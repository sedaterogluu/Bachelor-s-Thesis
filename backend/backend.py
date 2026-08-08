import os
import cv2
import math
import time
import base64
import threading
import numpy as np
import serial

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from ultralytics import YOLO

try:
    import torch
except ImportError:
    torch = None


# =========================
# AYARLAR
# =========================

TRAINED_MODEL_PATH = r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\runs\detect\trafik_modeli_v3\weights\best.pt"

VIDEO_PATHS = [
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\test_video1.mp4",
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\gece_video.mp4",
    r"C:\Users\serog\OneDrive\Masaüstü\Hepsi\tez\kirmizi4.mp4"
]

ARDUINO_PORT = "COM7"
BAUD_RATE = 115200

FRAME_ATLEME = 3
VERI_GONDERME_ARALIGI = 5

MIN_YESIL = 10
ORTA_YESIL = 20
MAX_YESIL = 35

KAMERA_ISIMLERI = ["KUZEY KAVŞAĞI", "GÜNEY KAVŞAĞI", "DOĞU KAVŞAĞI"]


# =========================
# FLASK + SOCKET.IO
# =========================

app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False
)

system_thread = None
system_running = False
system_lock = threading.Lock()


# =========================
# ARAÇ TAKİP SINIFI
# =========================

class MerkezTakip:
    def __init__(self, tolerans_piksel=50, hareket_esigi=3):
        self.tolerans = tolerans_piksel
        self.hareket_esigi = hareket_esigi
        self.hafiza = []

    def hareketli_araclari_say(self, yeni_kutular):
        hareketli_sayi = 0
        yeni_hafiza = []

        for kutu in yeni_kutular:
            x1, y1, x2, y2 = kutu.xyxy[0]
            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            eslesti = False

            for eski in self.hafiza:
                eski_cx, eski_cy = eski["merkez"]
                mesafe = math.hypot(cx - eski_cx, cy - eski_cy)

                if mesafe < self.tolerans:
                    eslesti = True
                    hareket_miktari = math.hypot(cx - eski_cx, cy - eski_cy)

                    if hareket_miktari >= self.hareket_esigi:
                        hareketli_sayi += 1

                    yeni_hafiza.append({"merkez": (cx, cy)})
                    break

            if not eslesti:
                hareketli_sayi += 1
                yeni_hafiza.append({"merkez": (cx, cy)})

        self.hafiza = yeni_hafiza
        return hareketli_sayi


# =========================
# YARDIMCI FONKSİYONLAR
# =========================

def log(level, msg):
    print(f"[{level}] {msg}", flush=True)


def sure_hesapla(arac_sayisi):
    if arac_sayisi <= 5:
        return MIN_YESIL
    elif arac_sayisi <= 15:
        return ORTA_YESIL
    return MAX_YESIL


def yogunluk_metni(arac_sayisi):
    if arac_sayisi <= 5:
        return "DUSUK"
    elif arac_sayisi <= 15:
        return "ORTA"
    return "YUKSEK"


def turkce_durum(durum):
    if durum == "YESIL":
        return "YEŞİL"
    if durum == "SARI":
        return "SARI"
    return "KIRMIZI"


def frame_to_base64(frame):
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
    if not ok:
        return None
    return base64.b64encode(buffer).decode("utf-8")


def arduino_state_oku(arduino, aktif_kavsak, sayaclar, sistem_modu):
    if arduino is None:
        return aktif_kavsak, sayaclar, sistem_modu

    try:
        while arduino.in_waiting > 0:
            satir = arduino.readline().decode("utf-8", errors="ignore").strip()
            if not satir:
                continue

            log("ARDUINO", satir)

            if satir.startswith("STATE"):
                parcalar = satir.split(",")

                if len(parcalar) >= 5:
                    aktif_kavsak = int(parcalar[1]) - 1
                    sayaclar = [
                        int(parcalar[2]),
                        int(parcalar[3]),
                        int(parcalar[4])
                    ]

                    if len(parcalar) >= 6:
                        sistem_modu = parcalar[5]

            elif satir.startswith("MODE"):
                parcalar = satir.split(",")
                if len(parcalar) == 2:
                    sistem_modu = parcalar[1]

    except Exception as e:
        log("WARN", f"Arduino okuma hatasi: {e}")

    return aktif_kavsak, sayaclar, sistem_modu


def guvenli_kapat(caps, arduino):
    global system_running

    if arduino is not None:
        try:
            arduino.write(b"STOP\n")
            time.sleep(0.5)
            log("OK", "Arduino'ya STOP gonderildi.")
        except Exception as e:
            log("WARN", f"Arduino STOP hatasi: {e}")

    for cap in caps:
        try:
            cap.release()
        except Exception:
            pass

    if arduino is not None:
        try:
            arduino.close()
        except Exception:
            pass

    with system_lock:
        system_running = False

    log("INFO", "Sistem dongusu kapatildi.")


