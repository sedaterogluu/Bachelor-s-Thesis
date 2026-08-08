#include <TM1637Display.h>

TM1637Display display1(11, 12);
TM1637Display display2(13, A0);
TM1637Display display3(A1, A2);

int K1_R = 2, K1_Y = 3, K1_G = 4;
int K2_R = 5, K2_Y = 6, K2_G = 7;
int K3_R = 8, K3_Y = 9, K3_G = 10;

int sure1 = 10, sure2 = 10, sure3 = 20;
int yeniSure1 = 10, yeniSure2 = 10, yeniSure3 = 20;

int sariSure = 3;
int guvenlikSure = 2;

bool sistemBasladi = false;

void setup() {
  Serial.begin(115200);

  pinMode(K1_R, OUTPUT); pinMode(K1_Y, OUTPUT); pinMode(K1_G, OUTPUT);
  pinMode(K2_R, OUTPUT); pinMode(K2_Y, OUTPUT); pinMode(K2_G, OUTPUT);
  pinMode(K3_R, OUTPUT); pinMode(K3_Y, OUTPUT); pinMode(K3_G, OUTPUT);

  display1.setBrightness(7);
  display2.setBrightness(7);
  display3.setBrightness(7);

  beklemeModu();
}

void loop() {
  while (!sistemBasladi) {
    beklemeModu();

    if (Serial.available()) {
      String veri = Serial.readStringUntil('\n');
      veri.trim();

      if (veri == "START") {
        sistemBasladi = true;
        Serial.println("READY");
        delay(500);
      }
    }

    delay(100);
  }

  seriVeriOku();

  sure1 = yeniSure1;
  sure2 = yeniSure2;
  sure3 = yeniSure3;

  kavsakCalistir(1, sure1);
  kavsakCalistir(2, sure2);
  kavsakCalistir(3, sure3);
}

void seriVeriOku() {
  while (Serial.available()) {
    String veri = Serial.readStringUntil('\n');
    veri.trim();

    if (veri == "START") {
      sistemBasladi = true;
      continue;
    }

    int s1, s2, s3;

    if (sscanf(veri.c_str(), "%d,%d,%d", &s1, &s2, &s3) == 3) {
      yeniSure1 = constrain(s1, 5, 60);
      yeniSure2 = constrain(s2, 5, 60);
      yeniSure3 = constrain(s3, 5, 60);
    }
  }
}

void kavsakCalistir(int aktif, int yesilSure) {
  tumKirmizi();

  if (aktif == 1) {
    digitalWrite(K1_R, LOW);
    digitalWrite(K1_G, HIGH);
  } 
  else if (aktif == 2) {
    digitalWrite(K2_R, LOW);
    digitalWrite(K2_G, HIGH);
  } 
  else {
    digitalWrite(K3_R, LOW);
    digitalWrite(K3_G, HIGH);
  }

  for (int kalan = yesilSure; kalan >= 0; kalan--) {
    seriVeriOku();
    sayaclariGosterVeGonder(aktif, kalan);
    delay(1000);
  }

  yesilKapat(aktif);
  sariYak(aktif);

  for (int kalan = sariSure; kalan >= 0; kalan--) {
    seriVeriOku();
    sayaclariGosterVeGonder(aktif, kalan);
    delay(1000);
  }

  sariKapat(aktif);
  tumKirmizi();

  for (int kalan = guvenlikSure; kalan >= 0; kalan--) {
    seriVeriOku();
    sayaclariGosterVeGonder(aktif, kalan);
    delay(1000);
  }
}

void sayaclariGosterVeGonder(int aktif, int kalan) {
  int gecis = sariSure + guvenlikSure;
  int d1, d2, d3;

  if (aktif == 1) {
    d1 = kalan;
    d2 = kalan + gecis;
    d3 = kalan + gecis + sure2 + gecis;
  } 
  else if (aktif == 2) {
    d2 = kalan;
    d3 = kalan + gecis;
    d1 = kalan + gecis + sure3 + gecis;
  } 
  else {
    d3 = kalan;
    d1 = kalan + gecis;
    d2 = kalan + gecis + sure1 + gecis;
  }

  display1.showNumberDec(d1, true);
  display2.showNumberDec(d2, true);
  display3.showNumberDec(d3, true);

  Serial.print("STATE,");
  Serial.print(aktif);
  Serial.print(",");
  Serial.print(d1);
  Serial.print(",");
  Serial.print(d2);
  Serial.print(",");
  Serial.println(d3);
}

void beklemeModu() {
  tumKirmizi();
  display1.showNumberDec(0, true);
  display2.showNumberDec(0, true);
  display3.showNumberDec(0, true);
}

void tumKirmizi() {
  digitalWrite(K1_R, HIGH); digitalWrite(K1_Y, LOW); digitalWrite(K1_G, LOW);
  digitalWrite(K2_R, HIGH); digitalWrite(K2_Y, LOW); digitalWrite(K2_G, LOW);
  digitalWrite(K3_R, HIGH); digitalWrite(K3_Y, LOW); digitalWrite(K3_G, LOW);
}

void yesilKapat(int kavsak) {
  if (kavsak == 1) digitalWrite(K1_G, LOW);
  if (kavsak == 2) digitalWrite(K2_G, LOW);
  if (kavsak == 3) digitalWrite(K3_G, LOW);
}

void sariYak(int kavsak) {
  if (kavsak == 1) digitalWrite(K1_Y, HIGH);
  if (kavsak == 2) digitalWrite(K2_Y, HIGH);
  if (kavsak == 3) digitalWrite(K3_Y, HIGH);
}

void sariKapat(int kavsak) {
  if (kavsak == 1) digitalWrite(K1_Y, LOW);
  if (kavsak == 2) digitalWrite(K2_Y, LOW);
  if (kavsak == 3) digitalWrite(K3_Y, LOW);
}