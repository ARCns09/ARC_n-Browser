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

  // ── Bookmarks ─────────────────────────────────────────────
  toggleBookmark: (title, url) => ipcRenderer.invoke('bookmark:toggle', title, url),
  checkBookmark:  (url)        => ipcRenderer.invoke('bookmark:check', url),
  getAllBookmarks: ()           => ipcRenderer.invoke('bookmark:getAll'),

  // ── History ───────────────────────────────────────────────
  getAllHistory:  ()          => ipcRenderer.invoke('history:getAll'),
  searchHistory: (query)     => ipcRenderer.invoke('history:search', query),
  removeHistory: (timestamp) => ipcRenderer.invoke('history:remove', timestamp),
  clearHistory:  ()          => ipcRenderer.invoke('history:clear'),

  // ── Downloads ─────────────────────────────────────────────
  openDownloadFolder: (id) => ipcRenderer.invoke('download:openFolder', id),

  // ── Shortcuts ─────────────────────────────────────────────
  getShortcuts:    ()           => ipcRenderer.invoke('shortcuts:getAll'),
  addShortcut:     (name, url)  => ipcRenderer.invoke('shortcuts:add', name, url),
  removeShortcut:  (index)      => ipcRenderer.invoke('shortcuts:remove', index),

  // ── Events from Main Process ──────────────────────────────
  onTitleUpdated: (callback) => {
    const handler = (_event, id, title) => callback(id, title);
    ipcRenderer.on('tab:title-updated', handler);
    return () => ipcRenderer.removeListener('tab:title-updated', handler);
  },
  onFaviconUpdated: (callback) => {
    const handler = (_event, id, favicon) => callback(id, favicon);
    ipcRenderer.on('tab:favicon-updated', handler);
    return () => ipcRenderer.removeListener('tab:favicon-updated', handler);
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
  },

  // ── Download Events ───────────────────────────────────────
  onDownloadStarted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:started', handler);
    return () => ipcRenderer.removeListener('download:started', handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onDownloadCompleted: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:completed', handler);
    return () => ipcRenderer.removeListener('download:completed', handler);
  },
  onDownloadFailed: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:failed', handler);
    return () => ipcRenderer.removeListener('download:failed', handler);
  },

  // ── Shortcut Events (from main process before-input-event) ──
  onShortcutToggleBookmark: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:toggle-bookmark', handler);
    return () => ipcRenderer.removeListener('shortcut:toggle-bookmark', handler);
  },
  onShortcutToggleDownloads: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:toggle-downloads', handler);
    return () => ipcRenderer.removeListener('shortcut:toggle-downloads', handler);
  },
  onShortcutFocusOmnibox: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:focus-omnibox', handler);
    return () => ipcRenderer.removeListener('shortcut:focus-omnibox', handler);
  }
});
