/**
 * Web Monitor - Background Service Worker
 * Chrome Manifest V3 Engine
 */

const ALARM_NAME = 'webMonitorScheduler';
const OFFSCREEN_PATH = 'offscreen.html';

// ===== Content Cleaning & Cryptographic Hashing =====

async function computeSha256(text) {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function cleanHtmlContent(rawHtml) {
  if (!rawHtml) return '';
  let cleaned = rawHtml;

  // Remove script tags and contents
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove style tags and contents
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remove noscript and iframe
  cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  cleaned = cleaned.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  // Normalize ISO timestamps: 2026-09-26T13:50:09.123Z
  cleaned = cleaned.replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/gi, '[TIMESTAMP]');
  // Normalize epoch milliseconds (13 digits) and seconds (10 digits)
  cleaned = cleaned.replace(/\b1[6-9]\d{11}\b/g, '[TIMESTAMP]');
  cleaned = cleaned.replace(/\b1[6-9]\d{8}\b/g, '[TIMESTAMP]');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// ===== Network Fetching =====

async function fetchPage(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    return {
      status: response.status,
      text
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Connection timeout (8s)');
    }
    throw error;
  }
}

// ===== Offscreen Document Lifecycle =====

async function ensureOffscreenDocument() {
  try {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT']
    });

    if (existing.length > 0) {
      return true;
    }

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['AUDIO_PLAYBACK', 'WORKERS'],
      justification: 'Synthesize audio alerts and maintain high-precision monitoring heartbeats'
    });
    return true;
  } catch (err) {
    console.warn('[Web Monitor] Offscreen document setup:', err);
    return false;
  }
}

// ===== State Management =====

const DEFAULT_SETTINGS = {
  interval: 10,
  soundEnabled: true,
  soundType: 'chime',
  soundDuration: 3,
  soundVolume: 0.7,
  notificationEnabled: true,
  popupAlert: false,
  autoOpen: false
};

async function getStoredState() {
  const data = await chrome.storage.local.get(['monitors', 'settings', 'isMonitoring']);
  return {
    monitors: data.monitors || [],
    settings: Object.assign({}, DEFAULT_SETTINGS, data.settings || {}),
    isMonitoring: typeof data.isMonitoring === 'boolean' ? data.isMonitoring : false
  };
}

// ===== Monitoring Engine =====

let isCheckInProgress = false;

async function performMonitoringCheck() {
  if (isCheckInProgress) return;
  isCheckInProgress = true;

  try {
    const { monitors, settings, isMonitoring } = await getStoredState();
    if (!isMonitoring || monitors.length === 0) {
      updateBadge(false, 0);
      return;
    }

    const activeMonitors = monitors.filter(m => m.enabled);
    if (activeMonitors.length === 0) {
      updateBadge(false, 0);
      return;
    }

    updateBadge(true, activeMonitors.length);

    // Concurrently process monitors
    await Promise.all(activeMonitors.map(async (monitor) => {
      const now = Date.now();
      const hadError = !!monitor.lastError;
      const previousHash = monitor.lastHash;

      try {
        const { text, status } = await fetchPage(monitor.url);
        const cleaned = cleanHtmlContent(text);
        const currentHash = await computeSha256(cleaned);

        monitor.lastCheck = now;
        monitor.lastStatus = status;
        monitor.lastError = null;

        // Condition 1: Hash changed after baseline established
        const contentChanged = Boolean(previousHash && currentHash !== previousHash);
        // Condition 2: Recovered from network/server error to 200 OK
        const recoveredFromError = Boolean(hadError && previousHash);

        monitor.lastHash = currentHash;

        if (contentChanged || recoveredFromError) {
          const changeType = recoveredFromError ? 'recovered' : 'content_changed';
          const summary = recoveredFromError ? 'Recovered from error' : 'Content change detected';

          if (!monitor.history) monitor.history = [];
          monitor.history.unshift({
            timestamp: now,
            type: changeType,
            summary
          });
          monitor.history = monitor.history.slice(0, 20);

          await handleTriggeredAlert(monitor, settings, recoveredFromError);
        }
      } catch (err) {
        monitor.lastCheck = now;
        monitor.lastError = err.message || 'Unknown network error';
      }
    }));

    await chrome.storage.local.set({ monitors });
  } catch (err) {
    console.error('[Web Monitor] Check execution error:', err);
  } finally {
    isCheckInProgress = false;
  }
}

