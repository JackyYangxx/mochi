import React, { useState, useRef, useEffect } from 'react';
import './TodoDetailModal.css';

interface TodoDetailModalProps {
  todoId: string;
  todoContent: string;
  initialNotes: string;
  onSave: (notes: string) => void;
  onClose: () => void;
}

export default function TodoDetailModal({ todoId, todoContent, initialNotes, onSave, onClose }: TodoDetailModalProps) {
  const [notes, setNotes] = useState(initialNotes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = () => {
    onSave(notes);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
    // Cmd/Ctrl + Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSave();
    }
  };

  return (
    <div className="detail-modal-overlay" onClick={onClose}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="detail-modal-header">
          <span className="detail-modal-title">{todoContent}</span>
          <button className="detail-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="detail-modal-content">
          <textarea
            ref={textareaRef}
            className="detail-modal-textarea"
            placeholder="记录过程信息..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="detail-modal-footer">
          <span className="detail-modal-hint">⌘+Enter 保存</span>
          <button className="detail-modal-cancel" onClick={onClose}>取消</button>
          <button className="detail-modal-save" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
}
