import Database from 'better-sqlite3';
import { getDb } from '../database/connection';

export class SettingsService {
  get(key: string): string | null {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  set(key: string, value: string): void {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }

  delete(key: string): void {
    const db = getDb();
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getAll(): Record<string, string> {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  has(key: string): boolean {
    const db = getDb();
    const row = db.prepare('SELECT 1 FROM settings WHERE key = ?').get(key);
    return !!row;
  }
}
