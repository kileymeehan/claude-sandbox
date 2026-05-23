// ── Auth ──

let supabaseClient = null;

async function initAuth() {
  const cfg = await fetch('/api/config').then(r => r.json()).catch(() => null);
  if (!cfg) return;

  supabaseClient = supabase.createClient(cfg.url, cfg.anonKey);

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('user-section').style.display = '';
      profileUser = session.user;
      updateProfileDisplay();
      if (event === 'SIGNED_IN') loadData();
    } else {
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('user-section').style.display = 'none';
    }
  });

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('user-section').style.display = '';
    profileUser = session.user;
    updateProfileDisplay();
  } else {
    document.getElementById('user-section').style.display = 'none';
  }

  document.getElementById('google-signin-btn').addEventListener('click', () => {
    supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  });

  return session;
}

async function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (supabaseClient) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  return fetch(url, { ...options, headers });
}

// State
let images = [];
let tags = {};
let folders = {};
let folderFilter = 'all';
let tagFilter = null;
let searchQuery = '';
let lightboxIndex = -1;
let viewMode = localStorage.getItem('inspo-view') || 'grid-small';
let uploadFolder = 'inbox';
let selectMode = false;
let selectedIds = new Set();

const KNOWN_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc', 'inbox'];

const FALLBACK_COLORS = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#6366f1','#14b8a6','#f97316','#ef4444','#06b6d4'];

function folderLabel(id) {
  return folders[id]?.name || id;
}

function folderColor(id) {
  return folders[id]?.color || '#888';
}

// ── Data ──

async function loadData() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  try {
    const [imgData, tagData, folderData] = await Promise.all([
      apiFetch('/api/images').then(r => r.json()),
      apiFetch('/api/tags').then(r => r.json()),
      apiFetch('/api/folders').then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ]);
    images = imgData;
    tags = tagData;
    folders = folderData;
    renderUploadFolderPicker();
    renderAll();
  } catch (err) {
    console.error('Failed to load data:', err);
  } finally {
    btn.classList.remove('spinning');
  }
}

async function saveTags(id, newTags) {
  tags[id] = newTags.length ? newTags : undefined;
  if (!newTags.length) delete tags[id];
  await apiFetch('/api/tags', {
    method: 'POST',
    body: JSON.stringify({ id, tags: newTags })
  });
  renderSidebar();
  renderGallery();
}

// ── Filtering ──

function getFiltered() {
  const q = searchQuery.toLowerCase();
  return images.filter(img => {
    if (folderFilter !== 'all' && img.folder !== folderFilter) return false;
    if (tagFilter) {
      const imgTags = tags[img.id] || [];
      if (!imgTags.includes(tagFilter)) return false;
    }
    if (q && !img.filename.toLowerCase().includes(q)) return false;
    return true;
  });
}

function getAllTags() {
  const set = new Set();
  Object.values(tags).forEach(list => list.forEach(t => set.add(t)));
  return [...set].sort();
}

function getFolderCounts() {
  const counts = {};
  images.forEach(img => {
    counts[img.folder] = (counts[img.folder] || 0) + 1;
  });
  return counts;
}

function downloadUrl(img) {
  return img.url;
}

// ── Render ──

function renderAll() {
  renderSidebar();
  renderGallery();
}