async function handleTriggeredAlert(monitor, settings, isRecovery = false) {
  const title = isRecovery ? 'Web Monitor: Page Recovered' : 'Web Monitor: Change Detected';
  const siteLabel = monitor.name || monitor.url;

  // 1. Badge Alert
  try {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    setTimeout(async () => {
      const { isMonitoring, monitors } = await getStoredState();
      const active = monitors.filter(m => m.enabled).length;
      updateBadge(isMonitoring, active);
    }, 12000);
  } catch (e) {}

  // 2. Desktop Notification
  if (settings.notificationEnabled) {
    try {
      const notifId = `alert-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: 'assets/icons/icon128.png',
        title: title,
        message: `${siteLabel}\n${monitor.url}`,
        priority: 2,
        requireInteraction: true
      });
      await chrome.storage.local.set({ [`notif_target_${notifId}`]: monitor.url });
    } catch (err) {
      console.error('[Web Monitor] Notification error:', err);
    }
  }

  // 3. Audio Alarm (via Offscreen)
  if (settings.soundEnabled) {
    try {
      await ensureOffscreenDocument();
      await chrome.runtime.sendMessage({
        type: 'PLAY_BEEP',
        soundType: settings.soundType || 'chime',
        duration: settings.soundDuration || 3,
        volume: settings.soundVolume || 0.7
      });
    } catch (err) {
      console.warn('[Web Monitor] Sound dispatch:', err);
    }
  }

  // 4. Standalone Alert Window
  if (settings.popupAlert) {
    try {
      const currentWindow = await chrome.windows.getCurrent().catch(() => null);
      const width = 440;
      const height = 360;
      let left = 200;
      let top = 150;

      if (currentWindow && currentWindow.left !== undefined) {
        left = currentWindow.left + Math.max(0, Math.floor((currentWindow.width - width) / 2));
        top = currentWindow.top + Math.max(0, Math.floor((currentWindow.height - height) / 2));
      }

      const alertUrl = chrome.runtime.getURL('alert.html') +
        `?url=${encodeURIComponent(monitor.url)}` +
        `&name=${encodeURIComponent(monitor.name || '')}` +
        `&type=${encodeURIComponent(isRecovery ? 'recovered' : 'change')}`;

      await chrome.windows.create({
        url: alertUrl,
        type: 'popup',
        width,
        height,
        left,
        top,
        focused: true
      });
    } catch (err) {
      console.error('[Web Monitor] Alert window error:', err);
    }
  }

  // 5. Auto Open
  if (settings.autoOpen) {
    try {
      await chrome.tabs.create({ url: monitor.url, active: true });
    } catch (err) {
      console.error('[Web Monitor] Auto-open tab error:', err);
    }
  }
}

// ===== Scheduler Controls =====

async function startMonitoringEngine() {
  const { settings } = await getStoredState();
  const intervalSec = Math.max(3, settings.interval || 10);
  const intervalMin = intervalSec / 60;

  await chrome.storage.local.set({ isMonitoring: true });

  // Chrome alarms fallback
  await chrome.alarms.clear(ALARM_NAME);
  await chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: Math.max(0.1, intervalMin),
    periodInMinutes: Math.max(1, intervalMin)
  });

  // Offscreen high-precision ticker for sub-minute intervals
  await ensureOffscreenDocument();
  chrome.runtime.sendMessage({
    type: 'START_TICKER',
    intervalSeconds: intervalSec
  }).catch(() => {});

  // Immediate check
  performMonitoringCheck();
}

async function stopMonitoringEngine() {
  await chrome.storage.local.set({ isMonitoring: false });
  await chrome.alarms.clear(ALARM_NAME);

  chrome.runtime.sendMessage({ type: 'STOP_TICKER' }).catch(() => {});
  updateBadge(false, 0);
}

function updateBadge(isMonitoring, activeCount = 0) {
  if (!isMonitoring || activeCount === 0) {
    chrome.action.setBadgeText({ text: '' });
  } else {
    chrome.action.setBadgeText({ text: String(activeCount) });
    chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  }
}

// ===== Event Listeners =====

// 1. Alarms Listener
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    performMonitoringCheck();
  }
});

// 2. Notification Click
chrome.notifications.onClicked.addListener(async (notifId) => {
  const key = `notif_target_${notifId}`;
  const data = await chrome.storage.local.get(key);
  if (data[key]) {
    chrome.tabs.create({ url: data[key], active: true });
    chrome.storage.local.remove(key);
  }
  chrome.notifications.clear(notifId);
});

// 3. Message Routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'START_MONITORING':
      startMonitoringEngine().then(() => sendResponse({ success: true }));
      return true;

    case 'STOP_MONITORING':
      stopMonitoringEngine().then(() => sendResponse({ success: true }));
      return true;

    case 'CHECK_NOW':
      performMonitoringCheck().then(() => sendResponse({ success: true }));
      return true;

    case 'HEARTBEAT_TICK':
      performMonitoringCheck();
      sendResponse({ received: true });
      return false;

    case 'GET_STATUS':
      getStoredState().then(({ isMonitoring, monitors }) => {
        const active = monitors.filter(m => m.enabled).length;
        sendResponse({
          isMonitoring,
          totalCount: monitors.length,
          activeCount: active
        });
      });
      return true;

    default:
      return false;
  }
});

// 4. Context Menu & Shortcuts
chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.create({
    id: 'web-monitor-add-page',
    title: 'Add current page to Web Monitor',
    contexts: ['page']
  });

  // Ensure initial storage defaults
  const data = await chrome.storage.local.get(['monitors', 'settings', 'isMonitoring']);
  if (!data.monitors) await chrome.storage.local.set({ monitors: [] });
  if (!data.settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  if (typeof data.isMonitoring !== 'boolean') await chrome.storage.local.set({ isMonitoring: false });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'web-monitor-add-page' && tab && tab.url) {
    await addUrlToMonitor(tab.url, tab.title || tab.url);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'add-current-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      await addUrlToMonitor(tab.url, tab.title || tab.url);
    }
  } else if (command === 'toggle-monitoring') {
    const { isMonitoring } = await getStoredState();
    if (isMonitoring) {
      await stopMonitoringEngine();
    } else {
      await startMonitoringEngine();
    }
  }
});

async function addUrlToMonitor(url, name) {
  if (!url || !url.startsWith('http')) return;
  const { monitors, isMonitoring } = await getStoredState();

  const existing = monitors.find(m => m.url === url);
  if (existing) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'assets/icons/icon128.png',
      title: 'Web Monitor',
      message: `Already in monitor list: ${existing.name || url}`
    });
    return;
  }

  const newMonitor = {
    id: `m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url,
    name: name || url,
    enabled: true,
    lastHash: null,
    lastCheck: null,
    lastStatus: null,
    lastError: null,
    addedAt: Date.now(),
    history: []
  };

  monitors.unshift(newMonitor);
  await chrome.storage.local.set({ monitors });

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icons/icon128.png',
    title: 'Web Monitor: Added',
    message: `Monitoring started for: ${newMonitor.name}`
  });

  if (!isMonitoring) {
    await startMonitoringEngine();
  } else {
    performMonitoringCheck();
  }
}
