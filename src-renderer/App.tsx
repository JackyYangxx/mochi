import React, { useEffect } from 'react';
import PetView from './components/PetView';
import TodoList from './components/TodoList';
import InputModal from './components/InputModal';
import SettingsPanel from './components/SettingsPanel';
import { useStore } from './store';
import { useTodos } from './hooks/useTodos';

export default function App() {
  const petState = useStore((s) => s.petState);
  const petSize = useStore((s) => s.petSize);
  const petImages = useStore((s) => s.petImages);
  const showInput = useStore((s) => s.showInput);
  const showSettings = useStore((s) => s.showSettings);
  const setShowInput = useStore((s) => s.setShowInput);
  const setShowSettings = useStore((s) => s.setShowSettings);
  const setPetState = useStore((s) => s.setPetState);
  const setPetImages = useStore((s) => s.setPetImages);
  const { todos, handleAdd, handleToggle, handleDelete } = useTodos();

  // Windows drag handling
  const dragStartPos = React.useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only handle left mouse button on the draggable container
    if (e.button !== 0) return;
    // Check if clicking on interactive elements (input, buttons) - don't drag
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA') {
      return;
    }
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragStartPos.current) return;
    // Don't need to do anything during move on Windows - startDragging handles it
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragStartPos.current) return;
    const deltaX = e.clientX - dragStartPos.current.x;
    const deltaY = e.clientY - dragStartPos.current.y;
    // Any mouse movement while pressed should trigger drag on Windows
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      window.todoAPI.dragWindow();
    }
    dragStartPos.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
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

  return (
    <div
      className="app-container"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setPetState('active')}
      onMouseLeave={() => setPetState('idle')}
    >
      <PetView
        petState={petState}
        petSize={petSize}
        images={petImages}
        onClick={() => setShowInput(true)}
      />
      <div className="app-content">
        <TodoList
          todos={todos}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      </div>
      {showInput && (
        <InputModal
          onAdd={handleAdd}
          onClose={() => setShowInput(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}