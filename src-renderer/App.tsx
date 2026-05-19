import React from 'react';
import PetView from './components/PetView';
import TodoList from './components/TodoList';
import TodoSearch from './components/TodoSearch';
import InputModal from './components/InputModal';
import { useStore } from './store';
import { useTodos } from './hooks/useTodos';

export default function App() {
  const petState = useStore((s) => s.petState);
  const showInput = useStore((s) => s.showInput);
  const setShowInput = useStore((s) => s.setShowInput);
  const setPetState = useStore((s) => s.setPetState);
  const { todos, handleAdd, handleToggle, handleDelete } = useTodos();
  const [images] = useState({ idle: null, active: null, speaking: null });

  return (
    <div
      className="app-container"
      onMouseEnter={() => setPetState('active')}
      onMouseLeave={() => setPetState('idle')}
    >
      <PetView
        petState={petState}
        images={images}
        onClick={() => setShowInput(true)}
      />
      <div className="app-content">
        <TodoSearch />
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
    </div>
  );
}