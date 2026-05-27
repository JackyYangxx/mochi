import { contextBridge, ipcRenderer } from 'electron';

const api = {
  closeSettingsWindow: () => ipcRenderer.invoke('settings:window:close'),
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
  getPetImages: () => ipcRenderer.invoke('pets:getImages'),
  uploadPetImage: (state: string, filePath: string) =>
    ipcRenderer.invoke('pets:uploadImage', state, filePath),
};

contextBridge.exposeInMainWorld('todoAPI', api);

export type TodoAPI = typeof api;