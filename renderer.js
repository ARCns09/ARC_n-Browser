// renderer.js — ARC_n Browser UI Logic
// Handles DOM manipulation for the tab bar, toolbar buttons, and omnibox.
// Communicates with the main process exclusively through the `window.arcn` API (preload bridge).

(() => {
  'use strict';

  // ── DOM References ──────────────────────────────────────────────────────
  const tabsContainer = document.getElementById('tabs-container');
  const btnNewTab     = document.getElementById('btn-new-tab');
  const btnBack       = document.getElementById('btn-back');
  const btnForward    = document.getElementById('btn-forward');
  const btnReload     = document.getElementById('btn-reload');
  const btnHome       = document.getElementById('btn-home');
  const omnibox       = document.getElementById('omnibox');

  // ── Tab UI State ────────────────────────────────────────────────────────
  // Mirror of the main process tabs array, kept lightweight (id + title only)
  let activeTabId = null;
  const tabOrder = []; // ordered array of tab IDs, mirrors main process order

  // ── Tab UI Helpers ──────────────────────────────────────────────────────

  /**
   * Create a tab element in the tab bar.
   * @param {number} id   — unique tab ID from main process
   * @param {string} title — initial tab title
   */
  function createTabUI(id, title) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.tabId = id;

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = title || 'New Tab';

    const tabClose = document.createElement('button');
    tabClose.className = 'tab-close';
    tabClose.title = 'Close tab';
    tabClose.innerHTML = '×';

    tab.appendChild(tabTitle);
    tab.appendChild(tabClose);

    // Click on the tab body → switch to this tab
    tab.addEventListener('click', (e) => {
      if (e.target === tabClose || tabClose.contains(e.target)) return;
      window.arcn.switchTab(id);
    });

    // Click the close button → close this tab
    tabClose.addEventListener('click', (e) => {
      e.stopPropagation();
      window.arcn.closeTab(id);
    });

    tabsContainer.appendChild(tab);
    tabOrder.push(id);

    // Scroll the new tab into view
    tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
  }

  /**
   * Set a tab as visually active and update the omnibox.
   * @param {number} id
   */
  function activateTabUI(id) {
    activeTabId = id;

    // Toggle .active class on all tabs
    tabsContainer.querySelectorAll('.tab').forEach((tab) => {
      tab.classList.toggle('active', Number(tab.dataset.tabId) === id);
    });
  }

  /**
   * Remove a tab element from the bar with an exit animation.
   * @param {number} id
   */
  function removeTabUI(id) {
    const tab = tabsContainer.querySelector(`.tab[data-tab-id="${id}"]`);
    if (tab) {
      // Exit animation
      tab.style.transition = 'opacity 0.15s, transform 0.15s';
      tab.style.opacity = '0';
      tab.style.transform = 'translateY(-4px) scale(0.9)';
      setTimeout(() => tab.remove(), 150);
    }

    // Remove from the order array
    const idx = tabOrder.indexOf(id);
    if (idx !== -1) tabOrder.splice(idx, 1);
  }

  /**
   * Update the title text of a tab.
   * @param {number} id
   * @param {string} title
   */
  function updateTabTitle(id, title) {
    const tab = tabsContainer.querySelector(`.tab[data-tab-id="${id}"]`);
    if (tab) {
      const titleEl = tab.querySelector('.tab-title');
      titleEl.textContent = title || 'Untitled';
      titleEl.title = title || '';
    }
  }

  // ── Omnibox Logic ───────────────────────────────────────────────────────

  omnibox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = omnibox.value.trim();
      if (!value) return;
      window.arcn.navigate(value);
      omnibox.blur();
    }
  });

  // Select all text on focus for easy overwriting
  omnibox.addEventListener('focus', () => {
    setTimeout(() => omnibox.select(), 0);
  });

  // ── Toolbar Buttons ─────────────────────────────────────────────────────

  btnBack.addEventListener('click',    () => window.arcn.goBack());
  btnForward.addEventListener('click', () => window.arcn.goForward());
  btnReload.addEventListener('click',  () => window.arcn.reload());
  btnHome.addEventListener('click',    () => window.arcn.goHome());
  btnNewTab.addEventListener('click',  () => window.arcn.createTab());

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────

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
    if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      window.arcn.goBack();
    }
    if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      window.arcn.goForward();
    }
  });

  // ── Events from Main Process ────────────────────────────────────────────

  window.arcn.onTabCreated((id, title) => {
    createTabUI(id, title);
  });

  window.arcn.onTabActivated((id) => {
    activateTabUI(id);
  });

  window.arcn.onTitleUpdated((id, title) => {
    updateTabTitle(id, title);
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

    // Update the omnibox with the current URL (hide data: URLs for home page)
    if (state.url && !state.url.startsWith('data:')) {
      omnibox.value = state.url;
    } else {
      omnibox.value = '';
      omnibox.placeholder = 'Search Google or enter a URL…';
    }
  });

})();