function renderSidebar() {
  const folderNav = document.getElementById('folder-nav');
  const tagNav = document.getElementById('tag-nav');
  const tagSection = document.getElementById('tag-nav-section');
  const counts = getFolderCounts();

  const knownOrder = KNOWN_FOLDERS.filter(f => counts[f]);
  const customOrder = Object.keys(counts).filter(f => !KNOWN_FOLDERS.includes(f) && f !== 'root');
  const orderedFolders = [...knownOrder, ...customOrder, ...Object.keys(counts).filter(f => f === 'root')];

  const allActive = folderFilter === 'all' ? 'active' : '';
  let folderHTML = `<button class="nav-item ${allActive}" data-folder="all">
    <span class="nav-label">All</span>
    <span class="nav-count">${images.length}</span>
  </button>`;

  orderedFolders.forEach(folder => {
    const count = counts[folder] || 0;
    if (!count) return;
    const active = folderFilter === folder ? 'active' : '';
    const label = folderLabel(folder);
    const color = folderColor(folder);
    folderHTML += `<button class="nav-item ${active}" data-folder="${folder}">
      <svg class="nav-folder-icon" width="13" height="12" viewBox="0 0 24 22" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="nav-label">${label}</span>
      <span class="nav-count">${count}</span>
    </button>`;
  });

  folderNav.innerHTML = folderHTML;
  folderNav.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      folderFilter = btn.dataset.folder;
      tagFilter = null;
      renderAll();
    });
  });

  const allTagsList = getAllTags();
  if (!allTagsList.length) {
    tagSection.style.display = 'none';
    return;
  }

  tagSection.style.display = 'block';
  tagNav.innerHTML = allTagsList.map(tag => {
    const active = tagFilter === tag ? 'active' : '';
    return `<button class="nav-item tag-item ${active}" data-tag="${escHtml(tag)}">
      <span class="tag-hash">#</span>
      <span class="nav-label">${escHtml(tag)}</span>
    </button>`;
  }).join('');

  tagNav.querySelectorAll('.tag-item').forEach(btn => {
    btn.addEventListener('click', () => {
      tagFilter = tagFilter === btn.dataset.tag ? null : btn.dataset.tag;
      if (tagFilter) folderFilter = 'all';
      renderAll();
    });
  });
}

function applyViewMode() {
  const gallery = document.getElementById('gallery');
  gallery.className = `view-${viewMode}`;
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewMode);
  });
}