# =========================
# API VE SOCKET EVENTLERİ
# =========================

@app.route("/")
def home():
    return jsonify({
        "status": "ok",
        "message": "ATOM Python Backend calisiyor.",
        "react": "http://localhost:5173",
        "socket": "http://localhost:5000"
    })


@app.route("/api/videos")
def api_videos():
    return jsonify([
        {
            "id": i,
            "name": KAMERA_ISIMLERI[i],
            "path": VIDEO_PATHS[i],
            "exists": os.path.exists(VIDEO_PATHS[i])
        }
        for i in range(3)
    ])


@socketio.on("connect")
def handle_connect():
    log("OK", "React arayuz backend'e baglandi.")
    emit("initial_videos", {
        "videos": [
            {"id": i, "name": KAMERA_ISIMLERI[i]}
            for i in range(3)
        ]
    })


@socketio.on("disconnect")
def handle_disconnect():
    log("WARN", "React arayuz backend baglantisi kesildi.")


@socketio.on("start_system")
def handle_start_system():
    global system_thread, system_running

    with system_lock:
        if system_running:
            log("WARN", "Sistem zaten calisiyor.")
            return

        system_running = True

    log("INFO", "Sistem baslatma komutu alindi.")

    system_thread = threading.Thread(target=system_loop, daemon=True)
    system_thread.start()


@socketio.on("manual_override")
def handle_manual_override(data):
    log("INFO", f"Manuel mudahale istegi: {data}")


# =========================
# ANA SİSTEM DÖNGÜSÜ
# =========================

