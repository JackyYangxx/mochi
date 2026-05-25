import React from 'react';
import ReactDOM from 'react-dom/client';
import SettingsPanel from '../components/SettingsPanel';
import '../components/SettingsPanel.css';

function SettingsApp() {
  const handleClose = () => {
    window.todoAPI.closeSettingsWindow();
  };

  return <SettingsPanel onClose={handleClose} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);