function renderGallery() {
  const gallery = document.getElementById('gallery');
  const countEl = document.getElementById('image-count');
  const emptyEl = document.getElementById('empty-state');
  const filtered = getFiltered();
  applyViewMode();

  countEl.textContent = `${filtered.length} image${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    gallery.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  gallery.innerHTML = filtered.map((img, i) => {
    const imgTags = tags[img.id] || [];
    const color = folderColor(img.folder);
    const label = folderLabel(img.folder);
    const dl = downloadUrl(img);
    const isSelected = selectedIds.has(img.id);
    return `<div class="card${isSelected ? ' card-selected' : ''}" data-index="${i}" data-id="${img.id}">
      <div class="card-image-wrap">
        <img class="card-img" src="${img.url}" alt="${escAttr(img.filename)}" loading="lazy">
        <div class="card-overlay">
          <a class="card-download" href="${dl}" download="${escAttr(img.filename)}" title="Download" data-dl>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3"/><path d="M8 11l4 4 4-4"/><path d="M20 21H4"/></svg>
          </a>
        </div>
        ${img.comments?.length ? `<div class="card-comment-dot" title="${img.comments.length} comment${img.comments.length !== 1 ? 's' : ''}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${img.comments.length > 1 ? `<span>${img.comments.length}</span>` : ''}</div>` : ''}
        <div class="card-checkbox ${isSelected ? 'checked' : ''}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div class="card-info">
        <div class="card-filename" title="${escAttr(img.filename)}">${escHtml(img.filename)}</div>
        <span class="folder-badge" style="--badge-color:${color}">${label}</span>
        ${imgTags.length ? `<div class="card-tags">${imgTags.map(t => `<span class="tag-pill">${escHtml(t)}</span>`).join('')}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  gallery.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-dl]')) return;
      if (selectMode) {
        const id = card.dataset.id;
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        renderGallery();
        renderBulkBar();
        return;
      }
      openLightbox(parseInt(card.dataset.index));
    });
  });
}

// ── Lightbox ──

function openLightbox(index) {
  lightboxIndex = index;
  document.getElementById('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  renderLightbox();
  document.getElementById('lb-img').focus();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.body.style.overflow = '';
  lightboxIndex = -1;
}

function navigateLightbox(dir) {
  const filtered = getFiltered();
  if (!filtered.length) return;
  lightboxIndex = (lightboxIndex + dir + filtered.length) % filtered.length;
  renderLightbox();
}

function renderLightbox() {
  const filtered = getFiltered();
  if (!filtered.length || lightboxIndex < 0) return;
  const img = filtered[lightboxIndex];
  const imgTags = tags[img.id] || [];
  const color = folderColor(img.folder);
  const label = folderLabel(img.folder);

  document.getElementById('lb-img').src = img.url;
  document.getElementById('lb-img').alt = img.filename;
  document.getElementById('lb-filename').textContent = img.filename;

  const otherFolders = Object.entries(folders).filter(([id]) => id !== img.folder);
  document.getElementById('lb-folder-badge-wrap').innerHTML =
    `<div class="lb-folder-section">
      <span class="folder-badge" style="--badge-color:${color}">${label}</span>
      <button class="lb-move-toggle" id="lb-move-toggle">Move to…</button>
    </div>
    <div id="lb-folder-picker" class="lb-folder-picker hidden">
      ${otherFolders.map(([id, f]) =>
        `<button class="lb-folder-opt" data-folder="${id}">
          <svg width="12" height="11" viewBox="0 0 24 22" fill="none" stroke="${f.color}" stroke-width="2" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          ${escHtml(f.name)}
        </button>`
      ).join('')}
      <div class="lb-folder-divider"></div>
      <button class="lb-folder-opt lb-new-folder-trigger" id="lb-new-folder-trigger">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New folder…
      </button>
      <div class="lb-inline-new-folder hidden" id="lb-inline-new-folder">
        <input id="lb-inline-folder-input" class="lb-inline-folder-input" type="text" placeholder="Folder name, press Enter…" autocomplete="off" spellcheck="false">
      </div>
    </div>`;

  document.getElementById('lb-move-toggle')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('lb-folder-picker').classList.toggle('hidden');
  });

  document.querySelectorAll('.lb-folder-opt:not(.lb-new-folder-trigger)').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.folder) await moveImage(img.id, btn.dataset.folder);
    });
  });

  document.getElementById('lb-new-folder-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    const inline = document.getElementById('lb-inline-new-folder');
    inline.classList.toggle('hidden');
    if (!inline.classList.contains('hidden')) document.getElementById('lb-inline-folder-input')?.focus();
  });

  const inlineInput = document.getElementById('lb-inline-folder-input');
  inlineInput?.addEventListener('click', e => e.stopPropagation());
  inlineInput?.addEventListener('keydown', async e => {
    e.stopPropagation();
    if (e.key === 'Escape') { document.getElementById('lb-inline-new-folder').classList.add('hidden'); return; }
    if (e.key !== 'Enter') return;
    const name = inlineInput.value.trim();
    if (!name) return;
    const res = await apiFetch('/api/folders', { method: 'POST', body: JSON.stringify({ name }) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); showToast(err.error || 'Failed'); return; }
    const folder = await res.json();
    folders[folder.id] = { name: folder.name, color: folder.color };
    await moveImage(img.id, folder.id);
  });
  document.getElementById('lb-counter').textContent =
    `${lightboxIndex + 1} of ${filtered.length}`;

  const lbTags = document.getElementById('lb-tags');
  lbTags.innerHTML = imgTags.map(tag =>
    `<span class="tag-pill" data-tag="${escAttr(tag)}">${escHtml(tag)}<button class="tag-remove" data-tag="${escAttr(tag)}" title="Remove tag">×</button></span>`
  ).join('');

  lbTags.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const newTags = (tags[img.id] || []).filter(t => t !== btn.dataset.tag);
      await saveTags(img.id, newTags);
      renderLightbox();
    });
  });

  const dl = downloadUrl(img);
  const dlLink = document.getElementById('lb-download');
  dlLink.href = dl;
  dlLink.download = img.filename;

  renderComments(img);

  const singleImage = filtered.length === 1;
  document.getElementById('lb-prev').style.visibility = singleImage ? 'hidden' : '';
  document.getElementById('lb-next').style.visibility = singleImage ? 'hidden' : '';

  const deleteBtn = document.getElementById('lb-delete-btn');
  deleteBtn.onclick = async () => {
    if (!confirm(`Delete "${img.filename}"? This cannot be undone.`)) return;
    const res = await apiFetch(`/api/images/${encodeURIComponent(img.id)}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error || 'Delete failed'); return; }
    closeLightbox();
    images = images.filter(i => i.id !== img.id);
    showToast(`Deleted "${img.filename}".`);
    renderAll();
  };
}

