# Calendar Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Calendar Kanban" BrowserWindow that visualizes daily todo completion counts via a yearly heatmap + monthly calendar, mirroring the settings window architecture.

**Architecture:** Three layers — backend (`CalendarService` SQL aggregation over `todos.completed_at`), main process (mirror of `settingsWindow.ts`: window lifecycle + tray menu trigger + IPC handlers), and renderer (independent React entry with three components: `YearHeatmap`, `CalendarMonth`, `DayDetailPanel`). Wired via the existing `window.todoAPI` preload bridge.

**Tech Stack:** Electron 28, React 18, TypeScript, better-sqlite3 (read-only queries), Vitest + React Testing Library, Vite multi-entry build.

**Spec:** `docs/superpowers/specs/2026-06-19-calendar-kanban-design.md`

---

## File Structure

### New files (backend)
- `src/shared/types/calendar.ts` — `MonthStat`, `DayStat`, `CalendarTodo` interfaces
- `src/services/CalendarService.ts` — three read-only SQL aggregation methods
- `tests/unit/CalendarService.test.ts` — service tests (date boundaries, DST, empty data, sub-tasks)

### New files (main process)
- `src/main/calendarWindow.ts` — window lifecycle, bounds persistence, `openCalendarWindow()` export

### New files (renderer)
- `src-renderer/calendar.html` — Vite entry HTML
- `src-renderer/calendar/CalendarApp.tsx` — top-level React component, layout shell
- `src-renderer/calendar/CalendarApp.css` — layout + theme tokens
- `src-renderer/calendar/hooks/useCalendarData.ts` — state hook bridging `window.todoAPI`
- `src-renderer/calendar/YearHeatmap.tsx` — 7×53 grid (year overview)
- `src-renderer/calendar/YearHeatmap.css`
- `src-renderer/calendar/CalendarMonth.tsx` — 6×7 grid (month detail)
- `src-renderer/calendar/CalendarMonth.css`
- `src-renderer/calendar/DayDetailPanel.tsx` — right-side drawer
- `src-renderer/calendar/DayDetailPanel.css`
- `tests/components/CalendarMonth.test.tsx` — grid render + click
- `tests/components/YearHeatmap.test.tsx` — grid render
- `tests/components/DayDetailPanel.test.tsx` — empty state + list

### Modified files
- `src/main/ipc.ts` — register 5 calendar IPC handlers
- `src/main/index.ts` — instantiate `CalendarService` for IPC handlers
- `src/main/tray.ts` — add `Calendar` menu item between `Show` and `Settings`
- `src/preload/index.ts` — add 5 calendar methods to `window.todoAPI`
- `vite.config.ts` — add `calendar` rollup entry; rename `injectSettingsAssets` plugin to `injectWindowAssets` (handles both HTML templates)

---

## Task 1: CalendarService — types, tests, and SQL implementation

**Files:**
- Create: `src/shared/types/calendar.ts`
- Create: `src/services/CalendarService.ts`
- Create: `tests/unit/CalendarService.test.ts`

- [ ] **Step 1: Create shared types**

`src/shared/types/calendar.ts`:

```ts
export interface MonthStat {
  day: number;       // 1-31
  count: number;
}

export interface DayStat {
  date: string;      // 'YYYY-MM-DD'
  count: number;
}

export interface CalendarTodo {
  id: string;
  content: string;
  completedAt: string;
  parentId: string | null;
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/CalendarService.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { CalendarService } from '../../src/services/CalendarService';

function setupDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE todos (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      is_completed INTEGER DEFAULT 0,
      parent_id TEXT DEFAULT NULL
    );
  `);
  return db;
}

function insertCompleted(db: Database.Database, id: string, completedAt: string, content = 'task', parentId: string | null = null): void {
  db.prepare(
    `INSERT INTO todos (id, content, sort_order, created_at, updated_at, completed_at, is_completed, parent_id)
     VALUES (?, ?, 0, ?, ?, ?, 1, ?)`
  ).run(id, content, completedAt, completedAt, completedAt, parentId);
}

