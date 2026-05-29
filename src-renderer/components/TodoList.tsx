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
}

export default function TodoList({ todos, onToggle, onDelete, onEdit }: TodoListProps) {
  const [sortedIds, setSortedIds] = React.useState<string[]>([]);
  const [animatingIds, setAnimatingIds] = React.useState<Set<string>>(new Set());
  const pendingSortRef = React.useRef(false);
  const prevTodosRef = React.useRef<Todo[]>([]);

  React.useEffect(() => {
    // Detect which todo just got completed
    const newlyCompleted = todos.find(t => t.isCompleted &&
      !prevTodosRef.current.find(pt => pt.id === t.id)?.isCompleted);

    if (newlyCompleted && !pendingSortRef.current) {
      pendingSortRef.current = true;
      // Trigger animation for the newly completed todo
      setAnimatingIds(prev => new Set(prev).add(newlyCompleted.id));
      setTimeout(() => {
        setSortedIds(todos.filter(t => !t.isCompleted).map(t => t.id).concat(todos.filter(t => t.isCompleted).map(t => t.id)));
        pendingSortRef.current = false;
      }, 600);
    } else if (!todos.some(t => t.isCompleted)) {
      setSortedIds(todos.map(t => t.id));
    }

    prevTodosRef.current = [...todos];
  }, [todos]);

  // Clear animation flag after animation completes
  React.useEffect(() => {
    if (animatingIds.size > 0) {
      const timer = setTimeout(() => {
        setAnimatingIds(new Set());
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [animatingIds]);

  if (todos.length === 0) {
    return (
      <div className="todo-list-empty">
        <span>暂无待办事项</span>
      </div>
    );
  }

  const orderedTodos = sortedIds.length > 0
    ? sortedIds.map(id => todos.find(t => t.id === id)!).filter(Boolean)
    : todos;

  return (
    <div className="todo-list">
      {orderedTodos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={{
            id: todo.id,
            content: todo.content,
            isCompleted: todo.isCompleted,
            createdAt: todo.createdAt,
            showAnimation: animatingIds.has(todo.id),
          }}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