// ── Comments ──

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  const opts = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function renderComments(img) {
  const comments = img.comments || [];
  const list = document.getElementById('lb-comments-list');
  if (!list) return;

  list.innerHTML = comments.map(c => {
    const isEmoji = c.avatar && /\p{Emoji}/u.test(c.avatar);
    const avatarContent = isEmoji ? c.avatar : (c.name?.[0]?.toUpperCase() || '?');
    return `<div class="lb-comment" data-id="${escAttr(c.id)}">
      <div class="lb-comment-avatar">${escHtml(avatarContent)}</div>
      <div class="lb-comment-body">
        <div class="lb-comment-meta">
          <span class="lb-comment-name">${escHtml(c.name)}</span>
          <span class="lb-comment-time">${escHtml(formatTime(c.timestamp))}</span>
          <button class="lb-comment-delete" data-cid="${escAttr(c.id)}" title="Delete">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="lb-comment-text">${escHtml(c.text)}</div>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('.lb-comment-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cid = btn.dataset.cid;
      await apiFetch(`/api/images/${encodeURIComponent(img.id)}/comment/${cid}`, { method: 'DELETE' });
      img.comments = (img.comments || []).filter(c => c.id !== cid);
      renderComments(img);
      renderGallery();
    });
  });

  const selfAvatar = localStorage.getItem('inspo-avatar') || '';
  const fallbackName = profileUser?.user_metadata?.full_name || profileUser?.email?.split('@')[0] || 'You';
  const selfName = localStorage.getItem('inspo-display-name') || fallbackName;
  const isEmoji = selfAvatar && /\p{Emoji}/u.test(selfAvatar);
  const selfAvatarEl = document.getElementById('lb-comment-self-avatar');
  if (selfAvatarEl) selfAvatarEl.textContent = isEmoji ? selfAvatar : (selfName[0]?.toUpperCase() || '?');

  const input = document.getElementById('lb-comment-input');
  if (!input) return;
  input.onkeydown = async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const res = await apiFetch(`/api/images/${encodeURIComponent(img.id)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text, avatar: selfAvatar, name: selfName })
    });
    if (!res.ok) return;
    const comment = await res.json();
    img.comments = [...(img.comments || []), comment];
    input.value = '';
    renderComments(img);
    renderGallery();
    list.scrollTop = list.scrollHeight;
  };
}

// ── Tag input with autocomplete ──

function initTagInput() {
  const input = document.getElementById('lb-tag-input');
  const list = document.getElementById('lb-tag-suggestions');
  let activeIdx = -1;

  function getSuggestions(query) {
    const filtered = getFiltered();
    const img = filtered[lightboxIndex];
    const current = img ? (tags[img.id] || []) : [];
    if (!query) return [];
    return getAllTags()
      .filter(t => t.includes(query) && !current.includes(t))
      .slice(0, 8);
  }

  function renderSuggestions(items) {
    activeIdx = -1;
    list.innerHTML = items.map((t, i) =>
      `<li data-tag="${escAttr(t)}"><span class="sug-hash">#</span>${escHtml(t)}</li>`
    ).join('');
    list.querySelectorAll('li').forEach(li => {
      li.addEventListener('mousedown', e => {
        e.preventDefault(); // keep input focused
        applyTag(li.dataset.tag);
      });
    });
  }

  function clearSuggestions() {
    list.innerHTML = '';
    activeIdx = -1;
  }

  async function applyTag(val) {
    const filtered = getFiltered();
    const img = filtered[lightboxIndex];
    if (!img) return;
    const current = tags[img.id] || [];
    if (!current.includes(val)) {
      await saveTags(img.id, [...current, val]);
      renderLightbox();
    }
    input.value = '';
    clearSuggestions();
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase().replace(/\s+/g, '-');
    renderSuggestions(getSuggestions(q));
  });

  input.addEventListener('keydown', async e => {
    const items = list.querySelectorAll('li');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      items.forEach((li, i) => li.classList.toggle('active', i === activeIdx));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, -1);
      items.forEach((li, i) => li.classList.toggle('active', i === activeIdx));
      return;
    }
    if (e.key === 'Escape') {
      clearSuggestions();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIdx >= 0 && items[activeIdx]) {
        applyTag(items[activeIdx].dataset.tag);
      } else {
        const val = input.value.trim().toLowerCase().replace(/\s+/g, '-');
        if (val) applyTag(val);
      }
    }
  });

  input.addEventListener('blur', () => {
    // slight delay so mousedown on a suggestion fires first
    setTimeout(clearSuggestions, 150);
  });
}

