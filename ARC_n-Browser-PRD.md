npm# Product Requirements Document: ARC_n Browser

## 1. Project Overview
**Project Name:** ARC_n Browser  
**Objective:** Build a lightweight, fast, and privacy-first desktop web browser using standard web technologies. The browser will feature a custom user interface and natively integrate robust ad-blocking capabilities at the network level without relying on the Chrome Web Store or external extensions.

## 2. Target Environment
* **Operating System:** Windows (Targeting a system running Node.js v24+).
* **Hardware Profile:** Optimized for low-power CPUs (e.g., Intel i3-1315U) and 12GB RAM. The architecture must remain lightweight to avoid heavy memory consumption or CPU locking.
* **Framework:** Electron (JavaScript/Node.js).

## 3. Core Architecture & Tech Stack
* **Engine:** Electron (Provides the Chromium rendering engine without the need to compile C++).
* **Ad-Blocker:** `@ghostery/adblocker-electron` (Used to intercept network requests at the engine level using uBlock Origin's EasyList and EasyPrivacy filters).
* **UI/Frontend:** Vanilla HTML, CSS, and JavaScript. 
* **View Management:** Use Electron's modern `WebContentsView` (or `BrowserView`) API to render the actual web pages inside the main window, keeping the UI separate from the loaded web content.

## 4. Key Features & Functionality

### 4.1 Native Ad-Blocking (The Engine)
* Must initialize `ElectronBlocker.fromPrebuiltAdsAndTracking()` in the main process.
* Must attach the blocker to the `session.defaultSession` so that all tabs and web views automatically inherit ad-blocking.
* Ad-blocking must be completely invisible to the user and require zero setup.

### 4.2 Browser User Interface (The Chrome)
* **Navigation Bar:** A clean top bar containing:
    * Back Button (`<`)
    * Forward Button (`>`)
    * Reload Button (`↻`)
    * Home Button
    * URL Input Field (Omnibox) with "Enter" key event listener to load URLs.
* **Tab System:** * A top tab bar allowing the user to open multiple websites concurrently.
    * "New Tab" (`+`) button.
    * Tabs must show the title of the active web page.

### 4.3 Process Isolation
* **Main Process (`main.js`):** Handles the Electron lifecycle, ad-blocker initialization, and creating the `BrowserWindow` and `WebContentsView` for tabs.
* **Preload Script (`preload.js`):** Securely bridges communication between the UI and the main process using `contextBridge` and `ipcRenderer` (e.g., sending the command to create a new tab).
* **Renderer Process (`renderer.js`):** Handles the DOM manipulation for the UI (clicking buttons, reading the URL bar).

## 5. Specific Implementation Constraints (Crucial for the AI Agent)

**⚠️ CRITICAL NODE 24 / WINDOWS INSTALL BUG:**
The developer has previously encountered the `ENOENT: no such file or directory, open '...\node_modules\electron\path.txt'` error caused by Node.js v24 failing to download the Electron `.zip` binary silently. 

* **Action Required by AI:** When generating the initial setup instructions, you MUST include a `.npmrc` file in the project root with an alternative mirror to guarantee the binary downloads correctly. 
    * *Example `.npmrc` content:* `ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"`
* Do NOT use the deprecated `<webview>` HTML tag. Use `WebContentsView` attached to the main `BrowserWindow` as per modern Electron best practices.
* Keep the UI styling sleek and modern (dark mode by default, rounded corners, minimalistic icons).

## 6. Expected Output from AI
Provide the exact folder structure and the complete code for the following files to create a fully functioning MVP:
1.  `package.json`
2.  `.npmrc` (Crucial for the download bug)
3.  `main.js` (Main process + Adblocker)
4.  `preload.js` (IPC bridge)
5.  `index.html` (The browser UI)
6.  `styles.css` (Dark mode UI design)
7.  `renderer.js` (UI logic)
