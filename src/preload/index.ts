import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Window controls
  closeSettingsWindow: () => ipcRenderer.invoke('settings:window:close'),
  dragWindow: () => ipcRenderer.send('window:drag'),
  moveWindow: (deltaX: number, deltaY: number) => ipcRenderer.send('window:move', deltaX, deltaY),
  getWindowPosition: () => ipcRenderer.invoke('window:getPosition'),
  setWindowCollapsed: (collapsed: boolean) => ipcRenderer.invoke('window:setCollapsed', collapsed),
  onRefreshPetImages: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('refresh-pet-images', listener);
    return () => ipcRenderer.removeListener('refresh-pet-images', listener);
  },
  onOpenSettings: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('open-settings', listener);
    return () => ipcRenderer.removeListener('open-settings', listener);
  },
  onPetGifReload: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('pet-gif-reload', listener);
    return () => ipcRenderer.removeListener('pet-gif-reload', listener);
  },
  onTriggerInput: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('trigger-input', listener);
    return () => ipcRenderer.removeListener('trigger-input', listener);
  },

  // Pet images
  getPetImages: () => ipcRenderer.invoke('pets:getImages'),
  uploadPetImage: (state: string, filePath: string) =>
    ipcRenderer.invoke('pets:uploadImage', state, filePath),
  resetPetImage: (state: string) =>
    ipcRenderer.invoke('pets:resetImage', state),

  // Todos
  getTodos: () => ipcRenderer.invoke('todos:getAll'),
  addTodo: (input: { content: string }) => ipcRenderer.invoke('todos:add', input),
  toggleTodo: (id: string) => ipcRenderer.invoke('todos:toggle', id),
  updateTodo: (id: string, content: string) => ipcRenderer.invoke('todos:update', id, content),
  updateTodoNotes: (id: string, notes: string) => ipcRenderer.invoke('todos:updateNotes', id, notes),
  deleteTodo: (id: string) => ipcRenderer.invoke('todos:delete', id),
  updateSortOrder: (ids: string[]) => ipcRenderer.invoke('todos:updateSortOrder', ids),

  // Daily Report
  generateDailyReport: () => ipcRenderer.invoke('dailyReport:generate'),
  getReportDir: () => ipcRenderer.invoke('dailyReport:getReportDir'),
  setReportDir: (dir: string) => ipcRenderer.invoke('dailyReport:setReportDir', dir),
  onDailyReportGenerated: (callback: (path: string) => void) => {
    const listener = (_: unknown, path: string) => callback(path);
    ipcRenderer.on('dailyReport:generated', listener);
    return () => ipcRenderer.removeListener('dailyReport:generated', listener);
  },

  // Encouragement phrase generator (powered by LLM when configured).
  generateEncouragement: () => ipcRenderer.invoke('encouragement:generate'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  getApiKey: () => ipcRenderer.invoke('settings:get', 'apiKey'),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:set', 'apiKey', apiKey),

  // Knowledge Base (Phase 1)
  kb: {
    listSources: () => ipcRenderer.invoke('kb:listSources'),
    addSource: (dirPath: string) => ipcRenderer.invoke('kb:addSource', dirPath),
    removeSource: (dirPath: string) => ipcRenderer.invoke('kb:removeSource', dirPath),
    getStats: () => ipcRenderer.invoke('kb:getStats'),
    rebuild: () => ipcRenderer.invoke('kb:rebuild'),
    getWikiDir: () => ipcRenderer.invoke('kb:getWikiDir'),
    setWikiDir: (dir: string) => ipcRenderer.invoke('kb:setWikiDir', dir),
    openRole: () => ipcRenderer.invoke('kb:openRole'),
    resetRole: () => ipcRenderer.invoke('kb:resetRole'),
  },
  dialog: {
    openDirectory: (defaultPath?: string) => ipcRenderer.invoke('dialog:openDirectory', defaultPath),
  },
  shell: {
    showInFolder: (target: string) => ipcRenderer.invoke('shell:showInFolder', target),
  },
};

contextBridge.exposeInMainWorld('todoAPI', api);

export type TodoAPI = typeof api;