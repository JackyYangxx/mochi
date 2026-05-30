import React, { useState, useRef, useEffect } from 'react';
import VoiceButton from './VoiceButton';
import './InputModal.css';

interface InputModalProps {
  initialValue?: string;
  onAdd: (content: string) => void;
  onEdit?: (content: string) => void;
  onClose: () => void;
}

export default function InputModal({ initialValue = '', onAdd, onEdit, onClose }: InputModalProps) {
  const [text, setText] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (onEdit) {
      onEdit(trimmed);
    } else {
      onAdd(trimmed);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleTranscript = (transcribed: string) => {
    setText((prev) => {
      const newText = prev ? `${prev} ${transcribed}` : transcribed;
      return newText;
    });
  };

  return (
    <div className="input-modal-overlay" onClick={onClose}>
      <button
        className="input-modal-close"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <div className="input-modal" onClick={(e) => e.stopPropagation()}>
        <div className="input-modal-row">
          <input
            ref={inputRef}
            type="text"
            className="input-modal-input"
            placeholder="输入待办事项..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <VoiceButton onTranscript={handleTranscript} />
        </div>
      </div>
    </div>
  );
}
