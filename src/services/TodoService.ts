import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database/connection';

export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
}

interface TodoRow {
  id: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_completed: number;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    isCompleted: row.is_completed === 1,
  };
}

export class TodoService {
  add(input: { content: string }): Todo {
    const db = getDb();
    const content = input.content.trim();
    if (!content) {
      throw new Error('Content cannot be empty');
    }
    const truncated = content.length > 500 ? content.slice(0, 500) : content;
    const id = uuidv4();
    const now = new Date().toISOString();

    const maxSort = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM todos')
      .get() as { next: number };

    db
      .prepare(
        'INSERT INTO todos (id, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, truncated, maxSort.next, now, now);

    return rowToTodo(
      db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    );
  }

  getAll(): Todo[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC')
      .all() as TodoRow[];
    return rows.map(rowToTodo);
  }

  toggle(id: string): Todo {
    const db = getDb();
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    if (!row) throw new Error('Todo not found');

    const now = new Date().toISOString();
    const newCompleted = row.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted === 1 ? now : null;

    db
      .prepare('UPDATE todos SET is_completed = ?, completed_at = ?, updated_at = ? WHERE id = ?')
      .run(newCompleted, completedAt, now, id);

    return rowToTodo(
      db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    );
  }

  delete(id: string): void {
    const db = getDb();
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  }

  update(id: string, content: string): Todo {
    const db = getDb();
    const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    if (!row) throw new Error('Todo not found');

    const now = new Date().toISOString();
    const trimmed = content.trim().slice(0, 500);

    db.prepare('UPDATE todos SET content = ?, updated_at = ? WHERE id = ?').run(trimmed, now, id);

    return rowToTodo(db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow);
  }

  search(query: string): Todo[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM todos WHERE content LIKE ? ORDER BY created_at DESC')
      .all(`%${query}%`) as TodoRow[];
    return rows.map(rowToTodo);
  }

  updateSortOrder(ids: string[]): void {
    const db = getDb();
    const update = db.transaction(() => {
      ids.forEach((id, index) => {
        db.prepare('UPDATE todos SET sort_order = ? WHERE id = ?').run(index, id);
      });
    });
    update();
  }

  getByDateRange(startDate: string, endDate: string): Todo[] {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM todos WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC')
      .all(startDate, endDate) as TodoRow[];
    return rows.map(rowToTodo);
  }

  archiveCompletedByDate(date: string): Todo[] {
    const db = getDb();
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59.999`;
    const transaction = db.transaction(() => {
      const rows = db
        .prepare('SELECT * FROM todos WHERE is_completed = 1 AND created_at >= ? AND created_at <= ?')
        .all(startOfDay, endOfDay) as TodoRow[];
      db.prepare('DELETE FROM todos WHERE is_completed = 1 AND created_at >= ? AND created_at <= ?')
        .run(startOfDay, endOfDay);
      return rows.map(rowToTodo);
    });
    return transaction();
  }
}
