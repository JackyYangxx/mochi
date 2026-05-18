import React from 'react';
import './PetView.css';

const DEFAULT_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="60" fill="#a78bfa" opacity="0.3"/><text x="64" y="72" text-anchor="middle" font-size="48" fill="#7c3aed">🐾</text></svg>'
)}`;

interface PetImages {
  idle: string | null;
  active: string | null;
  speaking: string | null;
}

type PetState = 'idle' | 'active' | 'speaking';

interface PetViewProps {
  petState: PetState;
  images: PetImages;
  onClick?: () => void;
}

function getImageSrc(state: PetState, images: PetImages): string {
  if (state === 'speaking' && images.speaking) return images.speaking;
  if (state === 'active' && images.active) return images.active;
  if (images.idle) return images.idle;
  if (images.speaking) return images.speaking;
  if (images.active) return images.active;
  return DEFAULT_ICON;
}

export default function PetView({ petState, images, onClick }: PetViewProps) {
  const src = getImageSrc(petState, images);

  return (
    <div
      className={`pet-view pet-state-${petState}`}
      onClick={onClick}
      data-testid="pet-view"
    >
      <img
        src={src}
        alt="pet"
        className="pet-image"
        draggable={false}
      />
    </div>
  );
}
