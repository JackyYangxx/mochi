import Database from 'better-sqlite3';

export const version = 3;

export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE todos ADD COLUMN notes TEXT DEFAULT NULL;
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    ALTER TABLE todos DROP COLUMN notes;
  `);
}
