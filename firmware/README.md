# ESP32 firmware setup

1. Follow the no-Docker PostgreSQL, backend, and frontend setup in the project [README](../README.md). Confirm `http://localhost:4000/api/health` reports a connected database before continuing.
2. Install ESP32 board support in Arduino IDE and install `DHT sensor library`, `Adafruit Unified Sensor`, and `ArduinoJson`.
3. Edit Wi-Fi name/password and `SERVER_URL` in `esp32_cassava_monitor.ino`. Set `SERVER_URL` to `http://<computer-LAN-IP>:4000/api/readings`; do not use `localhost` because it refers to the ESP32 itself.
4. Connect DHT22 DATA to GPIO 4, VCC to 3V3, and GND to GND. Connect the capacitive soil sensor analog output to GPIO 34 with a common GND. GPIO34 is input-only; keep its voltage within ESP32 ADC limits and never connect 5V to it. A bare DHT22 needs a 4.7k–10k pull-up resistor from DATA to 3V3.
5. Upload the sketch, open Serial Monitor at 115200 baud, and check the POST status. The backend should save each reading and the dashboard should display it within 15 seconds.
6. Calibrate `SOIL_DRY_RAW` and `SOIL_WET_RAW` using your actual sensor and soil; the included values are examples only.

The backend expects JSON like:
`{"deviceId":"ESP32-001","temperature":26.8,"humidity":71.2,"soilMoisture":45}`

Keep the ESP32 and computer on the same network, and allow inbound TCP port 4000 through the computer's firewall for that private network. The supplied sketch has no authentication or HTTPS; do not expose the API to the public internet.
