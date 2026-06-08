// renderer.js — ARC_n Browser UI Logic
// Handles DOM manipulation for tabs (with favicons), toolbar, omnibox,
// bookmark star, download panel, and keyboard shortcuts.
// Communicates with the main process exclusively through the `window.arcn` API.

(() => {
  'use strict';

  // ── DOM References ──────────────────────────────────────────────────────
  const tabsContainer    = document.getElementById('tabs-container');
  const btnNewTab        = document.getElementById('btn-new-tab');
  const btnBack          = document.getElementById('btn-back');
  const btnForward       = document.getElementById('btn-forward');
  const btnReload        = document.getElementById('btn-reload');
  const btnHome          = document.getElementById('btn-home');
  const omnibox          = document.getElementById('omnibox');
  const btnBookmark      = document.getElementById('btn-bookmark');
  const btnDownloads     = document.getElementById('btn-downloads');
  const downloadPanel    = document.getElementById('download-panel');
  const downloadList     = document.getElementById('download-list');
  const downloadEmpty    = document.getElementById('download-empty');
  const downloadBadge    = document.getElementById('download-badge');
  const downloadPanelClose = document.getElementById('download-panel-close');

  // ── State ───────────────────────────────────────────────────────────────
  let activeTabId = null;
  const tabOrder = [];
  let currentUrl = '';
  let currentTitle = '';
  let activeDownloads = 0;

  // ═════════════════════════════════════════════════════════════════════════
  //  TAB UI (with Favicons)
  // ═════════════════════════════════════════════════════════════════════════

  /** Fallback globe SVG for tabs without favicons */
  const FAVICON_FALLBACK_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1"/>
    <path d="M7 1.5C5.5 3 4.5 5 4.5 7s1 4 2.5 5.5M7 1.5C8.5 3 9.5 5 9.5 7s-1 4-2.5 5.5" stroke="currentColor" stroke-width="0.8"/>
    <path d="M2 5h10M2 9h10" stroke="currentColor" stroke-width="0.8"/>
  </svg>`;

  function createTabUI(id, title) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tabId = id;

    // Favicon (fallback by default)
    const faviconWrap = document.createElement('span');
    faviconWrap.className = 'tab-favicon-fallback';
    faviconWrap.innerHTML = FAVICON_FALLBACK_SVG;
    faviconWrap.dataset.faviconSlot = 'true';

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = title || 'New Tab';

    const tabClose = document.createElement('button');
    tabClose.className = 'tab-close';
    tabClose.title = 'Close tab';
    tabClose.innerHTML = '×';

    tab.appendChild(faviconWrap);
    tab.appendChild(tabTitle);
    tab.appendChild(tabClose);

    tab.addEventListener('click', (e) => {
      if (e.target === tabClose || tabClose.contains(e.target)) return;
      window.arcn.switchTab(id);
    });

    tabClose.addEventListener('click', (e) => {
      e.stopPropagation();
      window.arcn.closeTab(id);
    });

    tabsContainer.appendChild(tab);
    tabOrder.push(id);
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
  }

  function activateTabUI(id) {
    activeTabId = id;
    tabsContainer.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.toggle('active', Number(tab.dataset.tabId) === id);
    });
  }

  function removeTabUI(id) {
    const tab = tabsContainer.querySelector(`.tab[data-tab-id="${id}"]`);
    if (tab) {
      tab.style.transition = 'opacity 0.15s, transform 0.15s';
      tab.style.opacity = '0';
      tab.style.transform = 'translateY(-4px) scale(0.9)';
      setTimeout(() => tab.remove(), 150);
    }
    const idx = tabOrder.indexOf(id);
    if (idx !== -1) tabOrder.splice(idx, 1);
  }

  function updateTabTitle(id, title) {
    const tab = tabsContainer.querySelector(`.tab[data-tab-id="${id}"]`);
    if (tab) {
      const titleEl = tab.querySelector('.tab-title');
      titleEl.textContent = title || 'Untitled';
      titleEl.title = title || '';
    }
  }

  function updateTabFavicon(id, faviconUrl) {
    const tab = tabsContainer.querySelector(`.tab[data-tab-id="${id}"]`);
    if (!tab) return;

    const slot = tab.querySelector('[data-favicon-slot]');
    if (!slot) return;

    if (faviconUrl) {
      // Replace with actual favicon image
      const img = document.createElement('img');
      img.className = 'tab-favicon';
      img.src = faviconUrl;
      img.dataset.faviconSlot = 'true';
      img.onerror = () => {
        // Revert to fallback on load error
        const fallback = document.createElement('span');
        fallback.className = 'tab-favicon-fallback';
        fallback.innerHTML = FAVICON_FALLBACK_SVG;
        fallback.dataset.faviconSlot = 'true';
        img.replaceWith(fallback);
      };
      slot.replaceWith(img);
    } else {
      // Reset to fallback globe (e.g., when navigating to home page)
      const fallback = document.createElement('span');
      fallback.className = 'tab-favicon-fallback';
      fallback.innerHTML = FAVICON_FALLBACK_SVG;
      fallback.dataset.faviconSlot = 'true';
      slot.replaceWith(fallback);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  BOOKMARK STAR
  // ═════════════════════════════════════════════════════════════════════════

  btnBookmark.addEventListener('click', async () => {
    if (!currentUrl || currentUrl.startsWith('data:')) return;
    const isNowBookmarked = await window.arcn.toggleBookmark(currentTitle, currentUrl);
    updateBookmarkStar(isNowBookmarked);

    // Pulse animation
    if (isNowBookmarked) {
      btnBookmark.classList.add('just-bookmarked');
      setTimeout(() => btnBookmark.classList.remove('just-bookmarked'), 400);
    }
  });

  function updateBookmarkStar(isBookmarked) {
    btnBookmark.classList.toggle('bookmarked', isBookmarked);
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  DOWNLOAD PANEL
  // ═════════════════════════════════════════════════════════════════════════

  function toggleDownloadPanel() {
    downloadPanel.classList.toggle('hidden');
  }

  btnDownloads.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent click-outside handler from immediately closing
    toggleDownloadPanel();
  });
  downloadPanelClose.addEventListener('click', () => {
    downloadPanel.classList.add('hidden');
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!downloadPanel.classList.contains('hidden') &&
        !downloadPanel.contains(e.target) &&
        e.target !== btnDownloads &&
        !btnDownloads.contains(e.target)) {
      downloadPanel.classList.add('hidden');
    }
  });

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  function formatSpeed(bytesPerSec) {
    if (bytesPerSec <= 0) return '';
    return formatBytes(bytesPerSec) + '/s';
  }

  function createDownloadItem(data) {
    downloadEmpty.style.display = 'none';

    const item = document.createElement('div');
    item.className = 'download-item';
    item.dataset.downloadId = data.id;

    item.innerHTML = `
      <div class="download-filename" title="${data.filename}">${data.filename}</div>
      <div class="download-meta">
        <span class="download-size">0 B / ${formatBytes(data.totalBytes)}</span>
        <span class="download-speed"></span>
      </div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: 0%"></div>
      </div>
      <div class="download-actions" style="display:none;"></div>
    `;

    downloadList.prepend(item);

    // Show panel automatically
    downloadPanel.classList.remove('hidden');

    // Update badge
    activeDownloads++;
    updateDownloadBadge();
  }

  function updateDownloadProgress(data) {
    const item = downloadList.querySelector(`.download-item[data-download-id="${data.id}"]`);
    if (!item) return;

    const percent = data.totalBytes > 0
      ? Math.round((data.receivedBytes / data.totalBytes) * 100)
      : 0;

    const fill = item.querySelector('.download-progress-fill');
    fill.style.width = percent + '%';

    const sizeEl = item.querySelector('.download-size');
    sizeEl.textContent = `${formatBytes(data.receivedBytes)} / ${formatBytes(data.totalBytes)} (${percent}%)`;

    const speedEl = item.querySelector('.download-speed');
    speedEl.textContent = formatSpeed(data.speed);
  }

  function completeDownload(data) {
    const item = downloadList.querySelector(`.download-item[data-download-id="${data.id}"]`);
    if (!item) return;

    const fill = item.querySelector('.download-progress-fill');
    fill.style.width = '100%';
    fill.classList.add('completed');

    const sizeEl = item.querySelector('.download-size');
    sizeEl.textContent = formatBytes(data.totalBytes);

    const speedEl = item.querySelector('.download-speed');
    speedEl.innerHTML = '<span class="download-state completed">✓ Complete</span>';

    const actions = item.querySelector('.download-actions');
    actions.style.display = 'flex';
    actions.innerHTML = `<button class="download-action-btn primary" data-action="open-folder">Open Folder</button>`;

    actions.querySelector('[data-action="open-folder"]').addEventListener('click', () => {
      window.arcn.openDownloadFolder(data.id);
    });

    activeDownloads = Math.max(0, activeDownloads - 1);
    updateDownloadBadge();
  }

  function failDownload(data) {
    const item = downloadList.querySelector(`.download-item[data-download-id="${data.id}"]`);
    if (!item) return;

    const fill = item.querySelector('.download-progress-fill');
    fill.classList.add('failed');

    const speedEl = item.querySelector('.download-speed');
    speedEl.innerHTML = `<span class="download-state failed">✕ ${data.state || 'Failed'}</span>`;

    activeDownloads = Math.max(0, activeDownloads - 1);
    updateDownloadBadge();
  }

  function updateDownloadBadge() {
    if (activeDownloads > 0) {
      downloadBadge.textContent = activeDownloads;
      downloadBadge.style.display = 'flex';
    } else {
      downloadBadge.style.display = 'none';
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  //  OMNIBOX
  // ═════════════════════════════════════════════════════════════════════════

  omnibox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = omnibox.value.trim();
      if (!value) return;
      window.arcn.navigate(value);
      omnibox.blur();
    }
  });

  omnibox.addEventListener('focus', () => {
    setTimeout(() => omnibox.select(), 0);
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  TOOLBAR BUTTONS
  // ═════════════════════════════════════════════════════════════════════════

  btnBack.addEventListener('click',    () => window.arcn.goBack());
  btnForward.addEventListener('click', () => window.arcn.goForward());
  btnReload.addEventListener('click',  () => window.arcn.reload());
  btnHome.addEventListener('click',    () => window.arcn.goHome());
  btnNewTab.addEventListener('click',  () => window.arcn.createTab());

  // ═════════════════════════════════════════════════════════════════════════
  //  KEYBOARD SHORTCUTS
  // ═════════════════════════════════════════════════════════════════════════

  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 't') {
      e.preventDefault();
      window.arcn.createTab();
    }
    if (ctrl && e.key === 'w') {
      e.preventDefault();
      if (activeTabId !== null) window.arcn.closeTab(activeTabId);
    }
    if (ctrl && e.key === 'l') {
      e.preventDefault();
      omnibox.focus();
    }
    if (ctrl && e.key === 'r') {
      e.preventDefault();
      window.arcn.reload();
    }
    if (ctrl && e.key === 'd') {
      e.preventDefault();
      btnBookmark.click();
    }
    if (ctrl && e.key === 'j') {
      e.preventDefault();
      toggleDownloadPanel();
    }
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      window.arcn.goBack();
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      window.arcn.goForward();
    }
  });

  // ═════════════════════════════════════════════════════════════════════════
  //  EVENTS FROM MAIN PROCESS
  // ═════════════════════════════════════════════════════════════════════════

  window.arcn.onTabCreated((id, title) => {
    createTabUI(id, title);
  });

  window.arcn.onTabActivated((id) => {
    activateTabUI(id);
  });

  window.arcn.onTitleUpdated((id, title) => {
    updateTabTitle(id, title);
    if (id === activeTabId) currentTitle = title;
  });

  window.arcn.onFaviconUpdated((id, favicon) => {
    updateTabFavicon(id, favicon);
  });

  window.arcn.onUrlUpdated((id, url) => {
    if (id === activeTabId) {
      omnibox.value = (url && !url.startsWith('data:')) ? url : '';
    }
  });

  window.arcn.onTabClosed((id) => {
    removeTabUI(id);
  });

  window.arcn.onNavigationState((state) => {
    btnBack.disabled    = !state.canGoBack;
    btnForward.disabled = !state.canGoForward;

    if (state.url && !state.url.startsWith('data:')) {
      omnibox.value = state.url;
      currentUrl = state.url;
    } else {
      omnibox.value = '';
      omnibox.placeholder = 'Search Google or enter a URL…';
      currentUrl = '';
    }

    // Update bookmark star
    updateBookmarkStar(state.isBookmarked || false);
  });

  // ── Download Events ──────────────────────────────────────────────────────

  window.arcn.onDownloadStarted((data) => {
    createDownloadItem(data);
  });

  window.arcn.onDownloadProgress((data) => {
    updateDownloadProgress(data);
  });

  window.arcn.onDownloadCompleted((data) => {
    completeDownload(data);
  });

  window.arcn.onDownloadFailed((data) => {
    failDownload(data);
  });

  // ── Shortcut events from main process (fired via before-input-event) ────
  // These fire when the user presses shortcuts while a tab has focus.

  window.arcn.onShortcutToggleBookmark(() => {
    btnBookmark.click();
  });

  window.arcn.onShortcutToggleDownloads(() => {
    toggleDownloadPanel();
  });

  window.arcn.onShortcutFocusOmnibox(() => {
    omnibox.focus();
  });

})();
