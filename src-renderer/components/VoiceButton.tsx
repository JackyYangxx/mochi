import React from 'react';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import './VoiceButton.css';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
}

export default function VoiceButton({ onTranscript }: VoiceButtonProps) {
  const { isListening, startListening, stopListening, isSupported } = useSpeechRecognition();

  const handleMouseDown = () => {
    if (!isListening) {
      startListening();
    }
  };

  const handleMouseUp = () => {
    if (isListening) {
      stopListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <button
      className={`voice-button ${isListening ? 'listening' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      aria-label="Voice input"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    </button>
  );
}
