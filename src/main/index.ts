import { app, BrowserWindow, ipcMain } from 'electron';
import { createMainWindow, getMainWindow, saveWindowPosition } from './window';
import { createTray } from './tray';
import { openSettingsWindow, closeSettingsWindow } from './settingsWindow';
import { initDatabase, closeDatabase, getDb } from '../database/connection';
import { registerIpcHandlers, setKbService, setRoleService, setKbIngestService } from './ipc';
import { registerGlobalShortcut, unregisterAllShortcuts } from './shortcut';
import { ReminderService } from '../services/ReminderService';
import { CLIExecutor } from '../services/CLIExecutor';
import { LLMService } from '../services/LLMService';
import { SettingsService } from '../services/SettingsService';
import { RoleService } from '../services/RoleService';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService';
import { KnowledgeWatcher } from '../services/KnowledgeWatcher';
import { WikiIngestService } from '../services/WikiIngestService';
import { WikiIndexService } from '../services/WikiIndexService';
import log from 'electron-log';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Disable hardware acceleration to prevent black screen on Windows
app.disableHardwareAcceleration();

// 桌面宠物在失焦后仍需保持 GIF 动画。app.disableHardwareAcceleration() 让
// Windows 走软件合成路径,合成器对失焦/被遮挡窗口有额外的节流,仅靠
// webPreferences.backgroundThrottling (Blink JS 侧) 管不到合成器/图片解码器
// 这条路径。补齐三个开关以彻底关闭后台 throttle:
//   - disable-background-timer-throttling: 失焦时仍跑 timers
//   - disable-renderer-backgrounding:     失焦时仍调度渲染
//   - disable-backgrounding-occluded-windows: Windows 特有的 occlusion throttle
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

log.initialize();

let isQuitting = false;
let reminderService: ReminderService | null = null;
let watcher: KnowledgeWatcher | null = null;
let ingestService: WikiIngestService | null = null;

app.whenReady().then(async () => {
  initDatabase();
  registerIpcHandlers();

  const win = createMainWindow();

  createTray();
  // Set auto-launch from saved setting
  const autoLaunchEnabled = app.getLoginItemSettings().openAtLogin;
  log.info(`Auto-launch: ${autoLaunchEnabled}`);
  registerGlobalShortcut(win);

  // Initialize ReminderService
  const settingsService = new SettingsService();
  const llmService = new LLMService();
  const cliExecutor = new CLIExecutor();
  reminderService = new ReminderService(cliExecutor, llmService, settingsService);
  reminderService.start();

  const userDataDir = app.getPath('userData');
  // KB config dir: ~/.todoagent/ on the user's home — keeps new KB artifacts
  // (role.md, wiki output) in a conventional dotfolder, separate from the
  // Electron-managed userData (which holds todos.db + pet images). Pre-existing
  // role.md in userData is migrated one-way into the new dir on first load.
  const todoagentDir = path.join(os.homedir(), '.todoagent');
  fs.mkdirSync(todoagentDir, { recursive: true });
  const roleService = new RoleService(todoagentDir, path.join(userDataDir, 'role.md'));
  // Eager-load so role.md exists at ~/.todoagent/role.md from the first
  // launch (creates from template, or migrates a legacy userData/role.md).
  await roleService.load();
  const kbService = new KnowledgeBaseService(getDb(), settingsService);
  const indexService = new WikiIndexService();
  const wikiDirSetting = settingsService.get('kb_wiki_dir') || path.join(todoagentDir, 'wiki');
  ingestService = new WikiIngestService(getDb(), { llm: llmService, wikiDir: wikiDirSetting });
  watcher = new KnowledgeWatcher({ enqueue: (p) => ingestService!.enqueue(p) });

  // Drop stale wiki pages if the user changed the wiki dir since last run.
  const lastIndexed = settingsService.get('kb_wiki_dir_last_indexed');
  await indexService.initFromDbAndDisk(getDb(), wikiDirSetting, lastIndexed);

  // Wire LLMService dependencies for KB context injection (role + wiki hits).
  llmService.setContext(settingsService, roleService, indexService);

  // Start watcher on all enabled sources
  for (const src of kbService.listSources().filter(s => s.enabled)) {
    watcher.addDir(src.path);
  }
  await watcher.start();

  // Start ingest worker (drains kb_ingest_queue on a 2s poll)
  ingestService.startWorker();

  // Hand the services to IPC handlers. Order matters: services that the
  // handlers delegate to (kbService, roleService, kbIngestService) must be
  // set before any IPC event fires. Handlers are registered but no events
  // arrive until the renderer mounts, which happens after createMainWindow.
  setKbService(kbService);
  setRoleService(roleService);
  setKbIngestService(ingestService);

  // Register IPC handler for auto-launch setting
  ipcMain.handle('settings:setAutoLaunch', (_event: any, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
    log.info(`Auto-launch set to: ${enabled}`);
  });

  // Settings window IPC handlers
  ipcMain.handle('settings:window:open', () => {
    openSettingsWindow();
  });

  ipcMain.handle('settings:window:close', () => {
    closeSettingsWindow();
  });

  ipcMain.handle('settings:saved', () => {
    try {
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('refresh-pet-images');
      }
    } catch (error) {
      log.error('Error in settings:saved handler:', error);
    }
  });

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      saveWindowPosition(win);
    }
  });
});

app.on('will-quit', () => {
  unregisterAllShortcuts();
  reminderService?.stop();
  watcher?.stop();
  ingestService?.stopWorker();
});

app.on('before-quit', () => {
  isQuitting = true;
  reminderService?.stop();
  closeDatabase();
});

app.on('activate', () => {
  const win = getMainWindow();
  if (win) {
    win.show();
  }
});