describe('CalendarService', () => {
  let db: Database.Database;
  let svc: CalendarService;

  beforeEach(() => {
    db = setupDb();
    svc = new CalendarService(db);
  });

  describe('getMonthStats', () => {
    it('returns empty array when no completions in month', () => {
      expect(svc.getMonthStats(2026, 6)).toEqual([]);
    });

    it('aggregates completions by local day', () => {
      // 2026-06-15 local: three completions
      insertCompleted(db, 'a', '2026-06-15T09:00:00');
      insertCompleted(db, 'b', '2026-06-15T14:30:00');
      insertCompleted(db, 'c', '2026-06-15T23:59:00');
      // 2026-06-20 local: one completion
      insertCompleted(db, 'd', '2026-06-20T10:00:00');
      // 2026-05-31 (prior month) — should NOT appear
      insertCompleted(db, 'e', '2026-05-31T23:59:00');
      // 2026-07-01 (next month) — should NOT appear
      insertCompleted(db, 'f', '2026-07-01T00:00:01');

      const stats = svc.getMonthStats(2026, 6);
      expect(stats).toEqual([
        { day: 15, count: 3 },
        { day: 20, count: 1 },
      ]);
    });

    it('handles December → January year boundary', () => {
      insertCompleted(db, 'a', '2025-12-31T23:00:00');
      insertCompleted(db, 'b', '2026-01-01T01:00:00');

      expect(svc.getMonthStats(2025, 12)).toEqual([{ day: 31, count: 1 }]);
      expect(svc.getMonthStats(2026, 1)).toEqual([{ day: 1, count: 1 }]);
    });

    it('counts subtasks independently', () => {
      insertCompleted(db, 'parent', '2026-06-10T09:00:00', 'parent task');
      insertCompleted(db, 'child1', '2026-06-10T10:00:00', 'child 1', 'parent');
      insertCompleted(db, 'child2', '2026-06-10T11:00:00', 'child 2', 'parent');

      const stats = svc.getMonthStats(2026, 6);
      expect(stats).toEqual([{ day: 10, count: 3 }]);
    });

    it('ignores incomplete todos', () => {
      db.prepare(
        `INSERT INTO todos (id, content, is_completed, completed_at) VALUES (?, ?, 0, NULL)`
      ).run('x', 'still open');

      expect(svc.getMonthStats(2026, 6)).toEqual([]);
    });

    it('ignores NULL completed_at even when is_completed=1', () => {
      db.prepare(
        `INSERT INTO todos (id, content, is_completed, completed_at) VALUES (?, ?, 1, NULL)`
      ).run('x', 'weird row');

      expect(svc.getMonthStats(2026, 6)).toEqual([]);
    });
  });

  describe('getYearHeatmap', () => {
    it('returns stats across the full year', () => {
      insertCompleted(db, 'a', '2026-01-15T09:00:00');
      insertCompleted(db, 'b', '2026-06-15T09:00:00');
      insertCompleted(db, 'c', '2026-06-15T10:00:00');
      insertCompleted(db, 'd', '2026-12-31T23:00:00');
      insertCompleted(db, 'e', '2027-01-01T00:00:01'); // next year — excluded

      const heatmap = svc.getYearHeatmap(2026);
      expect(heatmap).toEqual([
        { date: '2026-01-15', count: 1 },
        { date: '2026-06-15', count: 2 },
        { date: '2026-12-31', count: 1 },
      ]);
    });

    it('returns empty array for year with no completions', () => {
      expect(svc.getYearHeatmap(2026)).toEqual([]);
    });
  });

  describe('getDayTodos', () => {
    it('returns todos completed on a given local day, sorted by completion time asc', () => {
      insertCompleted(db, 'a', '2026-06-15T09:00:00', 'morning');
      insertCompleted(db, 'b', '2026-06-15T14:00:00', 'afternoon');
      insertCompleted(db, 'c', '2026-06-14T23:00:00', 'yesterday');

      const todos = svc.getDayTodos('2026-06-15');
      expect(todos).toHaveLength(2);
      expect(todos[0]).toMatchObject({ id: 'a', content: 'morning', parentId: null });
      expect(todos[1]).toMatchObject({ id: 'b', content: 'afternoon', parentId: null });
      expect(todos[0].completedAt).toBe('2026-06-15T09:00:00');
    });

    it('returns empty array for day with no completions', () => {
      expect(svc.getDayTodos('2026-06-15')).toEqual([]);
    });

    it('returns subtasks with their parentId set', () => {
      insertCompleted(db, 'p', '2026-06-15T09:00:00', 'parent');
      insertCompleted(db, 'c', '2026-06-15T10:00:00', 'child', 'p');

      const todos = svc.getDayTodos('2026-06-15');
      expect(todos).toHaveLength(2);
      expect(todos.find(t => t.id === 'c')?.parentId).toBe('p');
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- tests/unit/CalendarService.test.ts`
Expected: FAIL with "Cannot find module '../../src/services/CalendarService'" or similar.

- [ ] **Step 4: Implement CalendarService**

`src/services/CalendarService.ts`:

```ts
import type Database from 'better-sqlite3';
import type { MonthStat, DayStat, CalendarTodo } from '../shared/types/calendar';

interface DayCountRow {
  day: string;
  count: number;
}

interface TodoRow {
  id: string;
  content: string;
  completed_at: string;
  parent_id: string | null;
}

export class CalendarService {
  constructor(private db: Database.Database) {}

  getMonthStats(year: number, month: number): MonthStat[] {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const end = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const rows = this.db.prepare(`
      SELECT date(completed_at, 'localtime') AS day, COUNT(*) AS count
      FROM todos
      WHERE is_completed = 1
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        AND completed_at < ?
      GROUP BY day
    `).all(start, end) as DayCountRow[];
    return rows.map(r => ({
      day: parseInt(r.day.slice(-2), 10),
      count: r.count,
    }));
  }

  getYearHeatmap(year: number): DayStat[] {
    const start = `${year}-01-01`;
    const end = `${year + 1}-01-01`;
    const rows = this.db.prepare(`
      SELECT date(completed_at, 'localtime') AS day, COUNT(*) AS count
      FROM todos
      WHERE is_completed = 1
        AND completed_at IS NOT NULL
        AND completed_at >= ?
        AND completed_at < ?
      GROUP BY day
    `).all(start, end) as DayCountRow[];
    return rows.map(r => ({ date: r.day, count: r.count }));
  }

  getDayTodos(date: string): CalendarTodo[] {
    const rows = this.db.prepare(`
      SELECT id, content, completed_at, parent_id
      FROM todos
      WHERE is_completed = 1
        AND completed_at IS NOT NULL
        AND date(completed_at, 'localtime') = ?
      ORDER BY completed_at ASC
    `).all(date) as TodoRow[];
    return rows.map(r => ({
      id: r.id,
      content: r.content,
      completedAt: r.completed_at,
      parentId: r.parent_id,
    }));
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- tests/unit/CalendarService.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `pnpm test`
Expected: PASS, all existing + new tests.

- [ ] **Step 7: Commit**

```bash
git add src/shared/types/calendar.ts src/services/CalendarService.ts tests/unit/CalendarService.test.ts
git commit -m "feat(calendar): add CalendarService with month/year/day stats queries"
```

---

## Task 2: IPC handlers + preload API

**Files:**
- Modify: `src/main/ipc.ts:56` — register 5 calendar handlers, instantiate CalendarService
- Modify: `src/main/index.ts` — pass shared `db` to `registerIpcHandlers` so it can construct CalendarService
- Modify: `src/preload/index.ts:3-86` — expose 5 calendar methods on `window.todoAPI`

- [ ] **Step 1: Examine how the shared DB is currently passed around**

Read `src/main/index.ts` and `src/main/ipc.ts:32-56` to confirm how `todoService` and `dailyReportService` get a DB connection today.

Note: `registerIpcHandlers` currently constructs `TodoService` and `SettingsService` with no arguments. Check `src/database/connection.ts` for `getDb()` and decide whether `CalendarService` should also use `getDb()` (matching the rest of the codebase) or receive an injected `db` like the test uses.

- [ ] **Step 2: Adjust CalendarService to use `getDb()` (production path)**

Production code should match the existing pattern. Update `src/services/CalendarService.ts` so its production methods call `getDb()` internally, while the tests keep the injected `db` for isolation.

Replace the constructor and the three methods with:

```ts
import { getDb } from '../database/connection';
import type { MonthStat, DayStat, CalendarTodo } from '../shared/types/calendar';

export class CalendarService {
  getMonthStats(year: number, month: number): MonthStat[] {
    const db = getDb();
    // ... same SQL as before, using `db`
  }

  getYearHeatmap(year: number): DayStat[] {
    const db = getDb();
    // ... same SQL as before, using `db`
  }

  getDayTodos(date: string): CalendarTodo[] {
    const db = getDb();
    // ... same SQL as before, using `db`
  }
}
```

The test file (Task 1) constructs the service with `new CalendarService(db)` — change the test file to call the methods directly on a `CalendarService` instance that internally uses `getDb()`. **But** the test needs DB isolation. Solution: change the test to use a helper that monkey-patches `getDb`, OR keep the constructor accepting an optional `db`.

Cleaner approach: keep `CalendarService` parameterless in production, and have the tests construct it against an in-memory DB by *replacing the `getDb` module export*. Do this via `vi.mock`:

Update `tests/unit/CalendarService.test.ts` top to:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const testDb = vi.hoisted(() => ({ current: null as Database.Database | null }));

vi.mock('../../src/database/connection', () => ({
  getDb: () => {
    if (!testDb.current) throw new Error('test db not initialized');
    return testDb.current;
  },
}));

import { CalendarService } from '../../src/services/CalendarService';
```

Then in `beforeEach`:

```ts
beforeEach(() => {
  testDb.current = setupDb();
});
```

This keeps the service code clean (matches `TodoService`) and the tests isolated.

- [ ] **Step 3: Re-run service tests to confirm they still pass**

Run: `pnpm test -- tests/unit/CalendarService.test.ts`
Expected: PASS, all 11 tests.

- [ ] **Step 4: Add IPC handlers**

In `src/main/ipc.ts`, near the existing `Todo handlers` block (around line 99), add:

```ts
import { CalendarService } from '../services/CalendarService';
```

And inside `registerIpcHandlers()`, after the existing handlers:

```ts
// Calendar handlers
const calendarService = new CalendarService();

ipcMain.handle('calendar:getMonthStats', (_event, year: number, month: number) =>
  calendarService.getMonthStats(year, month)
);
ipcMain.handle('calendar:getYearHeatmap', (_event, year: number) =>
  calendarService.getYearHeatmap(year)
);
ipcMain.handle('calendar:getDayTodos', (_event, date: string) =>
  calendarService.getDayTodos(date)
);
ipcMain.handle('calendar:window:open', () => {
  import('./calendarWindow').then(m => m.openCalendarWindow());
});
ipcMain.handle('calendar:window:close', () => {
  import('./calendarWindow').then(m => m.closeCalendarWindow());
});
```

- [ ] **Step 5: Expose calendar methods on `window.todoAPI`**

In `src/preload/index.ts`, add to the `api` object:

```ts
// Calendar
openCalendarWindow: () => ipcRenderer.invoke('calendar:window:open'),
closeCalendarWindow: () => ipcRenderer.invoke('calendar:window:close'),
getMonthStats: (year: number, month: number) =>
  ipcRenderer.invoke('calendar:getMonthStats', year, month),
getYearHeatmap: (year: number) =>
  ipcRenderer.invoke('calendar:getYearHeatmap', year),
getDayTodos: (date: string) =>
  ipcRenderer.invoke('calendar:getDayTodos', date),
```

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main/ipc.ts src/preload/index.ts src/services/CalendarService.ts tests/unit/CalendarService.test.ts
git commit -m "feat(calendar): wire IPC handlers and preload API for calendar window"
```

---

## Task 3: CalendarWindow main process + tray menu + Vite config

**Files:**
- Create: `src/main/calendarWindow.ts`
- Modify: `src/main/tray.ts:33-58` — add Calendar menu item
- Modify: `vite.config.ts:1-78` — rename plugin, add calendar entry

- [ ] **Step 1: Create CalendarWindow**

`src/main/calendarWindow.ts`:

```ts
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
```

- [ ] **Step 2: Add Calendar menu item to tray**

In `src/main/tray.ts`, after the `Show` menu item (line ~36-42) and before the `Settings` item (line ~44-49), add:

```ts
{
  label: 'Calendar',
  click: () => {
    openCalendarWindow();
  },
},
```

And add to the imports at the top:

```ts
import { openCalendarWindow } from './calendarWindow';
```

Result: tray context menu becomes `Show | Calendar | Settings | Quit`.

- [ ] **Step 3: Rename Vite plugin and add calendar entry**

In `vite.config.ts`:

1. Rename the plugin function `injectSettingsAssets` → `injectWindowAssets`.
2. Update its `closeBundle` to inject assets into **both** `settings.html` and `calendar.html` (if both exist).
3. Add `calendar` to the `rollupOptions.input` map.

Full new file:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

function injectWindowAssets() {
  let buildStarted = false;

  return {
    name: 'inject-window-assets',
    apply: 'build',
    buildStart() {
      buildStarted = true;
    },
    closeBundle() {
      if (!buildStarted) return;

      const distDir = path.join(__dirname, 'dist-renderer');
      const assetsDir = path.join(distDir, 'assets');

      if (!fs.existsSync(assetsDir)) {
        console.log('Assets dir not found');
        return;
      }

      const files = fs.readdirSync(assetsDir);

      // Settings window
      injectFor(files, distDir, path.join(distDir, 'src-renderer', 'settings.html'), 'settings', 'SettingsPanel');

      // Calendar window
      injectFor(files, distDir, path.join(distDir, 'src-renderer', 'calendar.html'), 'calendar', null);
    },
  };
}

function injectFor(
  files: string[],
  distDir: string,
  htmlPath: string,
  entryPrefix: string,
  cssFallbackPrefix: string | null
): void {
  if (!fs.existsSync(htmlPath)) return;
  const entryJs = files.find(f => f.startsWith(`${entryPrefix}-`) && f.endsWith('.js'));
  if (!entryJs) return;

  const entryCss = files.find(f => f.startsWith(`${entryPrefix}-`) && f.endsWith('.css'));
  const fallbackCss = cssFallbackPrefix
    ? files.find(f => f.startsWith(`${cssFallbackPrefix}-`) && f.endsWith('.css'))
    : undefined;

  const cssLinks = [
    entryCss ? `<link rel="stylesheet" crossorigin href="../assets/${entryCss}">` : '',
    fallbackCss ? `<link rel="stylesheet" crossorigin href="../assets/${fallbackCss}">` : '',
  ].filter(Boolean).join('\n  ');

  const title = entryPrefix === 'calendar' ? 'Mochi - Calendar' : 'Mochi - Settings';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <script type="module" crossorigin src="../assets/${entryJs}"></script>
  ${cssLinks}
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
  fs.writeFileSync(htmlPath, html);
  console.log(`Injected assets into ${path.basename(htmlPath)}: ${entryJs}`);
}

export default defineConfig({
  plugins: [react(), injectWindowAssets()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist-renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        settings: path.resolve(__dirname, 'src-renderer/settings.html'),
        calendar: path.resolve(__dirname, 'src-renderer/calendar.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
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

- [ ] **Step 4: Run build to verify Vite config compiles**

Run: `pnpm build`
Expected: Vite build succeeds; logs `Injected assets into calendar.html: calendar-...js` (calendar.html doesn't exist yet — that's OK, the `injectFor` call no-ops; we'll create the file in Task 4).

- [ ] **Step 5: Commit**

```bash
git add src/main/calendarWindow.ts src/main/tray.ts vite.config.ts
git commit -m "feat(calendar): add calendar window, tray menu item, and Vite entry"
```

---

## Task 4: CalendarApp shell + HTML entry + useCalendarData hook

**Files:**
- Create: `src-renderer/calendar.html`
- Create: `src-renderer/calendar/CalendarApp.tsx`
- Create: `src-renderer/calendar/CalendarApp.css`
- Create: `src-renderer/calendar/hooks/useCalendarData.ts`

- [ ] **Step 1: Create calendar HTML entry**

`src-renderer/calendar.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>Mochi - Calendar</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./calendar/CalendarApp.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create useCalendarData hook**

`src-renderer/calendar/hooks/useCalendarData.ts`:

```ts
import { useEffect, useState, useCallback } from 'react';
import type { MonthStat, DayStat, CalendarTodo } from '../../shared/types/calendar';

declare global {
  interface Window {
    todoAPI: {
      getMonthStats: (year: number, month: number) => Promise<MonthStat[]>;
      getYearHeatmap: (year: number) => Promise<DayStat[]>;
      getDayTodos: (date: string) => Promise<CalendarTodo[]>;
    };
  }
}

export function useCalendarData(year: number, month: number) {
  const [monthStats, setMonthStats] = useState<Map<number, number>>(new Map());
  const [heatmap, setHeatmap] = useState<Map<string, number>>(new Map());
  const [dayTodos, setDayTodos] = useState<CalendarTodo[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelectedDate(null);
    setDayTodos(null);
    Promise.all([
      window.todoAPI.getMonthStats(year, month),
      window.todoAPI.getYearHeatmap(year),
    ]).then(([m, h]) => {
      setMonthStats(new Map(m.map(s => [s.day, s.count])));
      setHeatmap(new Map(h.map(s => [s.date, s.count])));
      setLoading(false);
    });
  }, [year, month]);

  const selectDay = useCallback((date: string) => {
    setSelectedDate(date);
    window.todoAPI.getDayTodos(date).then(setDayTodos);
  }, []);

  return {
    monthStats,
    heatmap,
    dayTodos,
    selectedDate,
    loading,
    selectDay,
  };
}
```

- [ ] **Step 3: Create CalendarApp shell**

`src-renderer/calendar/CalendarApp.tsx`:

```tsx
import { useState, useCallback, useEffect } from 'react';
import { useCalendarData } from './hooks/useCalendarData';
import { CalendarMonth } from './CalendarMonth';
import { YearHeatmap } from './YearHeatmap';
import { DayDetailPanel } from './DayDetailPanel';
import './CalendarApp.css';

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function CalendarApp() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const { monthStats, heatmap, dayTodos, selectedDate, loading, selectDay } =
    useCalendarData(year, month);

  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const goPrev = useCallback(() => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }, [month]);

  const goNext = useCallback(() => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }, [month]);

  const goToday = useCallback(() => {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
  }, []);

  const jumpToMonth = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape' && selectedDate) selectDay(''); // close panel
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, selectedDate, selectDay]);

  return (
    <div className="calendar-app">
      <header className="calendar-header">
        <h1>Mochi · {year}</h1>
        <div className="month-nav">
          <button onClick={goPrev} aria-label="上个月">‹</button>
          <span className="month-label">{MONTH_NAMES[month - 1]}</span>
          <button onClick={goNext} aria-label="下个月">›</button>
        </div>
        <button className="today-btn" onClick={goToday}>今天</button>
      </header>

      <YearHeatmap
        year={year}
        heatmap={heatmap}
        onMonthClick={jumpToMonth}
      />

      {loading ? (
        <div className="loading">加载中…</div>
      ) : (
        <CalendarMonth
          year={year}
          month={month}
          stats={monthStats}
          todayStr={todayStr}
          selectedDate={selectedDate}
          onSelectDay={selectDay}
        />
      )}

      {selectedDate && dayTodos !== null && (
        <DayDetailPanel
          date={selectedDate}
          todos={dayTodos}
          onClose={() => selectDay('')}
        />
      )}
    </div>
  );
}

export default CalendarApp;
```

- [ ] **Step 4: Create CalendarApp.css with theme tokens**

`src-renderer/calendar/CalendarApp.css`:

```css
:root {
  --cal-bg: #fdfbf7;
  --cal-text: #333;
  --cal-text-muted: #888;
  --cal-border: #eee;
  --cal-cell-bg: #f0f0f0;
  --cal-cell-bg-1: #d8f0d4;
  --cal-cell-bg-3: #a8dc9e;
  --cal-cell-bg-6: #6cc060;
  --cal-cell-bg-11: #3a9c2e;
  --cal-accent: #6cc060;
  --cal-accent-soft: rgba(108, 192, 96, 0.4);
}

* {
  box-sizing: border-box;
}

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--cal-bg);
  color: var(--cal-text);
  font-family: system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: 14px;
}

.calendar-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  gap: 12px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.calendar-header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-nav button {
  width: 28px;
  height: 28px;
  border: 1px solid var(--cal-border);
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.month-nav button:hover {
  background: var(--cal-cell-bg-1);
}

.month-label {
  min-width: 36px;
  text-align: center;
  font-weight: 500;
}

.today-btn {
  border: 1px solid var(--cal-accent);
  background: white;
  color: var(--cal-accent);
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.today-btn:hover {
  background: var(--cal-accent);
  color: white;
}

.loading {
  padding: 40px;
  text-align: center;
  color: var(--cal-text-muted);
}
```

- [ ] **Step 5: Stub the three sub-components so the build succeeds**

We need placeholder files for `CalendarMonth`, `YearHeatmap`, and `DayDetailPanel` so the import in `CalendarApp` resolves. They will be filled in by Tasks 5–7.

Create each as a minimal stub:

`src-renderer/calendar/CalendarMonth.tsx`:
```tsx
export function CalendarMonth() { return <div className="placeholder">CalendarMonth (todo)</div>; }
```

`src-renderer/calendar/YearHeatmap.tsx`:
```tsx
export function YearHeatmap() { return <div className="placeholder">YearHeatmap (todo)</div>; }
```

`src-renderer/calendar/DayDetailPanel.tsx`:
```tsx
export function DayDetailPanel() { return <div className="placeholder">DayDetailPanel (todo)</div>; }
```

- [ ] **Step 6: Run build to verify Vite produces calendar entry**

Run: `pnpm build`
Expected: Build succeeds; logs `Injected assets into calendar.html: calendar-<hash>.js`.

- [ ] **Step 7: Commit**

```bash
git add src-renderer/calendar.html src-renderer/calendar/CalendarApp.tsx src-renderer/calendar/CalendarApp.css src-renderer/calendar/hooks/useCalendarData.ts src-renderer/calendar/CalendarMonth.tsx src-renderer/calendar/YearHeatmap.tsx src-renderer/calendar/DayDetailPanel.tsx
git commit -m "feat(calendar): add CalendarApp shell, hook, and HTML entry"
```

---

## Task 5: CalendarMonth component

**Files:**
- Modify: `src-renderer/calendar/CalendarMonth.tsx`
- Create: `src-renderer/calendar/CalendarMonth.css`
- Create: `tests/components/CalendarMonth.test.tsx`

- [ ] **Step 1: Write the failing component test**

`tests/components/CalendarMonth.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarMonth } from '../../src-renderer/calendar/CalendarMonth';

describe('CalendarMonth', () => {
  it('renders a 6-row × 7-col grid with day-of-week headers', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    const headers = screen.getAllByTestId('dow-header');
    expect(headers).toHaveLength(7);
    expect(headers[0].textContent).toBe('日');
    expect(headers[6].textContent).toBe('六');

    const cells = screen.getAllByTestId('day-cell');
    expect(cells.length).toBe(42); // 6 × 7
  });

  it('highlights today cell', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    const today = screen.getByTestId('day-cell-today');
    expect(today.textContent).toContain('19');
  });

  it('shows count badge only when count > 0', () => {
    const stats = new Map<number, number>([[5, 2], [12, 7]]);
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={stats}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    expect(screen.getByTestId('day-cell-count-5').textContent).toBe('2');
    expect(screen.getByTestId('day-cell-count-12').textContent).toBe('7');
    expect(screen.queryByTestId('day-cell-count-1')).toBeNull();
  });

  it('calls onSelectDay with YYYY-MM-DD on cell click', () => {
    const onSelectDay = vi.fn();
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={onSelectDay}
      />
    );
    fireEvent.click(screen.getByTestId('day-cell-15'));
    expect(onSelectDay).toHaveBeenCalledWith('2026-06-15');
  });

  it('marks out-of-month cells as placeholders', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate={null}
        onSelectDay={vi.fn()}
      />
    );
    const placeholders = screen.getAllByTestId('day-cell-placeholder');
    expect(placeholders.length).toBeGreaterThan(0); // June 2026 starts on Monday
  });

  it('marks selectedDate cell', () => {
    render(
      <CalendarMonth
        year={2026}
        month={6}
        stats={new Map()}
        todayStr="2026-06-19"
        selectedDate="2026-06-10"
        onSelectDay={vi.fn()}
      />
    );
    const selected = screen.getByTestId('day-cell-selected');
    expect(selected.textContent).toContain('10');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/components/CalendarMonth.test.tsx`
Expected: FAIL — `day-cell-*` test ids not found.

- [ ] **Step 3: Implement CalendarMonth**

`src-renderer/calendar/CalendarMonth.tsx`:

```tsx
import './CalendarMonth.css';

interface Props {
  year: number;
  month: number; // 1-12
  stats: Map<number, number>;
  todayStr: string;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
}

const DOW = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildCells(year: number, month: number): { day: number | null; dateStr: string | null }[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { day: number | null; dateStr: string | null }[] = [];

  // Leading placeholders
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ day: null, dateStr: null });
  }

  // Real days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      dateStr: `${year}-${pad2(month)}-${pad2(d)}`,
    });
  }

  // Trailing placeholders to fill 6×7 = 42
  while (cells.length < 42) {
    cells.push({ day: null, dateStr: null });
  }
  return cells;
}

