import Database from 'better-sqlite3';

export const version = 2;

export function up(db: Database.Database): void {
  // Check if column already exists (may have been applied manually)
  const cols = db.prepare("PRAGMA table_info(todos)").all() as { name: string }[];
  const hasParentId = cols.some(c => c.name === 'parent_id');
  if (!hasParentId) {
    db.exec(`ALTER TABLE todos ADD COLUMN parent_id TEXT DEFAULT NULL;`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);`);
  db.pragma('foreign_keys = ON');
}

export function down(db: Database.Database): void {
  db.exec(`
    DROP INDEX IF EXISTS idx_todos_parent_id;
    ALTER TABLE todos DROP COLUMN parent_id;
  `);
}