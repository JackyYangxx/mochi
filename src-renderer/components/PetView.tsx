import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './PetView.css';
import defaultPetGif from '../../assets/pet-default.gif';
import { useEncouragement } from '../hooks/useEncouragement';
import { useStore } from '../store';

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
  const imgRef = useRef<HTMLImageElement>(null);

  // Listen for daily report generation
  useEffect(() => {
    const unsubscribe = window.todoAPI.onDailyReportGenerated((path: string) => {
      setExternalTip(`日报已生成: ${path}`);
      setTimeout(() => setExternalTip(''), 5000);
    });
    return unsubscribe;
  }, []);

  // Window regained focus: nudge the GIF decoder to restart in case the
  // Windows software-compositor path left it paused. Setting src to '' and
  // back via rAF forces a fresh decode without going through React's
  // reconciliation (avoids tearing down the <img> DOM node).
  useEffect(() => {
    const unsubscribe = window.todoAPI.onPetGifReload(() => {
      const img = imgRef.current;
      if (!img) return;
      const src = img.src;
      if (!src) return;
      img.src = '';
      requestAnimationFrame(() => {
        if (imgRef.current) {
          imgRef.current.src = src;
        }
      });
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

  const isCollapsed = useStore((s) => s.isCollapsed);
  const setIsCollapsed = useStore((s) => s.setIsCollapsed);
  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsCollapsed(!isCollapsed);
    },
    [isCollapsed, setIsCollapsed]
  );

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
        <button
          className="collapse-toggle"
          onClick={handleToggleCollapse}
          aria-label={isCollapsed ? '展开待办列表' : '折叠待办列表'}
          title={isCollapsed ? '展开' : '折叠'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
          >
            <path
              d="M2.5 4.5 L6 8 L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {currentImage ? (
          <img ref={imgRef} src={currentImage} alt="Pet" className="pet-image" />
        ) : null}
      </div>
    </div>
  );
}
