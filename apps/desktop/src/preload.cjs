'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('projectgraf', {
  isElectron: true,
  selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
});
