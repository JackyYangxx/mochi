# Delete Confirmation Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a confirmation dialog before deleting todo items to prevent accidental deletion.

**Architecture:** Create a reusable ConfirmModal component that wraps the existing modal overlay pattern. The TodoItem will control visibility and handle the confirm/cancel callbacks.

**Tech Stack:** React (functional components, hooks), CSS Modules

---

## File Structure

```
src-renderer/components/ConfirmModal/
  ConfirmModal.tsx    # Confirmation dialog component
  ConfirmModal.css    # Modal styles
```

**Modify:**
- `src-renderer/components/TodoItem.tsx` - Import and use ConfirmModal
- `src-renderer/components/TodoItem.css` - (if needed for delete button styling)

---

## Task 1: Create ConfirmModal Component

**Files:**
- Create: `src-renderer/components/ConfirmModal/ConfirmModal.tsx`
- Create: `src-renderer/components/ConfirmModal/ConfirmModal.css`

- [ ] **Step 1: Create ConfirmModal.tsx**

```tsx
import React from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!visible) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <span className="confirm-modal-title">{title}</span>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
        </div>
        <div className="confirm-modal-footer">
          <button className="confirm-modal-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="confirm-modal-confirm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create ConfirmModal.css**

```css
.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-modal {
  background: #fff;
  border-radius: 12px;
  width: 320px;
  max-width: 90vw;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.confirm-modal-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.confirm-modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.confirm-modal-body {
  padding: 20px;
}

.confirm-modal-body p {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.confirm-modal-footer {
  padding: 12px 20px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  background: #fafafa;
}

.confirm-modal-cancel,
.confirm-modal-confirm {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.confirm-modal-cancel {
  background: #f5f5f5;
  color: #666;
}

.confirm-modal-cancel:hover {
  background: #eee;
}

.confirm-modal-confirm {
  background: #ef4444;
  color: #fff;
}

.confirm-modal-confirm:hover {
  background: #dc2626;
}
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/components/ConfirmModal/
git commit -m "feat: add ConfirmModal component for delete confirmation"
```

---

## Task 2: Integrate ConfirmModal into TodoItem

**Files:**
- Modify: `src-renderer/components/TodoItem.tsx`

- [ ] **Step 1: Read TodoItem.tsx to get full content for editing**

Run: `cat src-renderer/components/TodoItem.tsx`

- [ ] **Step 2: Update TodoItem.tsx to add state and ConfirmModal**

Add import:
```tsx
import ConfirmModal from './ConfirmModal/ConfirmModal';
```

Add state to component:
```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
```

Replace delete button onClick:
```tsx
onClick={(e) => {
  e.stopPropagation();
  setShowDeleteConfirm(true);
}}
```

Add ConfirmModal before final closing div:
```tsx
<ConfirmModal
  visible={showDeleteConfirm}
  title="删除确认"
  message="确定要删除该待办事项吗？"
  confirmText="删除"
  cancelText="取消"
  onConfirm={() => {
    setShowDeleteConfirm(false);
    onDelete(todo.id);
  }}
  onCancel={() => setShowDeleteConfirm(false)}
/>
```

- [ ] **Step 3: Run tests to verify**

Run: `pnpm test` (if tests exist for TodoItem)
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src-renderer/components/TodoItem.tsx
git commit -m "feat: add delete confirmation dialog to TodoItem"
```

---

## Verification

After implementation:
1. Open the app
2. Click the delete button (×) on any todo item
3. Confirm dialog appears with "删除确认" title and message
4. Click "取消" → dialog closes, item not deleted
5. Click "删除" → item is deleted
6. Verify no console errors