import Database from 'better-sqlite3';

export const version = 4;

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kb_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      enabled INTEGER NOT NULL DEFAULT 1,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS kb_files (
      path TEXT PRIMARY KEY,
      sha256 TEXT NOT NULL,
      last_ingested_at DATETIME,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS kb_ingest_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT NOT NULL,
      enqueued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS kb_pages (
      path TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      page_type TEXT NOT NULL,
      source_path TEXT,
      sha256 TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      content TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_kb_pages_type ON kb_pages(page_type);
    CREATE INDEX IF NOT EXISTS idx_kb_pages_source ON kb_pages(source_path);
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_kb_pages_source;
    DROP INDEX IF EXISTS idx_kb_pages_type;
    DROP TABLE IF EXISTS kb_pages;
    DROP TABLE IF EXISTS kb_ingest_queue;
    DROP TABLE IF EXISTS kb_files;
    DROP TABLE IF EXISTS kb_sources;
  `);
}