def system_loop():
    global system_running

    device = "0" if torch is not None and torch.cuda.is_available() else "cpu"

    log("INFO", "--- 3 KAVSAKLI AKILLI TRAFIK SISTEMI BASLATILIYOR ---")
    log("INFO", f"Cihaz: {device}")

    if not os.path.exists(TRAINED_MODEL_PATH):
        log("ERROR", f"Model bulunamadi: {TRAINED_MODEL_PATH}")
        with system_lock:
            system_running = False
        return

    for path in VIDEO_PATHS:
        if not os.path.exists(path):
            log("ERROR", f"Video dosyasi bulunamadi: {path}")
            with system_lock:
                system_running = False
            return

    model = YOLO(TRAINED_MODEL_PATH)
    log("OK", "YOLO modeli yuklendi.")

    arduino = None

    try:
        arduino = serial.Serial(
            ARDUINO_PORT,
            BAUD_RATE,
            timeout=0.1
        )

        time.sleep(2)
        arduino.reset_input_buffer()
        arduino.reset_output_buffer()
        arduino.write(b"START\n")
        time.sleep(0.5)

        log("OK", f"Arduino baglandi: {ARDUINO_PORT}")
        log("OK", "Arduino'ya START gonderildi.")

    except Exception as e:
        log("WARN", "Arduino baglanamadi. Sistem Arduino olmadan calisacak.")
        log("WARN", str(e))
        arduino = None

    caps = []

    for path in VIDEO_PATHS:
        cap = cv2.VideoCapture(path)

        if not cap.isOpened():
            log("ERROR", f"Video acilamadi: {path}")
            guvenli_kapat(caps, arduino)
            return

        caps.append(cap)

    log("OK", "3 video basariyla acildi.")

    takipler = [
        MerkezTakip(hareket_esigi=3),
        MerkezTakip(hareket_esigi=3),
        MerkezTakip(hareket_esigi=3)
    ]

    frame_sayaci = 0
    son_gonderim_zamani = 0

    arac_sayilari = [0, 0, 0]
    yeni_sureler = [10, 10, 20]

    arduino_aktif_kavsak = 0
    arduino_sayaclar = [0, 10, 20]
    sistem_modu = "SMART"

    sim_aktif_kavsak = 0
    sim_baslangic = time.time()
    sim_sureler = [10, 10, 20]

    try:
        while True:
            with system_lock:
                if not system_running:
                    break

            arduino_aktif_kavsak, arduino_sayaclar, sistem_modu = arduino_state_oku(
                arduino,
                arduino_aktif_kavsak,
                arduino_sayaclar,
                sistem_modu
            )

            if arduino is None:
                gecen = int(time.time() - sim_baslangic)
                aktif_sure = sim_sureler[sim_aktif_kavsak]
                kalan = max(0, aktif_sure - gecen)

                if sim_aktif_kavsak == 0:
                    arduino_aktif_kavsak = 0
                    arduino_sayaclar = [kalan, kalan, kalan + sim_sureler[1]]
                elif sim_aktif_kavsak == 1:
                    arduino_aktif_kavsak = 1
                    arduino_sayaclar = [kalan + sim_sureler[2], kalan, kalan]
                else:
                    arduino_aktif_kavsak = 2
                    arduino_sayaclar = [kalan, kalan + sim_sureler[0], kalan]

                if kalan <= 0:
                    sim_aktif_kavsak = (sim_aktif_kavsak + 1) % 3
                    sim_baslangic = time.time()
                    sim_sureler = yeni_sureler.copy()

            frames = []

            for cap in caps:
                ret, frame = cap.read()

                if not ret:
                    for c in caps:
                        c.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    frames = []
                    break

                frame = cv2.resize(frame, (640, 360))
                frames.append(frame)

            if len(frames) != 3:
                continue

            frame_sayaci += 1

            if frame_sayaci % FRAME_ATLEME != 0:
                time.sleep(0.01)
                continue

            results = model(frames, verbose=False, conf=0.40, iou=0.45)

            arac_sayilari = []

            for i, r in enumerate(results):
                hareketli_arac = takipler[i].hareketli_araclari_say(r.boxes)
                arac_sayilari.append(hareketli_arac)

            yeni_sureler = [
                sure_hesapla(arac_sayilari[0]),
                sure_hesapla(arac_sayilari[1]),
                sure_hesapla(arac_sayilari[2])
            ]

            su_an = time.time()

            if sistem_modu == "SMART" and su_an - son_gonderim_zamani >= VERI_GONDERME_ARALIGI:
                veri = f"{yeni_sureler[0]},{yeni_sureler[1]},{yeni_sureler[2]}\n"

                if arduino is not None:
                    try:
                        arduino.write(veri.encode())
                        log("OK", f"Arduino'ya gonderildi: {veri.strip()}")
                    except Exception as e:
                        log("WARN", f"Arduino veri gonderme hatasi: {e}")

                son_gonderim_zamani = su_an

            toplam_arac = sum(arac_sayilari)
            ortalama_bekleme = int(sum(arduino_sayaclar) / 3)
            throughput = toplam_arac * 12

            socketio.emit("system_update", {
                "active_vehicles": toplam_arac,
                "algorithm_status": sistem_modu if sistem_modu else "ACTIVE",
                "avg_wait_time": ortalama_bekleme,
                "throughput": throughput
            })

            for i, r in enumerate(results):
                annotated = r.plot(labels=True, boxes=True, conf=True)
                h, w, _ = annotated.shape

                arac_sayisi = arac_sayilari[i]
                yogunluk = yogunluk_metni(arac_sayisi)
                sayac = max(0, int(arduino_sayaclar[i]))

                if i == arduino_aktif_kavsak:
                    durum = "YESIL"
                else:
                    durum = "KIRMIZI"

                # Sağ alt mini bilgi etiketi
                # Videoda sadece yoğunluk ve sistem modu gösterilir.
                panel_w = 140
                panel_h = 24

                panel_x1 = w - panel_w - 12
                panel_y1 = h - 62
                panel_x2 = w - 12
                panel_y2 = panel_y1 + panel_h

                overlay = annotated.copy()

                cv2.rectangle(
                    overlay,
                    (panel_x1, panel_y1),
                    (panel_x2, panel_y2),
                    (20, 20, 20),
                    -1
                )

                annotated = cv2.addWeighted(
                    overlay,
                    0.70,
                    annotated,
                    0.30,
                    0
                )

                if yogunluk == "DUSUK":
                    bilgi_renk = (0, 255, 0)
                elif yogunluk == "ORTA":
                    bilgi_renk = (0, 255, 255)
                else:
                    bilgi_renk = (0, 0, 255)

                cv2.putText(
                    annotated,
                    f"{yogunluk} | {sistem_modu}",
                    (panel_x1 + 7, panel_y1 + 16),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.34,
                    bilgi_renk,
                    1,
                    cv2.LINE_AA
                )

                img_base64 = frame_to_base64(annotated)

                if img_base64 is not None:
                    socketio.emit("camera_update", {
                        "camera_id": i,
                        "vehicles": int(arac_sayisi),
                        "light_status": turkce_durum(durum),
                        "light_timer": int(sayac),
                        "label": 7,
                        "image": img_base64
                    })

            socketio.sleep(0.03)

    except Exception as e:
        log("ERROR", f"Sistem dongusu hatasi: {e}")

    finally:
        guvenli_kapat(caps, arduino)


# =========================
# PROGRAM BAŞLANGICI
# =========================

if __name__ == "__main__":
    print("==========================================")
    print("ATOM PYTHON BACKEND")
    print("Backend adresi: http://localhost:5000")
    print("React adresi genelde: http://localhost:5173")
    print("React'te SISTEMI BASLAT butonuna basinca model/video/Arduino calisir.")
    print("==========================================")

    socketio.run(
        app,
        host="0.0.0.0",
        port=5000,
        debug=False,
        allow_unsafe_werkzeug=True
    )