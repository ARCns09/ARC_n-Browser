// main.js — ARC_n Browser Main Process
// Handles: App lifecycle, ad-blocker init, BrowserWindow, tab management via WebContentsView,
//          IPC, favicons, bookmarks, history, downloads, shortcuts, and internal pages.

const { app, BrowserWindow, ipcMain, session, WebContentsView, shell } = require('electron');
const path = require('path');
const fetch = require('cross-fetch');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

// ── Manager Modules ──────────────────────────────────────────────────────────
const BookmarkManager  = require('./managers/BookmarkManager');
const HistoryManager   = require('./managers/HistoryManager');
const DownloadManager  = require('./managers/DownloadManager');
const ShortcutManager  = require('./managers/ShortcutManager');

// ── Constants ────────────────────────────────────────────────────────────────
const UI_HEIGHT = 82;                  // px — tab bar (40) + toolbar (42)
const TAB_SESSION = 'persist:browse';  // separate partition for web content

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;

/**
 * Tab management array — each tab is an object:
 * { id: number, title: string, favicon: string|null, view: WebContentsView }
 * @type {Array<{ id: number, title: string, favicon: string|null, view: WebContentsView }>}
 */
const tabs = [];
let activeTabId = null;
let nextTabId = 1;

/** @type {BookmarkManager} */  let bookmarkManager;
/** @type {HistoryManager} */   let historyManager;
/** @type {DownloadManager} */  let downloadManager;
/** @type {ShortcutManager} */  let shortcutManager;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Find a tab object by its ID */
function findTab(tabId) {
  return tabs.find(t => t.id === tabId) || null;
}

/** Find the index of a tab by its ID */
function findTabIndex(tabId) {
  return tabs.findIndex(t => t.id === tabId);
}

/** Get the active tab object */
function getActiveTab() {
  return activeTabId !== null ? findTab(activeTabId) : null;
}

