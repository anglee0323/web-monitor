/**
 * Web Monitor - Popup Interface Logic
 */

let monitors = [];
let settings = {};
let isMonitoring = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadState();
  renderApp();
  bindEventListeners();

  // Listen for storage changes from background worker
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.monitors) monitors = changes.monitors.newValue || [];
        if (changes.settings) settings = changes.settings.newValue || settings;
        if (changes.isMonitoring !== undefined) isMonitoring = changes.isMonitoring.newValue;
        renderApp();
      }
    });
  }
});

async function loadState() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get(['monitors', 'settings', 'isMonitoring']);
    monitors = data.monitors || [];
    settings = Object.assign({
      interval: 10,
      soundEnabled: true,
      soundType: 'chime',
      soundDuration: 3,
      soundVolume: 0.7,
      notificationEnabled: true,
      popupAlert: false,
      autoOpen: false
    }, data.settings || {});

    isMonitoring = typeof data.isMonitoring === 'boolean' ? data.isMonitoring : false;

    // Query background for verification
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
      if (res && typeof res.isMonitoring === 'boolean') {
        isMonitoring = res.isMonitoring;
      }
    } catch (e) {}
  } else {
    // Standalone browser preview mock data
    monitors = [
      {
        id: 'mock_1',
        url: 'https://github.com/anglee0323/web-monitor',
        name: 'Web Monitor GitHub Repo',
        enabled: true,
        lastHash: 'a1b2c3d4',
        lastCheck: Date.now() - 15000,
        lastStatus: 200,
        lastError: null,
        addedAt: Date.now() - 3600000,
        history: [{ timestamp: Date.now() - 15000, type: 'content_changed', summary: 'Version updated to 1.0.0' }]
      },
      {
        id: 'mock_2',
        url: 'https://news.ycombinator.com',
        name: 'Hacker News Frontpage',
        enabled: false,
        lastHash: 'e5f6g7h8',
        lastCheck: Date.now() - 180000,
        lastStatus: 200,
        lastError: null,
        addedAt: Date.now() - 7200000,
        history: []
      }
    ];
    settings = {
      interval: 10,
      soundEnabled: true,
      soundType: 'chime',
      soundDuration: 3,
      soundVolume: 0.7,
      notificationEnabled: true,
      popupAlert: false,
      autoOpen: false
    };
    isMonitoring = true;
  }
}

function renderApp() {
  renderGlobalHeader();
  renderMonitorsList();
  renderSettingsInputs();
}

function renderGlobalHeader() {
  const statusPill = document.getElementById('globalStatusPill');
  const statusText = document.getElementById('globalStatusText');
  const toggleBtn = document.getElementById('togglePowerBtn');
  const playIcon = toggleBtn.querySelector('.play-icon');
  const pauseIcon = toggleBtn.querySelector('.pause-icon');

  const activeCount = monitors.filter(m => m.enabled).length;

  if (isMonitoring && activeCount > 0) {
    statusPill.className = 'status-indicator active';
    statusText.textContent = `${activeCount} Running`;
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    toggleBtn.title = 'Pause Monitoring';
  } else {
    statusPill.className = 'status-indicator';
    statusText.textContent = isMonitoring ? '0 Active' : 'Idle';
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    toggleBtn.title = 'Start Monitoring';
  }

  document.getElementById('monitorCount').textContent = String(monitors.length);
}

