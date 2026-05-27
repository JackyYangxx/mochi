import { Tray, Menu, app, nativeImage } from 'electron';
import { getMainWindow } from './window';
import { openSettingsWindow } from './settingsWindow';
import path from 'path';

let tray: Tray | null = null;

function createTrayIcon(): Electron.NativeImage {
  // Use the icon.png from assets folder
  const iconPath = path.join(__dirname, '../../assets/icon.png');
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      // Resize to 16x16 for tray
      const resized = icon.resize({ width: 16, height: 16 });
      if (process.platform === 'darwin') {
        resized.setTemplateImage(true);
      }
      return resized;
    }
  } catch (e) {
    console.warn('[Tray] Failed to load icon from file:', e);
  }

  // Fallback: create a simple purple icon
  const fallbackIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA3klEQVQ4T6WTuw3CQBBE3y6IUAQRUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUoYiRQSX8LBhYHYX3su9YCGEGGNM0zQxxph933dd13W2bVvvvVf/IMl7VVXfqqr6att21XVd9x9J3iuEGGOMaZrmW9M0bUmvv5DkvX3f99M0zY+qql7GcfyepumbaZq+jeN4bppm3/f9b+Pf5zN+A4mIJMm2bddt2y7Lspzb9r6u67mI3N8xTVPXdT2u63o8TdMhpb8kqW3behiG4+77/t627bppmn3btk9N0yzb9rmI3N8xTVPXdT0O4zBc4ji+L8uyHAD2C/gWjV/gE3j7AAAAAElFTkSuQmCC'
  );
  return fallbackIcon;
}

export function createTray(): Tray {
  const icon = createTrayIcon();
  console.log('[Tray] Icon created, isEmpty:', icon.isEmpty());
  tray = new Tray(icon);
  tray.setToolTip('Desktop Todo');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        openSettingsWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  return tray;
}

export function getTray(): Tray | null {
  return tray;
}
