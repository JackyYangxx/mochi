# Settings Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设置面板从 React Overlay 改为独立的 Electron BrowserWindow，可自由调整大小和拖动

**Architecture:** 创建独立的 `settingsWindow.ts` 管理 BrowserWindow，渲染进程使用独立的 `settings.html` 入口，复用现有 SettingsPanel 组件。通过 IPC `settings:saved` 通知主窗口刷新宠物图片。

**Tech Stack:** Electron BrowserWindow, Vite multi-page, IPC

---

## File Structure

```
src/
  main/
    settingsWindow.ts    # [NEW] 设置窗口创建和管理
    index.ts             # [MOD] 注册 settingsWindow IPC

src-renderer/
  settings.html          # [NEW] 设置页面 HTML 入口
  settings/
    SettingsApp.tsx      # [NEW] 设置页面 React 入口
```

---

## Task 1: Create settingsWindow.ts

**Files:**
- Create: `src/main/settingsWindow.ts`

```typescript
import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { SettingsService } from '../services/SettingsService';

let settingsWindow: BrowserWindow | null = null;

function getSettingsService(): SettingsService {
  return new SettingsService();
}

function loadWindowBounds(): { x: number; y: number; width: number; height: number } | null {
  const s = getSettingsService();
  const x = s.get('settings_window_x');
  const y = s.get('settings_window_y');
  const width = s.get('settings_window_width');
  const height = s.get('settings_window_height');
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
  const s = getSettingsService();
  const [x, y] = win.getPosition();
  const [width, height] = win.getSize();
  s.set('settings_window_x', String(x));
  s.set('settings_window_y', String(y));
  s.set('settings_window_width', String(width));
  s.set('settings_window_height', String(height));
}

export function createSettingsWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, '../preload/index.js');
  const bounds = loadWindowBounds();

  settingsWindow = new BrowserWindow({
    width: bounds?.width || 480,
    height: bounds?.height || 600,
    x: bounds?.x,
    y: bounds?.y,
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
      webSecurity: false,
    },
  });

  const htmlPath = path.join(__dirname, '../../dist-renderer/settings.html');
  settingsWindow.loadFile(htmlPath);

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });

  settingsWindow.on('close', () => {
    if (settingsWindow) {
      saveWindowBounds(settingsWindow);
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function openSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  createSettingsWindow();
}

export function closeSettingsWindow(): void {
  if (settingsWindow) {
    settingsWindow.close();
    settingsWindow = null;
  }
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}
```

---

## Task 2: Register IPC handlers in index.ts

**Files:**
- Modify: `src/main/index.ts`

```typescript
import { openSettingsWindow, closeSettingsWindow } from './settingsWindow';
import { getMainWindow } from './window';

// In registerIpcHandlers():
ipcMain.handle('settings:window:open', () => {
  openSettingsWindow();
});

ipcMain.handle('settings:window:close', () => {
  closeSettingsWindow();
});

ipcMain.handle('settings:saved', () => {
  // Notify main window to refresh pet images
  const mainWin = getMainWindow();
  if (mainWin) {
    mainWin.webContents.send('refresh-pet-images');
  }
});
```

---

## Task 3: Update tray.ts to use settings window

**Files:**
- Modify: `src/main/tray.ts`

Change the Settings menu item click handler:

```typescript
{
  label: 'Settings',
  click: () => {
    openSettingsWindow();
  },
},
```

---

## Task 4: Create settings.html

**Files:**
- Create: `src-renderer/settings.html`

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Desktop Todo - Settings</title>
  <script type="module" crossorigin src="./assets/settings-CZefxd5P.js"></script>
  <link rel="stylesheet" crossorigin href="./assets/settings-CZefxd5P.css">
</head>
<body>
  <div id="root"></div>
</body>
</html>
```

---

## Task 5: Create SettingsApp.tsx

**Files:**
- Create: `src-renderer/settings/SettingsApp.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import SettingsPanel from '../components/SettingsPanel';
import '../components/SettingsPanel.css';

function SettingsApp() {
  const handleClose = () => {
    window.todoAPI.closeSettingsWindow();
  };

  return <SettingsPanel onClose={handleClose} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);
```

---

## Task 6: Update preload to add closeSettingsWindow

**Files:**
- Modify: `src/preload/index.ts`

Add to the API:

```typescript
closeSettingsWindow: () => ipcRenderer.invoke('settings:window:close'),
```

---

## Task 7: Update vite.config.ts for multi-page

**Files:**
- Modify: `vite.config.ts`

```typescript
export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        settings: path.resolve(__dirname, 'src-renderer/settings.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

Also need to move `index.html` to `src-renderer/` to match the structure, or adjust the input paths accordingly.

---

## Task 8: Add App.tsx listener for refresh-pet-images

**Files:**
- Modify: `src-renderer/App.tsx`

Add in the useEffect:

```typescript
useEffect(() => {
  const cleanup = window.todoAPI.onRefreshPetImages(() => {
    window.todoAPI.getPetImages().then((images) => {
      if (images) {
        setPetImages({
          idle: images.idle || null,
          active: images.active || null,
          speaking: images.speaking || null,
        });
      }
    });
  });
  return cleanup;
}, [setPetImages]);
```

Also need to add `setPetImages` to the store hooks and `petImages` state if not already present. (The pet image persistence fix already added these - verify they exist.)

---

## Task 9: Add onRefreshPetImages to preload

**Files:**
- Modify: `src/preload/index.ts`

Add to the API:

```typescript
onRefreshPetImages: (callback: () => void) => {
  const listener = () => callback();
  ipcRenderer.on('refresh-pet-images', listener);
  return () => ipcRenderer.removeListener('refresh-pet-images', listener);
},
```

---

## Task 10: Update App.tsx to use petImages from store

**Files:**
- Modify: `src-renderer/App.tsx`

Verify that `petImages` state is properly initialized from store and passed to PetView. This was partially implemented in the pet image persistence fix. Ensure:

1. `petImages` is read from store: `const petImages = useStore((s) => s.petImages);`
2. `setPetImages` updates store
3. `images={petImages}` is passed to PetView

---

## Task 11: Update electron-builder.yml for settings page

**Files:**
- Modify: `electron-builder.yml`

```yaml
files:
  - dist/**/*
  - dist-renderer/**/*
  - package.json
extraMetadata:
  main: dist/main/index.js
```

确保 `dist-renderer/settings.html` 和相关 assets 被打包。

---

## Task 12: Build and test

- [ ] Run `pnpm build` to build both pages
- [ ] Verify `dist-renderer/settings.html` and assets exist
- [ ] Test tray Settings opens independent window
- [ ] Verify window is resizable and movable
- [ ] Upload pet image in settings, close window, verify main window shows new image
- [ ] Close and reopen settings window, verify position/size restored

---

## Dependencies

- Task 1 → Task 2 → Task 3 (tray depends on settingsWindow)
- Task 4, 5 → Task 7 (HTML/TSX files needed for Vite config)
- Task 6 → Task 5 (preload API needed in SettingsApp)
- Task 9 → Task 8 (preload API needed in App listener)
