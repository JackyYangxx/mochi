import React from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarApp } from './CalendarApp';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <CalendarApp />
  </React.StrictMode>
);