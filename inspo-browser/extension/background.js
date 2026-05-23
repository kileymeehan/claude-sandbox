chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-to-inspo',
      title: 'Save to SwatchBook',
      contexts: ['image']
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'save-to-inspo') return;
  const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  if (!serverUrl || !apiToken) { chrome.action.openPopup(); return; }
  const result = await uploadUrl(info.srcUrl, serverUrl, apiToken);
  badge(result.ok);
  notify(result.ok, result.ok ? 'Image saved to SwatchBook' : `Failed: ${result.error}`);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'upload-urls') {
    (async () => {
      const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
      const results = await Promise.all(msg.urls.map(url => uploadUrl(url, serverUrl, apiToken)));
      const ok = results.filter(r => r.ok).length;
      const fail = results.filter(r => !r.ok).length;
      const success = ok > 0;
      notify(success, ok > 0
        ? `${ok} image${ok > 1 ? 's' : ''} saved to SwatchBook${fail ? ` (${fail} failed)` : ''}`
        : `All uploads failed`
      );
      sendResponse({ results });
    })();
    return true;
  }

  if (msg.type === 'capture-full') {
    (async () => {
      const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      const blob = await dataUrlToBlob(dataUrl);
      const result = await uploadBlob(blob, serverUrl, apiToken);
      badge(result.ok);
      sendResponse(result);
    })();
    return true;
  }

  if (msg.type === 'capture-area') {
    (async () => {
      const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
      const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
      const cropped = await cropImage(dataUrl, msg.rect);
      const result = await uploadBlob(cropped, serverUrl, apiToken);
      badge(result.ok);
      notify(result.ok, result.ok ? 'Screenshot saved to SwatchBook' : `Failed: ${result.error}`);
      sendResponse(result);
    })();
    return true;
  }
});

// ── Helpers ──────────────────────────────────────────────────

function notify(ok, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: ok ? 'SwatchBook' : 'SwatchBook — Upload failed',
    message
  });
}

function badge(ok) {
  chrome.action.setBadgeText({ text: ok ? '✓' : '!' });
  chrome.action.setBadgeBackgroundColor({ color: ok ? '#6366f1' : '#ef4444' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

async function uploadUrl(url, serverUrl, apiToken) {
  if (!serverUrl || !apiToken) return { ok: false, url, error: 'Not configured' };
  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiToken}` },
      body: JSON.stringify({ url, folder: 'inbox' })
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, url, error: data.error || res.statusText };
    return { ok: true, url, filename: data.filename };
  } catch (err) {
    return { ok: false, url, error: err.message };
  }
}

async function uploadBlob(blob, serverUrl, apiToken) {
  if (!serverUrl || !apiToken) return { ok: false, error: 'Not configured' };
  try {
    const fd = new FormData();
    fd.append('images', blob, `screenshot-${Date.now()}.png`);
    fd.append('folder', 'inbox');
    const res = await fetch(`${serverUrl.replace(/\/$/, '')}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiToken}` },
      body: fd
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || res.statusText };
    const r = data.results?.[0];
    return r?.error ? { ok: false, error: r.error } : { ok: true, filename: r?.filename };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function cropImage(dataUrl, rect) {
  const blob = await dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(rect.w, rect.h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return canvas.convertToBlob({ type: 'image/png' });
}