function colorClass(count: number): string {
  if (count === 0) return 'count-0';
  if (count <= 2) return 'count-1';
  if (count <= 5) return 'count-3';
  if (count <= 10) return 'count-6';
  return 'count-11';
}

export function CalendarMonth({ year, month, stats, todayStr, selectedDate, onSelectDay }: Props) {
  const cells = buildCells(year, month);

  return (
    <div className="calendar-month">
      <div className="dow-row">
        {DOW.map((d, i) => (
          <div key={i} className="dow-cell" data-testid="dow-header">{d}</div>
        ))}
      </div>
      <div className="day-grid">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={i} className="day-cell placeholder" data-testid="day-cell-placeholder" />;
          }
          const count = stats.get(cell.day) ?? 0;
          const isToday = cell.dateStr === todayStr;
          const isSelected = cell.dateStr === selectedDate;
          const classes = ['day-cell', colorClass(count), isToday && 'today', isSelected && 'selected']
            .filter(Boolean).join(' ');

          let testId = `day-cell-${cell.day}`;
          if (isToday) testId = 'day-cell-today';
          else if (isSelected) testId = 'day-cell-selected';

          return (
            <div
              key={i}
              className={classes}
              data-testid={testId}
              onClick={() => onSelectDay(cell.dateStr!)}
              role="button"
              tabIndex={0}
              title={count > 0 ? `${cell.dateStr} · ${count} 个待办` : cell.dateStr!}
            >
              <span className="day-number">{cell.day}</span>
              {count > 0 && (
                <span className="day-count" data-testid={`day-cell-count-${cell.day}`}>{count}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement CalendarMonth.css**

`src-renderer/calendar/CalendarMonth.css`:

```css
.calendar-month {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.dow-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}

.dow-cell {
  text-align: center;
  font-size: 12px;
  color: var(--cal-text-muted);
  padding: 4px 0;
}

.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  grid-template-rows: repeat(6, 1fr);
  gap: 4px;
  flex: 1;
}

.day-cell {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: transform 0.1s ease;
  user-select: none;
}

.day-cell.placeholder {
  cursor: default;
  visibility: hidden;
}

.day-cell:not(.placeholder):hover {
  transform: scale(1.05);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.day-cell.count-0 { background: var(--cal-cell-bg); }
.day-cell.count-1 { background: var(--cal-cell-bg-1); }
.day-cell.count-3 { background: var(--cal-cell-bg-3); color: white; }
.day-cell.count-6 { background: var(--cal-cell-bg-6); color: white; }
.day-cell.count-11 { background: var(--cal-cell-bg-11); color: white; }

.day-cell.today {
  box-shadow: 0 0 0 2px var(--cal-accent-soft);
  font-weight: 600;
}

.day-cell.selected {
  box-shadow: 0 0 0 2px var(--cal-accent);
}

.day-number {
  line-height: 1;
}

.day-count {
  position: absolute;
  right: 4px;
  bottom: 4px;
  background: rgba(255, 255, 255, 0.85);
  color: var(--cal-text);
  border-radius: 8px;
  padding: 0 6px;
  font-size: 10px;
  min-width: 14px;
  text-align: center;
  line-height: 14px;
  font-weight: 600;
}

.day-cell.count-3 .day-count,
.day-cell.count-6 .day-count,
.day-cell.count-11 .day-count {
  background: rgba(255, 255, 255, 0.95);
  color: var(--cal-text);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/components/CalendarMonth.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-renderer/calendar/CalendarMonth.tsx src-renderer/calendar/CalendarMonth.css tests/components/CalendarMonth.test.tsx
git commit -m "feat(calendar): add CalendarMonth component with color heatmap"
```

---

## Task 6: YearHeatmap component

**Files:**
- Modify: `src-renderer/calendar/YearHeatmap.tsx`
- Create: `src-renderer/calendar/YearHeatmap.css`
- Create: `tests/components/YearHeatmap.test.tsx`

- [ ] **Step 1: Write the failing component test**

`tests/components/YearHeatmap.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YearHeatmap } from '../../src-renderer/calendar/YearHeatmap';

describe('YearHeatmap', () => {
  it('renders 7 rows of weekday cells × 53 columns', () => {
    render(<YearHeatmap year={2026} heatmap={new Map()} onMonthClick={vi.fn()} />);
    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells.length).toBe(7 * 53);
  });

  it('clicking a cell calls onMonthClick with the year and month', () => {
    const onMonthClick = vi.fn();
    const heatmap = new Map<string, number>([['2026-06-15', 3]]);
    render(<YearHeatmap year={2026} heatmap={heatmap} onMonthClick={onMonthClick} />);

    fireEvent.click(screen.getByTestId('heatmap-cell-2026-06-15'));
    expect(onMonthClick).toHaveBeenCalledWith(2026, 6);
  });

  it('renders zero-count cells with neutral class', () => {
    render(<YearHeatmap year={2026} heatmap={new Map()} onMonthClick={vi.fn()} />);
    expect(screen.getByTestId('heatmap-cell-2026-03-10').className).toMatch(/count-0/);
  });

  it('renders high-count cells with deepest class', () => {
    const heatmap = new Map<string, number>([['2026-04-15', 20]]);
    render(<YearHeatmap year={2026} heatmap={heatmap} onMonthClick={vi.fn()} />);
    expect(screen.getByTestId('heatmap-cell-2026-04-15').className).toMatch(/count-11/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/components/YearHeatmap.test.tsx`
Expected: FAIL — `heatmap-cell-*` test ids not found.

- [ ] **Step 3: Implement YearHeatmap**

`src-renderer/calendar/YearHeatmap.tsx`:

```tsx
import './YearHeatmap.css';

interface Props {
  year: number;
  heatmap: Map<string, number>;
  onMonthClick: (year: number, month: number) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function colorClass(count: number): string {
  if (count === 0) return 'count-0';
  if (count <= 2) return 'count-1';
  if (count <= 5) return 'count-3';
  if (count <= 10) return 'count-6';
  return 'count-11';
}

function buildYearGrid(year: number): { date: Date; dateStr: string }[] {
  const start = new Date(year, 0, 1);
  // Walk back to the Sunday on or before Jan 1
  start.setDate(start.getDate() - start.getDay());
  const cells: { date: Date; dateStr: string }[] = [];
  for (let i = 0; i < 7 * 53; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      dateStr: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    });
  }
  return cells;
}

export function YearHeatmap({ year, heatmap, onMonthClick }: Props) {
  const cells = buildYearGrid(year);

  return (
    <div className="year-heatmap" role="grid" aria-label={`${year} 年完成热力图`}>
      {cells.map(({ date, dateStr }) => {
        const inYear = date.getFullYear() === year;
        const count = heatmap.get(dateStr) ?? 0;
        const classes = [
          'heatmap-cell',
          inYear ? colorClass(count) : 'out-of-year',
        ].join(' ');
        return (
          <div
            key={dateStr}
            className={classes}
            data-testid={`heatmap-cell-${dateStr}`}
            data-in-year={inYear ? 'true' : 'false'}
            title={inYear ? `${dateStr} · ${count} 个待办` : ''}
            onClick={inYear ? () => onMonthClick(year, date.getMonth() + 1) : undefined}
            role={inYear ? 'button' : undefined}
            tabIndex={inYear ? 0 : undefined}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement YearHeatmap.css**

`src-renderer/calendar/YearHeatmap.css`:

```css
.year-heatmap {
  display: grid;
  grid-template-columns: repeat(53, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 2px;
  padding: 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: 84px;
}

.heatmap-cell {
  border-radius: 2px;
  background: var(--cal-cell-bg);
  transition: transform 0.1s ease;
}

.heatmap-cell.out-of-year {
  visibility: hidden;
}

.heatmap-cell.count-1 { background: var(--cal-cell-bg-1); }
.heatmap-cell.count-3 { background: var(--cal-cell-bg-3); }
.heatmap-cell.count-6 { background: var(--cal-cell-bg-6); }
.heatmap-cell.count-11 { background: var(--cal-cell-bg-11); }

.heatmap-cell[data-in-year="true"]:not(.count-0):hover {
  transform: scale(1.4);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  z-index: 1;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/components/YearHeatmap.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-renderer/calendar/YearHeatmap.tsx src-renderer/calendar/YearHeatmap.css tests/components/YearHeatmap.test.tsx
git commit -m "feat(calendar): add YearHeatmap component"
```

---

## Task 7: DayDetailPanel component

**Files:**
- Modify: `src-renderer/calendar/DayDetailPanel.tsx`
- Create: `src-renderer/calendar/DayDetailPanel.css`
- Create: `tests/components/DayDetailPanel.test.tsx`

- [ ] **Step 1: Write the failing component test**

`tests/components/DayDetailPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayDetailPanel } from '../../src-renderer/calendar/DayDetailPanel';
import type { CalendarTodo } from '../../src/shared/types/calendar';

const SAMPLE_TODOS: CalendarTodo[] = [
  { id: '1', content: 'morning task', completedAt: '2026-06-15T09:00:00', parentId: null },
  { id: '2', content: 'afternoon task', completedAt: '2026-06-15T14:30:00', parentId: null },
  { id: '3', content: 'child of 1', completedAt: '2026-06-15T10:00:00', parentId: '1' },
];

describe('DayDetailPanel', () => {
  it('renders date and todo count in the header', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={vi.fn()} />
    );
    expect(screen.getByTestId('panel-title').textContent).toContain('2026-06-15');
    expect(screen.getByTestId('panel-title').textContent).toContain('3');
  });

  it('renders each todo with its content and HH:mm time', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={vi.fn()} />
    );
    expect(screen.getByText('morning task')).toBeDefined();
    expect(screen.getByText('09:00')).toBeDefined();
    expect(screen.getByText('14:30')).toBeDefined();
    expect(screen.getByText('child of 1')).toBeDefined();
  });

  it('renders empty state when no todos', () => {
    render(
      <DayDetailPanel date="2026-06-15" todos={[]} onClose={vi.fn()} />
    );
    expect(screen.getByTestId('panel-empty').textContent).toContain('没有');
  });

  it('clicking the close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <DayDetailPanel date="2026-06-15" todos={SAMPLE_TODOS} onClose={onClose} />
    );
    fireEvent.click(screen.getByTestId('panel-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/components/DayDetailPanel.test.tsx`
Expected: FAIL — `panel-title` etc. not found.

- [ ] **Step 3: Implement DayDetailPanel**

`src-renderer/calendar/DayDetailPanel.tsx`:

```tsx
import './DayDetailPanel.css';
import type { CalendarTodo } from '../../shared/types/calendar';

interface Props {
  date: string;
  todos: CalendarTodo[];
  onClose: () => void;
}

function formatHHmm(iso: string): string {
  // iso is 'YYYY-MM-DDTHH:MM:SS' or with offset
  const match = iso.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function DayDetailPanel({ date, todos, onClose }: Props) {
  return (
    <aside className="day-panel" data-testid="day-panel" role="dialog" aria-label={`${date} 完成清单`}>
      <header className="day-panel-header">
        <h2 data-testid="panel-title">{date} · {todos.length} 项已完成</h2>
        <button
          className="panel-close"
          data-testid="panel-close"
          onClick={onClose}
          aria-label="关闭"
        >×</button>
      </header>

      {todos.length === 0 ? (
        <div className="panel-empty" data-testid="panel-empty">
          这天没有完成的待办 ✨
        </div>
      ) : (
        <ul className="todo-list">
          {todos.map(t => (
            <li
              key={t.id}
              className={t.parentId ? 'todo-item subtask' : 'todo-item'}
            >
              <span className="todo-content">{t.content}</span>
              <span className="todo-time">{formatHHmm(t.completedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Implement DayDetailPanel.css**

`src-renderer/calendar/DayDetailPanel.css`:

```css
.day-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  bottom: 16px;
  width: 280px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  animation: slide-in 0.2s ease;
  z-index: 10;
}

@keyframes slide-in {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

.day-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--cal-border);
}

.day-panel-header h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.panel-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: var(--cal-text-muted);
  border-radius: 4px;
}

.panel-close:hover {
  background: var(--cal-cell-bg);
  color: var(--cal-text);
}

.panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cal-text-muted);
  padding: 24px;
  text-align: center;
}

