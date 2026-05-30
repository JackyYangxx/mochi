import React, { useRef, useEffect, useState } from 'react';
import './TodoItem.css';

export interface TodoItemData {
  id: string;
  content: string;
  isCompleted: boolean;
  createdAt: string;
}

interface TodoItemProps {
  todo: TodoItemData;
  children?: TodoItemData[];      // NEW: subtasks
  isExpanded?: boolean;           // NEW: expand state
  shouldAnimate?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onToggleExpand?: () => void;    // NEW
  onAddChild?: (content: string) => void;  // NEW
  onDeleteChild?: (id: string) => void;    // NEW
}

function TodoItemInner({ todo, children, isExpanded, shouldAnimate, onToggle, onDelete, onEdit, onToggleExpand, onAddChild, onDeleteChild }: TodoItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLDivElement>(null);
  const hasAnimatedRef = useRef<Record<string, boolean>>({});
  // Reset when todo becomes completed
  const wasCompletedRef = useRef<Record<string, boolean>>({});
  const [showAddChildInput, setShowAddChildInput] = useState(false);
  const [newChildContent, setNewChildContent] = useState('');

  useEffect(() => {
    // Reset animation state when todo becomes completed (transition from false to true)
    if (todo.isCompleted && !wasCompletedRef.current[todo.id]) {
      hasAnimatedRef.current[todo.id] = false;
      wasCompletedRef.current[todo.id] = true;
    } else if (!todo.isCompleted) {
      wasCompletedRef.current[todo.id] = false;
    }
  }, [todo.id, todo.isCompleted]);

  useEffect(() => {
    if (shouldAnimate && !hasAnimatedRef.current[todo.id]) {
      hasAnimatedRef.current[todo.id] = true;
      triggerCompletionAnimation();
    }
  }, [shouldAnimate, todo.id]);

  function triggerCompletionAnimation() {
    if (!itemRef.current || !checkboxRef.current) return;

    const checkbox = checkboxRef.current;
    const colors = ['#7c3aed', '#ec4899', '#8b5cf6', '#f472b6', '#a855f7'];

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

      particle.addEventListener('animationend', () => particle.remove());
    }
  }

  return (
    <div className={`todo-item ${todo.isCompleted ? 'completed' : ''}`} ref={itemRef}>
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
      <div className="todo-checkbox" ref={checkboxRef} onClick={() => onToggle(todo.id)}>
        {todo.isCompleted && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div className="todo-content">
        <span className="todo-text" title={todo.content}>{todo.content}</span>
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
    </div>
  );
}

export default React.memo(TodoItemInner);