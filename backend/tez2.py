import os
import cv2
import math
import time
import numpy as np
from ultralytics import YOLO

try:
    import torch
except ImportError:
    torch = None

# ==============================
# 1. DURUM FARKINDALIKLI HAREKET TAKİBİ
# ==============================
class MerkezTakip:
    def __init__(self, tolerans_piksel=40, park_siniri=50):
        self.tolerans = tolerans_piksel
        self.park_siniri = park_siniri
        self.hafiza = []

    def hareketli_araclari_say(self, yeni_kutular, isik_kirmizi=False):
        hareketli_sayi = 0
        yeni_hafiza = []

        for kutu in yeni_kutular:
            x1, y1, x2, y2 = kutu.xyxy[0]
            cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
            
            eslesti_mi = False
            for eski in self.hafiza:
                mesafe = math.hypot(cx - eski['merkez'][0], cy - eski['merkez'][1])
                
                if mesafe < self.tolerans: 
                    eslesti_mi = True
                    if isik_kirmizi:
                        yeni_sayac = eski['sayac']
                    else:
                        yeni_sayac = eski['sayac'] + 1
                        
                    yeni_hafiza.append({'merkez': (cx, cy), 'sayac': yeni_sayac})
                    
                    if yeni_sayac < self.park_siniri:
                        hareketli_sayi += 1
                    break
            
            if not eslesti_mi:
                yeni_hafiza.append({'merkez': (cx, cy), 'sayac': 0})
                hareketli_sayi += 1
        
        self.hafiza = yeni_hafiza
        return hareketli_sayi

# ==============================
# 2. YAPILANDIRMA VE YOLLAR
# ==============================
TRAINED_MODEL_PATH = r'runs\detect\trafik_modeli_v3\weights\best.pt' 

VIDEO_PATHS = [
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\gece_video.mp4",
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\gece_video1.mp4",
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\test_video.mp4",
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\test_video1.mp4"
]

def main():
    device = '0' if torch is not None and torch.cuda.is_available() else 'cpu'
    print(f"--- AKILLI KAVŞAK SİSTEMİ BAŞLATILIYOR (Cihaz: {device}) ---")
    print("(Arayüz frontend'de çalışmaktadır)\n")

    if os.path.exists(TRAINED_MODEL_PATH):
        model = YOLO(TRAINED_MODEL_PATH)
    else:
        print("HATA: Model bulunamadı!")
        return

    caps = [cv2.VideoCapture(path) for path in VIDEO_PATHS]
    takipler = [MerkezTakip(), MerkezTakip(), MerkezTakip(), MerkezTakip()]
    kamera_isimleri = ["KUZEY YONU", "GUNEY YONU", "DOGU YONU", "BATI YONU"]

    # --- VIDEO FRAME RATE AYARLARI (FPS yükseltme) ---
    for cap in caps:
        cap.set(cv2.CAP_PROP_FPS, 60)

    # --- SİSTEM DEĞİŞKENLERİ ---
    en_yogun_index = 0 
    frame_sayaci = 0
    FRAME_ATLEME = 1
    
    # --- KARARLILIK VE ADALET DEĞİŞKENLERİ ---
    bekleme_sureleri = [0, 0, 0, 0]
    BEKLEME_LIMITI = 600    
    MIN_YESIL_SURESI = 100  
    KARAR_ESIGI = 3         
    karar_kilidi_sayaci = 0 

    # --- ZAMANLAYICI VE SARI IŞIK DEĞİŞKENLERİ ---
    gecis_durumu = False          
    hedef_yogun_index = 0         
    SARI_SURESI = 3               
    zamanlayici_baslangic = time.time() 

    while True:
        frames = []
        for cap in caps:
            ret, frame = cap.read()
            if not ret: break
            frame = cv2.resize(frame, (640, 360))
            frames.append(frame)

        if len(frames) != 4: break

        frame_sayaci += 1 

        if frame_sayaci % FRAME_ATLEME == 0:
            results = model(frames, verbose=False, conf=0.15, iou=0.45, imgsz=640)
            
            arac_sayilari = []
            for i, r in enumerate(results):
                isik_kirmizi = (i != en_yogun_index) or gecis_durumu 
                aktif_arac_sayisi = takipler[i].hareketli_araclari_say(r.boxes, isik_kirmizi)
                arac_sayilari.append(aktif_arac_sayisi)
            
            for i in range(4):
                if i == en_yogun_index and not gecis_durumu: 
                    bekleme_sureleri[i] = 0
                else:
                    if arac_sayilari[i] > 0: bekleme_sureleri[i] += 1
                    else: bekleme_sureleri[i] = 0

            # --- KARAR MEKANİZMASI ---
            su_an = time.time()

            if gecis_durumu:
                gecen_sari_suresi = su_an - zamanlayici_baslangic
                if gecen_sari_suresi >= SARI_SURESI:
                    en_yogun_index = hedef_yogun_index
                    gecis_durumu = False
                    zamanlayici_baslangic = time.time() 
                    karar_kilidi_sayaci = MIN_YESIL_SURESI 
                    bekleme_sureleri[en_yogun_index] = 0
            else:
                if karar_kilidi_sayaci > 0:
                    karar_kilidi_sayaci -= 1
                else:
                    istenen_index = en_yogun_index
                    ac_kalanlar = [i for i in range(4) if bekleme_sureleri[i] > BEKLEME_LIMITI]
                    
                    if ac_kalanlar:
                        istenen_index = ac_kalanlar[0]
                    else:
                        potansiyel_yeni_index = np.argmax(arac_sayilari)
                        if arac_sayilari[potansiyel_yeni_index] > (arac_sayilari[en_yogun_index] + KARAR_ESIGI):
                            istenen_index = potansiyel_yeni_index
                    
                    if istenen_index != en_yogun_index:
                        gecis_durumu = True
                        hedef_yogun_index = istenen_index
                        zamanlayici_baslangic = time.time() 

            print(f"Yoğun Yol: {kamera_isimleri[en_yogun_index]} | Araç Sayıları: {arac_sayilari} | Bekleme: {bekleme_sureleri}")

    for cap in caps: cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()