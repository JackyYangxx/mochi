import { BrowserWindow, screen, nativeImage } from 'electron';
import path from 'path';
import { SettingsService } from '../services/SettingsService';

const BOUNDS_KEYS = {
  x: 'settings_window_x',
  y: 'settings_window_y',
  width: 'settings_window_width',
  height: 'settings_window_height',
} as const;

const DEFAULT_SETTINGS_WINDOW_SIZE = { width: 480, height: 600 };

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
  const x = ss.get(BOUNDS_KEYS.x);
  const y = ss.get(BOUNDS_KEYS.y);
  const width = ss.get(BOUNDS_KEYS.width);
  const height = ss.get(BOUNDS_KEYS.height);

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
    ss.set(BOUNDS_KEYS.x, String(x));
    ss.set(BOUNDS_KEYS.y, String(y));
    ss.set(BOUNDS_KEYS.width, String(width));
    ss.set(BOUNDS_KEYS.height, String(height));
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
  return DEFAULT_SETTINGS_WINDOW_SIZE;
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
    frame: false,
    title: 'Mochi - Settings',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
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

  const iconPath = path.join(__dirname, '../../assets/icon.png');
  if (require('fs').existsSync(iconPath)) {
    settingsWindow.setIcon(nativeImage.createFromPath(iconPath));
  }

  const settingsHtmlPath = path.join(__dirname, '../../dist-renderer/src-renderer/settings.html');
  console.log('[SettingsWindow] Loading:', settingsHtmlPath);
  settingsWindow.loadFile(settingsHtmlPath);

  settingsWindow.once('ready-to-show', () => {
    console.log('[SettingsWindow] Ready to show');
    settingsWindow?.show();
  });

  settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[SettingsWindow] Failed to load:', errorDescription);
  });

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