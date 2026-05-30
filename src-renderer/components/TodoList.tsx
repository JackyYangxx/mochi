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
    if (pendingSortRef.current && sortedIds.length > 0) {
      pendingSortRef.current = false;
    }
  }, [sortedIds]);

  React.useEffect(() => {
    // Detect which todo just got completed
    const newlyCompleted = todos.find(t => t.isCompleted &&
      !prevTodosRef.current.find(pt => pt.id === t.id)?.isCompleted);

    if (newlyCompleted && !pendingSortRef.current) {
      pendingSortRef.current = true;
      // Trigger animation for the newly completed todo
      const todoId = newlyCompleted.id;
      setAnimatingIds(prev => new Set(prev).add(todoId));
      // Sort after a delay - clear animation BEFORE sort
      setTimeout(() => {
        // Clear animation first with a unique key to force update
        setAnimatingIds(new Set());
        // Then sort after animation clears
        setTimeout(() => {
          setSortedIds(todos.filter(t => !t.isCompleted).map(t => t.id).concat(todos.filter(t => t.isCompleted).map(t => t.id)));
          pendingSortRef.current = false;
        }, 50);
      }, 600);
    } else if (!todos.some(t => t.isCompleted) && sortedIds.length > 0) {
      setSortedIds([]);
    }

    prevTodosRef.current = [...todos];
  }, [todos]);

  if (todos.length === 0) {
    return (
      <div className="todo-list-empty">
        <span>暂无待办事项</span>
      </div>
    );
  }

  const orderedTodos = sortedIds.length > 0
    ? [...sortedIds.map(id => todos.find(t => t.id === id)).filter(Boolean), ...todos.filter(t => !sortedIds.includes(t.id))]
    : todos;

  const handleToggle = (id: string) => {
    onToggle(id);
  };

  return (
    <div className="todo-list">
      {orderedTodos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          shouldAnimate={animatingIds.has(todo.id)}
          onToggle={handleToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
