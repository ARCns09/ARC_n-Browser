// managers/HistoryManager.js — Persistent browsing history tracker.
// Stores history in {userData}/history.json with dedup on sequential same-URL navigations.

const fs = require('fs');
const path = require('path');

class HistoryManager {
  /**
   * @param {string} userDataPath — Electron's app.getPath('userData')
   */
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'history.json');
    this.history = [];
    this._load();
  }

  /** Load history from disk */
  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.history = JSON.parse(data);
      }
    } catch (err) {
      console.error('⚠ HistoryManager: failed to load history:', err.message);
      this.history = [];
    }
  }

  /** Write current history to disk */
  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.history, null, 2), 'utf-8');
    } catch (err) {
      console.error('⚠ HistoryManager: failed to save history:', err.message);
    }
  }

  /**
   * Add a history entry. Skips if the last entry has the same URL
   * (prevents refresh spam). Also skips blank/data URLs.
   * @param {string} title
   * @param {string} url
   */
  add(title, url) {
    // Skip internal/data URLs
    if (!url || url.startsWith('data:') || url.startsWith('about:') || url.startsWith('arc://')) {
      return;
    }

    // Deduplicate: skip if the most recent entry has the same URL
    if (this.history.length > 0 && this.history[0].url === url) {
      // Update the title if it changed (e.g., page finished loading with a real title)
      if (title && title !== this.history[0].title) {
        this.history[0].title = title;
        this.save();
      }
      return;
    }

    this.history.unshift({
      title: title || url,
      url,
      timestamp: Date.now()
    });

    // Cap at 10,000 entries to prevent unbounded growth
    if (this.history.length > 10000) {
      this.history = this.history.slice(0, 10000);
    }

    this.save();
  }

  /**
   * Get all history entries (newest first).
   * @returns {Array<{ title: string, url: string, timestamp: number }>}
   */
  getAll() {
    return this.history;
  }

  /**
   * Search history by title or URL (case-insensitive).
   * @param {string} query
   * @returns {Array<{ title: string, url: string, timestamp: number }>}
   */
  search(query) {
    if (!query) return this.getAll();
    const q = query.toLowerCase();
    return this.history.filter(
      h => h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q)
    );
  }

  /**
   * Remove a single history entry by its timestamp.
   * @param {number} timestamp
   * @returns {boolean}
   */
  remove(timestamp) {
    const before = this.history.length;
    this.history = this.history.filter(h => h.timestamp !== timestamp);
    if (this.history.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Clear all history.
   */
  clear() {
    this.history = [];
    this.save();
  }
}

module.exports = HistoryManager;
