// main.js — ARC_n Browser Main Process
// Handles: App lifecycle, ad-blocker init, BrowserWindow, tab management via WebContentsView, IPC.

const { app, BrowserWindow, ipcMain, session, WebContentsView } = require('electron');
const path = require('path');
const fetch = require('cross-fetch');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');

// ── Constants ────────────────────────────────────────────────────────────────
const UI_HEIGHT = 82;                  // px — tab bar (40) + toolbar (42)
const TAB_SESSION = 'persist:browse';  // separate partition for web content

// ── State ────────────────────────────────────────────────────────────────────
let mainWindow = null;

/**
 * Tab management array — each tab is an object:
 * { id: number, title: string, view: WebContentsView }
 * @type {Array<{ id: number, title: string, view: WebContentsView }>}
 */
const tabs = [];
let activeTabId = null;
let nextTabId = 1;

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

/** Generate the new-tab "home" page HTML inline */
function getHomePageHTML() {
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
          gap: 24px;
          margin-top: 40px;
          flex-wrap: wrap;
          justify-content: center;
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
          border: 1px solid rgba(255,255,255,0.08);
          transition: background 0.2s, border-color 0.2s;
        }
        .shortcut:hover .shortcut-icon {
          background: rgba(233, 69, 96, 0.1);
          border-color: rgba(233, 69, 96, 0.3);
        }
        .shortcut-label { font-size: 0.75rem; }
      </style>
    </head>
    <body>
      <div class="logo">ARC_n</div>
      <div class="tagline">Privacy-first browsing</div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Search Google or enter a URL…" id="homeSearch" autofocus />
      </div>
      <div class="shortcuts">
        <a class="shortcut" data-url="https://www.google.com">
          <div class="shortcut-icon">G</div>
          <span class="shortcut-label">Google</span>
        </a>
        <a class="shortcut" data-url="https://www.youtube.com">
          <div class="shortcut-icon">▶</div>
          <span class="shortcut-label">YouTube</span>
        </a>
        <a class="shortcut" data-url="https://www.github.com">
          <div class="shortcut-icon">⌨</div>
          <span class="shortcut-label">GitHub</span>
        </a>
        <a class="shortcut" data-url="https://www.reddit.com">
          <div class="shortcut-icon">R</div>
          <span class="shortcut-label">Reddit</span>
        </a>
        <a class="shortcut" data-url="https://www.wikipedia.org">
          <div class="shortcut-icon">W</div>
          <span class="shortcut-label">Wikipedia</span>
        </a>
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
        document.querySelectorAll('.shortcut').forEach(el => {
          el.addEventListener('click', () => {
            window.location.href = el.dataset.url;
          });
        });
      </script>
    </body>
    </html>
  `;
}

// ── Home page data URL (cached once) ─────────────────────────────────────────
const HOME_DATA_URL = 'data:text/html;charset=utf-8,' + encodeURIComponent(getHomePageHTML());

/** Resize the active tab view to fill the window below the UI chrome */
function resizeActiveView() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const tab = getActiveTab();
  if (!tab) return;
  const { width, height } = mainWindow.getContentBounds();
  tab.view.setBounds({ x: 0, y: UI_HEIGHT, width, height: Math.max(0, height - UI_HEIGHT) });
}

/** Send navigation state (canGoBack, canGoForward, url) to the renderer */
function sendNavigationState(tabId) {
  const tab = findTab(tabId);
  if (!tab || tab.view.webContents.isDestroyed()) return;
  if (tabId !== activeTabId) return;
  sendToRenderer('nav:state', {
    canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
    canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
    url: tab.view.webContents.getURL()
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

  // Use the browsing session (separate from chrome UI) so ad-blocker
  // only operates on web content, not on our UI.
  const browseSession = session.fromPartition(TAB_SESSION);

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

  // Build the tab object
  const tabObj = { id: tabId, title: 'New Tab', view };
  tabs.push(tabObj);

  mainWindow.contentView.addChildView(view);

  // ── Wire up webContents events ──────────────────────────────────────────

  view.webContents.on('page-title-updated', (_e, title) => {
    tabObj.title = title || 'Untitled';
    sendToRenderer('tab:title-updated', tabId, tabObj.title);
  });

  view.webContents.on('did-navigate', () => sendNavigationState(tabId));
  view.webContents.on('did-navigate-in-page', () => sendNavigationState(tabId));
  view.webContents.on('did-finish-load', () => sendNavigationState(tabId));

  // Handle target="_blank" links → open in a new tab
  view.webContents.setWindowOpenHandler(({ url: newUrl }) => {
    createTab(newUrl);
    return { action: 'deny' };
  });

  // ── Load content ────────────────────────────────────────────────────────

  if (!url) {
    view.webContents.loadURL(HOME_DATA_URL);
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
 * Hides the old active view (zero-sized bounds) and shows the new one.
 * @param {number} tabId
 */
function switchTab(tabId) {
  const tab = findTab(tabId);
  if (!tab) return;

  // Hide the currently active view
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
 * Close a tab: destroy its WebContentsView, remove from array, and
 * auto-switch to a neighbor if this was the active tab.
 * @param {number} tabId
 */
function closeTab(tabId) {
  const idx = findTabIndex(tabId);
  if (idx === -1) return;

  const tab = tabs[idx];

  // Remove the view from the window and destroy it to free memory
  mainWindow.contentView.removeChildView(tab.view);
  if (!tab.view.webContents.isDestroyed()) {
    tab.view.webContents.close();
  }

  // Remove from the tabs array
  tabs.splice(idx, 1);

  // Notify the renderer
  sendToRenderer('tab:closed', tabId);

  // If the closed tab was active, switch to a neighbor
  if (activeTabId === tabId) {
    activeTabId = null;

    if (tabs.length > 0) {
      // Prefer the tab to the right (same index), else the one to the left
      const nextIdx = Math.min(idx, tabs.length - 1);
      switchTab(tabs[nextIdx].id);
    } else {
      // All tabs closed — open a fresh home tab
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
    if (!/^https?:\/\//i.test(target)) {
      if (/^[\w.-]+\.[a-z]{2,}/i.test(target)) {
        target = 'https://' + target;
      } else {
        target = 'https://www.google.com/search?q=' + encodeURIComponent(target);
      }
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
    if (tab) tab.view.webContents.loadURL(HOME_DATA_URL);
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

  // Load the browser chrome UI
  mainWindow.loadFile('index.html');

  // Resize the active view when the window is resized
  mainWindow.on('resize', resizeActiveView);
  mainWindow.on('maximize',   () => setTimeout(resizeActiveView, 50));
  mainWindow.on('unmaximize', () => setTimeout(resizeActiveView, 50));

  // Once the chrome UI is ready, create the first tab
  mainWindow.webContents.on('did-finish-load', () => {
    createTab(); // opens the home page
  });
}

app.whenReady().then(async () => {
  // ── Initialize Ad-Blocker on the BROWSING session only ─────────────────
  // Using a dedicated session partition ('persist:browse') keeps the
  // ad-blocker away from the chrome UI, preventing script injection errors.
  try {
    const browseSession = session.fromPartition(TAB_SESSION);
    const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
    blocker.enableBlockingInSession(browseSession);
    console.log('✔ Ad-blocker initialized on browsing session — EasyList + EasyPrivacy loaded');
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
