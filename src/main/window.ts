import { BrowserWindow, screen, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { SettingsService } from '../services/SettingsService';

let mainWindow: BrowserWindow | null = null;
let isInteracting = false;
let settingsService: SettingsService | null = null;

// 窗口尺寸常量。todo list 默认高度 = 屏幕 40–50%,以 1080p 屏幕 (1080px) 为基准
// 大约 520px,加 pet (168px) + padding ≈ 700px。折叠后只留 pet 区域。
const WINDOW_WIDTH = 320;
const WINDOW_HEIGHT_EXPANDED = 700;
const WINDOW_HEIGHT_COLLAPSED = 220;

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
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT_EXPANDED,
    x: initialPos?.x,
    y: initialPos?.y,
    frame: false,
    transparent: true,
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
      // 禁用后台限流,让宠物 GIF 在其他应用获焦时仍持续动画。
      // 代价是未聚焦时仍消耗少量 CPU,对悬浮宠物窗口可忽略。
      backgroundThrottling: false,
    },
  });

  console.log('[Window] BrowserWindow created');
  console.log('[Window] webContents:', mainWindow.webContents);
  console.log('[Window] Preload script running in:', mainWindow.webContents.getURL());

  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating');

  // 跨 DPI 显示器拖动时,Windows 会自动 resize 窗口以保持物理尺寸,
  // 导致 CSS 像素宽度变化,UI 拉伸变长。强制回到当前折叠状态对应的高度。
  let isCollapsed = false;
  const targetHeight = (): number =>
    isCollapsed ? WINDOW_HEIGHT_COLLAPSED : WINDOW_HEIGHT_EXPANDED;
  const resetSize = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [w, h] = mainWindow.getSize();
    if (w !== WINDOW_WIDTH || h !== targetHeight()) {
      mainWindow.setSize(WINDOW_WIDTH, targetHeight());
    }
  };
  screen.on('display-metrics-changed', resetSize);
  mainWindow.on('moved', resetSize);

  // 失焦再获焦后,Windows 软件合成路径上的 GIF 解码器有时不会自动恢复。
  // 主动通知渲染端刷新 <img src> (加 cache-busting query) 强制解码器重启。
  mainWindow.on('focus', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('pet-gif-reload');
  });

  // 渲染端点击折叠按钮后,resize 窗口并保持底边位置不变 (pet 不会跳)。
  ipcMain.removeHandler('window:setCollapsed');
  ipcMain.handle('window:setCollapsed', (_event, collapsed: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    isCollapsed = !!collapsed;
    const newH = targetHeight();
    const [x, y] = mainWindow.getPosition();
    const [, currentH] = mainWindow.getSize();
    const bottomY = y + currentH;
    mainWindow.setSize(WINDOW_WIDTH, newH);
    mainWindow.setPosition(x, bottomY - newH);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log('[Renderer Console]', message);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.log('[Renderer Process Gone]', details);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('[Failed Load]', errorCode, errorDescription);
  });

  const iconPath = path.join(__dirname, '../../assets/icon.png');
  if (require('fs').existsSync(iconPath)) {
    mainWindow.setIcon(nativeImage.createFromPath(iconPath));
  }

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
