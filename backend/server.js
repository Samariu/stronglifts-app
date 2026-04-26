import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || join(__dirname, 'stronglifts.db');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    session_index INTEGER,
    workout_type TEXT,
    exercises TEXT,
    completed INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Settings
app.get('/api/settings', (_req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('config');
  if (!row) return res.json(null);
  res.json(JSON.parse(row.value));
});

app.post('/api/settings', (req, res) => {
  const settings = req.body;
  const now = Date.now();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    WHERE excluded.updated_at >= settings.updated_at
  `).run('config', JSON.stringify(settings), settings.updatedAt ?? now);
  res.json({ ok: true });
});

// Workouts
app.get('/api/workouts', (_req, res) => {
  const rows = db.prepare('SELECT * FROM sessions ORDER BY date ASC').all();
  res.json(rows.map((r) => ({
    id: r.id,
    date: r.date,
    sessionIndex: r.session_index,
    workoutType: r.workout_type,
    exercises: JSON.parse(r.exercises || '{}'),
    completed: !!r.completed,
    updatedAt: r.updated_at,
  })));
});

app.post('/api/workouts', (req, res) => {
  const s = req.body;
  const now = Date.now();
  db.prepare(`
    INSERT INTO sessions (id, date, session_index, workout_type, exercises, completed, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      exercises = excluded.exercises,
      completed = excluded.completed,
      updated_at = excluded.updated_at
    WHERE excluded.updated_at >= sessions.updated_at
  `).run(
    s.id, s.date, s.sessionIndex, s.workoutType,
    JSON.stringify(s.exercises || {}), s.completed ? 1 : 0,
    s.updatedAt ?? now
  );
  res.json({ ok: true });
});

// Serve the built frontend (run `npm run build` in frontend/ first)
const frontendDist = join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('/{*path}', (_req, res) => res.sendFile(join(frontendDist, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`StrongLifts running on :${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