function renderMonitorsList() {
  const listEl = document.getElementById('monitorList');
  const emptyState = document.getElementById('emptyState');

  if (monitors.length === 0) {
    emptyState.style.display = 'flex';
    listEl.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';

  listEl.innerHTML = monitors.map(monitor => {
    const hasError = !!monitor.lastError;
    const isPaused = !monitor.enabled;
    let badgeClass = 'status-active';
    let badgeText = isMonitoring ? 'Active' : 'Ready';

    if (isPaused) {
      badgeClass = 'status-paused';
      badgeText = 'Paused';
    } else if (hasError) {
      badgeClass = 'status-error';
      badgeText = 'Error';
    }

    const domain = getDomain(monitor.url);
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
    const lastCheckFormatted = monitor.lastCheck ? formatRelativeTime(monitor.lastCheck) : 'Never checked';
    const changesCount = monitor.history ? monitor.history.length : 0;

    return `
      <div class="monitor-card" data-id="${monitor.id}">
        <div class="card-top">
          <div class="site-meta">
            <img src="${faviconUrl}" class="site-favicon" alt="" onerror="this.style.display='none'">
            <div class="site-title-box">
              <div class="site-name" title="${escapeHtml(monitor.name || monitor.url)}">${escapeHtml(monitor.name || monitor.url)}</div>
              <a href="${escapeHtml(monitor.url)}" target="_blank" class="site-url" title="${escapeHtml(monitor.url)}">${escapeHtml(shortenUrl(monitor.url))}</a>
            </div>
          </div>
          <div class="card-actions">
            <button class="card-btn check-single-btn" data-id="${monitor.id}" title="Check now">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
            </button>
            <button class="card-btn toggle-single-btn" data-id="${monitor.id}" title="${monitor.enabled ? 'Pause' : 'Resume'}">
              ${monitor.enabled ? `
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              ` : `
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              `}
            </button>
            <button class="card-btn delete-btn" data-id="${monitor.id}" title="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="card-bottom">
          <span class="badge-pill ${badgeClass}">${badgeText}</span>
          <span>Checked ${lastCheckFormatted}</span>
          ${changesCount > 0 ? `<span class="changes-count">⚡ ${changesCount} changes</span>` : ''}
        </div>

        ${hasError ? `<div class="card-error-text">${escapeHtml(monitor.lastError)}</div>` : ''}
      </div>
    `;
  }).join('');

  // Attach card event listeners
  listEl.querySelectorAll('.toggle-single-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleMonitorItem(btn.dataset.id));
  });

  listEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteMonitorItem(btn.dataset.id));
  });

  listEl.querySelectorAll('.check-single-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.style.transform = 'rotate(180deg)';
      btn.style.transition = 'transform 0.4s ease';
      await chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
      setTimeout(() => {
        btn.style.transform = 'none';
      }, 500);
    });
  });
}

function renderSettingsInputs() {
  // Interval Segmented Control
  const currentInterval = settings.interval || 10;
  document.querySelectorAll('#intervalSegmented .segment-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.val) === currentInterval);
  });

  document.getElementById('soundEnabled').checked = settings.soundEnabled;
  document.getElementById('soundType').value = settings.soundType || 'chime';
  document.getElementById('soundDuration').value = String(settings.soundDuration || 3);
  document.getElementById('notificationEnabled').checked = settings.notificationEnabled;
  document.getElementById('popupAlert').checked = settings.popupAlert;
  document.getElementById('autoOpen').checked = settings.autoOpen;

  document.getElementById('soundSubSettings').style.display = settings.soundEnabled ? 'flex' : 'none';
}

