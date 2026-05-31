import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

let db: Database.Database | null = null;
let isClosing = false;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'todos.db');
}

export function getDb(): Database.Database {
  if (!db) {
    log.error('[DB] getDb() called but db is null');
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  if (isClosing) {
    log.warn('[DB] getDb() called while isClosing=true, db state:', db ? 'still open' : 'already null');
    throw new Error('Database connection is closing');
  }
  return db;
}

export function initDatabase(): Database.Database {
  const dbPath = getDbPath();
  log.info(`Opening database at ${dbPath}`);

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } catch (err) {
    log.error('Failed to open database, attempting rebuild', err);
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
    } catch (rebuildErr) {
      log.error('Database rebuild failed', rebuildErr);
      throw rebuildErr;
    }
  }

  runMigrations(db);
  log.info('[DB] initDatabase complete');
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = db
    .prepare('SELECT version FROM migrations ORDER BY version')
    .all() as { version: number }[];

  const appliedVersions = new Set(applied.map((r) => r.version));

  const migrations = [
    require('./migrations/001_initial'),
    require('./migrations/002_add_parent_id'),
    require('./migrations/003_add_notes'),
  ];

  const migrateAll = db.transaction(() => {
    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        log.info(`Applying migration ${migration.version}`);
        migration.up(db);
        db.prepare('INSERT INTO migrations (version) VALUES (?)').run(migration.version);
      }
    }
  });

  migrateAll();
}

export function closeDatabase(): void {
  log.info('[DB] closeDatabase called, isClosing=true');
  isClosing = true;
  if (db) {
    db.close();
    db = null;
    log.info('[DB] db closed and set to null');
  }
  log.info('[DB] closeDatabase complete');
}
