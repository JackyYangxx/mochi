# Desktop Todo Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron + React desktop pet todo app with voice input, LLM-powered daily reminders, and CLI-based IM notifications.

**Architecture:** Electron main process manages window/tray/shortcuts/IPC; React renderer handles UI. Services run in the main process with SQLite persistence. Renderer communicates via a `contextBridge` preload API. All code is TypeScript. TDD: tests written first, then implementation.

**Tech Stack:** Electron 28, React 18, TypeScript, better-sqlite3, Vite, Vitest, pnpm

---

## File Structure

```
desktop-todo-list/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts              # Vite config for renderer
├── electron-builder.yml
├── index.html                  # HTML entry for renderer
├── src/
│   ├── main/                   # Electron main process
│   │   ├── index.ts            # App entry, lifecycle, IPC wiring
│   │   ├── window.ts           # Window creation & management
│   │   ├── shortcut.ts         # Global shortcut registration
│   │   ├── tray.ts             # System tray
│   │   └── ipc.ts              # IPC handler registration
│   ├── services/               # Business logic (main process)
│   │   ├── TodoService.ts      # Todo CRUD operations
│   │   ├── ReminderService.ts  # Reminder scheduling & dispatch
│   │   ├── LLMService.ts       # LLM API calls
│   │   ├── CLIExecutor.ts      # Safe child_process wrapper
│   │   └── KeyStore.ts         # safeStorage wrapper for API keys
│   ├── database/
│   │   ├── connection.ts       # SQLite connection, schema init, migrations
│   │   └── migrations/
│   │       └── 001_initial.ts  # Initial schema
│   ├── preload/
│   │   └── index.ts            # contextBridge API
│   └── shared/
│       └── types.ts            # Shared TypeScript types
├── src-renderer/               # React renderer process
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Root component
│   ├── App.css                 # Global styles
│   ├── components/
│   │   ├── PetView.tsx         # Pet avatar display
│   │   ├── PetView.css
│   │   ├── TodoList.tsx        # Todo list with drag sort
│   │   ├── TodoList.css
│   │   ├── TodoItem.tsx        # Single todo row
│   │   ├── TodoItem.css
│   │   ├── TodoSearch.tsx      # Search/filter input
│   │   ├── InputModal.tsx      # Add-todo modal with voice button
│   │   ├── InputModal.css
│   │   ├── VoiceButton.tsx     # Press-to-talk voice button
│   │   ├── NetworkStatus.tsx   # Online/offline indicator
│   │   └── SettingsPanel.tsx   # Settings form
│   ├── hooks/
│   │   ├── useSpeechRecognition.ts
│   │   └── useTodos.ts
│   └── store/
│       └── index.ts            # Zustand store
└── tests/
    ├── unit/
    │   ├── TodoService.test.ts
    │   ├── CLIExecutor.test.ts
    │   ├── KeyStore.test.ts
    │   └── LLMService.test.ts
    ├── components/
    │   ├── PetView.test.tsx
    │   ├── TodoList.test.tsx
    │   └── InputModal.test.tsx
    └── e2e/
        └── todo-flow.spec.ts
```

---

## Phase 1: Project Scaffolding

### Task 1: Initialize project with pnpm, Electron, React, Vite, TypeScript

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `electron-builder.yml`
- Create: `index.html`
- Create: `src/shared/types.ts`
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src-renderer/main.tsx`
- Create: `src-renderer/App.tsx`
- Create: `src-renderer/App.css`

- [ ] **Step 1: Initialize pnpm project and install dependencies**

Run:
```bash
cd /Users/fxy/Documents/projects/desktop-todo-list
pnpm init
```

Expected: `package.json` created.

- [ ] **Step 2: Install production dependencies**

Run:
```bash
pnpm add electron@^28.0.0 react@^18.2.0 react-dom@^18.2.0 better-sqlite3@^9.0.0 openai@^4.0.0 electron-log@^5.0.0 uuid@^9.0.0 zustand@^4.0.0
```

Expected: Dependencies installed, `node_modules/` and `pnpm-lock.yaml` created.

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
pnpm add -D typescript@^5.3.0 vite@^5.0.0 @vitejs/plugin-react@^4.0.0 vitest@^1.0.0 @testing-library/react@^14.0.0 @testing-library/jest-dom@^6.0.0 jsdom@^23.0.0 @types/react@^18.2.0 @types/react-dom@^18.2.0 @types/better-sqlite3@^7.6.0 @types/uuid@^9.0.0 electron-builder@^24.0.0 eslint@^8.0.0 prettier@^3.0.0
```

Expected: Dev dependencies installed.

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*", "src-renderer/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: Write `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
```

- [ ] **Step 7: Write `electron-builder.yml`**

```yaml
appId: com.desktop-todo-list.app
productName: Desktop Todo
directories:
  output: release
files:
  - dist/**/*
  - dist-renderer/**/*
  - package.json
mac:
  target: dmg
win:
  target: nsis
linux:
  target: AppImage
```

- [ ] **Step 8: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Desktop Todo</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src-renderer/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 9: Write `src/shared/types.ts`**

```typescript
export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
}

export interface TodoCreateInput {
  content: string;
}

export interface ReminderConfig {
  times: string[];
  imCliPath: string;
  imCliArgs: string;
}

export interface LLMConfig {
  endpoint: string;
  model: string;
}

export interface PetImages {
  idle: string | null;
  active: string | null;
  speaking: string | null;
}

export type PetState = 'idle' | 'active' | 'speaking';

export interface AppSettings {
  reminderTimes: string[];
  imCliPath: string;
  imCliArgs: string;
  petImageIdle: string;
  petImageActive: string;
  petImageSpeaking: string;
  windowPositionX: number;
  windowPositionY: number;
  autoLaunch: boolean;
  llmEndpoint: string;
  llmModel: string;
  lastReminderDate: string;
  dbVersion: number;
}

export interface IPCApi {
  getTodos: () => Promise<Todo[]>;
  addTodo: (input: TodoCreateInput) => Promise<Todo>;
  toggleTodo: (id: string) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  updateSortOrder: (ids: string[]) => Promise<void>;
  searchTodos: (query: string) => Promise<Todo[]>;
  getSettings: () => Promise<Partial<AppSettings>>;
  updateSetting: (key: string, value: string) => Promise<void>;
  getApiKey: () => Promise<string | null>;
  setApiKey: (key: string) => Promise<void>;
  startSpeechRecognition: () => Promise<string>;
  uploadPetImage: (state: PetState, filePath: string) => Promise<string>;
  getPetImages: () => Promise<PetImages>;
  exportData: () => Promise<string>;
  importData: (filePath: string) => Promise<void>;
  sendTestReminder: () => Promise<void>;
  onTriggerInput: (callback: () => void) => () => void;
  onPetStateChange: (callback: (state: PetState) => void) => () => void;
}
```

- [ ] **Step 10: Write `src/main/index.ts` (minimal app shell)**

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

- [ ] **Step 11: Write `src/preload/index.ts` (minimal stub)**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('todoAPI', {
  getTodos: () => ipcRenderer.invoke('todos:getAll'),
  addTodo: (input: { content: string }) => ipcRenderer.invoke('todos:add', input),
  toggleTodo: (id: string) => ipcRenderer.invoke('todos:toggle', id),
  deleteTodo: (id: string) => ipcRenderer.invoke('todos:delete', id),
  updateSortOrder: (ids: string[]) => ipcRenderer.invoke('todos:updateSortOrder', ids),
  searchTodos: (query: string) => ipcRenderer.invoke('todos:search', query),
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke('settings:update', key, value),
  getApiKey: () => ipcRenderer.invoke('apiKey:get'),
  setApiKey: (key: string) => ipcRenderer.invoke('apiKey:set', key),
  startSpeechRecognition: () => ipcRenderer.invoke('speech:start'),
  uploadPetImage: (state: string, filePath: string) => ipcRenderer.invoke('pet:uploadImage', state, filePath),
  getPetImages: () => ipcRenderer.invoke('pet:getImages'),
  exportData: () => ipcRenderer.invoke('data:export'),
  importData: (filePath: string) => ipcRenderer.invoke('data:import', filePath),
  sendTestReminder: () => ipcRenderer.invoke('reminder:test'),
  onTriggerInput: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('trigger-input', listener);
    return () => ipcRenderer.removeListener('trigger-input', listener);
  },
  onPetStateChange: (callback: (state: string) => void) => {
    const listener = (_event: any, state: string) => callback(state);
    ipcRenderer.on('pet-state-change', listener);
    return () => ipcRenderer.removeListener('pet-state-change', listener);
  },
});
```

- [ ] **Step 12: Write `src-renderer/main.tsx`**

```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 13: Write `src-renderer/App.tsx` (placeholder)**

```typescript
import React from 'react';

export default function App() {
  return (
    <div className="app-container">
      <h1>Desktop Todo</h1>
    </div>
  );
}
```

- [ ] **Step 14: Write `src-renderer/App.css` (base styles)**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}
```

- [ ] **Step 15: Add scripts to `package.json`**

Read `package.json` first, then modify. Add these scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && tsc -p tsconfig.node.json",
    "start": "electron dist/main/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/ src-renderer/ tests/",
    "format": "prettier --write src/ src-renderer/ tests/"
  }
}
```

