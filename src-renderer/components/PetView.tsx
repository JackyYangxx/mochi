import React, { useState, useEffect, useCallback } from 'react';
import './PetView.css';

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

  const currentImage = images[petState] || images.idle || '';

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
        ) : (
          <div className="pet-default-icon" />
        )}
      </div>
    </div>
  );
}