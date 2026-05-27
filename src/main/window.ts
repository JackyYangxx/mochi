import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { SettingsService } from '../services/SettingsService';

let mainWindow: BrowserWindow | null = null;
let isInteracting = false;
let settingsService: SettingsService | null = null;

export function saveWindowPosition(win: BrowserWindow): void {
  if (!settingsService) {
    settingsService = new SettingsService();
  }
  try {
    const [x, y] = win.getPosition();
    settingsService.set('window_position_x', String(x));
    settingsService.set('window_position_y', String(y));
  } catch (err) {
    console.warn('[Window] Failed to save window position:', err);
  }
}

export function loadWindowPosition(): { x: number; y: number } | null {
  if (!settingsService) {
    settingsService = new SettingsService();
  }
  const x = settingsService.get('window_position_x');
  const y = settingsService.get('window_position_y');
  if (x && y) return { x: parseInt(x, 10), y: parseInt(y, 10) };
  return null;
}

function getInitialPosition(): { x: number; y: number } | undefined {
  const saved = loadWindowPosition();
  if (saved) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    if (saved.x >= 0 && saved.x < screenWidth && saved.y >= 0 && saved.y < screenHeight) {
      return saved;
    }
  }
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  return { x: screenWidth - 340, y: 100 };
}

export function createMainWindow(): BrowserWindow {
  const initialPos = getInitialPosition();

  const preloadPath = path.join(__dirname, '../preload/index.js');
  console.log('[Window] Preload path:', preloadPath);
  console.log('[Window] __dirname:', __dirname);
  console.log('[Window] preload exists:', require('fs').existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    width: 320,
    height: 540,
    x: initialPos?.x,
    y: initialPos?.y,
    frame: false,
    transparent: process.platform === 'darwin', // Only enable transparency on macOS
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000', // Fully transparent for macOS
    show: true, // Show window immediately
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  console.log('[Window] BrowserWindow created');
  console.log('[Window] webContents:', mainWindow.webContents);
  console.log('[Window] Preload script running in:', mainWindow.webContents.getURL());

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating');

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[Renderer Console]', message);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.log('[Renderer Process Gone]', details);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('[Failed Load]', errorCode, errorDescription);
  });

  const distRendererPath = path.join(__dirname, '../../dist-renderer/index.html');
  console.log('[Window] Loading file:', distRendererPath);
  mainWindow.loadFile(distRendererPath);

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setMouseIgnore(ignore: boolean): void {
  if (!mainWindow) return;
  if (ignore) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  } else {
    mainWindow.setIgnoreMouseEvents(false);
  }
}

export function setInteracting(value: boolean): void {
  isInteracting = value;
  setMouseIgnore(!value);
}

export function isWindowInteracting(): boolean {
  return isInteracting;
}
