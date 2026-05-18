import { app, BrowserWindow } from 'electron';
import { createMainWindow, getMainWindow } from './window';
import { createTray } from './tray';
import log from 'electron-log';

log.initialize();

let isQuitting = false;

app.whenReady().then(() => {
  const win = createMainWindow();
  createTray();

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
  }
});
