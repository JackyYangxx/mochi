import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { SettingsService } from '../services/SettingsService';

let settingsWindow: BrowserWindow | null = null;
let settingsService: SettingsService | null = null;

function getSettingsService(): SettingsService {
  if (!settingsService) {
    settingsService = new SettingsService();
  }
  return settingsService;
}

interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

function loadWindowBounds(): WindowBounds | null {
  const ss = getSettingsService();
  const x = ss.get('settings_window_x');
  const y = ss.get('settings_window_y');
  const width = ss.get('settings_window_width');
  const height = ss.get('settings_window_height');

  if (x && y && width && height) {
    return {
      x: parseInt(x, 10),
      y: parseInt(y, 10),
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    };
  }
  return null;
}

function saveWindowBounds(win: BrowserWindow): void {
  const ss = getSettingsService();
  try {
    const [x, y] = win.getPosition();
    const [width, height] = win.getSize();
    ss.set('settings_window_x', String(x));
    ss.set('settings_window_y', String(y));
    ss.set('settings_window_width', String(width));
    ss.set('settings_window_height', String(height));
  } catch (err) {
    console.warn('[SettingsWindow] Failed to save window bounds:', err);
  }
}

function getValidBounds(): WindowBounds {
  const saved = loadWindowBounds();
  if (saved) {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const isValid =
      saved.x !== undefined &&
      saved.y !== undefined &&
      saved.x >= 0 &&
      saved.x < screenWidth &&
      saved.y >= 0 &&
      saved.y < screenHeight;
    if (isValid) {
      return saved;
    }
  }
  return { width: 480, height: 600 };
}

export function createSettingsWindow(): BrowserWindow {
  const bounds = getValidBounds();

  const preloadPath = path.join(__dirname, '../preload/index.js');

  settingsWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: true,
    title: 'Desktop Todo - Settings',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.on('close', () => {
    if (settingsWindow) {
      saveWindowBounds(settingsWindow);
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  const settingsHtmlPath = path.join(__dirname, '../../dist-renderer/settings.html');
  settingsWindow.loadFile(settingsHtmlPath);

  return settingsWindow;
}

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }
  return createSettingsWindow();
}

export function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  }
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}