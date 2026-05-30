import React from 'react';
import TodoItem from './TodoItem';
import { Todo } from '../store';
import './TodoList.css';

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onReorder?: (ids: string[]) => void;
  onRequestAddChild?: (parentId: string) => void;  // CHANGED: triggers global modal
  onDeleteChild?: (parentId: string, childId: string) => void;
}

export default function TodoList({ todos, onToggle, onDelete, onEdit, onRequestAddChild, onDeleteChild }: TodoListProps) {
  const [sortedIds, setSortedIds] = React.useState<string[]>([]);
  const [animatingIds, setAnimatingIds] = React.useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [childSortKeys, setChildSortKeys] = React.useState<Record<string, number>>({}); // Track child sort version per parent
  const animatingChildIdsRef = React.useRef<Set<string>>(new Set());
  const [, forceRenderChild] = React.useState(0);
  const pendingSortRef = React.useRef(false);
  const pendingSortTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const childSortTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTopLevelRef = React.useRef<Todo[]>([]);
  const prevChildRef = React.useRef<Todo[]>([]);
  const lastProcessedChildRef = React.useRef<string | null>(null);

  const getChildren = (parentId: string) => todos.filter(t => t.parentId === parentId);
  const getTopLevelTodos = () => todos.filter(t => !t.parentId);

  React.useEffect(() => {
    if (pendingSortRef.current && sortedIds.length > 0) {
      pendingSortRef.current = false;
    }
  }, [sortedIds]);

  // Cleanup timers on unmount
  React.useEffect(() => {
    return () => {
      if (pendingSortTimerRef.current) clearTimeout(pendingSortTimerRef.current);
      if (childSortTimerRef.current) clearTimeout(childSortTimerRef.current);
    };
  }, []);

  // Detect top-level todo completion change and sort
  const topLevelTodos = React.useMemo(() => todos.filter(t => !t.parentId), [todos]);
  React.useEffect(() => {
    // Snapshot BEFORE detection so state updates don't cause re-detection
    const prevTopLevel = prevTopLevelRef.current;
    prevTopLevelRef.current = [...topLevelTodos];

    const newlyCompleted = topLevelTodos.find(t => t.isCompleted &&
      !prevTopLevel.find(pt => pt.id === t.id)?.isCompleted);
    const newlyUncompleted = topLevelTodos.find(t => !t.isCompleted &&
      prevTopLevel.find(pt => pt.id === t.id)?.isCompleted);

    if ((newlyCompleted || newlyUncompleted) && !pendingSortRef.current) {
      pendingSortRef.current = true;
      const todoId = (newlyCompleted || newlyUncompleted)!.id;
      setAnimatingIds(prev => new Set(prev).add(todoId));
      pendingSortTimerRef.current = setTimeout(() => {
        setAnimatingIds(new Set());
        pendingSortTimerRef.current = setTimeout(() => {
          const topLevel = todos.filter(t => !t.parentId);
          const sorted = topLevel.filter(t => !t.isCompleted).map(t => t.id)
            .concat(topLevel.filter(t => t.isCompleted).map(t => t.id));
          setSortedIds(sorted);
          pendingSortRef.current = false;
          pendingSortTimerRef.current = null;
        }, 50);
      }, 650);
    } else if ((newlyCompleted || newlyUncompleted) && pendingSortRef.current) {
      if (pendingSortTimerRef.current) {
        clearTimeout(pendingSortTimerRef.current);
        pendingSortTimerRef.current = null;
      }
      const todoId = (newlyCompleted || newlyUncompleted)!.id;
      setAnimatingIds(prev => new Set(prev).add(todoId));
      pendingSortTimerRef.current = setTimeout(() => {
        setAnimatingIds(new Set());
        pendingSortTimerRef.current = setTimeout(() => {
          const topLevel = todos.filter(t => !t.parentId);
          const sorted = topLevel.filter(t => !t.isCompleted).map(t => t.id)
            .concat(topLevel.filter(t => t.isCompleted).map(t => t.id));
          setSortedIds(sorted);
          pendingSortRef.current = false;
          pendingSortTimerRef.current = null;
        }, 50);
      }, 650);
    } else if (!topLevelTodos.some(t => t.isCompleted) && sortedIds.length > 0) {
      setSortedIds([]);
    }
  }, [todos]);

  // Detect child todo completion change and trigger delayed sort
  React.useEffect(() => {
    // Snapshot BEFORE detection so forceRenderChild re-runs don't re-detect
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

      // Skip if this child was already processed (prevents re-detection from onToggle re-renders)
      if (lastProcessedChildRef.current === childId) {
        lastProcessedChildRef.current = null;
        return;
      }
      lastProcessedChildRef.current = childId;

      if (parentId) {
        // Auto-complete parent when all children are completed
        if (newlyCompletedChild) {
          const siblings = todos.filter(t => t.parentId === parentId);
          const allCompleted = siblings.length > 0 && siblings.every(t => t.isCompleted);
          const parent = todos.find(t => t.id === parentId);
          if (allCompleted && parent && !parent.isCompleted) {
            onToggle(parentId);
          }
        }

        // Auto-uncomplete parent when a child is uncompleted
        if (newlyUncompletedChild) {
          const parent = todos.find(t => t.id === parentId);
          if (parent && parent.isCompleted) {
            onToggle(parentId);
          }
        }

        if (childSortTimerRef.current) {
          clearTimeout(childSortTimerRef.current);
          childSortTimerRef.current = null;
        }
        // Use ref for synchronous tracking so sort code sees it on current render
        animatingChildIdsRef.current = new Set(animatingChildIdsRef.current).add(childId);
        forceRenderChild(n => n + 1);
        childSortTimerRef.current = setTimeout(() => {
          childSortTimerRef.current = setTimeout(() => {
            const next = new Set(animatingChildIdsRef.current);
            next.delete(childId);
            animatingChildIdsRef.current = next;
            setChildSortKeys(prev => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
            forceRenderChild(n => n + 1);
            childSortTimerRef.current = null;
          }, 50);
        }, 650);
      }
    }
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

  // Build top-level todos, respecting sorted order when available
  const topLevelIds = getTopLevelTodos().map(t => t.id);
  const newTopLevelIds = topLevelIds.filter(id => !sortedIds.includes(id));
  const orderedTopLevelIds = sortedIds.length > 0
    ? sortedIds.filter(id => topLevelIds.includes(id)).concat(newTopLevelIds)
    : topLevelIds;

  return (
    <div className="todo-list">
      {orderedTopLevelIds.map(id => {
        const todo = todos.find(t => t.id === id)!;
        const children = getChildren(todo.id);
        // Sort children: incomplete first, then completed, then by sortOrder
        // Animating children stay at original indices during particle effect
        const childOriginalIndices = new Map(children.map((c, i) => [c.id, i]));
        const hasAnimating = children.some(c => animatingChildIdsRef.current.has(c.id));
        const childCompare = (a: typeof children[0], b: typeof children[0]) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          if (a.isCompleted) {
            // Among completed: earliest completed first (oldest moves up, newest to bottom)
            return (a.completedAt || '').localeCompare(b.completedAt || '');
          }
          return a.sortOrder - b.sortOrder;
        };
        let sortedChildren: typeof children;
        if (hasAnimating) {
          const nonAnimating = children.filter(c => !animatingChildIdsRef.current.has(c.id));
          const sortedNonAnimating = [...nonAnimating].sort(childCompare);
          sortedChildren = new Array(children.length);
          for (const c of children) {
            if (animatingChildIdsRef.current.has(c.id)) {
              sortedChildren[childOriginalIndices.get(c.id)!] = c;
            }
          }
          let sortIdx = 0;
          for (let i = 0; i < sortedChildren.length; i++) {
            if (!sortedChildren[i]) {
              sortedChildren[i] = sortedNonAnimating[sortIdx++];
            }
          }
        } else {
          sortedChildren = [...children].sort(childCompare);
        }
        return (
          <TodoItem
            key={todo.id}
            todo={todo}
            children={sortedChildren}
            childSortKey={childSortKeys[todo.id]}
            isExpanded={expandedIds.has(todo.id)}
            shouldAnimate={animatingIds.has(todo.id)}
            onToggle={handleToggle}
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
            onRequestAddChild={onRequestAddChild ? (id) => onRequestAddChild(id) : undefined}
            onDeleteChild={onDeleteChild ? (childId) => onDeleteChild(todo.id, childId) : undefined}
          />
        );
      })}
    </div>
  );
}
