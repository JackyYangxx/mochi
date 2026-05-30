# Subtask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add subtask support to todos - each todo can have child todos, rendered as a tree with expand/collapse.

**Architecture:** Add `parent_id` column to todos table. Top-level todos have `parent_id=NULL`, subtasks reference their parent. UI shows ▶/▼ toggle and "+" button on parent todos to add subtasks. Parent completion requires all subtasks complete first.

**Tech Stack:** React + TypeScript, CSS Modules, SQLite (better-sqlite3), Zustand

---

## File Structure

```
src/
├── database/migrations/
│   └── 002_add_parent_id.ts    # New migration
├── services/
│   └── TodoService.ts          # Update to handle parentId
src-renderer/
├── components/
│   ├── TodoItem.tsx            # Add expand/collapse, add subtask UI
│   ├── TodoItem.css            # Add indent, expand icon styles
│   ├── TodoList.tsx            # Add recursive rendering
│   └── TodoList.css            # (if needed)
├── store/
│   └── index.ts                # Update Todo type, add children handling
└── hooks/
    └── useTodos.ts             # Update to handle subtask operations
```

---

## Task 1: Database Migration

**Files:**
- Create: `src/database/migrations/002_add_parent_id.ts`

- [ ] **Step 1: Create migration file**

```typescript
import Database from 'better-sqlite3';

export const version = 2;

export function up(db: Database.Database): void {
  db.exec(`
    ALTER TABLE todos ADD COLUMN parent_id TEXT DEFAULT NULL;
    CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);
    PRAGMA foreign_keys = ON;
    PRAGMA foreign_keys;  -- verify it's on
  `);
}

export function down(db: Database.Database): void {
  db.exec(`
    ALTER TABLE todos DROP COLUMN parent_id;
    DROP INDEX IF EXISTS idx_todos_parent_id;
  `);
}
```

- [ ] **Step 2: Run migration and verify**

Run: `pnpm start` (to trigger migration)
Expected: Migration runs without error, new column exists

- [ ] **Step 3: Commit**

```bash
git add src/database/migrations/002_add_parent_id.ts
git commit -m "feat: add parent_id column for subtask support"
```

---

## Task 2: Update Todo Type and Store

**Files:**
- Modify: `src-renderer/store/index.ts`

- [ ] **Step 1: Update Todo interface in store**

Add `parentId` to Todo type:

```typescript
export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
  parentId: string | null;  // NEW
}
```

- [ ] **Step 2: Add children helper to store**

Add computed `children` array per todo (not stored, computed at runtime):

```typescript
// In the store, add a selector or computed:
export const selectChildrenByParentId = (state: TodoStore, parentId: string) =>
  state.todos.filter(t => t.parentId === parentId);
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/store/index.ts
git commit -m "feat: add parentId to Todo type"
```

---

## Task 3: Update TodoService

**Files:**
- Modify: `src/services/TodoService.ts`

- [ ] **Step 1: Update add() to accept parentId**

```typescript
add(input: { content: string; parentId?: string }): Todo {
  const db = getDb();
  const content = input.content.trim();
  if (!content) {
    throw new Error('Content cannot be empty');
  }
  const id = uuidv4();
  const now = new Date().toISOString();

  let maxSort: number;
  if (input.parentId) {
    // Get max sort order among siblings
    const result = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM todos WHERE parent_id = ?')
      .get(input.parentId) as { next: number };
    maxSort = result.next;
  } else {
    // Get max sort order among top-level todos
    const result = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM todos WHERE parent_id IS NULL')
      .get() as { next: number };
    maxSort = result.next;
  }

  db.prepare(
    'INSERT INTO todos (id, content, sort_order, created_at, updated_at, parent_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, content, maxSort, now, now, input.parentId || null);

  return rowToTodo(
    db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
  );
}
```

- [ ] **Step 2: Update getAll() to return todos with parentId**

`rowToTodo()` already handles `parent_id` via `parentId` field mapping. Verify rowToTodo:

```typescript
function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    isCompleted: row.is_completed === 1,
    parentId: row.parent_id,  // NEW - verify this line exists
  };
}
```

- [ ] **Step 3: Update toggle() to check subtask completion**

