const { contextBridge } = require('electron');

// Expose app info to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  version: require('../package.json').version,
});