// ── Helpers ──

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Select & bulk delete ──

function renderBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const n = selectedIds.size;
  bar.classList.toggle('hidden', n === 0);
  document.getElementById('bulk-count').textContent = `${n} selected`;
}

function toggleSelectMode(on) {
  selectMode = on !== undefined ? on : !selectMode;
  if (!selectMode) { selectedIds.clear(); renderBulkBar(); }
  document.getElementById('select-btn').classList.toggle('active', selectMode);
  document.body.classList.toggle('select-mode', selectMode);
  renderGallery();
}

async function bulkDelete() {
  const ids = [...selectedIds];
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} image${ids.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
  const res = await apiFetch('/api/images/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); showToast(e.error || 'Delete failed'); return; }
  const data = await res.json();
  showToast(`Deleted ${data.deleted} image${data.deleted !== 1 ? 's' : ''}.`);
  images = images.filter(img => !ids.includes(img.id));
  selectedIds.clear();
  toggleSelectMode(false);
  renderAll();
}

function initSelectMode() {
  document.getElementById('select-btn').addEventListener('click', () => toggleSelectMode());
  document.getElementById('bulk-cancel').addEventListener('click', () => toggleSelectMode(false));
  document.getElementById('bulk-delete-btn').addEventListener('click', bulkDelete);
  document.getElementById('bulk-select-all').addEventListener('click', () => {
    const filtered = getFiltered();
    if (selectedIds.size === filtered.length) {
      selectedIds.clear();
    } else {
      filtered.forEach(img => selectedIds.add(img.id));
    }
    renderGallery();
    renderBulkBar();
  });
}

// ── View toggle ──

function initViewToggle() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      localStorage.setItem('inspo-view', viewMode);
      applyViewMode();
    });
  });
  applyViewMode();
}

// ── Sync inbox ──

function showToast(msg) {
  const toast = document.getElementById('sync-toast');
  document.getElementById('sync-toast-msg').innerHTML = msg;
  toast.classList.remove('hidden');
}

function hideToast() {
  document.getElementById('sync-toast').classList.add('hidden');
}

async function syncInbox() {
  showToast('Scanning inbox…');

  let count = 0;
  let errors = 0;
  const results = [];

  try {
    const resp = await fetch('/api/sync-inbox', { method: 'POST' });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      showToast(`Sync failed: ${err.error}`);
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        const item = JSON.parse(line);
        if (item.error) { errors++; continue; }
        if (item.skipped) continue;
        if (item.message) { showToast(item.message); continue; }
        count++;
        results.push(item);
        showToast(`Processed ${count} image${count !== 1 ? 's' : ''}… <span style="color:var(--text-muted)">${item.file}</span>`);
      }
    }

    if (count === 0 && errors === 0) {
      showToast('No new images in inbox.');
    } else {
      const summary = results.map(r =>
        `<span style="color:var(--text-muted)">${r.file}</span> → <strong>${r.destFolder}</strong>`
      ).join('<br>');
      showToast(`Moved ${count} image${count !== 1 ? 's' : ''}:<br>${summary}`);
      await loadData();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

function initSync() {
  document.getElementById('sync-btn')?.addEventListener('click', syncInbox);
  document.getElementById('sync-toast-close').addEventListener('click', hideToast);
}

// ── Upload ──

async function uploadFiles(files) {
  if (!files.length) return;
  const zone = document.getElementById('drop-zone');
  zone.style.pointerEvents = 'none';
  zone.style.opacity = '0.5';
  const destLabel = folderLabel(uploadFolder);
  showToast(`Uploading ${files.length} file${files.length !== 1 ? 's' : ''} to ${destLabel}…`);

  const fd = new FormData();
  for (const file of files) fd.append('images', file);
  fd.append('folder', uploadFolder);

  try {
    const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      showToast(`Upload failed: ${data.error || res.statusText}`);
      return;
    }
    const ok = (data.results || []).filter(r => !r.error).length;
    const fail = (data.results || []).filter(r => r.error).length;
    showToast(`Uploaded ${ok} image${ok !== 1 ? 's' : ''} to ${destLabel}${fail ? ` (${fail} failed)` : ''}.`);
    await loadData();
  } catch (err) {
    showToast(`Upload failed: ${err.message}`);
  } finally {
    zone.style.pointerEvents = '';
    zone.style.opacity = '';
  }
}

