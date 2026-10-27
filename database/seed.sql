INSERT INTO farms (name, location)
SELECT 'Demo Cassava Farm', 'Rwanda'
WHERE NOT EXISTS (SELECT 1 FROM farms WHERE name = 'Demo Cassava Farm');

INSERT INTO users (full_name, email, role, farm_id)
SELECT 'System Administrator', 'admin@example.com', 'admin', (SELECT id FROM farms WHERE name='Demo Cassava Farm' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='admin@example.com');

INSERT INTO users (full_name, email, role, farm_id)
SELECT 'Demo Farmer', 'farmer@example.com', 'farmer', (SELECT id FROM farms WHERE name='Demo Cassava Farm' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email='farmer@example.com');

INSERT INTO devices (device_id, name, farm_id, status, last_seen)
VALUES ('ESP32-001', 'Cassava Field Sensor 1', (SELECT id FROM farms WHERE name='Demo Cassava Farm' LIMIT 1), 'offline', NULL)
ON CONFLICT (device_id) DO NOTHING;
