import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';

let pgPool: any = null;
let sqliteDb: any = null;

const isPostgres = !!process.env.DATABASE_URL;

function convertParams(sql: string, params: any[]): { sql: string; params: any[] } {
  if (!isPostgres) return { sql, params };
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return { sql: converted, params };
}

function sqliteToPostgresSchema(sql: string): string {
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/AUTOINCREMENT/gi, '')
    .replace(/TEXT DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
    .replace(/INTEGER DEFAULT 1/gi, 'INTEGER DEFAULT 1')
    .replace(/CREATE INDEX IF NOT EXISTS/gi, 'CREATE INDEX IF NOT EXISTS');
}

async function initPostgres() {
  const { default: pg } = await import('pg');
  pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pgPool.on('error', (err: Error) => {
    console.error('[DB] Unexpected pool error:', err.message);
  });

  const client = await pgPool.connect();
  try {
    console.log('[DB] Connected to PostgreSQL (Cloud SQL)');
  } finally {
    client.release();
  }
}

function initSqlite() {
  try {
    sqliteDb = new Database('farm.db');
  } catch (err: any) {
    console.warn('Failed to open farm.db in current directory, falling back to /tmp:', err.message);
    sqliteDb = new Database(path.join(os.tmpdir(), 'farm.db'));
  }
  console.log('[DB] Using SQLite (local development)');
}

export async function dbAll(sql: string, ...params: any[]): Promise<any[]> {
  if (isPostgres) {
    const c = convertParams(sql, params);
    const result = await pgPool.query(c.sql, c.params);
    return result.rows;
  }
  return sqliteDb.prepare(sql).all(...params);
}

export async function dbGet(sql: string, ...params: any[]): Promise<any> {
  if (isPostgres) {
    const c = convertParams(sql, params);
    const result = await pgPool.query(c.sql, c.params);
    return result.rows[0] || null;
  }
  return sqliteDb.prepare(sql).get(...params) || null;
}

export async function dbRun(sql: string, ...params: any[]): Promise<{ lastInsertRowid: number; changes: number }> {
  if (isPostgres) {
    const c = convertParams(sql, params);
    let pgSql = c.sql;
    const isInsert = /^\s*INSERT/i.test(pgSql);
    if (isInsert && !/RETURNING/i.test(pgSql)) {
      pgSql += ' RETURNING id';
    }
    const result = await pgPool.query(pgSql, c.params);
    return {
      lastInsertRowid: result.rows?.[0]?.id ?? 0,
      changes: result.rowCount ?? 0,
    };
  }
  const info = sqliteDb.prepare(sql).run(...params);
  return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
}

export async function dbExec(sql: string): Promise<void> {
  if (isPostgres) {
    const pgSql = sqliteToPostgresSchema(sql);
    const statements = pgSql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await pgPool.query(stmt);
      } catch (err: any) {
        if (err.code === '42710' || err.code === '42P07') continue;
        console.warn(`[DB] Schema statement warning: ${err.message}`);
      }
    }
    return;
  }
  sqliteDb.exec(sql);
}

