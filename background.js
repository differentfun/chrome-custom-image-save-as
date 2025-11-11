const MENU_ROOT_ID = 'custom-save-image-root';
const MENU_ITEM_PREFIX = 'custom-save-image-format-';

const FORMAT_MAP = {
  jpeg: { mime: 'image/jpeg', extension: 'jpg', label: 'JPEG' },
  png: { mime: 'image/png', extension: 'png', label: 'PNG' },
  webp: { mime: 'image/webp', extension: 'webp', label: 'WebP' }
};

const DEFAULT_SETTINGS = {
  quality: 0.92,
  customExtension: ''
};

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
  primeDefaults();
});

chrome.runtime.onStartup.addListener(setupContextMenu);

chrome.contextMenus.onClicked.addListener((info) => {
  if (!info.menuItemId?.startsWith(MENU_ITEM_PREFIX) || !info.srcUrl) {
    return;
  }
  const formatKey = info.menuItemId.replace(MENU_ITEM_PREFIX, '');
  if (!FORMAT_MAP[formatKey]) {
    return;
  }
  saveWithCustomExtension(info.srcUrl, formatKey);
});

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ROOT_ID,
      title: 'Save image as (custom ext)',
      contexts: ['image']
    });

    Object.entries(FORMAT_MAP).forEach(([formatKey, meta]) => {
      chrome.contextMenus.create({
        id: `${MENU_ITEM_PREFIX}${formatKey}`,
        parentId: MENU_ROOT_ID,
        title: meta.label,
        contexts: ['image']
      });
    });
  });
}

function primeDefaults() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
    const next = { ...DEFAULT_SETTINGS, ...stored };
    chrome.storage.sync.set(next);
  });
}

async function saveWithCustomExtension(imageUrl, formatKey) {
  try {
    const settings = await getSettings();
    const format = FORMAT_MAP[formatKey];
    if (!format) {
      throw new Error(`Unsupported format: ${formatKey}`);
    }
    const { mime, extension } = format;
    const quality = sanitizeQuality(settings.quality);
    const customExtension = sanitizeExtension(settings.customExtension) || extension;

    const fileName = deriveFileName(imageUrl, customExtension);
    const blob = await convertImage(imageUrl, mime, formatKey === 'jpeg' ? quality : undefined);
    const dataUrl = await blobToDataUrl(blob);

    await chrome.downloads.download({
      url: dataUrl,
      filename: fileName,
      saveAs: true
    });
  } catch (error) {
    console.error('Custom Image Save As failed', error);
  }
}

function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => resolve({ ...DEFAULT_SETTINGS, ...items }));
  });
}

function sanitizeQuality(value) {
  const num = Number(value);
  if (Number.isFinite(num) && num >= 0.1 && num <= 1) {
    return num;
  }
  return DEFAULT_SETTINGS.quality;
}

function sanitizeExtension(value) {
  if (!value) return '';
  const cleaned = String(value).trim().replace(/^\./, '');
  if (!cleaned) return '';
  return cleaned.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
}

function deriveFileName(urlString, ext) {
  try {
    const url = new URL(urlString);
    const rawName = url.pathname.split('/').filter(Boolean).pop() || 'image';
    const base = rawName.includes('.') ? rawName.split('.').slice(0, -1).join('.') : rawName;
    return `${base || 'image'}.${ext}`;
  } catch {
    return `image.${ext}`;
  }
}

async function convertImage(imageUrl, mimeType, quality) {
  const response = await fetch(imageUrl, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }

  const sourceBlob = await response.blob();
  const bitmap = await createImageBitmap(sourceBlob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return canvas.convertToBlob({
    type: mimeType,
    quality
  });
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const base64 = bufferToBase64(buffer);
  return `data:${blob.type};base64,${base64}`;
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
