import { ipcMain, app, BrowserWindow } from 'electron';
import { TodoService } from '../services/TodoService';
import { SettingsService } from '../services/SettingsService';
import { DailyReportService } from '../services/DailyReportService';
import fs from 'fs';
import path from 'path';

let todoService: TodoService;
let settingsService: SettingsService;
let dailyReportService: DailyReportService | null = null;

export function registerIpcHandlers(): void {
  todoService = new TodoService();
  settingsService = new SettingsService();

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
    const ext = path.extname(filePath);
    const destFileName = `pet-${state}${ext}`;
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
}