- [ ] **Step 16: Add `main` field to `package.json`**

```json
{
  "main": "dist/main/index.js"
}
```

- [ ] **Step 17: Verify the app launches in dev mode**

Run:
```bash
pnpm dev &
sleep 3
npx electron dist/main/index.js
```

Expected: Electron window opens showing "Desktop Todo" heading with rounded white container.

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "feat: scaffold Electron + React + TypeScript project with Vite"
```

---

## Phase 2: Core Window & Pet (Priority 1)

### Task 2: Floating window with transparency, always-on-top, click-through

**Files:**
- Create: `src/main/window.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write `src/main/window.ts`**

```typescript
import { BrowserWindow, screen, app } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;
let isInteracting = false;

export function createMainWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 320,
    height: 540,
    x: screenWidth - 340,
    y: 100,
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
```

- [ ] **Step 2: Update `src/main/index.ts`**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import { createMainWindow, getMainWindow } from './window';

app.whenReady().then(() => {
  createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add src/main/window.ts src/main/index.ts
git commit -m "feat: add floating window with transparency and click-through support"
```

### Task 3: Pet view component with default icon and state display

**Files:**
- Create: `src-renderer/components/PetView.tsx`
- Create: `src-renderer/components/PetView.css`
- Modify: `src-renderer/App.tsx`
- Modify: `src-renderer/App.css`
- Create: `tests/components/PetView.test.tsx`

- [ ] **Step 1: Write the failing test `tests/components/PetView.test.tsx`**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PetView from '../../src-renderer/components/PetView';

describe('PetView', () => {
  it('renders default icon when no image provided', () => {
    render(<PetView petState="idle" images={{ idle: null, active: null, speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toContain('default-pet');
  });

  it('renders idle image when provided', () => {
    render(<PetView petState="idle" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/idle.png');
  });

  it('renders active image when state is active', () => {
    render(<PetView petState="active" images={{ idle: '/test/idle.png', active: '/test/active.png', speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/active.png');
  });

  it('renders speaking image when state is speaking', () => {
    render(<PetView petState="speaking" images={{ idle: null, active: null, speaking: '/test/speak.png' }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/speak.png');
  });

  it('falls back to idle if state image not available', () => {
    render(<PetView petState="speaking" images={{ idle: '/test/idle.png', active: null, speaking: null }} />);
    const img = screen.getByRole('img');
    expect(img.getAttribute('src')).toBe('/test/idle.png');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run tests/components/PetView.test.tsx
```

Expected: FAIL - cannot find module PetView.

- [ ] **Step 3: Write `src-renderer/components/PetView.tsx`**

```typescript
import React from 'react';
import './PetView.css';

const DEFAULT_ICON = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><circle cx="64" cy="64" r="60" fill="#a78bfa" opacity="0.3"/><text x="64" y="72" text-anchor="middle" font-size="48" fill="#7c3aed">🐾</text></svg>'
)}`;

interface PetImages {
  idle: string | null;
  active: string | null;
  speaking: string | null;
}

type PetState = 'idle' | 'active' | 'speaking';

interface PetViewProps {
  petState: PetState;
  images: PetImages;
  onClick?: () => void;
}

function getImageSrc(state: PetState, images: PetImages): string {
  if (state === 'speaking' && images.speaking) return images.speaking;
  if (state === 'active' && images.active) return images.active;
  if (images.idle) return images.idle;
  if (images.speaking) return images.speaking;
  if (images.active) return images.active;
  return DEFAULT_ICON;
}

export default function PetView({ petState, images, onClick }: PetViewProps) {
  const src = getImageSrc(petState, images);

  return (
    <div
      className={`pet-view pet-state-${petState}`}
      onClick={onClick}
      data-testid="pet-view"
    >
      <img
        src={src}
        alt="pet"
        className="pet-image"
        draggable={false}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write `src-renderer/components/PetView.css`**

```css
.pet-view {
  width: 128px;
  height: 128px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease;
}

.pet-image {
  width: 128px;
  height: 128px;
  object-fit: contain;
  image-rendering: auto;
  pointer-events: none;
}

.pet-state-active {
  transform: scale(1.05);
}

.pet-state-speaking {
  animation: pet-pulse 0.8s ease-in-out infinite;
}

@keyframes pet-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
pnpm vitest run tests/components/PetView.test.tsx
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Update `src-renderer/App.tsx`**

```typescript
import React, { useState } from 'react';
import PetView from './components/PetView';

export default function App() {
  const [petState, setPetState] = useState<'idle' | 'active' | 'speaking'>('idle');
  const [images] = useState({ idle: null, active: null, speaking: null });

  return (
    <div
      className="app-container"
      onMouseEnter={() => setPetState('active')}
      onMouseLeave={() => setPetState('idle')}
    >
      <PetView
        petState={petState}
        images={images}
        onClick={() => setPetState('active')}
      />
    </div>
  );
}
```

- [ ] **Step 7: Update `src-renderer/App.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: transparent;
}
```

- [ ] **Step 8: Configure Vitest**

Read `vite.config.ts` and add test configuration:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 9: Commit**

```bash
git add src-renderer/components/PetView.tsx src-renderer/components/PetView.css src-renderer/App.tsx src-renderer/App.css tests/components/PetView.test.tsx vite.config.ts
git commit -m "feat: add pet view component with state-based image display"
```

### Task 4: System tray with show/quit menu

**Files:**
- Create: `src/main/tray.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write `src/main/tray.ts`**

```typescript
import { Tray, Menu, app, nativeImage } from 'electron';
import path from 'path';
import { getMainWindow } from './window';

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
```

- [ ] **Step 2: Update `src/main/index.ts` to integrate tray**

```typescript
import { app, BrowserWindow } from 'electron';
import { createMainWindow, getMainWindow } from './window';
import { createTray } from './tray';
import log from 'electron-log';

log.initialize();

app.whenReady().then(() => {
  createMainWindow();
  createTray();
});

app.on('window-all-closed', (event: Electron.Event) => {
  // Prevent quit — minimize to tray instead
  event.preventDefault();
});

app.on('before-quit', () => {
  // Allow actual quit
});
```

Note: The window-all-closed approach above won't work precisely because Electron doesn't fire preventDefault on window-all-closed reliably. Fix in step 3.

- [ ] **Step 3: Use `close` event on window instead — update `src/main/index.ts`**

```typescript
import { app, BrowserWindow } from 'electron';
import { createMainWindow, getMainWindow } from './window';
import { createTray } from './tray';
import log from 'electron-log';

log.initialize();

let isQuitting = false;

app.whenReady().then(() => {
  const win = createMainWindow();
  createTray();

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add src/main/tray.ts src/main/index.ts
git commit -m "feat: add system tray with show/quit menu, minimize to tray on close"
```

---

## Phase 3: Database & Todo CRUD (Priority 3)

### Task 5: SQLite database connection, schema, and migration system

**Files:**
- Create: `src/database/connection.ts`
- Create: `src/database/migrations/001_initial.ts`

- [ ] **Step 1: Write `src/database/migrations/001_initial.ts`**

```typescript
import Database from 'better-sqlite3';

export const version = 1;

export function up(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      is_completed INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
    CREATE INDEX IF NOT EXISTS idx_todos_is_completed ON todos(is_completed);
    CREATE INDEX IF NOT EXISTS idx_todos_sort_order ON todos(sort_order);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
```

- [ ] **Step 2: Write `src/database/connection.ts`**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import log from 'electron-log';

let db: Database.Database | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'todos.db');
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): Database.Database {
  const dbPath = getDbPath();
  log.info(`Opening database at ${dbPath}`);

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } catch (err) {
    log.error('Failed to open database, attempting rebuild', err);
    try {
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
    } catch (rebuildErr) {
      log.error('Database rebuild failed', rebuildErr);
      throw rebuildErr;
    }
  }

  runMigrations(db);
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const applied = db
    .prepare('SELECT version FROM migrations ORDER BY version')
    .all() as { version: number }[];

  const appliedVersions = new Set(applied.map((r) => r.version));

  const migrations = [
    require('./migrations/001_initial'),
  ];

  const migrateAll = db.transaction(() => {
    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        log.info(`Applying migration ${migration.version}`);
        migration.up(db);
        db.prepare('INSERT INTO migrations (version) VALUES (?)').run(migration.version);
      }
    }
  });

  migrateAll();
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/database/connection.ts src/database/migrations/001_initial.ts
git commit -m "feat: add SQLite database connection with migration system"
```

### Task 6: TodoService — CRUD operations with tests

**Files:**
- Create: `tests/unit/TodoService.test.ts`
- Create: `src/services/TodoService.ts`

- [ ] **Step 1: Write the failing test `tests/unit/TodoService.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TodoService } from '../../src/services/TodoService';
import { up } from '../../src/database/migrations/001_initial';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  up(db);
  return db;
}

