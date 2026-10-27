CREATE TABLE IF NOT EXISTS farms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  location VARCHAR(180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'farmer' CHECK (role IN ('admin','agronomist','farmer')),
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(80) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT 'ESP32 Sensor Node',
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  last_seen TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(80) NOT NULL REFERENCES devices(device_id) ON UPDATE CASCADE ON DELETE CASCADE,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  soil_moisture DOUBLE PRECISION,
  light_intensity DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sensor_readings_recorded_at ON sensor_readings(recorded_at DESC);

CREATE TABLE IF NOT EXISTS predictions (
  id BIGSERIAL PRIMARY KEY,
  farm_id INTEGER REFERENCES farms(id) ON DELETE SET NULL,
  farm_name VARCHAR(120),
  image_path TEXT,
  original_filename TEXT,
  disease_class VARCHAR(80) NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  model_mode VARCHAR(30) NOT NULL DEFAULT 'demo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at DESC);
