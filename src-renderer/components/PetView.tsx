import React, { useState, useEffect, useCallback } from 'react';
import './PetView.css';

const DEFAULT_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="60" fill="#a78bfa" opacity="0.3"/><text x="64" y="72" text-anchor="middle" font-size="48" fill="#7c3aed">🐾</text></svg>'
)}`;

interface PetViewProps {
  petState?: 'idle' | 'active' | 'speaking';
  petSize?: 'small' | 'medium' | 'large';
  images: {
    idle: string | null;
    active: string | null;
    speaking: string | null;
  };
  onPetClick?: () => void;
}

export default function PetView({
  petState = 'idle',
  petSize = 'medium',
  images,
  onPetClick,
}: PetViewProps) {
  const [tipsMessage, setTipsMessage] = useState('');

  // Listen for daily report generation
  useEffect(() => {
    const unsubscribe = window.todoAPI.onDailyReportGenerated((path: string) => {
      setTipsMessage(`日报已生成: ${path}`);
      setTimeout(() => setTipsMessage(''), 5000);
    });
    return unsubscribe;
  }, []);

  const handleClick = useCallback(() => {
    onPetClick?.();
  }, [onPetClick]);

  const currentImage = images[petState] || images.idle || DEFAULT_ICON;

  return (
    <div className={`pet-view pet-size-${petSize}`}>
      {tipsMessage && (
        <div className="pet-tips">
          {tipsMessage}
        </div>
      )}
      <div
        className={`pet-image ${petState === 'active' ? 'pet-state-active' : ''} ${petState === 'speaking' ? 'pet-state-speaking' : ''}`}
        onClick={handleClick}
      >
        {currentImage ? (
          <img src={currentImage} alt="Pet" className="pet-image" />
        ) : null}
      </div>
    </div>
  );
}