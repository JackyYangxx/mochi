import Database from 'better-sqlite3';

export const version = 2;

export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE todos ADD COLUMN parent_id TEXT DEFAULT NULL;
    CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);
    PRAGMA foreign_keys = ON;
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_todos_parent_id;
    ALTER TABLE todos DROP COLUMN parent_id;
  `);
}