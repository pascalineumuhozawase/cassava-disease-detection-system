import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { predictCassavaDisease } from './services/predictionService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4000);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
fs.mkdirSync(uploadDir, { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(',') || true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    cb(null, `${Date.now()}-${safe}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WEBP images are accepted.'));
    }
    cb(null, true);
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', predictionMode: process.env.PREDICTION_MODE || 'demo', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ status: 'error', database: 'disconnected', message: e.message });
  }
});

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const [readings, predictions, devices, classes] = await Promise.all([
      pool.query('SELECT * FROM sensor_readings ORDER BY recorded_at DESC LIMIT 1'),
      pool.query('SELECT * FROM predictions ORDER BY created_at DESC LIMIT 5'),
      pool.query("SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='online')::int AS online FROM devices"),
      pool.query('SELECT disease_class, COUNT(*)::int AS count FROM predictions GROUP BY disease_class ORDER BY count DESC')
    ]);
    const totalPredictions = await pool.query('SELECT COUNT(*)::int AS count FROM predictions');
    res.json({
      latestReading: readings.rows[0] || null,
      recentPredictions: predictions.rows,
      devices: devices.rows[0],
      totalPredictions: totalPredictions.rows[0].count,
      diseaseBreakdown: classes.rows,
      predictionMode: process.env.PREDICTION_MODE || 'demo'
    });
  } catch (e) { next(e); }
});

app.get('/api/readings', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 500);
    const params = [];
    let where = '';
    if (req.query.from) { params.push(req.query.from); where += ` AND recorded_at >= $${params.length}::date`; }
    if (req.query.to) { params.push(req.query.to); where += ` AND recorded_at < ($${params.length}::date + INTERVAL '1 day')`; }
    params.push(limit);
    const sql = `SELECT * FROM sensor_readings WHERE TRUE ${where} ORDER BY recorded_at DESC LIMIT $${params.length}`;
    res.json((await pool.query(sql, params)).rows);
  } catch (e) { next(e); }
});

app.post('/api/readings', async (req, res, next) => {
  try {
    const { deviceId = 'ESP32-001', temperature, humidity, soilMoisture, lightIntensity } = req.body || {};
    const values = [temperature, humidity, soilMoisture, lightIntensity];
    if (values.some(v => v !== undefined && v !== null && !Number.isFinite(Number(v)))) {
      return res.status(400).json({ error: 'Sensor readings must be numeric.' });
    }
    await pool.query(
      `INSERT INTO devices(device_id, name, status, last_seen)
       VALUES ($1, $2, 'online', NOW())
       ON CONFLICT(device_id) DO UPDATE SET status='online', last_seen=NOW()`,
      [deviceId, `${deviceId} sensor node`]
    );
    const result = await pool.query(
      `INSERT INTO sensor_readings(device_id, temperature, humidity, soil_moisture, light_intensity)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [deviceId, temperature ?? null, humidity ?? null, soilMoisture ?? null, lightIntensity ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
});

app.get('/api/predictions', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 500);
    const params = [];
    let where = '';
    if (req.query.from) { params.push(req.query.from); where += ` AND created_at >= $${params.length}::date`; }
    if (req.query.to) { params.push(req.query.to); where += ` AND created_at < ($${params.length}::date + INTERVAL '1 day')`; }
    params.push(limit);
    const result = await pool.query(`SELECT * FROM predictions WHERE TRUE ${where} ORDER BY created_at DESC LIMIT $${params.length}`, params);
    res.json(result.rows);
  } catch (e) { next(e); }
});

app.post('/api/predictions', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'An image file is required.' });
    const prediction = await predictCassavaDisease(req.file.path);
    const result = await pool.query(
      `INSERT INTO predictions(farm_name, image_path, original_filename, disease_class, confidence, model_mode, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.body.farmName || null, `/uploads/${req.file.filename}`, req.file.originalname,
       prediction.diseaseClass, prediction.confidence, prediction.modelMode, prediction.notes || req.body.notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) { next(e); }
});

app.get('/api/devices', async (_req, res, next) => {
  try {
    res.json((await pool.query(`
      SELECT d.*, r.temperature, r.humidity, r.soil_moisture, r.light_intensity, r.recorded_at AS last_reading_at
      FROM devices d LEFT JOIN LATERAL
        (SELECT * FROM sensor_readings sr WHERE sr.device_id=d.device_id ORDER BY recorded_at DESC LIMIT 1) r ON TRUE
      ORDER BY d.id
    `)).rows);
  } catch (e) { next(e); }
});

app.get('/api/admin/users', async (_req, res, next) => {
  try {
    res.json((await pool.query(`
      SELECT u.id, u.full_name, u.email, u.role, f.name AS farm_name, u.created_at
      FROM users u LEFT JOIN farms f ON f.id=u.farm_id ORDER BY u.id
    `)).rows);
  } catch (e) { next(e); }
});

app.get('/api/admin/stats', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM farms) AS farms,
        (SELECT COUNT(*)::int FROM devices) AS devices,
        (SELECT COUNT(*)::int FROM sensor_readings) AS readings,
        (SELECT COUNT(*)::int FROM predictions) AS predictions
    `);
    res.json(result.rows[0]);
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err instanceof multer.MulterError ? 400 : (err.status || 500);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => console.log(`Cassava backend listening on http://localhost:${PORT}`));
