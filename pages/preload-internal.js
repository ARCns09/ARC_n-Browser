// pages/preload-internal.js — Preload for internal arc:// pages (history, bookmarks).
// Exposes a limited API specifically for internal page operations.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arcnInternal', {
  // ── History ─────────────────────────────────────────────────
  getAllHistory:   ()          => ipcRenderer.invoke('history:getAll'),
  searchHistory:  (query)     => ipcRenderer.invoke('history:search', query),
  removeHistory:  (timestamp) => ipcRenderer.invoke('history:remove', timestamp),
  clearHistory:   ()          => ipcRenderer.invoke('history:clear'),

  // ── Bookmarks ───────────────────────────────────────────────
  getAllBookmarks: ()          => ipcRenderer.invoke('bookmark:getAll'),
  removeBookmark: (url)       => ipcRenderer.invoke('bookmark:remove', url),

  // ── Navigation (to open URLs in the browser) ───────────────
  navigate: (url) => ipcRenderer.invoke('nav:go:internal', url)
});
