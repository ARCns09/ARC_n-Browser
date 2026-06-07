# Project status Signs
- Complete ✅
- In Progress 🚧

# ARC_n Browser Roadmap

## Vision
ARC_n aims to be a lightweight, privacy-focused, modern desktop browser built with Electron and WebContentsView.

---

# Phase 1: Core Browser Experience

## 1. Favicons
**Goal:** Show website icons in tabs.
**Benefit:** Makes tab navigation much easier.
**Guide:** Capture favicon URLs and render them beside tab titles.

## 2. Bookmarks System
**Goal:** Save favorite sites.
**Benefit:** Essential browser feature.
**Guide:** Store bookmarks in JSON under Electron userData.

## 3. History Manager
**Goal:** Track visited pages.
**Benefit:** Lets users revisit sites.
**Guide:** Record URL, title, and timestamp.

## 4. Download Manager
**Goal:** Track downloads.
**Benefit:** Professional browser experience.
**Guide:** Use Electron's will-download event.

## 5. Dynamic Start Page
**Goal:** User-editable shortcuts.
**Benefit:** Personalized homepage.
**Guide:** Read shortcuts from JSON.

---

# Phase 2: Productivity

## 6. Keyboard Shortcuts
Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+Shift+T.

## 7. Recently Closed Tabs
Restore accidentally closed tabs.

## 8. Search Suggestions
Show suggestions while typing.

## 9. Find in Page
Search text on current page.

## 10. Reader Mode
Distraction-free article reading.

---

# Phase 3: Performance

## 11. Tab Snoozing
Unload inactive tabs to save memory.

## 12. Performance Dashboard
Show memory and CPU usage.

## 13. Lazy Loading Tabs
Only load tabs when activated.

## 14. Crash Recovery
Restore tabs after crashes.

---

# Phase 4: Privacy

## 15. Privacy Dashboard
Show blocked ads and trackers.

## 16. Enhanced Ad Blocking
Additional filter lists.

## 17. Per-Site Permissions
Camera, microphone, notifications.

---

# Phase 5: Customization

## 18. Theme Engine
Dark, Light, AMOLED themes.

## 19. Workspace Profiles
Separate work and personal sessions.

## 20. ARC_n Settings Center
Centralized settings interface.

---

# Recommended Build Order

1. Favicons
2. Bookmarks
3. History
4. Download Manager
5. Dynamic Start Page
6. Keyboard Shortcuts
7. Recently Closed Tabs
8. Search Suggestions
9. Find in Page
10. Reader Mode
11. Tab Snoozing
12. Crash Recovery
13. Privacy Dashboard
14. Theme Engine
15. Settings Center

This order maximizes visible improvements while keeping architecture clean.
