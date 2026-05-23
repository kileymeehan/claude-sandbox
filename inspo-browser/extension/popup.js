const gearBtn = document.getElementById('gear-btn');
const settingsPanel = document.getElementById('settings-panel');
const mainSection = document.getElementById('main-section');
const setupSection = document.getElementById('setup-section');
const serverUrlInput = document.getElementById('server-url');
const apiTokenInput = document.getElementById('api-token');
const saveBtn = document.getElementById('save-btn');
const pickBtn = document.getElementById('pick-btn');
const status = document.getElementById('status');

async function loadFlows() {
  const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  if (!serverUrl || !apiToken) return;
  try {
    const res = await fetch(`${serverUrl}/api/flows`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    if (!res.ok) return;
    const flows = await res.json();
    if (!flows.length) return;
    const select = document.getElementById('flow-select');
    flows.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      select.appendChild(opt);
    });
    const { selectedFlowId } = await chrome.storage.local.get(['selectedFlowId']);
    if (selectedFlowId) select.value = selectedFlowId;
    document.getElementById('flow-selector-row').style.display = 'flex';
    select.addEventListener('change', () => {
      chrome.storage.local.set({ selectedFlowId: select.value || null });
    });
  } catch {}
}

async function init() {
  const { serverUrl, apiToken } = await chrome.storage.local.get(['serverUrl', 'apiToken']);
  serverUrlInput.value = serverUrl || '';
  apiTokenInput.value = apiToken || '';

  if (serverUrl && apiToken) {
    mainSection.style.display = 'block';
    setupSection.style.display = 'none';
  } else {
    mainSection.style.display = 'none';
    setupSection.style.display = 'block';
    settingsPanel.classList.add('open');
    gearBtn.classList.add('active');
  }
}

gearBtn.addEventListener('click', () => {
  const open = settingsPanel.classList.toggle('open');
  gearBtn.classList.toggle('active', open);
});

saveBtn.addEventListener('click', async () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, '');
  const apiToken = apiTokenInput.value.trim();
  if (!serverUrl || !apiToken) { status.textContent = 'Both fields required.'; return; }

  status.textContent = 'Checking…';
  try {
    const res = await fetch(`${serverUrl}/api/config`);
    if (!res.ok) throw new Error('unreachable');
    const authRes = await fetch(`${serverUrl}/api/images`, {
      headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    if (authRes.status === 401) { status.textContent = 'Wrong API token.'; return; }
    if (!authRes.ok) throw new Error('server error');
    await chrome.storage.local.set({ serverUrl, apiToken });
    status.textContent = 'Saved!';
    mainSection.style.display = 'block';
    setupSection.style.display = 'none';
    settingsPanel.classList.remove('open');
    gearBtn.classList.remove('active');
    setTimeout(() => { status.textContent = ''; }, 1500);
  } catch (err) {
    status.textContent = 'Could not reach server.';
  }
});

pickBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  window.close();
});

document.getElementById('shot-full-btn').addEventListener('click', async () => {
  const btn = document.getElementById('shot-full-btn');
  btn.textContent = 'Capturing…';
  btn.disabled = true;
  const result = await chrome.runtime.sendMessage({ type: 'capture-full' });
  btn.textContent = result?.ok ? '✓ Saved to SwatchBook' : '✗ Upload failed';
  setTimeout(() => window.close(), 1200);
});

document.getElementById('shot-area-btn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['screenshotter.js'] });
  window.close();
});

init();
loadFlows();
