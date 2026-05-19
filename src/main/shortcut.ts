import { globalShortcut, BrowserWindow } from 'electron';
import log from 'electron-log';

export function registerGlobalShortcut(window: BrowserWindow): void {
  const registered = globalShortcut.register('CommandOrControl+Shift+T', () => {
    log.info('Global shortcut triggered');
    if (window.isMinimized()) window.restore();
    if (!window.isVisible()) window.show();
    window.focus();
    window.webContents.send('trigger-input');
  });

  if (!registered) {
    log.warn('Failed to register global shortcut CommandOrControl+Shift+T');
  }
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}