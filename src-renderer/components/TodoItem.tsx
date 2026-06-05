import React, { useRef, useEffect } from 'react';
import './TodoItem.css';

export interface TodoItemData {
  id: string;
  content: string;
  notes?: string | null;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string | null;
  parentId?: string | null;
}

interface TodoItemProps {
  todo: TodoItemData;
  children?: TodoItemData[];
  childSortKey?: number;
  isExpanded?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDetail?: (todo: TodoItemData) => void;
  onToggleExpand?: () => void;
  onRequestAddChild?: (parentId: string) => void;
  onDeleteChild?: (id: string) => void;
}

function TodoItemInner({ todo, children, childSortKey, isExpanded, onToggle, onDelete, onEdit, onDetail, onToggleExpand, onRequestAddChild, onDeleteChild }: TodoItemProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const checkboxRef = useRef<HTMLDivElement>(null);
  const wasCompletedRef = useRef<boolean>(todo.isCompleted);

  useEffect(() => {
    if (wasCompletedRef.current !== todo.isCompleted) {
      wasCompletedRef.current = todo.isCompleted;
      if (itemRef.current && checkboxRef.current) {
        triggerCompletionAnimation();
      }
    }
  }, [todo.isCompleted]);

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

  const hasChildren = children && children.length > 0;

  return (
    <>
      <div className={`todo-item ${todo.isCompleted ? 'completed' : ''}`} ref={itemRef}>
        <div className={`todo-checkbox${hasChildren ? ' has-children' : ''}`} ref={checkboxRef} onClick={() => onToggle(todo.id)}>
          {todo.isCompleted && (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div className={`todo-content${hasChildren ? ' clickable' : ''}`} onClick={() => hasChildren && onToggleExpand && onToggleExpand()}>
          <span className="todo-text" title={todo.content}>{todo.content}</span>
          <div className="todo-meta">
            <span className="todo-date">{new Date(todo.createdAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <div className="todo-actions">
              {onDetail && (
                <button
                  className="todo-detail"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetail(todo);
                  }}
                  aria-label="Detail"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </button>
              )}
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
              {onRequestAddChild && (
                <button
                  className="todo-add-child"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestAddChild(todo.id);
                  }}
                  aria-label="Add subtask"
                >
                  +
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {children && children.length > 0 && isExpanded && (
        <div className="todo-children">
          {children.map(child => (
            <TodoItemInner
              key={child.id}
              todo={child}
              onToggle={onToggle}
              onDelete={onDeleteChild || onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default React.memo(TodoItemInner);