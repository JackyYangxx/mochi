import React, { useEffect } from 'react';
import PetView from './components/PetView';
import TodoList from './components/TodoList';
import InputModal from './components/InputModal';
import TodoDetailModal from './components/TodoDetailModal';
import SettingsPanel from './components/SettingsPanel';
import { useStore } from './store';
import { useTodos } from './hooks/useTodos';

export default function App() {
  const petState = useStore((s) => s.petState);
  const petSize = useStore((s) => s.petSize);
  const petImages = useStore((s) => s.petImages);
  const showInput = useStore((s) => s.showInput);
  const showSettings = useStore((s) => s.showSettings);
  const addingSubtaskForId = useStore((s) => s.addingSubtaskForId);
  const isCollapsed = useStore((s) => s.isCollapsed);
  const setShowInput = useStore((s) => s.setShowInput);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const setAddingSubtaskForId = useStore((s) => s.setAddingSubtaskForId);
  const setPetState = useStore((s) => s.setPetState);
  const setPetImages = useStore((s) => s.setPetImages);
  const { todos, handleAdd, handleToggle, handleDelete, handleUpdate, handleUpdateNotes, handleAddChild, handleDeleteChild } = useTodos();
  const [editingTodo, setEditingTodo] = React.useState<{ id: string; content: string } | null>(null);
  const [detailTodo, setDetailTodo] = React.useState<{ id: string; content: string; notes: string } | null>(null);
  const [aiEnabled, setAiEnabled] = React.useState(false);

  // Windows drag handling
  const dragState = React.useRef<{ mouseX: number; mouseY: number; didDrag: boolean } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button on the draggable container
    if (e.button !== 0) return;
    // Check if clicking on interactive elements (input, buttons) - don't drag
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') {
      return;
    }
    // Don't drag when clicking on todo items inside app-content
    const todoList = document.querySelector('.todo-list');
    if (todoList && todoList.contains(target)) {
      return;
    }
    dragState.current = { mouseX: e.screenX, mouseY: e.screenY, didDrag: false };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragState.current) return;
    const deltaX = e.screenX - dragState.current.mouseX;
    const deltaY = e.screenY - dragState.current.mouseY;
    // If moved more than 5px, consider it a drag
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      dragState.current.didDrag = true;
      window.todoAPI.moveWindow(deltaX, deltaY);
      // Update start position so next delta is relative to last position
      dragState.current.mouseX = e.screenX;
      dragState.current.mouseY = e.screenY;
    }
  };

  const handleMouseUp = () => {
    if (!dragState.current) return;
    const didDrag = dragState.current.didDrag;
    dragState.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    // Store whether this was a drag so PetView onClick can check
    (window as any).__wasDrag = didDrag;
  };

  useEffect(() => {
    const cleanup = window.todoAPI.onOpenSettings(() => {
      setShowSettings(true);
    });
    return cleanup;
  }, [setShowSettings]);

  useEffect(() => {
    // Initial fetch
    window.todoAPI.getPetImages().then((images) => {
      if (images) {
        setPetImages({
          idle: images.idle || null,
          active: images.active || null,
          speaking: images.speaking || null,
        });
      }
    });

    // Register listener for future updates
    const cleanup = window.todoAPI.onRefreshPetImages(() => {
      window.todoAPI.getPetImages().then((images) => {
        if (images) {
          setPetImages({
            idle: images.idle || null,
            active: images.active || null,
            speaking: images.speaking || null,
          });
        }
      });
    });
    return cleanup;
  }, [setPetImages]);

  // Detect LLM availability from settings. Refresh when the user saves
  // settings (the same IPC that triggers pet-image refresh above).
  useEffect(() => {
    const refreshAi = async () => {
      const s = await window.todoAPI.getSettings();
      setAiEnabled(Boolean(s?.llmEndpoint && s?.llmModel && s?.apiKey));
    };
    void refreshAi();
    const cleanup = window.todoAPI.onRefreshPetImages(() => { void refreshAi(); });
    return cleanup;
  }, []);

  // 折叠/展开状态变化时通知主进程 resize 窗口。窗口底边锚定,pet 不跳。
  useEffect(() => {
    void window.todoAPI.setWindowCollapsed(isCollapsed);
  }, [isCollapsed]);

  return (
    <div
      className={`app-container ${isCollapsed ? 'collapsed' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setPetState('active')}
      onMouseLeave={() => setPetState('idle')}
    >
      <PetView
        petState={petState}
        petSize={petSize}
        images={petImages}
        aiEnabled={aiEnabled}
        onPetClick={() => {
          console.log('onPetClick called, __wasDrag:', (window as any).__wasDrag);
          if (!(window as any).__wasDrag) {
            console.log('Setting showInput to true');
            setShowInput(true);
          }
          (window as any).__wasDrag = false;
        }}
      />
      <div className="app-content">
        {!isCollapsed && (
          <TodoList
            todos={todos}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onEdit={(id, content) => setEditingTodo({ id, content })}
            onDetail={(todo) => setDetailTodo({ id: todo.id, content: todo.content, notes: todo.notes || '' })}
            onRequestAddChild={(parentId) => {
              setAddingSubtaskForId(parentId);
              setShowInput(true);
            }}
            onDeleteChild={handleDeleteChild}
          />
        )}
      </div>
      {showInput && (
        <InputModal
          onAdd={addingSubtaskForId ? (content) => handleAddChild(addingSubtaskForId, content) : handleAdd}
          onClose={() => {
            setShowInput(false);
            setAddingSubtaskForId(null);
          }}
        />
      )}
      {editingTodo && (
        <InputModal
          initialValue={editingTodo.content}
          onAdd={() => {}}
          onEdit={(content) => {
            handleUpdate(editingTodo.id, content);
            setEditingTodo(null);
          }}
          onClose={() => setEditingTodo(null)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}
      {detailTodo && (
        <TodoDetailModal
          todoId={detailTodo.id}
          todoContent={detailTodo.content}
          initialNotes={detailTodo.notes}
          onSave={(notes) => {
            handleUpdateNotes(detailTodo.id, notes);
            setDetailTodo(null);
          }}
          onClose={() => setDetailTodo(null)}
        />
      )}
    </div>
  );
}