describe('TodoService', () => {
  let db: Database.Database;
  let service: TodoService;

  beforeEach(() => {
    db = createTestDb();
    service = new TodoService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('adds a todo and returns it with generated fields', () => {
    const todo = service.add({ content: 'Buy milk' });
    expect(todo.id).toBeDefined();
    expect(todo.content).toBe('Buy milk');
    expect(todo.isCompleted).toBe(false);
    expect(todo.createdAt).toBeDefined();
  });

  it('gets all todos sorted by sort_order', () => {
    service.add({ content: 'First' });
    service.add({ content: 'Second' });
    const todos = service.getAll();
    expect(todos).toHaveLength(2);
  });

  it('toggles todo completion', () => {
    const todo = service.add({ content: 'Test' });
    const toggled = service.toggle(todo.id);
    expect(toggled.isCompleted).toBe(true);
    expect(toggled.completedAt).toBeDefined();

    const toggledAgain = service.toggle(todo.id);
    expect(toggledAgain.isCompleted).toBe(false);
    expect(toggledAgain.completedAt).toBeNull();
  });

  it('deletes a todo', () => {
    const todo = service.add({ content: 'Delete me' });
    service.delete(todo.id);
    const todos = service.getAll();
    expect(todos).toHaveLength(0);
  });

  it('searches todos by content', () => {
    service.add({ content: 'Buy milk' });
    service.add({ content: 'Walk dog' });
    service.add({ content: 'Buy eggs' });
    const results = service.search('Buy');
    expect(results).toHaveLength(2);
  });

  it('updates sort order', () => {
    const a = service.add({ content: 'A' });
    const b = service.add({ content: 'B' });
    const c = service.add({ content: 'C' });
    service.updateSortOrder([c.id, a.id, b.id]);
    const todos = service.getAll();
    expect(todos[0].id).toBe(c.id);
    expect(todos[1].id).toBe(a.id);
    expect(todos[2].id).toBe(b.id);
  });

  it('trims whitespace and rejects empty content', () => {
    expect(() => service.add({ content: '   ' })).toThrow('Content cannot be empty');
  });

  it('truncates content over 500 characters', () => {
    const long = 'x'.repeat(600);
    const todo = service.add({ content: long });
    expect(todo.content.length).toBe(500);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run tests/unit/TodoService.test.ts
```

Expected: FAIL - cannot find module TodoService.

- [ ] **Step 3: Write `src/services/TodoService.ts`**

```typescript
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
}

interface TodoRow {
  id: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_completed: number;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    isCompleted: row.is_completed === 1,
  };
}

export class TodoService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  add(input: { content: string }): Todo {
    const content = input.content.trim();
    if (!content) {
      throw new Error('Content cannot be empty');
    }
    const truncated = content.length > 500 ? content.slice(0, 500) : content;
    const id = uuidv4();
    const now = new Date().toISOString();

    const maxSort = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM todos')
      .get() as { next: number };

    this.db
      .prepare(
        'INSERT INTO todos (id, content, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, truncated, maxSort.next, now, now);

    return rowToTodo(
      this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    );
  }

  getAll(): Todo[] {
    const rows = this.db
      .prepare('SELECT * FROM todos ORDER BY sort_order ASC, created_at DESC')
      .all() as TodoRow[];
    return rows.map(rowToTodo);
  }

  toggle(id: string): Todo {
    const row = this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow | undefined;
    if (!row) throw new Error('Todo not found');

    const now = new Date().toISOString();
    const newCompleted = row.is_completed === 1 ? 0 : 1;
    const completedAt = newCompleted === 1 ? now : null;

    this.db
      .prepare('UPDATE todos SET is_completed = ?, completed_at = ?, updated_at = ? WHERE id = ?')
      .run(newCompleted, completedAt, now, id);

    return rowToTodo(
      this.db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as TodoRow
    );
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  }

  search(query: string): Todo[] {
    const rows = this.db
      .prepare('SELECT * FROM todos WHERE content LIKE ? ORDER BY sort_order ASC')
      .all(`%${query}%`) as TodoRow[];
    return rows.map(rowToTodo);
  }

  updateSortOrder(ids: string[]): void {
    const update = this.db.prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      ids.forEach((id, index) => {
        update.run(index, now, id);
      });
    });
    tx();
  }

  getIncomplete(): Todo[] {
    const rows = this.db
      .prepare('SELECT * FROM todos WHERE is_completed = 0 ORDER BY sort_order ASC')
      .all() as TodoRow[];
    return rows.map(rowToTodo);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm vitest run tests/unit/TodoService.test.ts
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/TodoService.test.ts src/services/TodoService.ts
git commit -m "feat: add TodoService with CRUD, search, and sort operations"
```

### Task 7: Settings service (get/update settings from SQLite)

**Files:**
- Modify: `src/services/TodoService.ts` — already created, add SettingsService in same file pattern

Actually, add to `src/database/connection.ts` helper functions or create a thin wrapper. For simplicity, add settings helpers to the connection module.

- [ ] **Step 1: Add settings helpers to `src/database/connection.ts`**

Add these functions at the end of the file (before `closeDatabase`):

```typescript
export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
  ).run(key, value, value);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/database/connection.ts
git commit -m "feat: add settings read/write helpers to database module"
```

### Task 8: IPC handlers for todo and settings operations

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write `src/main/ipc.ts`**

```typescript
import { ipcMain, dialog } from 'electron';
import { getDb, getAllSettings, setSetting } from '../database/connection';
import { TodoService } from '../services/TodoService';
import { initDatabase } from '../database/connection';

function getTodoService(): TodoService {
  return new TodoService(getDb());
}

export function registerIpcHandlers(): void {
  initDatabase();

  // Todo CRUD
  ipcMain.handle('todos:getAll', () => {
    return getTodoService().getAll();
  });

  ipcMain.handle('todos:add', (_event, input: { content: string }) => {
    return getTodoService().add(input);
  });

  ipcMain.handle('todos:toggle', (_event, id: string) => {
    return getTodoService().toggle(id);
  });

  ipcMain.handle('todos:delete', (_event, id: string) => {
    getTodoService().delete(id);
  });

  ipcMain.handle('todos:updateSortOrder', (_event, ids: string[]) => {
    getTodoService().updateSortOrder(ids);
  });

  ipcMain.handle('todos:search', (_event, query: string) => {
    return getTodoService().search(query);
  });

  // Settings
  ipcMain.handle('settings:getAll', () => {
    return getAllSettings();
  });

  ipcMain.handle('settings:update', (_event, key: string, value: string) => {
    setSetting(key, value);
  });

  // Data export
  ipcMain.handle('data:export', async () => {
    const todos = getTodoService().getAll();
    const json = JSON.stringify(todos, null, 2);
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      defaultPath: `todos-export-${new Date().toISOString().slice(0, 10)}.json`,
    });
    if (result.canceled || !result.filePath) return null;
    const fs = require('fs');
    fs.writeFileSync(result.filePath, json, 'utf-8');
    return result.filePath;
  });

  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    const fs = require('fs');
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) throw new Error('Invalid import format: expected array');
    const service = getTodoService();
    const existing = new Set(service.getAll().map((t) => t.id));
    for (const item of items) {
      if (!existing.has(item.id)) {
        service.add({ content: item.content });
      }
    }
  });
}
```

- [ ] **Step 2: Update `src/main/index.ts` to register IPC handlers**

Add import and call at the top of the `app.whenReady()` callback:

```typescript
import { registerIpcHandlers } from './ipc';

// Inside app.whenReady().then(() => { ... }):
registerIpcHandlers();
const win = createMainWindow();
// ... rest
```

- [ ] **Step 3: Commit**

```bash
git add src/main/ipc.ts src/main/index.ts
git commit -m "feat: add IPC handlers for todo CRUD, settings, and data export/import"
```

---

## Phase 4: Input & Todo List UI (Priorities 2-3)

### Task 9: Global shortcut to trigger input (Priority 2)

**Files:**
- Create: `src/main/shortcut.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Write `src/main/shortcut.ts`**

```typescript
import { globalShortcut, BrowserWindow } from 'electron';
import log from 'electron-log';

export function registerGlobalShortcut(window: BrowserWindow): void {
  const registered = globalShortcut.register('CommandOrControl+Shift+T', () => {
    log.info('Global shortcut triggered');
    if (window.isMinimized()) window.restore();
    if (!window.isVisible()) window.show();
    window.focus();
    window.webContents.send('trigger-input');
  });

  if (!registered) {
    log.warn('Failed to register global shortcut CommandOrControl+Shift+T');
  }
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}
```

- [ ] **Step 2: Update `src/main/index.ts`**

Add after window creation in the `app.whenReady()` callback:

```typescript
import { registerGlobalShortcut, unregisterAllShortcuts } from './shortcut';

// After createMainWindow():
const win = getMainWindow()!;
registerGlobalShortcut(win);
// ... rest

// Add cleanup:
app.on('will-quit', () => {
  unregisterAllShortcuts();
});
```

- [ ] **Step 3: Commit**

```bash
git add src/main/shortcut.ts src/main/index.ts
git commit -m "feat: add global shortcut CmdOrCtrl+Shift+T to trigger todo input"
```

### Task 10: Zustand store and useTodos hook

