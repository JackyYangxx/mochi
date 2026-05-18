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