async function createSchema() {
  await dbExec(`
    CREATE TABLE IF NOT EXISTS zones (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      name TEXT NOT NULL,
      crop_type TEXT NOT NULL,
      planting_date TEXT NOT NULL,
      area_size REAL DEFAULT 1.0,
      status TEXT DEFAULT 'Active',
      expected_yield_kg REAL DEFAULT 0,
      actual_yield_kg REAL DEFAULT 0,
      irrigation_status TEXT DEFAULT 'Off' ${isPostgres ? '' : "CHECK(irrigation_status IN ('Off', 'Running'))"}
    )
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      zone_id INTEGER NOT NULL,
      task_type TEXT ${isPostgres ? '' : "CHECK(task_type IN ('Irrigation', 'Fertigation', 'Scouting'))"} NOT NULL,
      scheduled_time TEXT NOT NULL,
      duration_minutes INTEGER,
      status TEXT DEFAULT 'Pending',
      reasoning TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (zone_id) REFERENCES zones (id)
    )
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS logs (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      zone_id INTEGER,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'Info',
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT DEFAULT 'user' ${isPostgres ? '' : "CHECK(role IN ('admin', 'user'))"},
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  if (!isPostgres) {
    await dbExec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expire INTEGER NOT NULL
      )
    `);
    await dbExec(`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)`);
  }

  await dbExec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      user_id INTEGER NOT NULL,
      title TEXT DEFAULT 'New Conversation',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  await dbExec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id ${isPostgres ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${isPostgres ? '' : 'AUTOINCREMENT'},
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL ${isPostgres ? '' : "CHECK(role IN ('user', 'ai', 'system'))"},
      text TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
  `);
  await dbExec(`CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id)`);
}

async function runMigrations() {
  if (isPostgres) {
    const cols = await dbAll(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'zones'"
    );
    const colNames = cols.map((c: any) => c.column_name);
    if (colNames.length > 0 && !colNames.includes('expected_yield_kg')) {
      await pgPool.query("ALTER TABLE zones ADD COLUMN expected_yield_kg REAL DEFAULT 0");
    }
    if (colNames.length > 0 && !colNames.includes('actual_yield_kg')) {
      await pgPool.query("ALTER TABLE zones ADD COLUMN actual_yield_kg REAL DEFAULT 0");
    }
    if (colNames.length > 0 && !colNames.includes('irrigation_status')) {
      await pgPool.query("ALTER TABLE zones ADD COLUMN irrigation_status TEXT DEFAULT 'Off'");
    }

    const userCols = await dbAll(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    );
    const userColNames = userCols.map((c: any) => c.column_name);
    if (userColNames.length > 0 && !userColNames.includes('is_active')) {
      await pgPool.query("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
    }
    if (userColNames.length > 0 && !userColNames.includes('role')) {
      await pgPool.query("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    }
  } else {
    const tableInfo = sqliteDb.prepare("PRAGMA table_info(zones)").all() as any[];
    const columnNames = tableInfo.map((c: any) => c.name);
    if (!columnNames.includes('expected_yield_kg')) {
      sqliteDb.exec("ALTER TABLE zones ADD COLUMN expected_yield_kg REAL DEFAULT 0");
    }
    if (!columnNames.includes('actual_yield_kg')) {
      sqliteDb.exec("ALTER TABLE zones ADD COLUMN actual_yield_kg REAL DEFAULT 0");
    }
    if (!columnNames.includes('irrigation_status')) {
      sqliteDb.exec("ALTER TABLE zones ADD COLUMN irrigation_status TEXT DEFAULT 'Off' CHECK(irrigation_status IN ('Off', 'Running'))");
    }

    const checkSql = sqliteDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='zones'").get() as any;
    if (checkSql?.sql && checkSql.sql.includes("CHECK(crop_type IN")) {
      console.log('[DB] Migrating zones table to remove crop_type CHECK constraint...');
      sqliteDb.exec("ALTER TABLE zones RENAME TO zones_old");
      sqliteDb.exec(`
        CREATE TABLE zones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          crop_type TEXT NOT NULL,
          planting_date TEXT NOT NULL,
          area_size REAL DEFAULT 1.0,
          status TEXT DEFAULT 'Active',
          expected_yield_kg REAL DEFAULT 0,
          actual_yield_kg REAL DEFAULT 0,
          irrigation_status TEXT DEFAULT 'Off' CHECK(irrigation_status IN ('Off', 'Running'))
        )
      `);
      sqliteDb.exec("INSERT INTO zones SELECT * FROM zones_old");
      sqliteDb.exec("DROP TABLE zones_old");
      console.log('[DB] Zones table migrated successfully.');
    }

    const usersTableInfo = sqliteDb.prepare("PRAGMA table_info(users)").all() as any[];
    const usersColumns = usersTableInfo.map((c: any) => c.name);
    if (usersColumns.length > 0 && !usersColumns.includes('password_hash')) {
      sqliteDb.exec("DROP TABLE IF EXISTS users");
      sqliteDb.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    if (usersColumns.includes('password_hash') && !usersColumns.includes('role')) {
      sqliteDb.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user'))");
    }
    if (usersColumns.includes('password_hash') && !usersColumns.includes('is_active')) {
      sqliteDb.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
    }
  }
}

async function seedData() {
  const usersCount = await dbGet('SELECT count(*) as count FROM users');
  if (usersCount.count === 0 || usersCount.count === '0') {
    const hash = bcrypt.hashSync('admin123', 10);
    await dbRun(
      'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES (?, ?, ?, ?, ?)',
      'admin@bwanashamba.com', hash, 'Farm', 'Admin', 'admin'
    );
    console.log('[DB] Seeded default admin: admin@bwanashamba.com / admin123');
  }

  const zonesCount = await dbGet('SELECT count(*) as count FROM zones');
  if (zonesCount.count === 0 || zonesCount.count === '0') {
    const date30DaysAgo = new Date();
    date30DaysAgo.setDate(date30DaysAgo.getDate() - 30);
    const date60DaysAgo = new Date();
    date60DaysAgo.setDate(date60DaysAgo.getDate() - 60);

    await dbRun('INSERT INTO zones (name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?)',
      'Zone A', 'Tomato', date30DaysAgo.toISOString().split('T')[0], 2.5);
    await dbRun('INSERT INTO zones (name, crop_type, planting_date, area_size) VALUES (?, ?, ?, ?)',
      'Zone B', 'Onion', date60DaysAgo.toISOString().split('T')[0], 2.5);
    console.log('[DB] Seeded initial zones.');
  }
}

export async function initDatabase() {
  if (isPostgres) {
    await initPostgres();
  } else {
    initSqlite();
  }
  await createSchema();
  await runMigrations();
  await seedData();
  console.log('[DB] Database initialized successfully');
}

export function getSqliteDb() {
  return sqliteDb;
}

export function getPgPool() {
  return pgPool;
}

export { isPostgres };
