import React from 'react';
import SettingsPanel from '../components/SettingsPanel';

export default function SettingsApp() {
  return <SettingsPanel onClose={() => window.todoAPI.closeSettingsWindow()} />;
}