function initUpload() {
  const input = document.getElementById('upload-input');
  const zone = document.getElementById('drop-zone');

  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length) {
      uploadFiles([...input.files]);
      input.value = '';
    }
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-active');
  });
  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-active');
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-active');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files);
  });
}

// ── Folders ──

async function moveImage(imageId, folder) {
  const res = await apiFetch(`/api/images/${encodeURIComponent(imageId)}/move`, {
    method: 'POST',
    body: JSON.stringify({ folder })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    showToast(`Move failed: ${err.error || 'unknown error'}`);
    return;
  }
  closeLightbox();
  await loadData();
}

function renderUploadFolderPicker() {
  const picker = document.getElementById('upload-folder-picker');
  const label = document.getElementById('upload-folder-label');
  if (!picker || !label) return;
  if (!folders[uploadFolder]) uploadFolder = 'inbox';
  label.textContent = folderLabel(uploadFolder);
  picker.innerHTML = Object.entries(folders).map(([id, f]) =>
    `<button class="upload-folder-opt${id === uploadFolder ? ' selected' : ''}" data-folder="${id}">
      <span class="folder-dot" style="background:${f.color}"></span>
      ${escHtml(f.name)}
    </button>`
  ).join('');
  picker.querySelectorAll('.upload-folder-opt').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      uploadFolder = btn.dataset.folder;
      label.textContent = folderLabel(uploadFolder);
      picker.classList.add('hidden');
    });
  });
}

function initFolderModal() {
  const modal = document.getElementById('folder-modal');
  const input = document.getElementById('folder-modal-input');

  document.getElementById('new-folder-btn').addEventListener('click', () => {
    modal.classList.remove('hidden');
    input.value = '';
    input.focus();
  });

  async function submit() {
    const name = input.value.trim();
    if (!name) return;
    const res = await apiFetch('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    if (!res.ok) { const e = await res.json(); showToast(e.error); return; }
    const folder = await res.json();
    folders[folder.id] = { name: folder.name, color: folder.color };
    modal.classList.add('hidden');
    renderUploadFolderPicker();
    renderSidebar();
  }

  document.getElementById('folder-modal-create').addEventListener('click', submit);
  document.getElementById('folder-modal-cancel').addEventListener('click', () => modal.classList.add('hidden'));
  document.getElementById('folder-modal-overlay').addEventListener('click', () => modal.classList.add('hidden'));
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') modal.classList.add('hidden');
  });

  // Upload folder button
  const uploadBtn = document.getElementById('upload-folder-btn');
  const picker = document.getElementById('upload-folder-picker');
  uploadBtn.addEventListener('click', e => {
    e.stopPropagation();
    picker.classList.toggle('hidden');
  });
  document.addEventListener('click', e => {
    if (!uploadBtn.contains(e.target) && !picker.contains(e.target)) {
      picker.classList.add('hidden');
    }
  });
}

// ── User Profile ──

let profileUser = null;

