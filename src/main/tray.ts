import { Tray, Menu, app, nativeImage } from 'electron';
import { getMainWindow } from './window';
import { openSettingsWindow } from './settingsWindow';

let tray: Tray | null = null;

const TRAY_ICON = nativeImage.createFromDataURL(
  `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#7c3aed"/><text x="8" y="11" text-anchor="middle" font-size="9" fill="white">T</text></svg>'
  )}`
);

export function createTray(): Tray {
  tray = new Tray(TRAY_ICON.resize({ width: 16, height: 16 }));
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
