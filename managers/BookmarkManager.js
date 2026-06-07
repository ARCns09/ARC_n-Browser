// managers/BookmarkManager.js — Persistent JSON-backed bookmark store.
// Stores bookmarks in {userData}/bookmarks.json with deduplication by URL.

const fs = require('fs');
const path = require('path');

class BookmarkManager {
  /**
   * @param {string} userDataPath — Electron's app.getPath('userData')
   */
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'bookmarks.json');
    this.bookmarks = [];
    this._load();
  }

  /** Load bookmarks from disk, or start with empty array */
  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.bookmarks = JSON.parse(data);
      }
    } catch (err) {
      console.error('⚠ BookmarkManager: failed to load bookmarks:', err.message);
      this.bookmarks = [];
    }
  }

  /** Write current bookmarks to disk */
  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.bookmarks, null, 2), 'utf-8');
    } catch (err) {
      console.error('⚠ BookmarkManager: failed to save bookmarks:', err.message);
    }
  }

  /** Normalize a URL for deduplication (strip trailing slash, lowercase protocol+host) */
  _normalize(url) {
    try {
      const u = new URL(url);
      return u.origin + u.pathname.replace(/\/$/, '') + u.search + u.hash;
    } catch {
      return url;
    }
  }

  /**
   * Get all bookmarks, newest first.
   * @returns {Array<{ title: string, url: string, timestamp: number }>}
   */
  getAll() {
    return [...this.bookmarks].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Add a bookmark. Deduplicates by normalized URL.
   * @param {string} title
   * @param {string} url
   * @returns {boolean} true if added, false if already exists
   */
  add(title, url) {
    const norm = this._normalize(url);
    if (this.bookmarks.some(b => this._normalize(b.url) === norm)) {
      return false; // duplicate
    }
    this.bookmarks.push({
      title: title || url,
      url,
      timestamp: Date.now()
    });
    this.save();
    return true;
  }

  /**
   * Remove a bookmark by URL.
   * @param {string} url
   * @returns {boolean} true if removed
   */
  remove(url) {
    const norm = this._normalize(url);
    const before = this.bookmarks.length;
    this.bookmarks = this.bookmarks.filter(b => this._normalize(b.url) !== norm);
    if (this.bookmarks.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Check if a URL is bookmarked.
   * @param {string} url
   * @returns {boolean}
   */
  has(url) {
    const norm = this._normalize(url);
    return this.bookmarks.some(b => this._normalize(b.url) === norm);
  }

  /**
   * Toggle a bookmark: add if not present, remove if present.
   * @param {string} title
   * @param {string} url
   * @returns {boolean} true if now bookmarked, false if removed
   */
  toggle(title, url) {
    if (this.has(url)) {
      this.remove(url);
      return false;
    } else {
      this.add(title, url);
      return true;
    }
  }
}

module.exports = BookmarkManager;