function updateProfileDisplay() {
  if (!profileUser) return;
  const savedAvatar = localStorage.getItem('inspo-avatar');
  const savedName = localStorage.getItem('inspo-display-name');
  const fallbackName = profileUser.user_metadata?.full_name || profileUser.email?.split('@')[0] || 'You';
  const displayName = savedName || fallbackName;

  const avatarEl = document.getElementById('user-avatar');
  if (savedAvatar) {
    avatarEl.textContent = savedAvatar;
    avatarEl.style.background = 'transparent';
    avatarEl.style.fontSize = '17px';
  } else {
    avatarEl.textContent = displayName[0].toUpperCase();
    avatarEl.style.background = '';
    avatarEl.style.fontSize = '';
  }

  document.getElementById('user-display-name').textContent = displayName;
  document.getElementById('user-email-label').textContent = profileUser.email || '';
  document.getElementById('profile-name-display').textContent = displayName;

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.avatar === savedAvatar);
  });
}

function initProfileUI() {
  const section = document.getElementById('user-section');
  const profile = document.getElementById('user-profile');
  const menu = document.getElementById('profile-menu');

  profile.addEventListener('click', e => {
    e.stopPropagation();
    const open = section.classList.toggle('open');
    menu.classList.toggle('hidden', !open);
  });

  document.addEventListener('click', e => {
    if (!section.contains(e.target)) {
      section.classList.remove('open');
      menu.classList.add('hidden');
    }
  });

  document.querySelectorAll('.avatar-opt').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      localStorage.setItem('inspo-avatar', btn.dataset.avatar);
      updateProfileDisplay();
    });
  });

  const nameDisplay = document.getElementById('profile-name-display');
  const nameInput = document.getElementById('profile-name-input');
  const editBtn = document.getElementById('profile-name-edit');
  const saveBtn = document.getElementById('profile-name-save');

  function startEdit() {
    nameInput.value = nameDisplay.textContent;
    nameDisplay.classList.add('hidden');
    nameInput.classList.remove('hidden');
    editBtn.classList.add('hidden');
    saveBtn.classList.remove('hidden');
    nameInput.focus();
    nameInput.select();
  }

  function saveName() {
    const val = nameInput.value.trim();
    if (val) localStorage.setItem('inspo-display-name', val);
    nameDisplay.classList.remove('hidden');
    nameInput.classList.add('hidden');
    editBtn.classList.remove('hidden');
    saveBtn.classList.add('hidden');
    updateProfileDisplay();
  }

  editBtn.addEventListener('click', e => { e.stopPropagation(); startEdit(); });
  saveBtn.addEventListener('click', e => { e.stopPropagation(); saveName(); });
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') {
      nameDisplay.classList.remove('hidden');
      nameInput.classList.add('hidden');
      editBtn.classList.remove('hidden');
      saveBtn.classList.add('hidden');
    }
  });
  nameInput.addEventListener('click', e => e.stopPropagation());
  nameInput.addEventListener('keydown', e => e.stopPropagation());

  document.getElementById('profile-signout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
  });
}

// ── Theme ──

function applyTheme(light) {
  document.body.classList.toggle('light', light);
  document.getElementById('theme-icon-dark').style.display = light ? 'none' : '';
  document.getElementById('theme-icon-light').style.display = light ? '' : 'none';
}

function initTheme() {
  const saved = localStorage.getItem('inspo-theme');
  const light = saved ? saved === 'light' : false;
  applyTheme(light);
  document.getElementById('theme-btn').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    localStorage.setItem('inspo-theme', isLight ? 'light' : 'dark');
    applyTheme(isLight);
  });
}

// ── Init ──

async function init() {
  document.getElementById('lb-overlay').addEventListener('click', closeLightbox);
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lb-next').addEventListener('click', () => navigateLightbox(1));
  document.getElementById('refresh-btn').addEventListener('click', loadData);
  initTheme();
  initViewToggle();
  initSelectMode();
  initFolderModal();
  initProfileUI();
  initSync();
  initUpload();

  document.getElementById('search').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderGallery();
  });

  document.addEventListener('keydown', e => {
    if (!document.getElementById('lightbox').classList.contains('hidden')) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
      return;
    }
    if (e.key === 'Escape' && selectMode) toggleSelectMode(false);
  });

  initTagInput();
  const session = await initAuth();
  if (session) loadData();
}

document.addEventListener('DOMContentLoaded', init);
