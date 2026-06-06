import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './PetView.css';
import defaultPetGif from '../../assets/pet-default.gif';
import { useEncouragement } from '../hooks/useEncouragement';

const DEFAULT_ICON = defaultPetGif;

interface PetViewProps {
  petState?: 'idle' | 'active' | 'speaking';
  petSize?: 'small' | 'medium' | 'large';
  images: {
    idle: string | null;
    active: string | null;
    speaking: string | null;
  };
  aiEnabled?: boolean;
  onPetClick?: () => void;
}

export default function PetView({
  petState = 'idle',
  petSize = 'medium',
  images,
  aiEnabled = false,
  onPetClick,
}: PetViewProps) {
  const [externalTip, setExternalTip] = useState('');

  // Listen for daily report generation
  useEffect(() => {
    const unsubscribe = window.todoAPI.onDailyReportGenerated((path: string) => {
      setExternalTip(`日报已生成: ${path}`);
      setTimeout(() => setExternalTip(''), 5000);
    });
    return unsubscribe;
  }, []);

  const generate = useCallback(() => window.todoAPI.generateEncouragement(), []);
  const { currentTip } = useEncouragement({
    aiEnabled,
    isExternalTipActive: externalTip !== '',
    generate,
  });

  const handleClick = useCallback(() => {
    console.log('PetView clicked, onPetClick:', !!onPetClick);
    onPetClick?.();
  }, [onPetClick]);

  const currentImage = images[petState] || images.idle || DEFAULT_ICON;
  const displayedTip = useMemo(() => externalTip || currentTip, [externalTip, currentTip]);

  return (
    <div className={`pet-view pet-size-${petSize}`}>
      {displayedTip && (
        <div className="pet-tips">
          {displayedTip}
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