```typescript
toggle(id: string): Todo {
  const db = getDb();
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
  if (!row) throw new Error('Todo not found');

  // If this todo has subtasks, check if all subtasks are completed before allowing completion
  if (row.is_completed === 0) {
    const subtasks = db
      .prepare('SELECT * FROM todos WHERE parent_id = ?')
      .all(id) as TodoRow[];
    if (subtasks.length > 0) {
      const allCompleted = subtasks.every(s => s.is_completed === 1);
      if (!allCompleted) {
        throw new Error('Cannot complete parent todo until all subtasks are completed');
      }
    }
  }

  const now = new Date().toISOString();
  const newCompleted = row.is_completed === 1 ? 0 : 1;
  const completedAt = newCompleted === 1 ? now : null;

  db.prepare('UPDATE todos SET is_completed = ?, completed_at = ?, updated_at = ? WHERE id = ?')
    .run(newCompleted, completedAt, now, id);

  return rowToTodo(
    db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
  );
}
```

- [ ] **Step 4: Update delete() to cascade**

Verify the migration enabled PRAGMA foreign_keys = ON, then delete works automatically via CASCADE. If not, add manual cascade:

```typescript
delete(id: string): void {
  const db = getDb();
  const transaction = db.transaction(() => {
    // Delete subtasks first
    db.prepare('DELETE FROM todos WHERE parent_id = ?').run(id);
    // Delete the todo itself
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  });
  transaction();
}
```

- [ ] **Step 5: Commit**

```bash
git add src/services/TodoService.ts
git commit -m "feat: TodoService supports parentId and subtask completion check"
```

---

## Task 4: Update TodoItem Component

**Files:**
- Modify: `src-renderer/components/TodoItem.tsx`
- Modify: `src-renderer/components/TodoItem.css`

- [ ] **Step 1: Update TodoItemProps interface**

```typescript
interface TodoItemProps {
  todo: TodoItemData;
  children?: TodoItemData[];      // NEW: subtasks
  isExpanded?: boolean;           // NEW: expand state
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onToggleExpand?: () => void;    // NEW
  onAddChild?: (content: string) => void;  // NEW
  onDeleteChild?: (id: string) => void;    // NEW
}
```

- [ ] **Step 2: Add state for adding subtask**

```typescript
const [showAddChildInput, setShowAddChildInput] = useState(false);
const [newChildContent, setNewChildContent] = useState('');
```

- [ ] **Step 3: Add expand toggle button (before checkbox)**

```tsx
{onToggleExpand && (
  <button
    className="todo-expand"
    onClick={(e) => {
      e.stopPropagation();
      onToggleExpand();
    }}
    aria-label={isExpanded ? 'Collapse' : 'Expand'}
  >
    {isExpanded ? '▼' : '▶'}
  </button>
)}
```

- [ ] **Step 4: Add subtask button (+ icon, after delete button)**

```tsx
{onAddChild && (
  <button
    className="todo-add-child"
    onClick={(e) => {
      e.stopPropagation();
      setShowAddChildInput(true);
    }}
    aria-label="Add subtask"
  >
    +
  </button>
)}
```

- [ ] **Step 5: Add subtask input (conditional render before closing div)**

```tsx
{showAddChildInput && (
  <div className="todo-add-child-form">
    <input
      type="text"
      value={newChildContent}
      onChange={(e) => setNewChildContent(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && newChildContent.trim()) {
          onAddChild(newChildContent.trim());
          setNewChildContent('');
          setShowAddChildInput(false);
        }
        if (e.key === 'Escape') {
          setShowAddChildInput(false);
          setNewChildContent('');
        }
      }}
      onClick={(e) => e.stopPropagation()}
      autoFocus
    />
  </div>
)}
```

- [ ] **Step 6: Add children rendering (after input, before closing div)**

```tsx
{children && children.length > 0 && isExpanded && (
  <div className="todo-children">
    {children.map(child => (
      <TodoItemInner
        key={child.id}
        todo={child}
        onToggle={onDeleteChild ? (id) => onToggle(id) : onToggle}
        onDelete={onDeleteChild || onDelete}
        onEdit={onEdit}
      />
    ))}
  </div>
)}
```

- [ ] **Step 7: Update TodoItem.css**

```css
.todo-item {
  /* existing styles */
}

.todo-expand {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 10px;
  color: #999;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.todo-expand:hover {
  color: #333;
}

.todo-add-child {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  font-size: 16px;
  color: #999;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.todo-add-child:hover {
  background: #f5f5f5;
  color: #333;
}

.todo-add-child-form {
  padding: 8px 0 8px 44px;
}

.todo-add-child-form input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.todo-add-child-form input:focus {
  outline: none;
  border-color: #7c3aed;
}

.todo-children {
  margin-left: 20px;
  border-left: 1px solid #eee;
  padding-left: 12px;
}
```

