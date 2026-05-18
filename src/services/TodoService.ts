import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

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
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  add(input: { content: string }): Todo {
    const content = input.content.trim();
    if (!content) {
      throw new Error('Content cannot be empty');
    }
    const truncated = content.length > 500 ? content.slice(0, 500) : content;
    const id = uuidv4();
    const now = new Date().toISOString();

    const maxSort = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM todos')
      .get() as { next: number };

    this.db
      .prepare(
        'INSERT INTO todos (id, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, truncated, maxSort.next, now, now);

    return rowToTodo(
      this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    );
  }

  getAll(): Todo[] {
    const rows = this.db
      .prepare('SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC')
      .all() as TodoRow[];
    return rows.map(rowToTodo);
  }

  toggle(id: string): Todo {
    const row = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    if (!row) throw new Error('Todo not found');

    const now = new Date().toISOString();
    const newCompleted = row.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted === 1 ? now : null;

    this.db
      .prepare('UPDATE todos SET is_completed = ?, completed_at = ?, updated_at = ? WHERE id = ?')
      .run(newCompleted, completedAt, now, id);

    return rowToTodo(
      this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  }

  search(query: string): Todo[] {
    const rows = this.db
      .prepare('SELECT * FROM todos WHERE content LIKE ? ORDER BY created_at DESC')
      .all(`%${query}%`) as TodoRow[];
    return rows.map(rowToTodo);
  }

  updateSortOrder(ids: string[]): void {
    const update = this.db.transaction(() => {
      ids.forEach((id, index) => {
        this.db!.prepare('UPDATE todos SET sort_order = ? WHERE id = ?').run(index, id);
      });
    });
    update();
  }
}
