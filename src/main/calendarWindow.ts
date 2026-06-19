import { BrowserWindow, screen, nativeImage } from 'electron';
import path from 'path';
import { SettingsService } from '../services/SettingsService';

const BOUNDS_KEYS = {
  x: 'calendar_window_x',
  y: 'calendar_window_y',
  width: 'calendar_window_width',
  height: 'calendar_window_height',
} as const;

const DEFAULT_BOUNDS = { width: 480, height: 600 };

let calendarWindow: BrowserWindow | null = null;
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
    console.warn('[CalendarWindow] Failed to save window bounds:', err);
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
    if (isValid) return saved;
  }
  return DEFAULT_BOUNDS;
}

export function createCalendarWindow(): BrowserWindow {
  const bounds = getValidBounds();
  const preloadPath = path.join(__dirname, '../preload/index.js');

  calendarWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 400,
    minHeight: 500,
    resizable: true,
    frame: true,
    title: 'Mochi - Calendar',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  calendarWindow.on('close', () => {
    if (calendarWindow) saveWindowBounds(calendarWindow);
  });

  calendarWindow.on('closed', () => {
    calendarWindow = null;
  });

  const iconPath = path.join(__dirname, '../../assets/icon.png');
  if (require('fs').existsSync(iconPath)) {
    calendarWindow.setIcon(nativeImage.createFromPath(iconPath));
  }

  const calendarHtmlPath = path.join(__dirname, '../../dist-renderer/src-renderer/calendar.html');
  console.log('[CalendarWindow] Loading:', calendarHtmlPath);
  calendarWindow.loadFile(calendarHtmlPath);

  calendarWindow.once('ready-to-show', () => {
    console.log('[CalendarWindow] Ready to show');
    calendarWindow?.show();
  });

  calendarWindow.webContents.on('did-fail-load', (_event, _code, desc) => {
    console.error('[CalendarWindow] Failed to load:', desc);
  });

  return calendarWindow;
}

export function openCalendarWindow(): BrowserWindow {
  if (calendarWindow && !calendarWindow.isDestroyed()) {
    if (calendarWindow.isMinimized()) calendarWindow.restore();
    calendarWindow.show();
    calendarWindow.focus();
    return calendarWindow;
  }
  return createCalendarWindow();
}

export function closeCalendarWindow(): void {
  if (calendarWindow && !calendarWindow.isDestroyed()) {
    calendarWindow.close();
    calendarWindow = null;
  }
}

export function getCalendarWindow(): BrowserWindow | null {
  return calendarWindow;
}