**Files:**
- Create: `src-renderer/store/index.ts`
- Create: `src-renderer/hooks/useTodos.ts`

- [ ] **Step 1: Write `src-renderer/store/index.ts`**

```typescript
import { create } from 'zustand';

export interface Todo {
  id: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  isCompleted: boolean;
}

interface TodoStore {
  todos: Todo[];
  searchQuery: string;
  showInput: boolean;
  petState: 'idle' | 'active' | 'speaking';
  setTodos: (todos: Todo[]) => void;
  addTodo: (todo: Todo) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
  updateSortOrder: (ids: string[]) => void;
  setSearchQuery: (query: string) => void;
  setShowInput: (show: boolean) => void;
  setPetState: (state: 'idle' | 'active' | 'speaking') => void;
}

export const useStore = create<TodoStore>((set) => ({
  todos: [],
  searchQuery: '',
  showInput: false,
  petState: 'idle',
  setTodos: (todos) => set({ todos }),
  addTodo: (todo) => set((s) => ({ todos: [...s.todos, todo] })),
  toggleTodo: (id) =>
    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, isCompleted: !t.isCompleted, completedAt: !t.isCompleted ? new Date().toISOString() : null } : t
      ),
    })),
  deleteTodo: (id) => set((s) => ({ todos: s.todos.filter((t) => t.id !== id) })),
  updateSortOrder: (ids) =>
    set((s) => ({
      todos: ids
        .map((id, index) => {
          const todo = s.todos.find((t) => t.id === id);
          return todo ? { ...todo, sortOrder: index } : null;
        })
        .filter(Boolean) as Todo[],
    })),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setShowInput: (show) => set({ showInput: show }),
  setPetState: (state) => set({ petState: state }),
}));
```

- [ ] **Step 2: Write `src-renderer/hooks/useTodos.ts`**

```typescript
import { useEffect, useCallback } from 'react';
import { useStore } from '../store';

declare global {
  interface Window {
    todoAPI: {
      getTodos: () => Promise<any[]>;
      addTodo: (input: { content: string }) => Promise<any>;
      toggleTodo: (id: string) => Promise<any>;
      deleteTodo: (id: string) => Promise<void>;
      updateSortOrder: (ids: string[]) => Promise<void>;
      searchTodos: (query: string) => Promise<any[]>;
      onTriggerInput: (callback: () => void) => () => void;
    };
  }
}

export function useTodos() {
  const { todos, searchQuery, setTodos, addTodo, toggleTodo, deleteTodo, updateSortOrder, setShowInput } = useStore();

  const loadTodos = useCallback(async () => {
    const data = await window.todoAPI.getTodos();
    setTodos(data);
  }, [setTodos]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    const cleanup = window.todoAPI.onTriggerInput(() => {
      setShowInput(true);
    });
    return cleanup;
  }, [setShowInput]);

  const handleAdd = async (content: string) => {
    const todo = await window.todoAPI.addTodo({ content });
    addTodo(todo);
    setShowInput(false);
  };

  const handleToggle = async (id: string) => {
    const updated = await window.todoAPI.toggleTodo(id);
    toggleTodo(id);
  };

  const handleDelete = async (id: string) => {
    await window.todoAPI.deleteTodo(id);
    deleteTodo(id);
  };

  const handleSort = async (ids: string[]) => {
    await window.todoAPI.updateSortOrder(ids);
    updateSortOrder(ids);
  };

  const filteredTodos = searchQuery
    ? todos.filter((t) => t.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : todos;

  return {
    todos: filteredTodos,
    handleAdd,
    handleToggle,
    handleDelete,
    handleSort,
    loadTodos,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/store/index.ts src-renderer/hooks/useTodos.ts
git commit -m "feat: add Zustand store and useTodos hook with IPC integration"
```

### Task 11: InputModal component (text input + voice button placeholder)

**Files:**
- Create: `src-renderer/components/InputModal.tsx`
- Create: `src-renderer/components/InputModal.css`
- Create: `tests/components/InputModal.test.tsx`

- [ ] **Step 1: Write failing test `tests/components/InputModal.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InputModal from '../../src-renderer/components/InputModal';

describe('InputModal', () => {
  it('renders text input and voice button', () => {
    render(<InputModal onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByPlaceholderText('输入待办事项...')).toBeDefined();
    expect(screen.getByRole('button', { name: /voice/i })).toBeDefined();
  });

  it('calls onAdd with trimmed content on Enter', () => {
    const onAdd = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('输入待办事项...');
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('Buy milk');
  });

  it('does not call onAdd for empty input', () => {
    const onAdd = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('输入待办事项...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    render(<InputModal onAdd={vi.fn()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByPlaceholderText('输入待办事项...'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('truncates input beyond 500 characters and shows warning', () => {
    const onAdd = vi.fn();
    render(<InputModal onAdd={onAdd} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText('输入待办事项...') as HTMLInputElement;
    const long = 'x'.repeat(600);
    fireEvent.change(input, { target: { value: long } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAdd).toHaveBeenCalledWith('x'.repeat(500));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm vitest run tests/components/InputModal.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src-renderer/components/InputModal.tsx`**

```typescript
import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import './InputModal.css';

interface InputModalProps {
  onAdd: (content: string) => void;
  onClose: () => void;
  voiceText?: string;
}

export default function InputModal({ onAdd, onClose, voiceText }: InputModalProps) {
  const [text, setText] = useState('');
  const [warning, setWarning] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (voiceText) {
      setText(voiceText);
    }
  }, [voiceText]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (trimmed.length > 500) {
      setWarning('内容过长，已自动截断至500字符');
      onAdd(trimmed.slice(0, 500));
    } else {
      onAdd(trimmed);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="input-modal-overlay" onClick={onClose}>
      <div className="input-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="todo-input"
          placeholder="输入待办事项..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setWarning('');
          }}
          onKeyDown={handleKeyDown}
          maxLength={500}
        />
        <div className="input-actions">
          <button
            className="voice-btn"
            aria-label="voice input"
            title="语音输入"
          >
            🎤
          </button>
          <button className="submit-btn" onClick={handleSubmit}>
            确定
          </button>
        </div>
        {warning && <div className="input-warning">{warning}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `src-renderer/components/InputModal.css`**

```css
.input-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.1);
  z-index: 100;
}

