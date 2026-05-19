import { app, BrowserWindow } from 'electron';
import { createMainWindow, getMainWindow } from './window';
import { createTray } from './tray';
import { initDatabase, closeDatabase } from '../database/connection';
import { registerIpcHandlers } from './ipc';
import { registerGlobalShortcut, unregisterAllShortcuts } from './shortcut';
import log from 'electron-log';

log.initialize();

let isQuitting = false;

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();

  const win = createMainWindow();
  createTray();
  registerGlobalShortcut(win);

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
});

app.on('will-quit', () => {
  unregisterAllShortcuts();
});

app.on('before-quit', () => {
  isQuitting = true;
  closeDatabase();
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
  }
});
