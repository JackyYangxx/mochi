import { vi, describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const testDb = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('../../src/database/connection', () => ({
  getDb: () => {
    if (!testDb.current) throw new Error('test db not initialized');
    return testDb.current;
  },
}));

import { CalendarService } from '../../src/services/CalendarService';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      is_completed INTEGER DEFAULT 0,
      parent_id TEXT DEFAULT NULL,
      notes TEXT DEFAULT NULL
    );
  `);
  return db;
}

function insertCompleted(db: Database.Database, id: string, completedAt: string, content = 'task', parentId: string | null = null, notes: string | null = null): void {
  db.prepare(
    `INSERT INTO todos (id, content, sort_order, created_at, updated_at, completed_at, is_completed, parent_id, notes)
     VALUES (?, ?, 0, ?, ?, ?, 1, ?, ?)`
  ).run(id, content, completedAt, completedAt, completedAt, parentId, notes);
}

describe('CalendarService', () => {
  let db: Database.Database;
  let svc: CalendarService;

  beforeEach(() => {
    db = setupDb();
    testDb.current = db;
    svc = new CalendarService();
  });

  describe('getMonthStats', () => {
    it('returns empty array when no completions in month', () => {
      expect(svc.getMonthStats(2026, 6)).toEqual([]);
    });

    it('aggregates completions by local day', () => {
      insertCompleted(db, 'a', '2026-06-15T09:00:00');
      insertCompleted(db, 'b', '2026-06-15T14:30:00');
      insertCompleted(db, 'c', '2026-06-15T23:59:00');
      insertCompleted(db, 'd', '2026-06-20T10:00:00');
      insertCompleted(db, 'e', '2026-05-31T23:59:00');
      insertCompleted(db, 'f', '2026-07-01T00:00:01');

      const stats = svc.getMonthStats(2026, 6);
      expect(stats).toEqual([
        { day: 15, count: 3 },
        { day: 20, count: 1 },
      ]);
    });

    it('handles December → January year boundary', () => {
      insertCompleted(db, 'a', '2025-12-31T23:00:00');
      insertCompleted(db, 'b', '2026-01-01T01:00:00');

      expect(svc.getMonthStats(2025, 12)).toEqual([{ day: 31, count: 1 }]);
      expect(svc.getMonthStats(2026, 1)).toEqual([{ day: 1, count: 1 }]);
    });

    it('counts subtasks independently', () => {
      insertCompleted(db, 'parent', '2026-06-10T09:00:00', 'parent task');
      insertCompleted(db, 'child1', '2026-06-10T10:00:00', 'child 1', 'parent');
      insertCompleted(db, 'child2', '2026-06-10T11:00:00', 'child 2', 'parent');

      const stats = svc.getMonthStats(2026, 6);
      expect(stats).toEqual([{ day: 10, count: 3 }]);
    });

    it('ignores incomplete todos', () => {
      db.prepare(
        `INSERT INTO todos (id, content, is_completed, completed_at) VALUES (?, ?, 0, NULL)`
      ).run('x', 'still open');

      expect(svc.getMonthStats(2026, 6)).toEqual([]);
    });

    it('ignores NULL completed_at even when is_completed=1', () => {
      db.prepare(
        `INSERT INTO todos (id, content, is_completed, completed_at) VALUES (?, ?, 1, NULL)`
      ).run('x', 'weird row');

      expect(svc.getMonthStats(2026, 6)).toEqual([]);
    });
  });

  describe('getYearHeatmap', () => {
    it('returns stats across the full year', () => {
      insertCompleted(db, 'a', '2026-01-15T09:00:00');
      insertCompleted(db, 'b', '2026-06-15T09:00:00');
      insertCompleted(db, 'c', '2026-06-15T10:00:00');
      insertCompleted(db, 'd', '2026-12-31T23:00:00');
      insertCompleted(db, 'e', '2027-01-01T00:00:01');

      const heatmap = svc.getYearHeatmap(2026);
      expect(heatmap).toEqual([
        { date: '2026-01-15', count: 1 },
        { date: '2026-06-15', count: 2 },
        { date: '2026-12-31', count: 1 },
      ]);
    });

    it('returns empty array for year with no completions', () => {
      expect(svc.getYearHeatmap(2026)).toEqual([]);
    });
  });

  describe('getDayTodos', () => {
    it('returns todos completed on a given local day, sorted by completion time asc', () => {
      insertCompleted(db, 'a', '2026-06-15T09:00:00', 'morning');
      insertCompleted(db, 'b', '2026-06-15T14:00:00', 'afternoon');
      insertCompleted(db, 'c', '2026-06-14T23:00:00', 'yesterday');

      const todos = svc.getDayTodos('2026-06-15');
      expect(todos).toHaveLength(2);
      expect(todos[0]).toMatchObject({ id: 'a', content: 'morning', parentId: null });
      expect(todos[1]).toMatchObject({ id: 'b', content: 'afternoon', parentId: null });
      expect(todos[0].completedAt).toBe('2026-06-15T09:00:00');
    });

    it('returns empty array for day with no completions', () => {
      expect(svc.getDayTodos('2026-06-15')).toEqual([]);
    });

    it('returns subtasks with their parentId set', () => {
      insertCompleted(db, 'p', '2026-06-15T09:00:00', 'parent');
      insertCompleted(db, 'c', '2026-06-15T10:00:00', 'child', 'p');

      const todos = svc.getDayTodos('2026-06-15');
      expect(todos).toHaveLength(2);
      expect(todos.find(t => t.id === 'c')?.parentId).toBe('p');
    });

    it('returns notes for each todo (null when unset, string when set)', () => {
      insertCompleted(db, 'a', '2026-06-15T09:00:00', 'no-notes');
      insertCompleted(db, 'b', '2026-06-15T10:00:00', 'has-notes', null, '这是今天的总结');

      const todos = svc.getDayTodos('2026-06-15');
      expect(todos.find(t => t.id === 'a')?.notes).toBeNull();
      expect(todos.find(t => t.id === 'b')?.notes).toBe('这是今天的总结');
    });
  });
});