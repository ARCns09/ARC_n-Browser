// managers/ShortcutManager.js — Persistent user-editable homepage shortcuts.
// Stores shortcuts in {userData}/shortcuts.json with default seeds.

const fs = require('fs');
const path = require('path');

const DEFAULT_SHORTCUTS = [
  { name: 'Google',    url: 'https://www.google.com' },
  { name: 'YouTube',   url: 'https://www.youtube.com' },
  { name: 'GitHub',    url: 'https://www.github.com' },
  { name: 'Reddit',    url: 'https://www.reddit.com' },
  { name: 'Wikipedia', url: 'https://www.wikipedia.org' }
];

class ShortcutManager {
  /**
   * @param {string} userDataPath — Electron's app.getPath('userData')
   */
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'shortcuts.json');
    this.shortcuts = [];
    this._load();
  }

  /** Load shortcuts from disk, or seed with defaults */
  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.shortcuts = JSON.parse(data);
      } else {
        this.shortcuts = [...DEFAULT_SHORTCUTS];
        this.save();
      }
    } catch (err) {
      console.error('⚠ ShortcutManager: failed to load shortcuts:', err.message);
      this.shortcuts = [...DEFAULT_SHORTCUTS];
    }
  }

  /** Write current shortcuts to disk */
  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.shortcuts, null, 2), 'utf-8');
    } catch (err) {
      console.error('⚠ ShortcutManager: failed to save shortcuts:', err.message);
    }
  }

  /**
   * Get all shortcuts.
   * @returns {Array<{ name: string, url: string }>}
   */
  getAll() {
    return [...this.shortcuts];
  }

  /**
   * Add a shortcut.
   * @param {string} name
   * @param {string} url
   */
  add(name, url) {
    this.shortcuts.push({ name, url });
    this.save();
  }

  /**
   * Remove a shortcut by index.
   * @param {number} index
   * @returns {boolean}
   */
  remove(index) {
    if (index >= 0 && index < this.shortcuts.length) {
      this.shortcuts.splice(index, 1);
      this.save();
      return true;
    }
    return false;
  }
}

module.exports = ShortcutManager;
