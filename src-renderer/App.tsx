import React, { useState } from 'react';
import PetView from './components/PetView';

export default function App() {
  const [petState, setPetState] = useState<'idle' | 'active' | 'speaking'>('idle');
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
        onClick={() => setPetState('active')}
      />
    </div>
  );
}
