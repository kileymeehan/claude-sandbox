chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-inspo',
    title: 'Save to Inspo',
    contexts: ['image']
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== 'save-to-inspo') return;
  const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  if (!serverUrl || !apiToken) {
    chrome.action.openPopup();
    return;
  }
  const result = await uploadUrl(info.srcUrl, serverUrl, apiToken);
  chrome.action.setBadgeText({ text: result.ok ? '✓' : '!' });
  chrome.action.setBadgeBackgroundColor({ color: result.ok ? '#6366f1' : '#ef4444' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'upload-urls') {
    (async () => {
      const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
      const results = await Promise.all(msg.urls.map(url => uploadUrl(url, serverUrl, apiToken)));
      sendResponse({ results });
    })();
    return true;
  }
});

async function uploadUrl(url, serverUrl, apiToken) {
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
