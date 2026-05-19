import React, { useState, useRef, useEffect } from 'react';
import './InputModal.css';

interface InputModalProps {
  onAdd: (content: string) => void;
  onClose: () => void;
}

export default function InputModal({ onAdd, onClose }: InputModalProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const trimmed = text.trim();
      if (trimmed) {
        onAdd(trimmed.length > 500 ? trimmed.slice(0, 500) : trimmed);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="input-modal-overlay" onClick={onClose}>
      <div className="input-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="input-modal-input"
          placeholder="输入待办事项..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />
        <button
          className="input-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}