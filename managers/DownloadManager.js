// managers/DownloadManager.js — Download tracking and IPC bridge.
// Hooks into Electron's will-download event and sends progress updates to the renderer.

const { shell } = require('electron');
const path = require('path');

class DownloadManager {
  /**
   * @param {Function} sendToRenderer — function(channel, ...args) to send IPC to the chrome UI
   */
  constructor(sendToRenderer) {
    this.sendToRenderer = sendToRenderer;
    this.downloads = new Map(); // id → download info
    this.nextId = 1;
  }

  /**
   * Attach to a session's will-download event.
   * @param {Electron.Session} sess
   */
  attach(sess) {
    sess.on('will-download', (event, item, webContents) => {
      this._handleDownload(item);
    });
  }

  /**
   * Handle a single download item.
   * @param {Electron.DownloadItem} item
   */
  _handleDownload(item) {
    const id = this.nextId++;
    const filename = item.getFilename();
    const totalBytes = item.getTotalBytes();

    const info = {
      id,
      filename,
      totalBytes,
      receivedBytes: 0,
      speed: 0,           // bytes/sec
      state: 'progressing',
      savePath: item.getSavePath(),
      startTime: Date.now(),
      lastReceivedBytes: 0,
      lastSpeedUpdate: Date.now()
    };

    this.downloads.set(id, info);

    // Notify renderer that a download started
    this.sendToRenderer('download:started', {
      id,
      filename,
      totalBytes
    });

    // Track progress
    item.on('updated', (_event, state) => {
      info.receivedBytes = item.getReceivedBytes();
      info.state = state; // 'progressing' or 'interrupted'
      info.savePath = item.getSavePath();

      // Calculate speed (bytes/sec) using delta over time
      const now = Date.now();
      const elapsed = (now - info.lastSpeedUpdate) / 1000;
      if (elapsed >= 0.5) { // update speed every 500ms
        const deltaBytes = info.receivedBytes - info.lastReceivedBytes;
        info.speed = Math.round(deltaBytes / elapsed);
        info.lastReceivedBytes = info.receivedBytes;
        info.lastSpeedUpdate = now;
      }

      this.sendToRenderer('download:progress', {
        id,
        receivedBytes: info.receivedBytes,
        totalBytes: info.totalBytes,
        speed: info.speed,
        state: info.state
      });
    });

    // Handle completion
    item.once('done', (_event, state) => {
      info.state = state; // 'completed', 'cancelled', or 'interrupted'
      info.receivedBytes = item.getReceivedBytes();
      info.savePath = item.getSavePath();
      info.speed = 0;

      if (state === 'completed') {
        this.sendToRenderer('download:completed', {
          id,
          filename: info.filename,
          savePath: info.savePath,
          totalBytes: info.totalBytes
        });
        console.log(`✔ Download complete: ${info.filename}`);
      } else {
        this.sendToRenderer('download:failed', {
          id,
          filename: info.filename,
          state
        });
        console.log(`⚠ Download ${state}: ${info.filename}`);
      }
    });
  }

  /**
   * Open the folder containing a completed download.
   * @param {number} downloadId
   */
  openFolder(downloadId) {
    const info = this.downloads.get(downloadId);
    if (info && info.savePath) {
      shell.showItemInFolder(info.savePath);
    }
  }
}

module.exports = DownloadManager;