.input-modal {
  width: 280px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.todo-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.todo-input:focus {
  border-color: #7c3aed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.voice-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: #f3f4f6;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.voice-btn:hover {
  background: #e5e7eb;
}

.submit-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: #7c3aed;
  color: white;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.submit-btn:hover {
  background: #6d28d9;
}

.input-warning {
  margin-top: 8px;
  font-size: 12px;
  color: #f59e0b;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
pnpm vitest run tests/components/InputModal.test.tsx
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src-renderer/components/InputModal.tsx src-renderer/components/InputModal.css tests/components/InputModal.test.tsx
git commit -m "feat: add InputModal component with validation and voice button placeholder"
```

### Task 12: TodoList, TodoItem, TodoSearch components

**Files:**
- Create: `src-renderer/components/TodoList.tsx`
- Create: `src-renderer/components/TodoList.css`
- Create: `src-renderer/components/TodoItem.tsx`
- Create: `src-renderer/components/TodoItem.css`
- Create: `src-renderer/components/TodoSearch.tsx`
- Create: `tests/components/TodoList.test.tsx`

- [ ] **Step 1: Write `src-renderer/components/TodoItem.tsx`**

```typescript
import React from 'react';
import './TodoItem.css';

interface TodoItemProps {
  id: string;
  content: string;
  isCompleted: boolean;
  createdAt: string;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TodoItem({ id, content, isCompleted, createdAt, onToggle, onDelete }: TodoItemProps) {
  return (
    <div className={`todo-item ${isCompleted ? 'completed' : ''}`}>
      <button
        className={`todo-checkbox ${isCompleted ? 'checked' : ''}`}
        onClick={() => onToggle(id)}
        aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {isCompleted ? '✓' : ''}
      </button>
      <span className="todo-content" onClick={() => onToggle(id)}>
        {content}
      </span>
      <span className="todo-time">
        {new Date(createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <button
        className="todo-delete"
        onClick={() => onDelete(id)}
        aria-label="Delete todo"
      >
        ×
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write `src-renderer/components/TodoItem.css`**

```css
.todo-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 8px;
  border-radius: 8px;
  transition: background 0.15s;
  cursor: default;
}

.todo-item:hover {
  background: rgba(124, 58, 237, 0.06);
}

.todo-item.completed .todo-content {
  text-decoration: line-through;
  color: #9ca3af;
}

.todo-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #d1d5db;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.15s;
}

.todo-checkbox.checked {
  background: #7c3aed;
  border-color: #7c3aed;
}

.todo-content {
  flex: 1;
  font-size: 13px;
  color: #1f2937;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.todo-time {
  font-size: 11px;
  color: #9ca3af;
  flex-shrink: 0;
}

.todo-delete {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.todo-item:hover .todo-delete {
  opacity: 1;
}

.todo-delete:hover {
  background: #fee2e2;
  color: #ef4444;
}
```

- [ ] **Step 3: Write `src-renderer/components/TodoSearch.tsx`**

```typescript
import React from 'react';

interface TodoSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function TodoSearch({ value, onChange }: TodoSearchProps) {
  return (
    <div className="todo-search">
      <input
        type="text"
        placeholder="搜索待办..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="search-input"
      />
    </div>
  );
}
```

- [ ] **Step 4: Write `src-renderer/components/TodoList.tsx`**

```typescript
import React from 'react';
import TodoItem from './TodoItem';
import TodoSearch from './TodoSearch';
import './TodoList.css';

interface Todo {
  id: string;
  content: string;
  isCompleted: boolean;
  createdAt: string;
}

interface TodoListProps {
  todos: Todo[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
}

export default function TodoList({
  todos,
  searchQuery,
  onSearchChange,
  onToggle,
  onDelete,
  showCompleted,
  onToggleShowCompleted,
}: TodoListProps) {
  const incompleteTodos = todos.filter((t) => !t.isCompleted);
  const completedTodos = todos.filter((t) => t.isCompleted);

  if (todos.length === 0) {
    return (
      <div className="todo-list">
        <TodoSearch value={searchQuery} onChange={onSearchChange} />
        <div className="todo-empty">暂无待办事项</div>
      </div>
    );
  }

  return (
    <div className="todo-list">
      <TodoSearch value={searchQuery} onChange={onSearchChange} />
      <div className="todo-items">
        {incompleteTodos.map((todo) => (
          <TodoItem
            key={todo.id}
            id={todo.id}
            content={todo.content}
            isCompleted={todo.isCompleted}
            createdAt={todo.createdAt}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
        {completedTodos.length > 0 && (
          <>
            <button className="show-completed-toggle" onClick={onToggleShowCompleted}>
              {showCompleted ? '隐藏' : '显示'}已完成 ({completedTodos.length})
            </button>
            {showCompleted &&
              completedTodos.map((todo) => (
                <TodoItem
                  key={todo.id}
                  id={todo.id}
                  content={todo.content}
                  isCompleted={todo.isCompleted}
                  createdAt={todo.createdAt}
                  onToggle={onToggle}
                  onDelete={onDelete}
                />
              ))}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `src-renderer/components/TodoList.css`**

```css
.todo-list {
  width: 100%;
  padding: 0 8px;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.todo-search {
  padding: 8px 4px;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  outline: none;
}

.search-input:focus {
  border-color: #7c3aed;
}

.todo-items {
  flex: 1;
  overflow-y: auto;
}

.todo-empty {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 32px 0;
}

.show-completed-toggle {
  width: 100%;
  padding: 6px;
  border: none;
  background: transparent;
  color: #9ca3af;
  font-size: 11px;
  cursor: pointer;
  border-top: 1px solid #f3f4f6;
  margin-top: 4px;
}

.show-completed-toggle:hover {
  color: #6b7280;
}
```

- [ ] **Step 6: Write `tests/components/TodoList.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TodoList from '../../src-renderer/components/TodoList';

const mockTodos = [
  { id: '1', content: 'Buy milk', isCompleted: false, createdAt: '2026-05-18T12:00:00Z' },
  { id: '2', content: 'Walk dog', isCompleted: true, createdAt: '2026-05-18T11:00:00Z' },
];

describe('TodoList', () => {
  it('renders incomplete todos', () => {
    render(
      <TodoList
        todos={mockTodos}
        searchQuery=""
        onSearchChange={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        showCompleted={false}
        onToggleShowCompleted={vi.fn()}
      />
    );
    expect(screen.getByText('Buy milk')).toBeDefined();
  });

  it('shows empty state when no todos', () => {
    render(
      <TodoList
        todos={[]}
        searchQuery=""
        onSearchChange={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        showCompleted={false}
        onToggleShowCompleted={vi.fn()}
      />
    );
    expect(screen.getByText('暂无待办事项')).toBeDefined();
  });

  it('filters by search query', () => {
    render(
      <TodoList
        todos={mockTodos}
        searchQuery="milk"
        onSearchChange={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        showCompleted={false}
        onToggleShowCompleted={vi.fn()}
      />
    );
    expect(screen.getByText('Buy milk')).toBeDefined();
    expect(screen.queryByText('Walk dog')).toBeNull();
  });

  it('calls onToggle when checkbox clicked', () => {
    const onToggle = vi.fn();
    render(
      <TodoList
        todos={mockTodos}
        searchQuery=""
        onSearchChange={vi.fn()}
        onToggle={onToggle}
        onDelete={vi.fn()}
        showCompleted={false}
        onToggleShowCompleted={vi.fn()}
      />
    );
    fireEvent.click(screen.getAllByRole('button', { name: /mark complete/i })[0]);
    expect(onToggle).toHaveBeenCalledWith('1');
  });
});
```

- [ ] **Step 7: Run tests**

Run:
```bash
pnpm vitest run tests/components/TodoList.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src-renderer/components/TodoList.tsx src-renderer/components/TodoList.css src-renderer/components/TodoItem.tsx src-renderer/components/TodoItem.css src-renderer/components/TodoSearch.tsx tests/components/TodoList.test.tsx
git commit -m "feat: add TodoList, TodoItem, and TodoSearch components"
```

### Task 13: Wire up App.tsx with all components

**Files:**
- Modify: `src-renderer/App.tsx`
- Modify: `src-renderer/App.css`

- [ ] **Step 1: Update `src-renderer/App.tsx`**

```typescript
import React, { useState } from 'react';
import PetView from './components/PetView';
import InputModal from './components/InputModal';
import TodoList from './components/TodoList';
import { useTodos } from './hooks/useTodos';
import { useStore } from './store';

export default function App() {
  const { showInput, setShowInput, petState, setPetState, searchQuery, setSearchQuery } = useStore();
  const { todos, handleAdd, handleToggle, handleDelete, handleSort } = useTodos();
  const [showCompleted, setShowCompleted] = useState(false);
  const [images] = useState({ idle: null, active: null, speaking: null });

  return (
    <div
      className="app-container"
      onMouseEnter={() => !showInput && setPetState('active')}
      onMouseLeave={() => !showInput && setPetState('idle')}
    >
      <PetView
        petState={petState}
        images={images}
        onClick={() => setShowInput(true)}
      />
      <TodoList
        todos={todos}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onToggle={handleToggle}
        onDelete={handleDelete}
        showCompleted={showCompleted}
        onToggleShowCompleted={() => setShowCompleted(!showCompleted)}
      />
      {showInput && (
        <InputModal
          onAdd={handleAdd}
          onClose={() => setShowInput(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `src-renderer/App.css`**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: transparent;
  overflow: hidden;
  user-select: none;
}

.app-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  padding: 12px 0;
}
```

- [ ] **Step 3: Add type declaration file**

Create `src-renderer/global.d.ts`:

```typescript
export {};

declare global {
  interface Window {
    todoAPI: {
      getTodos: () => Promise<any[]>;
      addTodo: (input: { content: string }) => Promise<any>;
      toggleTodo: (id: string) => Promise<any>;
      deleteTodo: (id: string) => Promise<void>;
      updateSortOrder: (ids: string[]) => Promise<void>;
      searchTodos: (query: string) => Promise<any[]>;
      getSettings: () => Promise<Record<string, string>>;
      updateSetting: (key: string, value: string) => Promise<void>;
      getApiKey: () => Promise<string | null>;
      setApiKey: (key: string) => Promise<void>;
      startSpeechRecognition: () => Promise<string>;
      uploadPetImage: (state: string, filePath: string) => Promise<string>;
      getPetImages: () => Promise<{ idle: string | null; active: string | null; speaking: string | null }>;
      exportData: () => Promise<string | null>;
      importData: (filePath: string) => Promise<void>;
      sendTestReminder: () => Promise<void>;
      onTriggerInput: (callback: () => void) => () => void;
      onPetStateChange: (callback: (state: string) => void) => () => void;
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src-renderer/App.tsx src-renderer/App.css src-renderer/global.d.ts
git commit -m "feat: wire up App with PetView, InputModal, TodoList, and useTodos hook"
```

---

## Phase 5: Voice Input (Priority 4)

### Task 14: VoiceButton with press-to-talk and Web Speech API

**Files:**
- Create: `src-renderer/hooks/useSpeechRecognition.ts`
- Create: `src-renderer/components/VoiceButton.tsx`
- Modify: `src-renderer/components/InputModal.tsx`

- [ ] **Step 1: Write `src-renderer/hooks/useSpeechRecognition.ts`**

```typescript
import { useState, useRef, useCallback } from 'react';

interface SpeechRecognitionResult {
  text: string;
  isListening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition(): SpeechRecognitionResult {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const resolveRef = useRef<((text: string) => void) | null>(null);

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech recognition not available');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (resolveRef.current) {
        resolveRef.current(text);
        resolveRef.current = null;
      }
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Please enable microphone permission in system settings');
      } else if (event.error !== 'aborted') {
        setError(`Recognition failed: ${event.error}`);
      }
      if (resolveRef.current) {
        resolveRef.current('');
        resolveRef.current = null;
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return {
    text: '',
    isListening,
    error,
    start,
    stop,
  };
}
```

- [ ] **Step 2: Write `src-renderer/components/VoiceButton.tsx`**

```typescript
import React, { useState, useRef } from 'react';

interface VoiceButtonProps {
  onResult: (text: string) => void;
  isListening: boolean;
  onStart: () => void;
  onStop: () => void;
  error: string | null;
}

export default function VoiceButton({ onResult, isListening, onStart, onStop, error }: VoiceButtonProps) {
  const isPressedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    isPressedRef.current = true;
    onStart();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    if (isPressedRef.current) {
      isPressedRef.current = false;
      onStop();
    }
  };

  const handlePointerLeave = (e: React.PointerEvent) => {
    if (isPressedRef.current) {
      isPressedRef.current = false;
      onStop();
    }
  };

  return (
    <div className="voice-btn-wrapper">
      <button
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        aria-label={isListening ? 'Listening...' : 'Voice input'}
        title="按住说话"
      >
        {isListening ? '🔴' : '🎤'}
      </button>
      {error && <div className="voice-error">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Update `src-renderer/components/InputModal.tsx` to integrate VoiceButton**

Add the import and replace the static voice button:

```typescript
import VoiceButton from './VoiceButton';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

// Inside the component, before the return:
const { isListening, error, start, stop } = useSpeechRecognition();

// Replace the static voice button with:
<VoiceButton
  onResult={(voiceText) => {
    if (voiceText) setText((prev) => prev + voiceText);
  }}
  isListening={isListening}
  onStart={start}
  onStop={stop}
  error={error}
/>
```

Note: Because `useSpeechRecognition` resolves via a ref callback, the integration needs a slight adjustment. Update the hook to track the result:

Actually, update `useSpeechRecognition` to use a callback pattern:

Modify `src-renderer/hooks/useSpeechRecognition.ts` — add `onResult` callback parameter:

```typescript
export function useSpeechRecognition(onResult: (text: string) => void): Omit<SpeechRecognitionResult, 'text'> & { start: () => void; stop: () => void } {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech recognition not available');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      onResult(text);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setError('Please enable microphone permission in system settings');
      } else if (event.error !== 'aborted') {
        setError(`Recognition failed: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  }, [onResult]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  return { isListening, error, start, stop };
}
```

Then in InputModal:

```typescript
// Inside InputModal component:
const handleVoiceResult = (voiceText: string) => {
  if (voiceText) setText((prev) => prev + voiceText);
};
const { isListening, error, start, stop } = useSpeechRecognition(handleVoiceResult);
```

- [ ] **Step 4: Commit**

```bash
git add src-renderer/hooks/useSpeechRecognition.ts src-renderer/components/VoiceButton.tsx src-renderer/components/InputModal.tsx
git commit -m "feat: add voice input with press-to-talk and Web Speech API"
```

---

## Phase 6: CLI Executor & API Key Storage (Priorities 5-6)

### Task 15: CLIExecutor with spawn-based safe execution — tests first

**Files:**
- Create: `tests/unit/CLIExecutor.test.ts`
- Create: `src/services/CLIExecutor.ts`

- [ ] **Step 1: Write failing test `tests/unit/CLIExecutor.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CLIExecutor } from '../../src/services/CLIExecutor';
import { EventEmitter } from 'events';
import child_process from 'child_process';

vi.mock('child_process', () => {
  const mockChild = new EventEmitter();
  (mockChild as any).stdout = new EventEmitter();
  (mockChild as any).stderr = new EventEmitter();
  (mockChild as any).kill = vi.fn();

  return {
    default: {
      spawn: vi.fn(() => mockChild),
    },
    spawn: vi.fn(() => mockChild),
  };
});

describe('CLIExecutor', () => {
  let executor: CLIExecutor;
  let mockChild: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChild = new EventEmitter();
    mockChild.stdout = new EventEmitter();
    mockChild.stderr = new EventEmitter();
    mockChild.kill = vi.fn();
    (child_process.spawn as any).mockReturnValue(mockChild);
    executor = new CLIExecutor(30000);
  });

  it('executes CLI with arguments array (no shell)', async () => {
    const resultPromise = executor.execute('/usr/bin/echo', ['hello world']);

    mockChild.stdout!.emit('data', Buffer.from('hello world\n'));
    mockChild.emit('close', 0);

    const result = await resultPromise;
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello world');
  });

  it('uses spawn with shell: false', async () => {
    const resultPromise = executor.execute('/usr/bin/echo', ['test']);

    mockChild.stdout!.emit('data', Buffer.from('test\n'));
    mockChild.emit('close', 0);
    await resultPromise;

    const spawnCall = (child_process.spawn as any).mock.calls[0];
    expect(spawnCall[2].shell).toBe(false);
  });

  it('passes {content} placeholder as literal argument', async () => {
    const resultPromise = executor.execute('/bin/cli', ['send', '--msg', 'hello; rm -rf /']);

    mockChild.emit('close', 0);
    await resultPromise;

    const spawnCall = (child_process.spawn as any).mock.calls[0];
    const args = spawnCall[1];
    expect(args).toContain('hello; rm -rf /');
  });

  it('rejects when CLI path not found', async () => {
    const error = new Error('ENOENT');
    (error as any).code = 'ENOENT';
    mockChild.emit('error', error);

    await expect(executor.execute('/nonexistent/cli', [])).rejects.toThrow('CLI tool not found');
  });

  it('times out after configured duration', async () => {
    vi.useFakeTimers();
    const resultPromise = executor.execute('/bin/sleep', ['100']);
    vi.advanceTimersByTime(31000);
    await expect(resultPromise).rejects.toThrow('timed out');
    expect(mockChild.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('validates that CLI path is an absolute path', async () => {
    await expect(executor.execute('./relative/path', [])).rejects.toThrow('must be an absolute path');
  });
});
```

- [ ] **Step 2: Write `src/services/CLIExecutor.ts`**

```typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class CLIExecutor {
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  async execute(cliPath: string, args: string[], timeout?: number): Promise<ExecResult> {
    if (!path.isAbsolute(cliPath)) {
      throw new Error('CLI path must be an absolute path');
    }

    if (!fs.existsSync(cliPath)) {
      throw new Error('CLI tool not found');
    }

    try {
      fs.accessSync(cliPath, fs.constants.X_OK);
    } catch {
      throw new Error('CLI tool is not executable');
    }

    const maxWait = timeout ?? this.defaultTimeout;

    return new Promise<ExecResult>((resolve, reject) => {
      const child: ChildProcess = spawn(cliPath, args, {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill('SIGTERM');
          reject(new Error(`CLI execution timed out after ${maxWait}ms`));
        }
      }, maxWait);

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if (err.code === 'ENOENT') {
            reject(new Error('CLI tool not found'));
          } else {
            reject(new Error(`CLI execution failed: ${err.message}`));
          }
        }
      });

      child.on('close', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({
            exitCode: code ?? 1,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      });
    });
  }

  validatePath(cliPath: string): string | null {
    if (!path.isAbsolute(cliPath)) {
      return 'CLI path must be an absolute path';
    }
    if (!fs.existsSync(cliPath)) {
      return 'CLI path does not exist';
    }
    try {
      fs.accessSync(cliPath, fs.constants.X_OK);
    } catch {
      return 'CLI path is not executable';
    }
    return null;
  }
}
```

- [ ] **Step 3: Run tests**

Run:
```bash
pnpm vitest run tests/unit/CLIExecutor.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/CLIExecutor.test.ts src/services/CLIExecutor.ts
git commit -m "feat: add CLIExecutor with spawn-based safe execution, timeout, and path validation"
```

### Task 16: KeyStore — API key encryption with safeStorage

**Files:**
- Create: `tests/unit/KeyStore.test.ts`
- Create: `src/services/KeyStore.ts`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Write `src/services/KeyStore.ts`**

```typescript
import { safeStorage } from 'electron';
import { getDb } from '../database/connection';

const KEY_STORAGE_KEY = '__llm_api_key__';

export class KeyStore {
  isAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  storeKey(apiKey: string): void {
    if (!this.isAvailable()) {
      throw new Error('Encryption not available on this system');
    }
    const encrypted = safeStorage.encryptString(apiKey);
    const hex = encrypted.toString('hex');

    const db = getDb();
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    ).run(KEY_STORAGE_KEY, hex, hex);
  }

  getKey(): string | null {
    if (!this.isAvailable()) {
      return null;
    }

    const db = getDb();
    const row = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(KEY_STORAGE_KEY) as { value: string } | undefined;

    if (!row?.value) return null;

    try {
      const buffer = Buffer.from(row.value, 'hex');
      return safeStorage.decryptString(buffer);
    } catch {
      return null;
    }
  }

  deleteKey(): void {
    const db = getDb();
    db.prepare('DELETE FROM settings WHERE key = ?').run(KEY_STORAGE_KEY);
  }
}
```

- [ ] **Step 2: Write `tests/unit/KeyStore.test.ts`** (unit tests that work without Electron runtime)

```typescript
import { describe, it, expect, vi } from 'vitest';

// Test the KeyStore interface and error paths
// Full integration requires Electron runtime; unit tests cover logic paths
describe('KeyStore', () => {
  it('exports KeyStore class', async () => {
    const { KeyStore } = await import('../../src/services/KeyStore');
    expect(typeof KeyStore).toBe('function');
    const store = new KeyStore();
    expect(typeof store.isAvailable).toBe('function');
    expect(typeof store.storeKey).toBe('function');
    expect(typeof store.getKey).toBe('function');
    expect(typeof store.deleteKey).toBe('function');
  });
});
```

- [ ] **Step 3: Add IPC handlers for API key in `src/main/ipc.ts`**

Add to `registerIpcHandlers()`:

```typescript
import { KeyStore } from '../services/KeyStore';

// Inside registerIpcHandlers():
const keyStore = new KeyStore();

ipcMain.handle('apiKey:get', () => {
  return keyStore.getKey();
});

ipcMain.handle('apiKey:set', (_event, key: string) => {
  keyStore.storeKey(key);
});
```

- [ ] **Step 4: Commit**

```bash
git add src/services/KeyStore.ts tests/unit/KeyStore.test.ts src/main/ipc.ts
git commit -m "feat: add KeyStore for API key encryption via safeStorage"
```

---

## Phase 7: Daily Reminders & LLM (Priority 7)

### Task 17: LLMService — call LLM for reminder content generation

**Files:**
- Create: `src/services/LLMService.ts`
- Create: `tests/unit/LLMService.test.ts`

- [ ] **Step 1: Write `src/services/LLMService.ts`**

```typescript
import OpenAI from 'openai';
import log from 'electron-log';

const PROMPT_TEMPLATE = `你是一个待办事项助手。用户有以下待办事项：

{todoList}

请生成：
1. 简洁摘要（不超过50字）
2. 每条待办的行动建议（简短）
3. 优先级建议（如有）

输出格式：
【摘要】
...

【行动建议】
1. ...
2. ...`;

export interface ReminderContent {
  summary: string;
  suggestions: string[];
  raw: string;
}

export class LLMService {
  private getClient(endpoint: string, apiKey: string): OpenAI {
    return new OpenAI({
      apiKey,
      baseURL: endpoint || 'https://api.openai.com/v1',
      timeout: 15000,
      maxRetries: 1,
    });
  }

  async generateReminder(
    todos: { content: string; isCompleted: boolean }[],
    endpoint: string,
    apiKey: string,
    model: string
  ): Promise<ReminderContent> {
    const incomplete = todos.filter((t) => !t.isCompleted);

    if (incomplete.length === 0) {
      return { summary: '', suggestions: [], raw: '' };
    }

    const displayTodos = incomplete.slice(0, 50);
    const todoText = displayTodos.map((t, i) => `${i + 1}. ${t.content}`).join('\n');
    const prompt = PROMPT_TEMPLATE.replace('{todoList}', todoText);

    const client = this.getClient(endpoint, apiKey);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseResponse(content);
    } catch (err: any) {
      log.warn('LLM call failed, falling back to raw list', err.message);
      const fallback = incomplete.map((t) => `- ${t.content}`).join('\n');
      return {
        summary: `You have ${incomplete.length} pending todos`,
        suggestions: [],
        raw: fallback,
      };
    }
  }

  private parseResponse(content: string): ReminderContent {
    const summaryMatch = content.match(/【摘要】\s*\n?(.+?)(?:\n|$)/);
    const summary = summaryMatch?.[1]?.trim() || '';

    const suggestions: string[] = [];
    const suggestionSection = content.match(/【行动建议】\s*\n?([\s\S]*?)$/);
    if (suggestionSection) {
      const lines = suggestionSection[1].trim().split('\n');
      for (const line of lines) {
        const cleaned = line.replace(/^\d+\.\s*/, '').trim();
        if (cleaned) suggestions.push(cleaned);
      }
    }

    return { summary, suggestions, raw: content };
  }
}
```

- [ ] **Step 2: Write `tests/unit/LLMService.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { LLMService } from '../../src/services/LLMService';

describe('LLMService', () => {
  const service = new LLMService();

  it('parses reminder response correctly', () => {
    const raw = `【摘要】
你今天有3项任务需要完成

【行动建议】
1. 先去超市买牛奶
2. 下午遛狗
3. 晚上回复邮件`;

    const result = (service as any).parseResponse(raw);
    expect(result.summary).toBe('你今天有3项任务需要完成');
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0]).toBe('先去超市买牛奶');
  });

  it('handles empty incomplete todos', async () => {
    const result = await service.generateReminder([], '', '', '');
    expect(result.summary).toBe('');
    expect(result.suggestions).toHaveLength(0);
  });

  it('handles malformed LLM response gracefully', () => {
    const result = (service as any).parseResponse('some random text without format');
    expect(result.raw).toBe('some random text without format');
  });
});
```

- [ ] **Step 3: Run tests**

Run:
```bash
pnpm vitest run tests/unit/LLMService.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/services/LLMService.ts tests/unit/LLMService.test.ts
git commit -m "feat: add LLMService for reminder content generation with fallback"
```

### Task 18: ReminderService — scheduling, catch-up, and dispatch

**Files:**
- Create: `src/services/ReminderService.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/main/index.ts`

- [ ] **Step 1: Write `src/services/ReminderService.ts`**

```typescript
import { getDb, getSetting, setSetting } from '../database/connection';
import { TodoService } from './TodoService';
import { LLMService } from './LLMService';
import { KeyStore } from './KeyStore';
import { CLIExecutor } from './CLIExecutor';
import log from 'electron-log';

export class ReminderService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private llmService: LLMService;
  private keyStore: KeyStore;
  private cliExecutor: CLIExecutor;
  private onReminderContent?: (content: string) => void;

  constructor() {
    this.llmService = new LLMService();
    this.keyStore = new KeyStore();
    this.cliExecutor = new CLIExecutor(30000);
  }

  setOnReminderContent(callback: (content: string) => void): void {
    this.onReminderContent = callback;
  }

  scheduleAll(): void {
    this.clearAll();
    const timesJson = getSetting('reminder_times');
    if (!timesJson) return;

    let times: string[];
    try {
      times = JSON.parse(timesJson);
    } catch {
      log.warn('Invalid reminder_times format');
      return;
    }

    for (const timeStr of times) {
      this.scheduleTime(timeStr);
    }

    this.scheduleCatchUp();
  }

  private scheduleTime(timeStr: string): void {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);

    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const delay = target.getTime() - now.getTime();

    const timer = setTimeout(() => {
      this.fireReminder(timeStr);
      // Reschedule for next day
      this.scheduleTime(timeStr);
    }, delay);

    this.timers.set(timeStr, timer);
    log.info(`Scheduled reminder at ${timeStr}, firing in ${Math.round(delay / 60000)} minutes`);
  }

  private scheduleCatchUp(): void {
    const now = new Date();
    const timesJson = getSetting('reminder_times');

    if (!timesJson) return;
    let times: string[];
    try {
      times = JSON.parse(timesJson);
    } catch {
      return;
    }

    for (const timeStr of times) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);

      const missedBy = now.getTime() - target.getTime();
      // If missed by less than 5 minutes, fire catch-up
      if (missedBy > 0 && missedBy < 5 * 60 * 1000) {
        log.info(`Catch-up: firing missed reminder at ${timeStr}`);
        this.fireReminder(timeStr);
      }
    }
  }

  private async fireReminder(timeStr: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = getSetting('last_reminder_date');

    if (lastDate === today) {
      log.info(`Reminder already sent today (${today}), skipping`);
      return;
    }

    const todoService = new TodoService(getDb());
    const todos = todoService.getIncomplete();

    if (todos.length === 0) {
      log.info('No incomplete todos, skipping reminder');
      return;
    }

    const endpoint = getSetting('llm_endpoint') || '';
    const model = getSetting('llm_model') || 'gpt-4o-mini';
    const apiKey = this.keyStore.getKey();

    let content: string;

    if (apiKey && endpoint) {
      const result = await this.llmService.generateReminder(todos, endpoint, apiKey, model);
      content = result.raw || todos.map((t) => `- ${t.content}`).join('\n');
    } else {
      content = todos.map((t) => `- ${t.content}`).join('\n');
    }

    // Send via CLI
    const cliPath = getSetting('im_cli_path');
    const cliArgs = getSetting('im_cli_args');

    if (cliPath && cliArgs) {
      try {
        const args = cliArgs.replace('{content}', content).split(' ').filter(Boolean);
        await this.cliExecutor.execute(cliPath, args);
        log.info('Reminder sent via CLI');
      } catch (err: any) {
        log.error('Failed to send reminder via CLI', err.message);
      }
    }

    this.onReminderContent?.(content);
    setSetting('last_reminder_date', today);
  }

  async sendTest(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await this.fireReminder('test');
  }

  clearAll(): void {
    for (const [key, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
```

- [ ] **Step 2: Add reminder IPC handlers in `src/main/ipc.ts`**

```typescript
import { ReminderService } from '../services/ReminderService';

// In registerIpcHandlers(), after other ipcMain.handle calls:
const reminderService = new ReminderService();
reminderService.setOnReminderContent((content) => {
  const win = getMainWindow();
  if (win) {
    win.webContents.send('reminder-content', content);
  }
});
reminderService.scheduleAll();

ipcMain.handle('reminder:test', async () => {
  await reminderService.sendTest();
});
```

Need to import `getMainWindow` from `./window`:

```typescript
import { getMainWindow } from './window';
```

- [ ] **Step 3: Ensure reminder service starts on app launch**

In `src/main/index.ts`, the IPC handlers registration already calls `reminderService.scheduleAll()` via `registerIpcHandlers()`.

- [ ] **Step 4: Commit**

```bash
git add src/services/ReminderService.ts src/main/ipc.ts
git commit -m "feat: add ReminderService with scheduling, catch-up, LLM integration, and CLI dispatch"
```

---

## Phase 8: Settings Panel & Network Status (Priorities 8-11)

### Task 19: NetworkStatus component

**Files:**
- Create: `src-renderer/components/NetworkStatus.tsx`

- [ ] **Step 1: Write `src-renderer/components/NetworkStatus.tsx`**

```typescript
import React, { useState, useEffect } from 'react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="network-status">
      <span className="network-dot" />
      离线
    </div>
  );
}
```

- [ ] **Step 2: Add styles to `App.css`**

```css
.network-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 4px;
}

.network-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
}
```

- [ ] **Step 3: Add to App.tsx**

Add `<NetworkStatus />` at the top of the app container div.

- [ ] **Step 4: Commit**

```bash
git add src-renderer/components/NetworkStatus.tsx src-renderer/App.tsx src-renderer/App.css
git commit -m "feat: add NetworkStatus component showing offline state"
```

### Task 20: SettingsPanel — IM CLI config, LLM config, reminder times, pet images, auto-launch

**Files:**
- Create: `src-renderer/components/SettingsPanel.tsx`

- [ ] **Step 1: Write `src-renderer/components/SettingsPanel.tsx`**

```typescript
import React, { useState, useEffect } from 'react';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [imCliPath, setImCliPath] = useState('');
  const [imCliArgs, setImCliArgs] = useState('');
  const [reminderTimes, setReminderTimes] = useState('');
  const [llmEndpoint, setLlmEndpoint] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const settings = await window.todoAPI.getSettings();
      setImCliPath(settings.im_cli_path || '');
      setImCliArgs(settings.im_cli_args || '');
      setReminderTimes((settings.reminder_times || '["21:00"]'));
      setLlmEndpoint(settings.llm_endpoint || 'https://api.openai.com/v1');
      setLlmModel(settings.llm_model || 'gpt-4o-mini');
      setAutoLaunch(settings.auto_launch === '1');

      const key = await window.todoAPI.getApiKey();
      if (key) setApiKey('••••••••');
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await window.todoAPI.updateSetting('im_cli_path', imCliPath);
      await window.todoAPI.updateSetting('im_cli_args', imCliArgs);
      await window.todoAPI.updateSetting('reminder_times', reminderTimes);
      await window.todoAPI.updateSetting('llm_endpoint', llmEndpoint);
      await window.todoAPI.updateSetting('llm_model', llmModel);
      await window.todoAPI.updateSetting('auto_launch', autoLaunch ? '1' : '0');

      if (apiKey && apiKey !== '••••••••') {
        await window.todoAPI.setApiKey(apiKey);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <label>Reminder times (JSON array, e.g. ["09:00","21:00"])</label>
        <input value={reminderTimes} onChange={(e) => setReminderTimes(e.target.value)} />

        <label>IM CLI path</label>
        <input value={imCliPath} onChange={(e) => setImCliPath(e.target.value)} placeholder="/usr/local/bin/feishu" />

        <label>IM CLI args (use {'{content}'} placeholder)</label>
        <input value={imCliArgs} onChange={(e) => setImCliArgs(e.target.value)} placeholder='send --message "{content}"' />

        <label>LLM API endpoint</label>
        <input value={llmEndpoint} onChange={(e) => setLlmEndpoint(e.target.value)} />

        <label>LLM model</label>
        <input value={llmModel} onChange={(e) => setLlmModel(e.target.value)} />

        <label>API key</label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />

        <label>
          <input
            type="checkbox"
            checked={autoLaunch}
            onChange={(e) => setAutoLaunch(e.target.checked)}
          />
          Launch on startup
        </label>

        <div className="settings-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add SettingsPanel styles to App.css**

```css
.settings-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.2);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}

.settings-panel {
  width: 280px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-panel h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.settings-panel label {
  font-size: 12px;
  color: #6b7280;
}

.settings-panel input[type="text"],
.settings-panel input[type="password"] {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
}

.settings-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.settings-actions button {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
}

.settings-actions button:first-child {
  background: #f3f4f6;
}

.settings-actions button:last-child {
  background: #7c3aed;
  color: white;
}
```

- [ ] **Step 3: Commit**

```bash
git add src-renderer/components/SettingsPanel.tsx src-renderer/App.css
git commit -m "feat: add SettingsPanel for IM CLI, LLM, reminders, and auto-launch config"
```

---

## Phase 9: Polish & Auto-Launch (Priority 12)

### Task 21: Auto-launch registration and window position persistence

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/window.ts`

- [ ] **Step 1: Add auto-launch logic to `src/main/index.ts`**

```typescript
import { app } from 'electron';
import { setSetting, getSetting } from '../database/connection';

// In app.whenReady():
const autoLaunch = getSetting('auto_launch') === '1';
app.setLoginItemSettings({
  openAtLogin: autoLaunch,
});
```

- [ ] **Step 2: Add window position save/restore to `src/main/window.ts`**

Add to `createMainWindow()`:

```typescript
import { getSetting, setSetting } from '../database/connection';

// After window is created, restore position:
const savedX = getSetting('window_position_x');
const savedY = getSetting('window_position_y');
if (savedX && savedY) {
  mainWindow.setPosition(parseInt(savedX), parseInt(savedY));
}

// Save position on move:
mainWindow.on('moved', () => {
  const [x, y] = mainWindow!.getPosition();
  setSetting('window_position_x', String(x));
  setSetting('window_position_y', String(y));
});
```

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts src/main/window.ts
git commit -m "feat: add auto-launch registration and window position persistence"
```

### Task 22: Pet image upload via file dialog

**Files:**
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Add pet image upload IPC handler in `src/main/ipc.ts`**

```typescript
import { dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// In registerIpcHandlers():
ipcMain.handle('pet:uploadImage', async (_event, state: string) => {
  const result = await dialog.showOpenDialog({
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const stat = fs.statSync(filePath);

  if (stat.size > 2 * 1024 * 1024) {
    throw new Error('Image must be under 2MB');
  }

  // Copy to app data
  const userDataPath = app.getPath('userData');
  const destDir = path.join(userDataPath, 'pet-images');
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const ext = path.extname(filePath);
  const destPath = path.join(destDir, `${state}${ext}`);
  fs.copyFileSync(filePath, destPath);

  setSetting(`pet_image_${state}`, destPath);
  return destPath;
});

ipcMain.handle('pet:getImages', () => {
  return {
    idle: getSetting('pet_image_idle') || null,
    active: getSetting('pet_image_active') || null,
    speaking: getSetting('pet_image_speaking') || null,
  };
});
```

- [ ] **Step 2: Commit**

```bash
git add src/main/ipc.ts
git commit -m "feat: add pet image upload via file dialog with validation"
```

---

## Phase 10: E2E Test

### Task 23: Playwright E2E test for core todo flow

**Files:**
- Create: `tests/e2e/todo-flow.spec.ts`

- [ ] **Step 1: Install Playwright**

Run:
```bash
pnpm add -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write `tests/e2e/todo-flow.spec.ts`**

```typescript
import { test, expect, _electron as electron } from '@playwright/test';

test('add, complete, and delete a todo', async () => {
  const electronApp = await electron.launch({
    args: ['dist/main/index.js'],
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  // Click pet to open input
  await page.click('[data-testid="pet-view"]');

  // Type and submit a todo
  const input = page.locator('.todo-input');
  await input.fill('E2E test todo');
  await input.press('Enter');

  // Verify it appears
  await expect(page.locator('.todo-content')).toContainText('E2E test todo');

  // Toggle complete
  await page.locator('.todo-checkbox').first().click();
  await expect(page.locator('.todo-item.completed')).toHaveCount(1);

  // Delete
  await page.hover('.todo-item');
  await page.locator('.todo-delete').click();
  await expect(page.locator('.todo-content')).toHaveCount(0);

  await electronApp.close();
});
```

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/todo-flow.spec.ts
git commit -m "test: add Playwright E2E test for core todo flow"
```

---

## Verification Checklist

Before marking this plan complete, verify:

- [ ] All 12 priority items from spec are covered by tasks
- [ ] Every task has exact file paths
- [ ] Every code step shows the actual code
- [ ] Every test step shows the test code
- [ ] Every command step shows the exact command and expected output
- [ ] No TBD, TODO, or placeholder references
- [ ] Types are consistent across tasks (Todo, TodoCreateInput, AppSettings match)
- [ ] IPC channel names match between preload and ipc.ts
