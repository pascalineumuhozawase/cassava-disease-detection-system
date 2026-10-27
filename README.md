# Cassava Disease Detection System

This project connects a React/Vite frontend, an Express API, a local PostgreSQL database, and an ESP32 sensor. The local development setup below uses **no Docker**.

## What is connected

- The frontend reads dashboard, device, sensor, and prediction data from the backend REST API.
- The backend stores sensor readings and image-analysis records in PostgreSQL.
- The ESP32 sends DHT22 and soil-moisture readings to `POST /api/readings`.
- Vite proxies `/api` and `/uploads` to the local backend. The proxy target defaults to `http://localhost:4000`; set `VITE_API_PROXY_TARGET` only when the backend uses a different address.

> **Demo AI only:** `backend/src/services/predictionService.js` is a connectivity placeholder, not a trained cassava disease classifier. Do not use its demo result for agricultural decisions.

## Requirements

- Node.js 20 or newer and npm.
- PostgreSQL 15 or newer, installed as a Windows service, plus the `psql` command-line client. pgAdmin can also be used to run the SQL files.
- For hardware: Arduino IDE, ESP32 board support, `DHT sensor library`, `Adafruit Unified Sensor`, and `ArduinoJson`.

## Set up PostgreSQL (PowerShell, no Docker)

Install PostgreSQL and make sure its `bin` folder is on `PATH` (for example, `C:\Program Files\PostgreSQL\16\bin`). Open PowerShell in the project root and create the development role and database once:

```powershell
psql -U postgres
```

At the `postgres=#` prompt, run:

```sql
CREATE ROLE ems_user WITH LOGIN PASSWORD 'ems_password';
CREATE DATABASE environment_monitor OWNER ems_user;
\q
```

If the role or database already exists, skip its corresponding `CREATE` statement. Apply the project schema and demo records from the project root:

```powershell
psql -U ems_user -d environment_monitor -f .\database\schema.sql
psql -U ems_user -d environment_monitor -f .\database\seed.sql
```

To inspect the database with `psql`:

```powershell
psql -U ems_user -d environment_monitor
```

Useful commands at the `environment_monitor=>` prompt:

```sql
\dt
\d sensor_readings
SELECT device_id, temperature, humidity, soil_moisture, recorded_at
FROM sensor_readings
ORDER BY recorded_at DESC
LIMIT 10;
\q
```

The same database can be browsed in pgAdmin by connecting to `localhost:5432`, database `environment_monitor`, user `ems_user`.

## Start the application

Copy the backend environment template. Edit `backend\.env` if your PostgreSQL username, password, database, or ports differ:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Start the backend in one PowerShell window:

```powershell
Set-Location .\backend
npm install
npm run dev
```

Start the frontend in a second PowerShell window:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The API health check is at `http://localhost:4000/api/health`; it reports whether PostgreSQL is connected. The development frontend proxies API and uploaded-image requests to `http://localhost:4000`.

To check a sensor reading from PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/readings `
  -ContentType 'application/json' `
  -Body '{"deviceId":"ESP32-001","temperature":26.8,"humidity":71.2,"soilMoisture":45}'
```

This posts test data, not a physical sensor measurement.

## Connect the ESP32

1. Install the ESP32 board support and the libraries listed above.
2. Connect DHT22 DATA to GPIO 4, VCC to 3V3, and GND to GND. Connect the capacitive soil sensor analog output to GPIO 34 and share GND. GPIO34 is input-only; never apply 5V to it. A bare DHT22 needs a 4.7k–10k pull-up resistor between DATA and 3V3.
3. Open `firmware/esp32_cassava_monitor.ino`; set `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_URL`. Set the URL to `http://<computer-LAN-IP>:4000/api/readings`, not `localhost`—on the ESP32, `localhost` means the ESP32 itself. Find the computer's LAN address with `ipconfig`.
4. Keep the computer and ESP32 on the same network and allow inbound TCP port 4000 through the Windows firewall for that private network.
5. Upload the sketch, open Serial Monitor at 115200 baud, and confirm successful POST responses. The dashboard refreshes sensor and device data every 15 seconds.
6. Calibrate `SOIL_DRY_RAW` and `SOIL_WET_RAW` for the actual sensor and soil.

The optional light-intensity field is not measured by the supplied firmware because no light sensor is included.

## API routes

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/readings?limit=50&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/readings` JSON: `{ "deviceId":"ESP32-001", "temperature":26.8, "humidity":71.2, "soilMoisture":45 }`
- `GET /api/predictions?limit=50&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/predictions` multipart form fields: `image` (file), optional `farmName`, `notes`
- `GET /api/devices`
- `GET /api/admin/users`
- `GET /api/admin/stats`

## Security and deployment

This is a development starter, not a production-hardened service. It has no authentication. Before deploying publicly, add authentication and authorization, HTTPS, upload validation/scanning, backups, secret management, audit logging, and a validated disease model. Do not expose the development database password or the unauthenticated API to the public internet.
