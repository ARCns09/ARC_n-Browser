// preload.js — Secure IPC bridge between the browser chrome UI and the main process.
// Exposes a safe `window.arcn` API via contextBridge (no direct Node access in renderer).

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcn', {
  // ── Navigation ────────────────────────────────────────────
  navigate:  (url)  => ipcRenderer.invoke('nav:go', url),
  goBack:    ()     => ipcRenderer.invoke('nav:back'),
  goForward: ()     => ipcRenderer.invoke('nav:forward'),
  reload:    ()     => ipcRenderer.invoke('nav:reload'),
  goHome:    ()     => ipcRenderer.invoke('nav:home'),

  // ── Tab Management ────────────────────────────────────────
  createTab: (url)  => ipcRenderer.invoke('tab:create', url),
  closeTab:  (id)   => ipcRenderer.invoke('tab:close', id),
  switchTab: (id)   => ipcRenderer.invoke('tab:switch', id),

  // ── Events from Main Process ──────────────────────────────
  // Each returns a cleanup function for good hygiene, though in
  // practice these listeners live for the entire app lifetime.
  onTitleUpdated: (callback) => {
    const handler = (_event, id, title) => callback(id, title);
    ipcRenderer.on('tab:title-updated', handler);
    return () => ipcRenderer.removeListener('tab:title-updated', handler);
  },
  onUrlUpdated: (callback) => {
    const handler = (_event, id, url) => callback(id, url);
    ipcRenderer.on('tab:url-updated', handler);
    return () => ipcRenderer.removeListener('tab:url-updated', handler);
  },
  onTabClosed: (callback) => {
    const handler = (_event, id) => callback(id);
    ipcRenderer.on('tab:closed', handler);
    return () => ipcRenderer.removeListener('tab:closed', handler);
  },
  onTabCreated: (callback) => {
    const handler = (_event, id, title) => callback(id, title);
    ipcRenderer.on('tab:created', handler);
    return () => ipcRenderer.removeListener('tab:created', handler);
  },
  onTabActivated: (callback) => {
    const handler = (_event, id) => callback(id);
    ipcRenderer.on('tab:activated', handler);
    return () => ipcRenderer.removeListener('tab:activated', handler);
  },
  onNavigationState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('nav:state', handler);
    return () => ipcRenderer.removeListener('nav:state', handler);
  }
});
