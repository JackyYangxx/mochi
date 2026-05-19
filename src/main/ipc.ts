import { ipcMain, app } from 'electron';
import { getDb } from '../database/connection';
import { TodoService } from '../services/TodoService';
import { SettingsService } from '../services/SettingsService';
import fs from 'fs';
import path from 'path';

let todoService: TodoService;
let settingsService: SettingsService;

export function registerIpcHandlers(): void {
  todoService = new TodoService(getDb());
  settingsService = new SettingsService(getDb());

  // Todo handlers
  ipcMain.handle('todos:getAll', () => todoService.getAll());
  ipcMain.handle('todos:add', (_event, input: { content: string }) => todoService.add(input));
  ipcMain.handle('todos:toggle', (_event, id: string) => todoService.toggle(id));
  ipcMain.handle('todos:delete', (_event, id: string) => todoService.delete(id));
  ipcMain.handle('todos:search', (_event, query: string) => todoService.search(query));
  ipcMain.handle('todos:updateSortOrder', (_event, ids: string[]) => todoService.updateSortOrder(ids));

  // Settings handlers
  ipcMain.handle('settings:getAll', () => settingsService.getAll());
  ipcMain.handle('settings:get', (_event, key: string) => settingsService.get(key));
  ipcMain.handle('settings:set', (_event, key: string, value: string) => settingsService.set(key, value));
  ipcMain.handle('settings:delete', (_event, key: string) => settingsService.delete(key));

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
    return destPath;
  });

  ipcMain.handle('pets:getImages', () => ({
    idle: settingsService.get('petImage_idle'),
    active: settingsService.get('petImage_active'),
    speaking: settingsService.get('petImage_speaking'),
  }));
}