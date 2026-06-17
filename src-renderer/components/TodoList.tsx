import React from 'react';
import TodoItem from './TodoItem';
import { Todo } from '../store';
import './TodoList.css';

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDetail?: (todo: { id: string; content: string; notes: string | null }) => void;
  onReorder?: (ids: string[]) => void;
  onRequestAddChild?: (parentId: string) => void;
  onDeleteChild?: (parentId: string, childId: string) => void;
}

export default function TodoList({ todos, onToggle, onDelete, onEdit, onDetail, onRequestAddChild, onDeleteChild }: TodoListProps) {
  const [sortedIds, setSortedIds] = React.useState<string[]>([]);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [childSortKeys, setChildSortKeys] = React.useState<Record<string, number>>({});
  const pendingSortTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const childSortTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTopLevelRef = React.useRef<Todo[]>([]);
  const prevChildRef = React.useRef<Todo[]>([]);
  const prevChildCountsRef = React.useRef<Record<string, number>>({});
  const lastProcessedChildRef = React.useRef<string | null>(null);

  const getChildren = (parentId: string) => todos.filter(t => t.parentId === parentId);
  const getTopLevelTodos = () => todos.filter(t => !t.parentId);

  React.useEffect(() => {
    return () => {
      if (pendingSortTimerRef.current) clearTimeout(pendingSortTimerRef.current);
      if (childSortTimerRef.current) clearTimeout(childSortTimerRef.current);
    };
  }, []);

  const topLevelTodos = React.useMemo(() => todos.filter(t => !t.parentId), [todos]);

  const prevTopLevelSnap = prevTopLevelRef.current;
  const completionChanged = prevTopLevelSnap.length > 0 && topLevelTodos.some(t => {
    const prev = prevTopLevelSnap.find(p => p.id === t.id);
    return prev && prev.isCompleted !== t.isCompleted;
  });

  // Top-level: detect completion change, delay sort, then apply.
  // Also detect addition/deletion and reset sortedIds so new todos sort correctly.
  React.useLayoutEffect(() => {
    const prevTopLevel = prevTopLevelRef.current;
    prevTopLevelRef.current = [...topLevelTodos];

    const changed = topLevelTodos.some(t => {
      const prev = prevTopLevel.find(pt => pt.id === t.id);
      return prev && prev.isCompleted !== t.isCompleted;
    });

    const idSetChanged =
      prevTopLevel.length !== topLevelTodos.length ||
      topLevelTodos.some(t => !prevTopLevel.find(pt => pt.id === t.id)) ||
      prevTopLevel.some(pt => !topLevelTodos.find(t => t.id === pt.id));

    if (changed) {
      if (pendingSortTimerRef.current) {
        clearTimeout(pendingSortTimerRef.current);
      }
      pendingSortTimerRef.current = setTimeout(() => {
        const topLevel = todos.filter(t => !t.parentId);
        const sorted = topLevel.filter(t => !t.isCompleted).map(t => t.id)
          .concat(topLevel.filter(t => t.isCompleted).map(t => t.id));
        setSortedIds(sorted);
        pendingSortTimerRef.current = null;
      }, 650);
    } else if (idSetChanged && sortedIds.length > 0) {
      setSortedIds([]);
    } else if (!topLevelTodos.some(t => t.isCompleted) && sortedIds.length > 0) {
      setSortedIds([]);
    }
  }, [todos]);

  // Child: detect completion change, auto-toggle parent, delay child re-sort
  React.useEffect(() => {
    const prevChildren = prevChildRef.current;
    prevChildRef.current = [...todos];

    const newlyCompletedChild = todos.find(t =>
      t.parentId && t.isCompleted &&
      !prevChildren.find(pt => pt.id === t.id)?.isCompleted
    );
    const newlyUncompletedChild = todos.find(t =>
      t.parentId && !t.isCompleted &&
      prevChildren.find(pt => pt.id === t.id)?.isCompleted
    );

    if (newlyCompletedChild || newlyUncompletedChild) {
      const childId = (newlyCompletedChild || newlyUncompletedChild)!.id;
      const parentId = (newlyCompletedChild || newlyUncompletedChild)!.parentId;

      if (lastProcessedChildRef.current === childId) {
        lastProcessedChildRef.current = null;
        return;
      }
      lastProcessedChildRef.current = childId;

      if (parentId) {
        if (newlyCompletedChild) {
          const siblings = todos.filter(t => t.parentId === parentId);
          const allCompleted = siblings.length > 0 && siblings.every(t => t.isCompleted);
          const parent = todos.find(t => t.id === parentId);
          if (allCompleted && parent && !parent.isCompleted) {
            onToggle(parentId);
          }
        }

        if (newlyUncompletedChild) {
          const parent = todos.find(t => t.id === parentId);
          if (parent && parent.isCompleted) {
            onToggle(parentId);
          }
        }

        if (childSortTimerRef.current) {
          clearTimeout(childSortTimerRef.current);
        }
        childSortTimerRef.current = setTimeout(() => {
          setChildSortKeys(prev => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
          childSortTimerRef.current = null;
        }, 650);
      }
    }
  }, [todos]);

  // Auto-expand parent when a new child todo is added
  React.useEffect(() => {
    const newCounts: Record<string, number> = {};
    todos.filter(t => t.parentId).forEach(t => {
      newCounts[t.parentId!] = (newCounts[t.parentId!] || 0) + 1;
    });

    const prev = prevChildCountsRef.current;
    for (const [parentId, count] of Object.entries(newCounts)) {
      if ((prev[parentId] || 0) < count) {
        setExpandedIds(prevIds => {
          const next = new Set(prevIds);
          next.add(parentId);
          return next;
        });
      }
    }
    prevChildCountsRef.current = newCounts;
  }, [todos]);

  if (todos.length === 0) {
    return (
      <div className="todo-list-empty">
        <span>暂无待办事项</span>
      </div>
    );
  }

  const handleToggle = (id: string) => {
    onToggle(id);
  };

  const topLevel = getTopLevelTodos();
  let orderedTopLevelIds: string[];
  if (completionChanged) {
    // Just detected a change: keep current visual order (no jump)
    if (sortedIds.length > 0) {
      const topLevelIds = new Set(topLevel.map(t => t.id));
      const inSort = sortedIds.filter(id => topLevelIds.has(id));
      const notInSort = topLevel.map(t => t.id).filter(id => !sortedIds.includes(id));
      orderedTopLevelIds = inSort.concat(notInSort);
    } else {
      orderedTopLevelIds = topLevel.map(t => t.id);
    }
  } else if (sortedIds.length > 0) {
    const topLevelIds = new Set(topLevel.map(t => t.id));
    const inSort = sortedIds.filter(id => topLevelIds.has(id));
    const notInSort = topLevel.map(t => t.id).filter(id => !sortedIds.includes(id));
    orderedTopLevelIds = inSort.concat(notInSort);
  } else {
    const incomplete = topLevel.filter(t => !t.isCompleted);
    const completed = topLevel.filter(t => t.isCompleted);
    orderedTopLevelIds = incomplete.map(t => t.id).concat(completed.map(t => t.id));
  }

  return (
    <div className="todo-list">
      {orderedTopLevelIds.map(id => {
        const todo = todos.find(t => t.id === id)!;
        const children = getChildren(todo.id);
        const childCompare = (a: typeof children[0], b: typeof children[0]) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          if (a.isCompleted) {
            return (a.completedAt || '').localeCompare(b.completedAt || '');
          }
          return a.sortOrder - b.sortOrder;
        };
        const sortedChildren = [...children].sort(childCompare);
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            children={sortedChildren}
            childSortKey={childSortKeys[todo.id]}
            isExpanded={expandedIds.has(todo.id)}
            onToggle={handleToggle}
            onDelete={onDelete}
            onEdit={onEdit}
            onDetail={onDetail ? (t) => onDetail(t) : undefined}
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
            onRequestAddChild={onRequestAddChild ? (id) => onRequestAddChild(id) : undefined}
            onDeleteChild={onDeleteChild ? (childId) => onDeleteChild(todo.id, childId) : undefined}
          />
        );
      })}
    </div>
  );
}