function bindEventListeners() {
  // 1. Add Monitor
  document.getElementById('addMonitorBtn').addEventListener('click', handleAddMonitor);
  document.getElementById('urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddMonitor();
  });

  // 2. Use Current Tab
  document.getElementById('useCurrentTabBtn').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.startsWith('http')) {
        document.getElementById('urlInput').value = tab.url;
        document.getElementById('nameInput').value = tab.title || '';
        document.getElementById('urlInput').focus();
      }
    } catch (e) {
      console.error(e);
    }
  });

  // 3. Global Power Toggle
  document.getElementById('togglePowerBtn').addEventListener('click', async () => {
    if (isMonitoring) {
      await chrome.runtime.sendMessage({ type: 'STOP_MONITORING' });
      isMonitoring = false;
    } else {
      // If there are no monitors enabled, enable them all
      let hasEnabled = monitors.some(m => m.enabled);
      if (!hasEnabled && monitors.length > 0) {
        monitors.forEach(m => m.enabled = true);
        await chrome.storage.local.set({ monitors });
      }
      await chrome.runtime.sendMessage({ type: 'START_MONITORING' });
      isMonitoring = true;
    }
    renderGlobalHeader();
    renderMonitorsList();
  });

  // 4. Check All Now
  const checkAllBtn = document.getElementById('checkAllNowBtn');
  checkAllBtn.addEventListener('click', async () => {
    const icon = checkAllBtn.querySelector('svg');
    icon.style.transform = 'rotate(360deg)';
    icon.style.transition = 'transform 0.5s ease';
    await chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
    setTimeout(() => {
      icon.style.transform = 'none';
      icon.style.transition = 'none';
    }, 600);
  });

  // 5. Settings Drawer Toggle
  const settingsDrawer = document.getElementById('settingsDrawer');
  document.getElementById('openSettingsBtn').addEventListener('click', () => {
    settingsDrawer.classList.add('open');
  });

  document.getElementById('closeSettingsBtn').addEventListener('click', () => {
    settingsDrawer.classList.remove('open');
  });

  // 6. Settings Inputs
  document.querySelectorAll('#intervalSegmented .segment-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const val = parseInt(btn.dataset.val);
      settings.interval = val;
      await saveSettings();
      document.querySelectorAll('#intervalSegmented .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (isMonitoring) {
        await chrome.runtime.sendMessage({ type: 'STOP_MONITORING' });
        await chrome.runtime.sendMessage({ type: 'START_MONITORING' });
      }
    });
  });

  document.getElementById('soundEnabled').addEventListener('change', async (e) => {
    settings.soundEnabled = e.target.checked;
    document.getElementById('soundSubSettings').style.display = settings.soundEnabled ? 'flex' : 'none';
    await saveSettings();
  });

  document.getElementById('soundType').addEventListener('change', async (e) => {
    settings.soundType = e.target.value;
    await saveSettings();
  });

  document.getElementById('soundDuration').addEventListener('change', async (e) => {
    settings.soundDuration = parseInt(e.target.value);
    await saveSettings();
  });

  document.getElementById('notificationEnabled').addEventListener('change', async (e) => {
    settings.notificationEnabled = e.target.checked;
    await saveSettings();
  });

  document.getElementById('popupAlert').addEventListener('change', async (e) => {
    settings.popupAlert = e.target.checked;
    await saveSettings();
  });

  document.getElementById('autoOpen').addEventListener('change', async (e) => {
    settings.autoOpen = e.target.checked;
    await saveSettings();
  });

  // 7. Test Sound
  document.getElementById('testSoundBtn').addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({
        type: 'PLAY_BEEP',
        soundType: settings.soundType || 'chime',
        duration: settings.soundDuration || 3,
        volume: settings.soundVolume || 0.7
      });
    } catch (e) {
      console.warn(e);
    }
  });

  // 8. Export & Import Config
  document.getElementById('exportDataBtn').addEventListener('click', () => {
    const exportPayload = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      monitors,
      settings
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-monitor-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const importFileInput = document.getElementById('importFileInput');
  document.getElementById('importDataBtn').addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported.monitors)) {
          monitors = imported.monitors;
          if (imported.settings) settings = Object.assign(settings, imported.settings);
          await chrome.storage.local.set({ monitors, settings });
          renderApp();
          alert('Configuration imported successfully!');
        } else {
          alert('Invalid configuration format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  });

  // 9. Clear All
  document.getElementById('clearAllBtn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to remove all monitored pages?')) {
      monitors = [];
      await chrome.storage.local.set({ monitors });
      if (isMonitoring) {
        await chrome.runtime.sendMessage({ type: 'STOP_MONITORING' });
        isMonitoring = false;
      }
      renderApp();
    }
  });
}

async function handleAddMonitor() {
  const urlInput = document.getElementById('urlInput');
  const nameInput = document.getElementById('nameInput');
  const url = urlInput.value.trim();
  const name = nameInput.value.trim();

  if (!url) {
    urlInput.focus();
    return;
  }

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      alert('Please enter a valid HTTP or HTTPS URL.');
      return;
    }
  } catch {
    alert('Please enter a valid URL.');
    return;
  }

  // Duplicate check
  if (monitors.some(m => m.url === url)) {
    alert('This URL is already in your monitor list.');
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

  urlInput.value = '';
  nameInput.value = '';

  renderApp();

  // If not monitoring, start automatically
  if (!isMonitoring) {
    await chrome.runtime.sendMessage({ type: 'START_MONITORING' });
    isMonitoring = true;
    renderGlobalHeader();
  } else {
    chrome.runtime.sendMessage({ type: 'CHECK_NOW' });
  }
}

async function toggleMonitorItem(id) {
  const item = monitors.find(m => m.id === id);
  if (!item) return;

  item.enabled = !item.enabled;
  await saveMonitors();
  renderApp();

  const anyEnabled = monitors.some(m => m.enabled);
  if (anyEnabled && !isMonitoring) {
    await safeSendMessage({ type: 'START_MONITORING' });
    isMonitoring = true;
    renderGlobalHeader();
  } else if (!anyEnabled && isMonitoring) {
    await safeSendMessage({ type: 'STOP_MONITORING' });
    isMonitoring = false;
    renderGlobalHeader();
  }
}

async function deleteMonitorItem(id) {
  monitors = monitors.filter(m => m.id !== id);
  await saveMonitors();
  renderApp();
}

async function saveMonitors() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ monitors });
  }
}

async function saveSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ settings });
  }
}

async function safeSendMessage(msg) {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      return await chrome.runtime.sendMessage(msg);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    if (path.length > 28) {
      return u.hostname + path.substring(0, 25) + '...';
    }
    return u.hostname + path;
  } catch {
    return url.length > 35 ? url.substring(0, 32) + '...' : url;
  }
}

function formatRelativeTime(timestamp) {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}
