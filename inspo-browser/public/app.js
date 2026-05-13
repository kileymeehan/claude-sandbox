// State
let images = [];
let tags = {};
let folderFilter = 'all';
let tagFilter = null;
let searchQuery = '';
let lightboxIndex = -1; // index into getFiltered()
let viewMode = localStorage.getItem('inspo-view') || 'grid-small';
let projects = {}; // { id: { name, created, images[] } }
let projectFilter = null;
let projectModalCallback = null; // called with new project id after creation

const KNOWN_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc', 'inbox'];

const FOLDER_LABELS = {
  all: 'All',
  components: 'Components',
  layouts: 'Layouts',
  typography: 'Typography',
  motion: 'Motion',
  color: 'Color',
  'empty-states': 'Empty States',
  misc: 'Misc',
  inbox: 'Inbox',
  root: 'Ungrouped'
};

const FOLDER_COLORS = {
  components: '#3b82f6',
  layouts: '#10b981',
  typography: '#f59e0b',
  motion: '#a855f7',
  color: '#ec4899',
  'empty-states': '#6366f1',
  misc: '#14b8a6',
  inbox: '#f97316',
  root: '#6b7280'
};

// ── Data ──

async function loadData() {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  try {
    const [imgData, tagData, projData] = await Promise.all([
      fetch('/api/images').then(r => r.json()),
      fetch('/api/tags').then(r => r.json()),
      fetch('/api/projects').then(r => r.ok ? r.json() : {}).catch(() => ({}))
    ]);
    images = imgData;
    tags = tagData;
    projects = projData;
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
  await fetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    if (projectFilter) {
      const proj = projects[projectFilter];
      if (!proj || !(proj.images || []).includes(img.id)) return false;
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
  const rel = img.folder === 'root' ? img.filename : `${img.folder}/${img.filename}`;
  return `/download?path=${encodeURIComponent(rel)}`;
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

  const orderedFolders = [
    ...KNOWN_FOLDERS.filter(f => counts[f]),
    ...Object.keys(counts).filter(f => f === 'root')
  ];

  const allActive = folderFilter === 'all' ? 'active' : '';
  let folderHTML = `<button class="nav-item ${allActive}" data-folder="all">
    <span class="nav-label">All</span>
    <span class="nav-count">${images.length}</span>
  </button>`;

  orderedFolders.forEach(folder => {
    const count = counts[folder] || 0;
    if (!count) return;
    const active = folderFilter === folder ? 'active' : '';
    const label = FOLDER_LABELS[folder] || folder;
    const color = FOLDER_COLORS[folder] || '#888';
    folderHTML += `<button class="nav-item ${active}" data-folder="${folder}">
      <span class="folder-dot" style="background:${color}"></span>
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

  // Projects
  const projectNav = document.getElementById('project-nav');
  const projectList = Object.entries(projects).sort((a, b) => b[1].created - a[1].created);
  projectNav.innerHTML = projectList.map(([id, proj]) => {
    const active = projectFilter === id ? 'active' : '';
    const count = (proj.images || []).length;
    return `<div class="project-nav-item ${active}" data-id="${id}">
      <span class="nav-label">${escHtml(proj.name)}</span>
      <span class="nav-count">${count}</span>
      <div class="project-nav-actions">
        <a href="/api/projects/${id}/download" title="Download zip" data-dl-proj>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3"/><path d="M8 11l4 4 4-4"/><path d="M20 21H4"/></svg>
        </a>
        <button title="Delete project" data-delete-id="${id}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  projectNav.querySelectorAll('.project-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.closest('[data-dl-proj]') || e.target.closest('[data-delete-id]')) return;
      const id = item.dataset.id;
      projectFilter = projectFilter === id ? null : id;
      if (projectFilter) { folderFilter = 'all'; tagFilter = null; }
      renderAll();
    });
    item.querySelector('[data-delete-id]')?.addEventListener('click', async e => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.deleteId;
      if (!confirm(`Delete project "${projects[id]?.name}"?`)) return;
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      delete projects[id];
      if (projectFilter === id) projectFilter = null;
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
    const color = FOLDER_COLORS[img.folder] || '#888';
    const label = FOLDER_LABELS[img.folder] || img.folder;
    const dl = downloadUrl(img);
    return `<div class="card" data-index="${i}">
      <div class="card-image-wrap">
        <img class="card-img" src="${img.url}" alt="${escAttr(img.filename)}" loading="lazy">
        <div class="card-overlay">
          <a class="card-download" href="${dl}" download="${escAttr(img.filename)}" title="Download" data-dl>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15V3"/><path d="M8 11l4 4 4-4"/><path d="M20 21H4"/></svg>
          </a>
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
  const color = FOLDER_COLORS[img.folder] || '#888';
  const label = FOLDER_LABELS[img.folder] || img.folder;

  document.getElementById('lb-img').src = img.url;
  document.getElementById('lb-img').alt = img.filename;
  document.getElementById('lb-filename').textContent = img.filename;
  document.getElementById('lb-folder-badge-wrap').innerHTML =
    `<span class="folder-badge" style="--badge-color:${color}">${label}</span>`;
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

  // Projects
  const lbProjects = document.getElementById('lb-projects');
  const projectList = Object.entries(projects).sort((a, b) => b[1].created - a[1].created);
  lbProjects.innerHTML = projectList.map(([id, proj]) => {
    const assigned = (proj.images || []).includes(img.id);
    return `<div class="lb-project-row ${assigned ? 'assigned' : ''}" data-proj-id="${id}">
      <div class="lb-project-check">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <span>${escHtml(proj.name)}</span>
    </div>`;
  }).join('');

  lbProjects.querySelectorAll('.lb-project-row').forEach(row => {
    row.addEventListener('click', async () => {
      const projId = row.dataset.projId;
      await toggleImageInProject(projId, img.id);
      renderLightbox();
      renderSidebar();
    });
  });

  const dl = downloadUrl(img);
  const dlLink = document.getElementById('lb-download');
  dlLink.href = dl;
  dlLink.download = img.filename;

  const singleImage = filtered.length === 1;
  document.getElementById('lb-prev').style.visibility = singleImage ? 'hidden' : '';
  document.getElementById('lb-next').style.visibility = singleImage ? 'hidden' : '';
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

// ── Projects ──

async function toggleImageInProject(projectId, imageId) {
  const proj = projects[projectId];
  if (!proj) return;
  const imgs = proj.images || [];
  const newImgs = imgs.includes(imageId)
    ? imgs.filter(id => id !== imageId)
    : [...imgs, imageId];
  projects[projectId].images = newImgs;
  await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: projectId, images: newImgs })
  });
}

function openProjectModal(callback) {
  projectModalCallback = callback || null;
  const modal = document.getElementById('project-modal');
  const input = document.getElementById('project-modal-input');
  modal.classList.remove('hidden');
  input.value = '';
  input.focus();
}

function closeProjectModal() {
  document.getElementById('project-modal').classList.add('hidden');
  projectModalCallback = null;
}

async function createProject(name) {
  const id = `proj-${Date.now()}`;
  projects[id] = { name, created: Date.now(), images: [] };
  await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, images: [] })
  });
  return id;
}

function initProjectModal() {
  const input = document.getElementById('project-modal-input');

  async function submit() {
    const name = input.value.trim();
    if (!name) return;
    const id = await createProject(name);
    closeProjectModal();
    renderSidebar();
    if (projectModalCallback) {
      await projectModalCallback(id);
      renderLightbox();
      renderSidebar();
    }
  }

  document.getElementById('project-modal-create').addEventListener('click', submit);
  document.getElementById('project-modal-cancel').addEventListener('click', closeProjectModal);
  document.getElementById('project-modal-overlay').addEventListener('click', closeProjectModal);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') closeProjectModal();
  });

  document.getElementById('new-project-btn').addEventListener('click', () => openProjectModal(null));

  document.getElementById('lb-new-project-btn').addEventListener('click', () => {
    openProjectModal(async newId => {
      const filtered = getFiltered();
      const img = filtered[lightboxIndex];
      if (img) await toggleImageInProject(newId, img.id);
    });
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
  const btn = document.getElementById('sync-btn');
  btn.classList.add('syncing');
  btn.disabled = true;
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
  } finally {
    btn.classList.remove('syncing');
    btn.disabled = false;
  }
}

function initSync() {
  document.getElementById('sync-btn').addEventListener('click', syncInbox);
  document.getElementById('sync-toast-close').addEventListener('click', hideToast);
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

function init() {
  document.getElementById('lb-overlay').addEventListener('click', closeLightbox);
  document.getElementById('lb-close').addEventListener('click', closeLightbox);
  document.getElementById('lb-prev').addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('lb-next').addEventListener('click', () => navigateLightbox(1));
  document.getElementById('refresh-btn').addEventListener('click', loadData);
  initTheme();
  initViewToggle();
  initProjectModal();
  initSync();

  document.getElementById('search').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderGallery();
  });

  document.addEventListener('keydown', e => {
    if (document.getElementById('lightbox').classList.contains('hidden')) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigateLightbox(-1);
    if (e.key === 'ArrowRight') navigateLightbox(1);
  });

  initTagInput();
  loadData();
}

document.addEventListener('DOMContentLoaded', init);