.todo-list {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  gap: 8px;
}

.todo-item.subtask {
  padding-left: 32px;
  font-size: 12px;
  color: var(--cal-text-muted);
}

.todo-item:not(:last-child) {
  border-bottom: 1px solid var(--cal-border);
}

.todo-content {
  flex: 1;
  word-break: break-word;
}

.todo-time {
  font-size: 11px;
  color: var(--cal-text-muted);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test -- tests/components/DayDetailPanel.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-renderer/calendar/DayDetailPanel.tsx src-renderer/calendar/DayDetailPanel.css tests/components/DayDetailPanel.test.tsx
git commit -m "feat(calendar): add DayDetailPanel drawer component"
```

---

## Task 8: Integration verification

**Files:** none modified — manual + build verification only.

- [ ] **Step 1: Run lint and full test suite**

Run:
```bash
pnpm lint
pnpm test
```
Expected: All lint warnings/errors resolved; all tests pass.

- [ ] **Step 2: Run production build**

Run: `pnpm build`
Expected: Build succeeds. Logs should include:
- `Injected assets into settings.html: settings-<hash>.js`
- `Injected assets into calendar.html: calendar-<hash>.js`

Verify on disk:
```bash
ls dist-renderer/assets/ | grep -E "^(calendar|settings)-"
ls dist-renderer/src-renderer/calendar.html
```
Expected: Both `calendar-*.js` and `settings-*.js` exist in assets; calendar.html exists at the expected path.

- [ ] **Step 3: Launch the app and run the manual checklist**

Run: `pnpm start`

Verify on first run:
- [ ] Tray icon → right-click shows `Show | Calendar | Settings | Quit`
- [ ] Click `Calendar` → calendar window opens, defaults to today's month
- [ ] Today's date cell is highlighted (ring around it)
- [ ] The current month shows completed counts (if any data exists) or all gray (if fresh install)
- [ ] Click any day with completions → right-side drawer slides in with the list
- [ ] Click `×` or press `Esc` → drawer closes
- [ ] Click `<` / `>` → month navigates, data refreshes
- [ ] Click `今天` → jumps to current month
- [ ] Click a colored cell in the year heatmap → month jumps to that month
- [ ] Resize the window, close it, reopen from tray → window restores last position and size
- [ ] Add a new todo in the main window, complete it, open Calendar → that day shows count +1 and the todo in its drawer

- [ ] **Step 4: Commit any final fixes (if any)**

If any checklist item failed and required a code fix:
```bash
git add -A
git commit -m "fix(calendar): address manual QA findings"
```

If everything passed, no commit needed — move on to the release step below.

---

## Task 9: Version bump + release (separate workflow)

The release process is documented in `CLAUDE.md`. This task bundles the version bump, build, and tag. Run these as a single change set:

- [ ] **Step 1: Bump version**

In `package.json`: `"version": "1.0.32"` → `"version": "1.0.33"`.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.0.33"
```

- [ ] **Step 3: Build Windows x64**

```bash
pnpm build && pnpm electron-builder --win --x64 --dir
```

Verify `better_sqlite3.node` is `PE32+` (per `CLAUDE.md` warning):
```bash
file release/win-unpacked/resources/app/node_modules/better-sqlite3/build/Release/better_sqlite3.node
```

- [ ] **Step 4: Package zip**

```bash
cd release && zip -r Mochi-v1.0.33-win-x64.zip win-unpacked
cd ..
```

- [ ] **Step 5: Push and create GitHub release**

```bash
git push origin main
gh release create v1.0.33 release/Mochi-v1.0.33-win-x64.zip \
  --title "v1.0.33" \
  --generate-notes
```

---

## Self-Review Notes (filled after writing)

1. **Spec coverage:**
   - §1 Window architecture → Tasks 3, 4 ✓
   - §2 Data model (types + queries) → Task 1 ✓
   - §3 Visual layout (year + month + drawer) → Tasks 5, 6, 7 ✓
   - §4 Interaction (click, navigation, keyboard) → Task 4 (CalendarApp) ✓
   - §5 CalendarService SQL → Task 1 ✓
   - §6 State management (useCalendarData) → Task 4 ✓
   - §7 Error handling → covered by SQL defensive guards + UI loading state ✓
   - §8 File changes → spread across Tasks 1-7 ✓
   - §9 Test strategy → component tests in Tasks 5-7, integration in Task 8 ✓
   - §10 YAGNI scope → no YAGNI violations; spec's "暂不实现" list not introduced ✓
   - §11 No new deps / schema changes → confirmed ✓

2. **Placeholder scan:** No TBD / TODO / "implement later" in steps. Each step has full code or a concrete command. ✓

3. **Type consistency:**
   - `MonthStat`, `DayStat`, `CalendarTodo` defined in Task 1; used identically in hook (Task 4), tests (Tasks 5/6/7), and components (Tasks 5/6/7). ✓
   - `colorClass()` defined in `CalendarMonth.tsx` (Task 5) and `YearHeatmap.tsx` (Task 6) with identical logic and thresholds — kept as duplicated (YAGNI: a shared util would be premature; both files are short and self-contained).
   - `pad2()` duplicated in `CalendarApp.tsx`, `CalendarMonth.tsx`, `YearHeatmap.tsx` — same justification; if a 4th occurrence appears, extract.
   - `openCalendarWindow` / `closeCalendarWindow` exported from `calendarWindow.ts` (Task 3), called from `tray.ts` (Task 3) and `ipc.ts` (Task 2 dynamic import). ✓
   - `window.todoAPI` methods added in Task 2, consumed in `useCalendarData` (Task 4). Names match. ✓

4. **Open questions for the implementer:**
   - None — the spec is unambiguous and the plan is concrete.