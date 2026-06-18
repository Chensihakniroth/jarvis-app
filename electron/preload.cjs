const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('jarvisAPI', {
  startGateway: () => ipcRenderer.invoke('gateway-start'),
  getGatewayStatus: () => ipcRenderer.invoke('gateway-status'),
  onGatewayReady: (callback) => ipcRenderer.on('gateway-ready', (_, data) => callback(data)),
  onGatewayExit: (callback) => ipcRenderer.on('gateway-exit', (_, data) => callback(data)),
  onMainLog: (callback) => ipcRenderer.on('main-log', (_, data) => callback(data)),
  speakText: (text, voice) => ipcRenderer.invoke('tts-speak', text, voice),
  speakTextFiltered: (text, voice) => ipcRenderer.invoke('tts-speak-filtered', text, voice),
  filterText: (text) => ipcRenderer.invoke('tts-filter', text),
  getAppInfo: () => ipcRenderer.invoke('app-info'),
  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  platform: process.platform,
})
