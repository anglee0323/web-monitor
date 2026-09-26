/**
 * Web Monitor - Alert Window Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const url = params.get('url') || '';
  const name = params.get('name') || '';
  const type = params.get('type') || 'change';

  const pageTitle = document.getElementById('pageTitle');
  const urlBox = document.getElementById('urlBox');
  const timeBox = document.getElementById('timeBox');
  const badgeText = document.getElementById('badgeText');
  const openBtn = document.getElementById('openBtn');
  const closeBtn = document.getElementById('closeBtn');

  if (type === 'recovered') {
    badgeText.textContent = 'Server Recovered / Online';
    pageTitle.textContent = name || 'Page Is Back Online';
  } else {
    badgeText.textContent = 'Change Detected';
    pageTitle.textContent = name || 'Page Content Updated';
  }

  urlBox.textContent = url || 'No URL specified';
  timeBox.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  openBtn.focus();

  openBtn.addEventListener('click', async () => {
    if (url) {
      await chrome.tabs.create({ url, active: true });
    }
    window.close();
  });

  closeBtn.addEventListener('click', () => {
    window.close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close();
    } else if (e.key === 'Enter') {
      openBtn.click();
    }
  });
});
