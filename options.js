const DEFAULT_SETTINGS = {
  quality: 0.92,
  customExtension: ''
};

const form = document.getElementById('settings-form');
const qualityField = document.getElementById('quality');
const customExtField = document.getElementById('customExtension');
const statusEl = document.getElementById('status');

document.addEventListener('DOMContentLoaded', restoreSettings);
form.addEventListener('submit', saveSettings);

async function restoreSettings() {
  const settings = await getStoredSettings();
  qualityField.value = settings.quality;
  customExtField.value = settings.customExtension;
}

async function saveSettings(event) {
  event.preventDefault();
  const payload = {
    quality: clampQuality(Number(qualityField.value)),
    customExtension: sanitizeExtension(customExtField.value)
  };

  await chrome.storage.sync.set(payload);
  showStatus('Salvato!');
}

function clampQuality(value) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.quality;
  }
  return Math.min(1, Math.max(0.1, value));
}

function sanitizeExtension(value) {
  if (!value) return '';
  const cleaned = String(value).trim().replace(/^\./, '');
  return cleaned.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
}

function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => resolve({ ...DEFAULT_SETTINGS, ...items }));
  });
}

function showStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    statusEl.textContent = '';
  }, 1800);
}
