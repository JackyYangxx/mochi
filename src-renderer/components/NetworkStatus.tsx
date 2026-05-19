import React, { useState, useEffect } from 'react';
import './NetworkStatus.css';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`network-status ${isOnline ? 'online' : 'offline'}`}>
      <span className="network-indicator" />
      <span className="network-label">
        {isOnline ? '在线' : '离线'}
      </span>
    </div>
  );
}