- [ ] **Step 8: Commit**

```bash
git add src-renderer/components/TodoItem.tsx src-renderer/components/TodoItem.css
git commit -m "feat: TodoItem supports expand/collapse and add subtask"
```

---

## Task 5: Update TodoList Component

**Files:**
- Modify: `src-renderer/components/TodoList.tsx`

- [ ] **Step 1: Update TodoListProps**

```typescript
interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onReorder?: (ids: string[]) => void;
  onAddChild?: (parentId: string, content: string) => void;  // NEW
  onDeleteChild?: (parentId: string, childId: string) => void; // NEW
}
```

- [ ] **Step 2: Add state for expanded todos**

```typescript
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add helper to get children**

```typescript
const getChildren = (parentId: string) => todos.filter(t => t.parentId === parentId);
const getTopLevelTodos = () => todos.filter(t => !t.parentId);
```

- [ ] **Step 4: Update TodoItem rendering to pass subtasks and handlers**

```tsx
{getTopLevelTodos().map(todo => {
  const children = getChildren(todo.id);
  return (
    <TodoItem
      key={todo.id}
      todo={todo}
      children={children}
      isExpanded={expandedIds.has(todo.id)}
      onToggle={onToggle}
      onDelete={onDelete}
      onEdit={onEdit}
      onToggleExpand={() => {
        setExpandedIds(prev => {
          const next = new Set(prev);
          if (next.has(todo.id)) {
            next.delete(todo.id);
          } else {
            next.add(todo.id);
          }
          return next;
        });
      }}
      onAddChild={onAddChild ? (content) => onAddChild(todo.id, content) : undefined}
      onDeleteChild={onDeleteChild ? (childId) => onDeleteChild(todo.id, childId) : undefined}
    />
  );
})}
```

- [ ] **Step 5: Commit**

```bash
git add src-renderer/components/TodoList.tsx
git commit -m "feat: TodoList renders todo tree with expand/collapse"
```

---

## Task 6: Update useTodos Hook

**Files:**
- Modify: `src-renderer/hooks/useTodos.ts`

- [ ] **Step 1: Add addChild handler**

```typescript
const addChild = useCallback((parentId: string, content: string) => {
  const newTodo = await window.todoAPI.add({ content, parentId });
  setTodos(prev => [...prev, newTodo]);
}, []);
```

- [ ] **Step 2: Pass handlers to TodoList**

Update the return or the component where TodoList is used to pass `onAddChild` and `onDeleteChild`.

- [ ] **Step 3: Commit**

```bash
git add src-renderer/hooks/useTodos.ts
git commit -m "feat: useTodos supports addChild operation"
```

---

## Task 7: Integration Testing

**Files:**
- Manual testing via app

- [ ] **Step 1: Build and run**

Run: `pnpm build && pnpm start`

- [ ] **Step 2: Test add subtask**

1. Click "+" on any todo
2. Input appears at bottom
3. Type content and press Enter
4. Subtask appears indented below parent

- [ ] **Step 3: Test expand/collapse**

1. Click ▶ on parent todo
2. ▼ icon shown and subtasks visible
3. Click ▼ again
4. Subtasks hidden

- [ ] **Step 4: Test completion logic**

1. Parent with subtasks - verify checkbox disabled until all subtasks complete
2. Complete all subtasks - verify parent now can be completed

- [ ] **Step 5: Test cascade delete**

1. Delete parent todo
2. Verify subtasks are also deleted

---

## Spec Coverage Check

- [x] Database `parent_id` column - Task 1
- [x] UI: expand/collapse icon - Task 4
- [x] UI: add subtask button - Task 4
- [x] UI: indent for subtasks - Task 4
- [x] Parent completion requires subtasks complete - Task 3
- [x] Cascade delete - Task 3
- [x] One level nesting only - enforced by UI (add button only on parent todos)

## Type Consistency Check

- `Todo.parentId` defined in store (Task 2) ✓
- `TodoItemData.parentId` referenced in TodoItem (Task 4) ✓
- `TodoService.add({ content, parentId })` matches usage in useTodos (Task 3, 6) ✓