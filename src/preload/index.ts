import { contextBridge, ipcRenderer } from 'electron';

const api = {
  closeSettingsWindow: () => ipcRenderer.invoke('settings:window:close'),
  onRefreshPetImages: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('refresh-pet-images', listener);
    return () => ipcRenderer.removeListener('refresh-pet-images', listener);
  },
};

contextBridge.exposeInMainWorld('todoAPI', api);

export type TodoAPI = typeof api;