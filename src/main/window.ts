import { BrowserWindow, screen, app } from 'electron';
import path from 'path';
import { getSetting, setSetting } from '../services/SettingsService';

let mainWindow: BrowserWindow | null = null;
let isInteracting = false;

export function saveWindowPosition(win: BrowserWindow): void {
  const [x, y] = win.getPosition();
  setSetting('window_position_x', String(x));
  setSetting('window_position_y', String(y));
}

export function loadWindowPosition(): { x: number; y: number } | null {
  const x = getSetting('window_position_x');
  const y = getSetting('window_position_y');
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

  mainWindow = new BrowserWindow({
    width: 320,
    height: 540,
    x: initialPos?.x,
    y: initialPos?.y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating');

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }

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
