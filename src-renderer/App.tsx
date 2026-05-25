import React, { useState, useEffect } from 'react';
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