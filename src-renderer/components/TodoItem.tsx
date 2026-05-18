import React from 'react';
import './TodoItem.css';

export interface TodoItemData {
  id: string;
  content: string;
  isCompleted: boolean;
  createdAt: string;
}

interface TodoItemProps {
  todo: TodoItemData;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
  return (
    <div className={`todo-item ${todo.isCompleted ? 'completed' : ''}`}>
      <div className="todo-checkbox" onClick={() => onToggle(todo.id)}>
        {todo.isCompleted && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div className="todo-content">
        <span className="todo-text">{todo.content}</span>
        <span className="todo-date">{new Date(todo.createdAt).toLocaleDateString('zh-CN')}</span>
      </div>
      <button
        className="todo-delete"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(todo.id);
        }}
        aria-label="Delete"
      >
        ×
      </button>
    </div>
  );
}
