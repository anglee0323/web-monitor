# Web Monitor

<p>
  <b>English</b> | <a href="README_zh.md">简体中文</a>
</p>

A sleek, high-frequency webpage change detector and alerting extension for Chromium browsers (Chrome, Edge, Arc, Brave), built on Manifest V3.

<p align="left">
  <img src="https://img.shields.io/badge/Manifest-V3-blue?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/License-MIT-emerald?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/Browsers-Chrome%20%7C%20Edge%20%7C%20Arc%20%7C%20Brave-gray?style=flat-square" alt="Chromium Browsers" />
  <img src="https://img.shields.io/badge/Privacy-100%25%20Local-success?style=flat-square" alt="100% Local" />
</p>

---

## Preview

<p align="center">
  <img src="assets/screenshots/preview.png" width="410" alt="Web Monitor Interface" />
</p>

---

## Features

- **⚡ High-Frequency Monitoring**: Supports configurable check intervals from ultra-fast 5s / 10s / 30s to 1m / 5m.
- **🔔 Multi-Channel Alert System**:
  - **Synthesized Audio Alarms**: Built-in Web Audio API tone synthesis (Chime, Radar, Success, Alert) with zero external media files.
  - **Native Notifications**: OS-level desktop notification banners with one-click navigation to the target site.
  - **Standalone Alert Window**: Centered modal popup for critical, can't-miss alerts with keyboard shortcuts (<kbd>Enter</kbd> to open, <kbd>Esc</kbd> to dismiss).
  - **Auto-Open Webpage**: Automatically launches the updated page in an active tab when changes occur.
- **🛡️ Error Recovery Tracking**: Detects when pages recover from server errors (HTTP 404/500/502/timeouts) back to `200 OK`.
- **🧼 Smart Normalization & SHA-256 Fingerprinting**: Automatically strips scripts, styles, dynamic timestamps, and session tokens to eliminate false positives.
- **🖱️ Instant Quick Actions**:
  - One-click `Current Tab` button in popup to auto-fill current page URL and title.
  - Right-click any webpage: `Add current page to Web Monitor`.
  - Keyboard shortcut: <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> (Mac: <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>).
- **🎨 Modern, Minimalist UI**: Clean dark & light mode support, real-time status indicators, and JSON configuration export/import.
- **🔒 100% Private & Local**: Zero analytics, zero external API tracking. Everything executes locally in your browser.

---

## Installation Guide

### Prerequisites
Any Chromium-based browser:
- Google Chrome
- Microsoft Edge
- Brave
- Arc Browser

### Steps
1. Clone or download this repository:
   ```bash
   git clone https://github.com/anglee0323/web-monitor.git
   ```
2. Open your browser and navigate to the Extensions page:
   - Chrome / Arc: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Toggle on **Developer mode** (top-right corner).
4. Click **Load unpacked**.
5. Select the `web-monitor` directory.
6. Pin the **Web Monitor** icon to your toolbar for quick access.

---

## Architecture & How It Works

```
Target URL ──► Service Worker Fetch ──► Smart Normalizer ──► Web Crypto SHA-256
                                                                    │
                                                      ┌─────────────┴─────────────┐
                                                      ▼                           ▼
                                                 Hash Matched               Hash Changed
                                                  (No action)               (Alert Triggered)
                                                                                  │
                                                ┌───────────────────┬─────────────┴─────────────┬──────────────────┐
                                                ▼                   ▼                           ▼                  ▼
                                           Desktop Notif       Web Audio (Offscreen)       Alert Window        Auto-Open
```

1. **Scheduled Fetching**: The background service worker queries the target URL using `cache: 'no-store'` to bypass intermediate CDN caching.
2. **Content Sanitization**: Strips dynamic noise including `<script>`, `<style>`, `<iframe>`, inline timestamps, and CSRF nonces.
3. **Cryptographic Fingerprint**: Generates a standard SHA-256 hash digest.
4. **Change Detection**: When the hash diverges from the previous state, or when a previously offline site returns `200 OK`, alerts trigger across enabled channels.
5. **Offscreen Document Integration**: Uses Chrome's `offscreen` API to keep audio synthesis reliable and sub-minute timers accurate in Manifest V3.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> / <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd> | Add current active page to monitor list |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> / <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> | Toggle monitoring start / pause |

---

## License

Distributed under the [MIT License](LICENSE).
