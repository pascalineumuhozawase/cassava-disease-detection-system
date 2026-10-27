#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

// Wiring from the project diagram:
// DHT22 DATA -> GPIO 4, VCC -> 3V3, GND -> GND
// Capacitive soil moisture analog output -> GPIO 34, GND shared with ESP32
#define DHTPIN 4
#define DHTTYPE DHT22
#define SOIL_PIN 34

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
// Replace with the computer/server LAN IP, e.g. http://192.168.1.20:4000/api/readings
// Do not use localhost here: localhost would mean the ESP32 itself.
const char* SERVER_URL = "http://192.168.1.20:4000/api/readings";
const char* DEVICE_ID = "ESP32-001";

DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSend = 0;
const unsigned long SEND_INTERVAL_MS = 30000;

// Calibrate these two ADC readings for your own sensor and soil.
// Dry raw ADC value and wet raw ADC value are examples only.
const int SOIL_DRY_RAW = 3200;
const int SOIL_WET_RAW = 1400;

float readSoilMoisturePercent() {
  int raw = analogRead(SOIL_PIN);
  float pct = (float)(SOIL_DRY_RAW - raw) * 100.0f / (SOIL_DRY_RAW - SOIL_WET_RAW);
  return constrain(pct, 0.0f, 100.0f);
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected; IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Wi-Fi connection failed; will retry.");
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  analogReadResolution(12);
  connectWiFi();
}

void loop() {
  connectWiFi();
  if (millis() - lastSend < SEND_INTERVAL_MS) {
    delay(100);
    return;
  }
  lastSend = millis();

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  float soilMoisture = readSoilMoisturePercent();

  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("DHT22 read failed; skipping this upload.");
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("No Wi-Fi; readings were not sent.");
    return;
  }

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["soilMoisture"] = soilMoisture;
  // No light sensor is wired in the supplied diagram's core build.
  // Add a supported sensor before sending lightIntensity.
  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int status = http.POST(payload);
  Serial.printf("POST status: %d\n", status);
  if (status > 0) Serial.println(http.getString());
  else Serial.println(http.errorToString(status));
  http.end();
}
