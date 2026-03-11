import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

let db: any;

try {
  db = new Database('farm.db');
} catch (err: any) {
  console.warn('Failed to open farm.db in current directory, falling back to /tmp:', err.message);
  db = new Database(path.join(os.tmpdir(), 'farm.db'));
}

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    crop_type TEXT CHECK(crop_type IN ('Tomato', 'Onion')) NOT NULL,
    planting_date TEXT NOT NULL,
    area_size REAL DEFAULT 1.0,
    status TEXT DEFAULT 'Active',
    expected_yield_kg REAL DEFAULT 0,
    actual_yield_kg REAL DEFAULT 0,
    irrigation_status TEXT DEFAULT 'Off' CHECK(irrigation_status IN ('Off', 'Running'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER NOT NULL,
    task_type TEXT CHECK(task_type IN ('Irrigation', 'Fertigation', 'Scouting')) NOT NULL,
    scheduled_time TEXT NOT NULL,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'Pending',
    reasoning TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zone_id) REFERENCES zones (id)
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'Info',
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    profile_image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    sess TEXT NOT NULL,
    expire INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire);
`);

// Migration: Add missing columns if they don't exist (for existing databases)
const tableInfo = db.prepare("PRAGMA table_info(zones)").all() as any[];
const columnNames = tableInfo.map(c => c.name);

if (!columnNames.includes('expected_yield_kg')) {
  db.exec("ALTER TABLE zones ADD COLUMN expected_yield_kg REAL DEFAULT 0");
}
if (!columnNames.includes('actual_yield_kg')) {
  db.exec("ALTER TABLE zones ADD COLUMN actual_yield_kg REAL DEFAULT 0");
}
if (!columnNames.includes('irrigation_status')) {
  db.exec("ALTER TABLE zones ADD COLUMN irrigation_status TEXT DEFAULT 'Off' CHECK(irrigation_status IN ('Off', 'Running'))");
}

// Seed initial data if empty
const zonesCount = db.prepare('SELECT count(*) as count FROM zones').get() as { count: number };

if (zonesCount.count === 0) {
  const insertZone = db.prepare('INSERT INTO zones (name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?)');
  // Planted 30 days ago
  const date30DaysAgo = new Date();
  date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
  
  // Planted 60 days ago
  const date60DaysAgo = new Date();
  date60DaysAgo.setDate(date60DaysAgo.getDate() - 60);

  insertZone.run('Zone A', 'Tomato', date30DaysAgo.toISOString().split('T')[0], 2.5);
  insertZone.run('Zone B', 'Onion', date60DaysAgo.toISOString().split('T')[0], 2.5);
  
  console.log('Seeded initial zones.');
}

export default db;
