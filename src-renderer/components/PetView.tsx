import React, { useState, useEffect, useCallback } from 'react';
import './PetView.css';

interface PetViewProps {
  petImage: string;
  petState?: 'idle' | 'active' | 'speaking';
  petSize?: 'small' | 'medium' | 'large';
  onPetClick?: () => void;
}

export default function PetView({
  petImage,
  petState = 'idle',
  petSize = 'medium',
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
        <img src={petImage} alt="Pet" className="pet-image" />
      </div>
    </div>
  );
}