/** Safely send an IPC message to the chrome UI renderer */
function sendToRenderer(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

/** Check if a URL is an internal page */
function isInternalUrl(url) {
  return url && (url.startsWith('arc://') || url.startsWith('arcn://'));
}

// Aliases for internal pages (handle common misspellings/variants)
const PAGE_ALIASES = {
  'bookmark': 'bookmarks',
  'setting': 'settings',
  'download': 'downloads'
};

/** Resolve an internal URL to a file path */
function resolveInternalPage(url) {
  const parsed = url.replace(/^arcn?:\/\//, '');
  let pageName = parsed.split('/')[0].split('?')[0].toLowerCase();
  pageName = PAGE_ALIASES[pageName] || pageName;
  const filePath = path.join(__dirname, 'pages', `${pageName}.html`);
  return filePath;
}

// ── Dynamic Home Page ────────────────────────────────────────────────────────

/** Generate the new-tab "home" page HTML with dynamic shortcuts */
function getHomePageHTML() {
  const shortcuts = shortcutManager ? shortcutManager.getAll() : [];

  const shortcutCards = shortcuts.map((s, i) => `
    <div class="shortcut" data-url="${s.url}" data-index="${i}">
      <div class="shortcut-icon">${s.name.charAt(0).toUpperCase()}</div>
      <span class="shortcut-label">${s.name}</span>
      <button class="shortcut-delete" data-index="${i}" title="Remove">×</button>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          font-family: 'Inter', 'Segoe UI', sans-serif;
          color: #e0e0e0;
          overflow: hidden;
        }
        .logo {
          font-size: 3.2rem;
          font-weight: 800;
          letter-spacing: -1px;
          margin-bottom: 6px;
          background: linear-gradient(135deg, #e94560, #ff6b6b, #e94560);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.3); }
        }
        .tagline {
          font-size: 0.95rem;
          color: #8a8a9a;
          margin-bottom: 32px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .search-box {
          position: relative;
          width: min(520px, 85vw);
        }
        .search-box input {
          width: 100%;
          padding: 14px 20px 14px 48px;
          border: 1px solid rgba(233, 69, 96, 0.3);
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          color: #e0e0e0;
          font-size: 1rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .search-box input::placeholder { color: #5a5a6e; }
        .search-box input:focus {
          border-color: #e94560;
          box-shadow: 0 0 20px rgba(233, 69, 96, 0.15);
        }
        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 1.1rem;
          color: #5a5a6e;
          pointer-events: none;
        }
        .shortcuts {
          display: flex;
          gap: 20px;
          margin-top: 40px;
          flex-wrap: wrap;
          justify-content: center;
          max-width: 700px;
        }
        .shortcut {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          color: #8a8a9a;
          transition: color 0.2s, transform 0.2s;
          cursor: pointer;
          position: relative;
        }
        .shortcut:hover {
          color: #e94560;
          transform: translateY(-2px);
        }
        .shortcut-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          font-weight: 600;
          border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.2s, border-color 0.2s;
        }
        .shortcut:hover .shortcut-icon {
          background: rgba(233, 69, 96, 0.1);
          border-color: rgba(233, 69, 96, 0.3);
        }
        .shortcut-label { font-size: 0.75rem; }
        .shortcut-delete {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: none;
          background: rgba(233,69,96,0.8);
          color: #fff;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s;
        }
        .shortcut:hover .shortcut-delete { display: flex; }
        .shortcut-delete:hover { transform: scale(1.2); }
        .add-shortcut {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: #5a5a6e;
          transition: color 0.2s, transform 0.2s;
        }
        .add-shortcut:hover { color: #e94560; transform: translateY(-2px); }
        .add-shortcut .shortcut-icon {
          border-style: dashed;
          font-size: 1.5rem;
          font-weight: 300;
        }
        /* Modal */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.5);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        .modal-overlay.active { display: flex; }
        .modal {
          background: #1a1a2e;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 24px;
          width: 340px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }
        .modal h3 {
          margin-bottom: 16px;
          font-size: 1rem;
          color: #e0e0e0;
        }
        .modal input {
          width: 100%;
          padding: 10px 14px;
          margin-bottom: 10px;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          background: rgba(255,255,255,0.05);
          color: #e0e0e0;
          font-family: inherit;
          font-size: 0.9rem;
          outline: none;
        }
        .modal input:focus {
          border-color: rgba(233,69,96,0.4);
        }
        .modal-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 8px;
        }
        .modal-btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: #e0e0e0;
          font-family: inherit;
          cursor: pointer;
          font-size: 0.85rem;
          transition: background 0.2s;
        }
        .modal-btn:hover { background: rgba(255,255,255,0.1); }
        .modal-btn.primary {
          background: rgba(233,69,96,0.2);
          border-color: rgba(233,69,96,0.4);
          color: #e94560;
        }
        .modal-btn.primary:hover { background: rgba(233,69,96,0.3); }
      </style>
    </head>
    <body>
      <div class="logo">ARC_n</div>
      <div class="tagline">Privacy-first browsing</div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search Google or enter a URL…" id="homeSearch" autofocus />
      </div>
      <div class="shortcuts" id="shortcutsGrid">
        ${shortcutCards}
        <div class="add-shortcut" id="addShortcut">
          <div class="shortcut-icon">+</div>
          <span class="shortcut-label">Add</span>
        </div>
      </div>

      <!-- Add Shortcut Modal -->
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal">
          <h3>Add Shortcut</h3>
          <input type="text" id="shortcutName" placeholder="Name (e.g., Twitter)" />
          <input type="text" id="shortcutUrl" placeholder="URL (e.g., twitter.com)" />
          <div class="modal-actions">
            <button class="modal-btn" id="modalCancel">Cancel</button>
            <button class="modal-btn primary" id="modalSave">Add</button>
          </div>
        </div>
      </div>

      <script>
        const searchInput = document.getElementById('homeSearch');
        searchInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const val = searchInput.value.trim();
            if (!val) return;
            let url;
            if (/^https?:\\/\\//i.test(val) || /^[\\w.-]+\\.[a-z]{2,}/i.test(val)) {
              url = val.startsWith('http') ? val : 'https://' + val;
            } else {
              url = 'https://www.google.com/search?q=' + encodeURIComponent(val);
            }
            window.location.href = url;
          }
        });

        // Shortcut clicks
        document.querySelectorAll('.shortcut[data-url]').forEach(el => {
          el.addEventListener('click', (e) => {
            if (e.target.classList.contains('shortcut-delete')) return;
            window.location.href = el.dataset.url;
          });
        });

        // Delete shortcut buttons — post message to parent
        document.querySelectorAll('.shortcut-delete').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(btn.dataset.index);
            // Use postMessage to communicate with main process
            // The main process listens for this via webContents console message
            console.log('__ARCN_SHORTCUT_DELETE__:' + idx);
            btn.closest('.shortcut').remove();
          });
        });

        // Add shortcut modal
        const modal = document.getElementById('modalOverlay');
        const nameInput = document.getElementById('shortcutName');
        const urlInput = document.getElementById('shortcutUrl');

        document.getElementById('addShortcut').addEventListener('click', () => {
          modal.classList.add('active');
          nameInput.focus();
        });

        document.getElementById('modalCancel').addEventListener('click', () => {
          modal.classList.remove('active');
          nameInput.value = '';
          urlInput.value = '';
        });

        document.getElementById('modalSave').addEventListener('click', () => {
          const name = nameInput.value.trim();
          let url = urlInput.value.trim();
          if (!name || !url) return;
          if (!/^https?:\\/\\//i.test(url)) url = 'https://' + url;
          console.log('__ARCN_SHORTCUT_ADD__:' + JSON.stringify({ name, url }));
          modal.classList.remove('active');
          nameInput.value = '';
          urlInput.value = '';
          // Reload the page to show the new shortcut
          window.location.reload();
        });

        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('active');
          }
        });
      </script>
    </body>
    </html>
  `;
}

/** Get the home page data URL (regenerated each time for fresh shortcuts) */
function getHomeDataUrl() {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(getHomePageHTML());
}

/** Resize the active tab view to fill the window below the UI chrome */
function resizeActiveView() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const tab = getActiveTab();
  if (!tab) return;
  const { width, height } = mainWindow.getContentBounds();
  tab.view.setBounds({ x: 0, y: UI_HEIGHT, width, height: Math.max(0, height - UI_HEIGHT) });
}

/** Send navigation state (canGoBack, canGoForward, url, isBookmarked) to the renderer */
function sendNavigationState(tabId) {
  const tab = findTab(tabId);
  if (!tab || tab.view.webContents.isDestroyed()) return;
  if (tabId !== activeTabId) return;
  const url = tab.view.webContents.getURL();
  sendToRenderer('nav:state', {
    canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
    canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
    url,
    isBookmarked: bookmarkManager ? bookmarkManager.has(url) : false
  });
}

// ── Tab Management ───────────────────────────────────────────────────────────

/**
 * Create a new tab with its own WebContentsView.
 * @param {string} [url] — URL to load; omit for home page
 * @returns {number} — the new tab's ID
 */
function createTab(url) {
  const tabId = nextTabId++;

  const view = new WebContentsView({
    webPreferences: {
      partition: TAB_SESSION,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  // Match our dark theme so there's no white flash while content loads
  view.setBackgroundColor('#1a1a2e');

  // Increase max listeners — ad-blocker attaches several per webContents
  view.webContents.setMaxListeners(20);

  // Build the tab object (now includes favicon)
  const tabObj = { id: tabId, title: 'New Tab', favicon: null, view };
  tabs.push(tabObj);

  mainWindow.contentView.addChildView(view);

  // ── Wire up webContents events ──────────────────────────────────────────

  // Title updates
  view.webContents.on('page-title-updated', (_e, title) => {
    tabObj.title = title || 'Untitled';
    sendToRenderer('tab:title-updated', tabId, tabObj.title);
  });

  // Favicon updates
  view.webContents.on('page-favicon-updated', (_e, favicons) => {
    if (favicons && favicons.length > 0) {
      tabObj.favicon = favicons[0];
      sendToRenderer('tab:favicon-updated', tabId, tabObj.favicon);
    }
  });

  // Navigation state
  view.webContents.on('did-navigate', (_e, navUrl) => {
    sendNavigationState(tabId);
    // Record in history
    if (historyManager && navUrl && !navUrl.startsWith('data:')) {
      historyManager.add(tabObj.title || navUrl, navUrl);
    }
  });

  view.webContents.on('did-navigate-in-page', () => sendNavigationState(tabId));

  view.webContents.on('did-finish-load', () => {
    sendNavigationState(tabId);
    // Update history title (page may have set a proper title now)
    const currentUrl = view.webContents.getURL();
    if (historyManager && currentUrl && !currentUrl.startsWith('data:')) {
      historyManager.add(tabObj.title, currentUrl);
    }
  });

  // Handle target="_blank" links → open in a new tab
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    createTab(newUrl);
    return { action: 'deny' };
  });

  // Listen for shortcut management messages from home page
  // Uses new Event object API (avoids deprecated positional arguments)
  view.webContents.on('console-message', (event) => {
    const message = event.message;
    if (!message) return;
    if (message.startsWith('__ARCN_SHORTCUT_DELETE__:')) {
      const idx = parseInt(message.split(':')[1]);
      if (shortcutManager) {
        shortcutManager.remove(idx);
      }
    }
    if (message.startsWith('__ARCN_SHORTCUT_ADD__:')) {
      try {
        const data = JSON.parse(message.substring('__ARCN_SHORTCUT_ADD__:'.length));
        if (shortcutManager && data.name && data.url) {
          shortcutManager.add(data.name, data.url);
        }
      } catch { /* ignore parse errors */ }
    }
  });

  // ── Load content ────────────────────────────────────────────────────────

  if (!url || isInternalUrl(url)) {
    if (url && isInternalUrl(url)) {
      // Internal page — load with internal preload
      const filePath = resolveInternalPage(url);
      view.webContents.loadFile(filePath);
    } else {
      // Home page
      view.webContents.loadURL(getHomeDataUrl());
    }
  } else {
    view.webContents.loadURL(url);
  }

  // Switch to the new tab
  switchTab(tabId);

  // Notify the renderer UI
  sendToRenderer('tab:created', tabId, tabObj.title);

  return tabId;
}

/**
 * Switch the visible tab.
 * @param {number} tabId
 */
function switchTab(tabId) {
  const tab = findTab(tabId);
  if (!tab) return;

  const oldTab = getActiveTab();
  if (oldTab && oldTab.id !== tabId) {
    oldTab.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }

  activeTabId = tabId;
  resizeActiveView();
  sendNavigationState(tabId);
  sendToRenderer('tab:activated', tabId);
}

/**
 * Close a tab: destroy its WebContentsView, remove from array.
 * @param {number} tabId
 */
function closeTab(tabId) {
  const idx = findTabIndex(tabId);
  if (idx === -1) return;

  const tab = tabs[idx];

  mainWindow.contentView.removeChildView(tab.view);
  if (!tab.view.webContents.isDestroyed()) {
    tab.view.webContents.close();
  }

  tabs.splice(idx, 1);
  sendToRenderer('tab:closed', tabId);

  if (activeTabId === tabId) {
    activeTabId = null;
    if (tabs.length > 0) {
      const nextIdx = Math.min(idx, tabs.length - 1);
      switchTab(tabs[nextIdx].id);
    } else {
      createTab();
    }
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIPC() {
  // ── Tab management ──────────────────────────────────────────────────────
  ipcMain.handle('tab:create', (_e, url) => createTab(url));
  ipcMain.handle('tab:close',  (_e, id)  => closeTab(id));
  ipcMain.handle('tab:switch', (_e, id)  => switchTab(id));

  // ── Navigation ──────────────────────────────────────────────────────────
  ipcMain.handle('nav:go', (_e, url) => {
    const tab = getActiveTab();
    if (!tab) return;

    let target = url.trim();

    // Handle internal URLs
    if (isInternalUrl(target)) {
      const filePath = resolveInternalPage(target);
      tab.view.webContents.loadFile(filePath);
      return;
    }

    if (!/^https?:\/\//i.test(target)) {
      if (/^[\w.-]+\.[a-z]{2,}/i.test(target)) {
        target = 'https://' + target;
      } else {
        target = 'https://www.google.com/search?q=' + encodeURIComponent(target);
      }
    }
    tab.view.webContents.loadURL(target);
  });

  // Navigation from internal pages → load in active tab
  ipcMain.handle('nav:go:internal', (_e, url) => {
    const tab = getActiveTab();
    if (!tab) return;
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target;
    }
    tab.view.webContents.loadURL(target);
  });

  ipcMain.handle('nav:back', () => {
    const tab = getActiveTab();
    if (tab && tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack();
    }
  });

  ipcMain.handle('nav:forward', () => {
    const tab = getActiveTab();
    if (tab && tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward();
    }
  });

  ipcMain.handle('nav:reload', () => {
    const tab = getActiveTab();
    if (tab) tab.view.webContents.reload();
  });

  ipcMain.handle('nav:home', () => {
    const tab = getActiveTab();
    if (tab) tab.view.webContents.loadURL(getHomeDataUrl());
  });

  // ── Bookmarks ───────────────────────────────────────────────────────────
  ipcMain.handle('bookmark:toggle', (_e, title, url) => {
    return bookmarkManager.toggle(title, url);
  });

  ipcMain.handle('bookmark:check', (_e, url) => {
    return bookmarkManager.has(url);
  });

  ipcMain.handle('bookmark:getAll', () => {
    return bookmarkManager.getAll();
  });

  ipcMain.handle('bookmark:remove', (_e, url) => {
    return bookmarkManager.remove(url);
  });

  // ── History ─────────────────────────────────────────────────────────────
  ipcMain.handle('history:getAll', () => {
    return historyManager.getAll();
  });

  ipcMain.handle('history:search', (_e, query) => {
    return historyManager.search(query);
  });

  ipcMain.handle('history:remove', (_e, timestamp) => {
    return historyManager.remove(timestamp);
  });

  ipcMain.handle('history:clear', () => {
    historyManager.clear();
  });

  // ── Downloads ───────────────────────────────────────────────────────────
  ipcMain.handle('download:openFolder', (_e, id) => {
    downloadManager.openFolder(id);
  });

  // ── Shortcuts ───────────────────────────────────────────────────────────
  ipcMain.handle('shortcuts:getAll', () => {
    return shortcutManager.getAll();
  });

  ipcMain.handle('shortcuts:add', (_e, name, url) => {
    shortcutManager.add(name, url);
  });

  ipcMain.handle('shortcuts:remove', (_e, index) => {
    shortcutManager.remove(index);
  });
}

// ── App Lifecycle ────────────────────────────────────────────────────────────

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#e0e0e0',
      height: 40
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false  // preload needs require()
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('resize', resizeActiveView);
  mainWindow.on('maximize',   () => setTimeout(resizeActiveView, 50));
  mainWindow.on('unmaximize', () => setTimeout(resizeActiveView, 50));

  mainWindow.webContents.on('did-finish-load', () => {
    createTab(); // opens the home page
  });
}

// ── Suppress ad-blocker script injection errors ─────────────────────────────
// The ad-blocker's cosmetic filters inject scripts via executeJavaScript() which
// can fail on data: or about: URLs. These are harmless and expected.
process.on('unhandledRejection', (reason) => {
  if (reason && reason.message && reason.message.includes('Script failed to execute')) {
    // Silently ignore — this is the ad-blocker trying to inject cosmetic filters
    return;
  }
  console.error('Unhandled rejection:', reason);
});

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');

  // ── Initialize Managers ────────────────────────────────────────────────
  bookmarkManager  = new BookmarkManager(userDataPath);
  historyManager   = new HistoryManager(userDataPath);
  downloadManager  = new DownloadManager(sendToRenderer);
  shortcutManager  = new ShortcutManager(userDataPath);

  console.log('✔ Managers initialized (bookmarks, history, downloads, shortcuts)');

  // ── Initialize Ad-Blocker on the BROWSING session only ─────────────────
  try {
    const browseSession = session.fromPartition(TAB_SESSION);
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInSession(browseSession);
    console.log('✔ Ad-blocker initialized on browsing session');

    // ── Attach Download Manager to browsing session ─────────────────────
    downloadManager.attach(browseSession);
    console.log('✔ Download manager attached to browsing session');
  } catch (err) {
    console.error('⚠ Failed to initialize ad-blocker:', err.message);
  }

  registerIPC();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
