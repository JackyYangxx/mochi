import { app, BrowserWindow } from 'electron';
import { createMainWindow, getMainWindow, saveWindowPosition } from './window';
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
  // Set auto-launch from saved setting
  const autoLaunchEnabled = app.getLoginItemSettings().openAtLogin;
  log.info(`Auto-launch: ${autoLaunchEnabled}`);
  registerGlobalShortcut(win);

  // Register IPC handler for auto-launch setting
  const { ipcMain } = require('electron');
  ipcMain.handle('settings:setAutoLaunch', (_event: any, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    log.info(`Auto-launch set to: ${enabled}`);
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
    saveWindowPosition(win);
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
