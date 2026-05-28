import React, { useRef, useEffect } from 'react';
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
  onEdit: (id: string, content: string) => void;
}

export default function TodoItem({ todo, onToggle, onDelete, onEdit }: TodoItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLDivElement>(null);
  const animationTriggeredRef = useRef(false);

  useEffect(() => {
    // Only trigger animation once when first completing
    if (todo.isCompleted && !animationTriggeredRef.current) {
      animationTriggeredRef.current = true;
      triggerCompletionAnimation();
    }
    if (!todo.isCompleted) {
      animationTriggeredRef.current = false;
    }
  }, [todo.isCompleted]);

  function triggerCompletionAnimation() {
    if (!itemRef.current || !checkboxRef.current) return;

    const item = itemRef.current;
    const checkbox = checkboxRef.current;
    const colors = ['#7c3aed', '#ec4899', '#8b5cf6', '#f472b6', '#a855f7'];

    // Create particles
    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('span');
      particle.className = 'todo-particle';
      particle.style.setProperty('--color', colors[i % colors.length]);
      const angle = (i / particleCount) * 360;
      const rad = (angle * Math.PI) / 180;
      const distance = 40;
      particle.style.setProperty('--tx', `${Math.cos(rad) * distance}px`);
      particle.style.setProperty('--ty', `${Math.sin(rad) * distance}px`);
      checkbox.appendChild(particle);

      // Remove particle after animation
      particle.addEventListener('animationend', () => particle.remove());
    }

    // Remove particles after animation
    setTimeout(() => {
      // particles auto-remove via animationend event
    }, 600);
  }

  return (
    <div className={`todo-item ${todo.isCompleted ? 'completed' : ''}`} ref={itemRef}>
      <div className="todo-checkbox" ref={checkboxRef} onClick={() => onToggle(todo.id)}>
        {todo.isCompleted && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div className="todo-content">
        <span className="todo-text">{todo.content}</span>
        <span className="todo-date">{new Date(todo.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
      <button
        className="todo-edit"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(todo.id, todo.content);
        }}
        aria-label="Edit"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
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