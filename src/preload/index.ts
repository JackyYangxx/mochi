import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Window controls
  closeSettingsWindow: () => ipcRenderer.invoke('settings:window:close'),
  dragWindow: () => ipcRenderer.send('window:drag'),
  moveWindow: (deltaX: number, deltaY: number) => ipcRenderer.send('window:move', deltaX, deltaY),
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
  deleteTodo: (id: string) => ipcRenderer.invoke('todos:delete', id),
  updateSortOrder: (ids: string[]) => ipcRenderer.invoke('todos:updateSortOrder', ids),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  getApiKey: () => ipcRenderer.invoke('settings:get', 'apiKey'),
  updateSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  setApiKey: (apiKey: string) => ipcRenderer.invoke('settings:set', 'apiKey', apiKey),
};

contextBridge.exposeInMainWorld('todoAPI', api);

export type TodoAPI = typeof api;