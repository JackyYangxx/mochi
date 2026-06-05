import { ipcMain, app, BrowserWindow, dialog, shell } from 'electron';
import { TodoService } from '../services/TodoService';
import { SettingsService } from '../services/SettingsService';
import { DailyReportService } from '../services/DailyReportService';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import { RoleService } from '../services/RoleService';
import { getDb } from '../database/connection';
import fs from 'fs';
import path from 'path';

let todoService: TodoService;
let settingsService: SettingsService;
let dailyReportService: DailyReportService | null = null;
let kbService: KnowledgeBaseService;
// Phase 1: WikiIngestService is created in Task 7/8; we use a lazy any-typed ref
// so the UI wiring compiles before that service lands. Methods called through
// the handlers will throw a clear "not yet wired" error until then.
let kbIngestService: { getStats(): unknown; rebuildAll(): Promise<unknown> } | null = null;
let roleService: RoleService;

// Phase 4 closure: main process calls this after constructing WikiIngestService.
// The setter pattern breaks the circular import between index.ts and ipc.ts
// without resorting to module-level exports of state.
export function setKbIngestService(svc: {
  getStats(): unknown;
  rebuildAll(): Promise<unknown>;
}): void {
  kbIngestService = svc;
}

export function registerIpcHandlers(): void {
  todoService = new TodoService();
  settingsService = new SettingsService();
  kbService = new KnowledgeBaseService(getDb(), settingsService);
  roleService = new RoleService(app.getPath('userData'));

  // Daily Report handlers
  ipcMain.handle('dailyReport:generate', async () => {
    if (!dailyReportService) {
      const llmService = new (await import('../services/LLMService')).LLMService();
      dailyReportService = new DailyReportService(llmService, settingsService);
    }
    return dailyReportService.generateDailyReport();
  });

  ipcMain.handle('dailyReport:getReportDir', () => {
    return settingsService.get('reportDir') || '';
  });

  ipcMain.handle('dailyReport:setReportDir', (_event, dir: string) => {
    settingsService.set('reportDir', dir);
    return true;
  });

  // Todo handlers
  ipcMain.handle('todos:getAll', () => todoService.getAll());
  ipcMain.handle('todos:add', (_event, input: { content: string; parentId?: string }) => todoService.add(input));
  ipcMain.handle('todos:toggle', (_event, id: string) => todoService.toggle(id));
  ipcMain.handle('todos:delete', (_event, id: string) => todoService.delete(id));
  ipcMain.handle('todos:update', (_event, id: string, content: string) => todoService.update(id, content));
  ipcMain.handle('todos:updateNotes', (_event, id: string, notes: string) => todoService.updateNotes(id, notes));
  ipcMain.handle('todos:search', (_event, query: string) => todoService.search(query));
  ipcMain.handle('todos:updateSortOrder', (_event, ids: string[]) => todoService.updateSortOrder(ids));

  // Settings handlers
  ipcMain.handle('settings:getAll', () => settingsService.getAll());
  ipcMain.handle('settings:get', (_event, key: string) => settingsService.get(key));
  ipcMain.handle('settings:set', (_event, key: string, value: string) => settingsService.set(key, value));
  ipcMain.handle('settings:delete', (_event, key: string) => settingsService.delete(key));

  // Window drag handlers (for Windows compatibility)
  ipcMain.on('window:drag', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      // startDragging() makes the window draggable - use any to bypass strict TS checking
      (win as any).startDragging?.();
    }
  });

  ipcMain.on('window:move', (_event, deltaX: number, deltaY: number) => {
    const win = BrowserWindow.fromWebContents((_event as any).sender);
    if (win && !win.isDestroyed()) {
      const [x, y] = win.getPosition();
      win.setPosition(x + deltaX, y + deltaY);
    }
  });

  ipcMain.handle('window:getPosition', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      return win.getPosition();
    }
    return [0, 0];
  });

  // App handlers
  ipcMain.handle('app:setAutoLaunch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
    });
  });

  ipcMain.handle('app:getAutoLaunch', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  // Pet image handlers
  ipcMain.handle('pets:uploadImage', (_event, state: string, filePath: string) => {
    const userDataPath = app.getPath('userData');
    const imagesDir = path.join(userDataPath, 'pet-images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const oldPath = settingsService.get(`petImage_${state}`);
    if (oldPath) {
      try {
        fs.unlinkSync(oldPath);
      } catch {
        // ignore missing file
      }
    }
    const ext = path.extname(filePath);
    const destFileName = `pet-${state}-${Date.now()}${ext}`;
    const destPath = path.join(imagesDir, destFileName);
    fs.copyFileSync(filePath, destPath);
    settingsService.set(`petImage_${state}`, destPath);

    // Notify main window to refresh pet images
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('refresh-pet-images');
      }
    }
    return destPath;
  });

  ipcMain.handle('pets:getImages', () => ({
    idle: settingsService.get('petImage_idle'),
    active: settingsService.get('petImage_active'),
    speaking: settingsService.get('petImage_speaking'),
  }));

  ipcMain.handle('pets:resetImage', (_event, state: string) => {
    const key = `petImage_${state}`;
    const currentPath = settingsService.get(key);
    if (currentPath) {
      try {
        fs.unlinkSync(currentPath);
      } catch (e) {
        // Ignore if file doesn't exist
      }
    }
    settingsService.delete(key);

    // Notify main window to refresh pet images
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('refresh-pet-images');
      }
    }
    return null;
  });

  // Data import/export handlers
  ipcMain.handle('data:export', (_event, filePath: string) => {
    const todos = todoService.getAll();
    const data = { version: 1, exportedAt: new Date().toISOString(), todos };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, count: todos.length };
  });

  ipcMain.handle('data:import', (_event, filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    if (!data.todos || !Array.isArray(data.todos)) {
      throw new Error('Invalid import file format');
    }
    const added: string[] = [];
    for (const todo of data.todos) {
      const result = todoService.add({ content: todo.content });
      added.push(result.id);
    }
    return { success: true, count: added.length };
  });

  // ============================================================
  // Knowledge Base (Phase 1) handlers
  // ============================================================
  ipcMain.handle('kb:listSources', () => kbService.listSources());
  ipcMain.handle('kb:addSource', (_event, dirPath: string) => kbService.addSource(dirPath));
  ipcMain.handle('kb:removeSource', (_event, dirPath: string) => kbService.removeSource(dirPath));
  ipcMain.handle('kb:getStats', () => {
    if (!kbIngestService) {
      return { pending: 0, processing: 0, failed: 0, lastIngestedAt: null };
    }
    return kbIngestService.getStats();
  });
  ipcMain.handle('kb:rebuild', async () => {
    if (!kbIngestService) {
      throw new Error('WikiIngestService 尚未初始化（Phase 2 任务待完成）');
    }
    return kbIngestService.rebuildAll();
  });
  ipcMain.handle('kb:getWikiDir', () => settingsService.get('kb_wiki_dir') || '');
  ipcMain.handle('kb:setWikiDir', (_event, dir: string) => {
    // Validate input: reject empty / whitespace-only / non-absolute paths.
    if (typeof dir !== 'string' || dir.trim().length === 0) {
      throw new Error('wiki 目录路径不能为空');
    }
    if (!path.isAbsolute(dir)) {
      throw new Error('wiki 目录必须是绝对路径');
    }
    // Normalize so trailing slashes / "." segments don't trip the equality check.
    const normalizedDir = path.resolve(dir);
    if (normalizedDir === path.sep) {
      throw new Error('wiki 目录不能为根目录');
    }
    const current = settingsService.get('kb_wiki_dir');
    const normalizedCurrent = current ? path.resolve(current) : '';
    if (normalizedCurrent && normalizedCurrent !== normalizedDir) {
      // F3: block hot-swap, force restart
      throw new Error('wiki 目录不可热切换，请重启应用后再次修改');
    }
    settingsService.set('kb_wiki_dir', normalizedDir);
    if (!settingsService.get('kb_wiki_dir_last_indexed')) {
      // F3: bootstrap last-known so the startup check passes on first set
      settingsService.set('kb_wiki_dir_last_indexed', normalizedDir);
    }
    return true;
  });
  ipcMain.handle('kb:openRole', () => roleService.openInEditor());
  ipcMain.handle('kb:resetRole', async () => {
    await roleService.reset();
    return true;
  });

  // Native folder picker (shared by KB "add source" + "change wiki dir")
  ipcMain.handle('dialog:openDirectory', async (event, defaultPath?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options: Electron.OpenDialogOptions = {
      title: '选择目录',
      defaultPath: defaultPath || app.getPath('home'),
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Reveal a path in the OS file manager
  ipcMain.handle('shell:showInFolder', (_event, target: string) => {
    if (!target) return false;
    shell.showItemInFolder(target);
    return true;
  });
}