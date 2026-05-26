import { app, BrowserWindow, ipcMain } from 'electron';
import { createMainWindow, getMainWindow, saveWindowPosition } from './window';
import { createTray } from './tray';
import { openSettingsWindow, closeSettingsWindow } from './settingsWindow';
import { initDatabase, closeDatabase, getDb } from '../database/connection';
import { registerIpcHandlers } from './ipc';
import { registerGlobalShortcut, unregisterAllShortcuts } from './shortcut';
import { ReminderService } from '../services/ReminderService';
import { CLIExecutor } from '../services/CLIExecutor';
import { LLMService } from '../services/LLMService';
import { SettingsService } from '../services/SettingsService';
import log from 'electron-log';

log.initialize();

let isQuitting = false;
let reminderService: ReminderService | null = null;

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();

  const win = createMainWindow();

  // Ensure window shows properly - especially important on Windows
  win.once('ready-to-show', () => {
    win.show();
  });

  createTray();
  // Set auto-launch from saved setting
  const autoLaunchEnabled = app.getLoginItemSettings().openAtLogin;
  log.info(`Auto-launch: ${autoLaunchEnabled}`);
  registerGlobalShortcut(win);

  // Initialize ReminderService
  const settingsService = new SettingsService();
  const llmService = new LLMService();
  const cliExecutor = new CLIExecutor();
  reminderService = new ReminderService(cliExecutor, llmService, settingsService);
  reminderService.start();

  // Register IPC handler for auto-launch setting
  ipcMain.handle('settings:setAutoLaunch', (_event: any, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    log.info(`Auto-launch set to: ${enabled}`);
  });

  // Settings window IPC handlers
  ipcMain.handle('settings:window:open', () => {
    openSettingsWindow();
  });

  ipcMain.handle('settings:window:close', () => {
    closeSettingsWindow();
  });

  ipcMain.handle('settings:saved', () => {
    try {
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('refresh-pet-images');
      }
    } catch (error) {
      log.error('Error in settings:saved handler:', error);
    }
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      saveWindowPosition(win);
    }
  });
});

app.on('will-quit', () => {
  unregisterAllShortcuts();
  reminderService?.stop();
});

app.on('before-quit', () => {
  isQuitting = true;
  reminderService?.stop();
  closeDatabase();
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
  }
});
