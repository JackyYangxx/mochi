import React from 'react';
import SettingsPanel from '../components/SettingsPanel';
import '../components/SettingsPanel.css';

export default function SettingsApp() {
  const handleClose = () => {
    window.todoAPI.closeSettingsWindow();
  };

  return <SettingsPanel onClose={handleClose} />;
}