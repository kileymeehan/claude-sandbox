const grid = document.getElementById('grid');
const search = document.getElementById('search');
const summary = document.getElementById('summary');
const toastEl = document.getElementById('toast');

let projects = [];
let sort = localStorage.getItem('launchpad.sort') || 'recent';
const rendered = new Map(); // id -> { el, html }
const busy = new Set();     // ids with an action in flight

// ---------- data ----------

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function load(refresh) {
  try {
    projects = await api('/api/projects' + (refresh ? '?refresh' : ''));
    render();
  } catch {
    summary.textContent = 'Lost connection to the Launchpad server';
  }
}

// ---------- helpers ----------

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function ago(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const days = Math.floor((startOfDay(new Date()) - startOfDay(d)) / 864e5);
  if (days <= 0) {
    const mins = Math.round((Date.now() - ms) / 6e4);
    if (mins < 2) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    return `${Math.round(mins / 60)} hr ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} wk ago`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const PALETTE = ['#c4583a', '#2f6f62', '#3b5b92', '#8a5a2b', '#6b4f8a', '#4f7a3a', '#a2445e', '#2d6d8c', '#7a6a2a'];
function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function initials(title) {
  const words = title.replace(/[^\p{L}\p{N}& ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : title[0]).toUpperCase();
}

const localUrl = p => `http://localhost:${p.port}${p.path || '/'}`;

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 3200);
}

// ---------- render ----------

const STATE_LABEL = { running: 'Running', starting: 'Starting…', crashed: 'Crashed', stopped: 'Stopped' };

function cardHtml(p) {
  const running = p.state === 'running';
  const isBusy = busy.has(p.id);
  const href = running ? localUrl(p) : p.railway || '';
  const thumb = p.thumbnail
    ? `<img src="${esc(p.thumbnail)}" alt="" loading="lazy">`
    : `<div class="placeholder" style="background:${colorFor(p.id)}">${esc(initials(p.title))}<small>no thumbnail yet</small></div>`;

  const runBtn = running || p.state === 'starting'
    ? `<button class="btn-stop" data-act="stop"><svg viewBox="0 0 10 10"><rect width="10" height="10" rx="2"/></svg>Stop</button>`
    : `<button class="btn-run" data-act="start" ${isBusy ? 'disabled' : ''}><svg viewBox="0 0 10 10"><path d="M1 0.5v9l8.5-4.5z"/></svg>${p.state === 'crashed' ? 'Retry' : 'Run'}</button>`;

  return `
    <div class="thumb" ${href ? `data-href="${esc(href)}" title="Open ${esc(href)}"` : ''}>
      ${thumb}
      <span class="pill ${p.state}">${STATE_LABEL[p.state]}${p.port ? ` · :${p.port}` : ''}</span>
    </div>
    <div class="body">
      <div class="titlerow">
        <h2 class="title">${esc(p.title)}</h2>
        <span class="when" title="Last edited ${esc(new Date(p.lastModified).toLocaleString())}">${ago(p.lastModified)}</span>
      </div>
      <p class="desc">${esc(p.description || p.dir.split('/').pop())}</p>
      <div class="tags">${p.stack.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </div>
    <div class="links">
      ${runBtn}
      <a class="link ${running ? '' : 'off'}" href="${esc(localUrl(p))}" target="_blank" rel="noopener" title="${esc(localUrl(p))}">localhost ↗</a>
      ${p.railway ? `<a class="link rail" href="${esc(p.railway)}" target="_blank" rel="noopener" title="${esc(p.railway)}">Railway ↗</a>` : ''}
      <span class="spacer"></span>
      <div class="more">
        <button data-act="menu" aria-label="More actions" aria-haspopup="menu">⋯</button>
      </div>
    </div>`;
}

function sorted(list) {
  const order = { running: 0, starting: 1, crashed: 2, stopped: 3 };
  const byRecent = (a, b) => b.lastModified - a.lastModified;
  if (sort === 'name') return [...list].sort((a, b) => a.title.localeCompare(b.title));
  if (sort === 'running') return [...list].sort((a, b) => order[a.state] - order[b.state] || byRecent(a, b));
  return [...list].sort(byRecent);
}

function render() {
  const q = search.value.trim().toLowerCase();
  const visible = sorted(projects).filter(p =>
    !q || [p.title, p.description, p.id, p.notes, ...p.stack].join(' ').toLowerCase().includes(q));

  const running = projects.filter(p => p.state === 'running').length;
  summary.textContent = `${projects.length} projects · ${running} running`;

  // Patch cards in place so polling doesn't close menus or flash images.
  const seen = new Set();
  visible.forEach((p, i) => {
    seen.add(p.id);
    const html = cardHtml(p);
    let r = rendered.get(p.id);
    if (!r) {
      const el = document.createElement('article');
      el.className = 'card';
      el.dataset.id = p.id;
      r = { el, html: null };
      rendered.set(p.id, r);
    }
    if (r.html !== html && !r.el.querySelector('.menu')) {
      r.el.innerHTML = html;
      r.html = html;
    }
    if (grid.children[i] !== r.el) grid.insertBefore(r.el, grid.children[i] || null);
  });
  for (const [id, r] of rendered) if (!seen.has(id)) { r.el.remove(); rendered.delete(id); }

  let empty = grid.querySelector('.empty');
  if (!visible.length && !empty) {
    empty = document.createElement('p');
    empty.className = 'empty';
    grid.append(empty);
  }
  if (empty) visible.length ? empty.remove() : (empty.textContent = q ? `Nothing matches “${search.value}”` : 'No projects found');
}

// ---------- actions ----------

async function act(p, action) {
  const base = `/api/projects/${encodeURIComponent(p.id)}`;
  try {
    if (action === 'start') {
      busy.add(p.id); render();
      await api(`${base}/start`, { method: 'POST' });
      p.state = 'starting'; render();
      watchStart(p);
    } else if (action === 'stop') {
      await api(`${base}/stop`, { method: 'POST' });
      toast(`Stopping ${p.title}`);
      setTimeout(load, 800);
    } else if (action === 'capture') {
      toast(`Capturing ${p.title}…`);
      await api(`${base}/capture`, { method: 'POST' });
      toast(`Thumbnail updated`);
      load();
    } else if (action === 'reveal') {
      await api(`${base}/reveal`, { method: 'POST' });
    } else if (action === 'logs') {
      openLogs(p);
    } else if (action === 'edit') {
      openEdit(p);
    } else if (action === 'copy') {
      await navigator.clipboard.writeText(p.dir);
      toast('Path copied');
    }
  } catch (err) {
    toast(err.message);
  } finally {
    busy.delete(p.id);
  }
}

// Poll quickly after a start so the card flips to Running promptly,
// and grab a first thumbnail automatically if there isn't one yet.
async function watchStart(p) {
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, 1000));
    await load();
    const now = projects.find(x => x.id === p.id);
    if (!now || now.state === 'stopped') return;
    if (now.state === 'crashed') return toast(`${now.title} crashed — open Logs from the ⋯ menu`);
    if (now.state === 'running') {
      if (!now.thumbnail) act(now, 'capture');
      return;
    }
  }
}

function openMenu(card, p) {
  closeMenus();
  const wrap = card.querySelector('.more');
  const menu = document.createElement('div');
  menu.className = 'menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button data-act="capture">${p.thumbnail ? 'Retake thumbnail' : 'Capture thumbnail'}</button>
    <button data-act="logs" ${p.hasLogs ? '' : 'disabled style="opacity:.4"'}>View logs</button>
    <hr>
    <button data-act="reveal">Reveal in Finder</button>
    <button data-act="copy">Copy folder path</button>
    <hr>
    <button data-act="edit">Edit details…</button>`;
  wrap.append(menu);
}
function closeMenus() {
  document.querySelectorAll('.menu').forEach(m => m.remove());
}

grid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const p = projects.find(x => x.id === card.dataset.id);
  const btn = e.target.closest('[data-act]');
  if (btn) {
    e.preventDefault();
    const action = btn.dataset.act;
    if (action === 'menu') {
      const open = card.querySelector('.menu');
      open ? closeMenus() : openMenu(card, p);
      return;
    }
    closeMenus();
    if (!btn.disabled) act(p, action);
    return;
  }
  const thumb = e.target.closest('.thumb[data-href]');
  if (thumb) window.open(thumb.dataset.href, '_blank', 'noopener');
});
document.addEventListener('click', e => { if (!e.target.closest('.more')) closeMenus(); });

// ---------- edit dialog ----------

const editDialog = document.getElementById('editDialog');
const editForm = document.getElementById('editForm');
let editing = null;

function openEdit(p) {
  editing = p;
  document.getElementById('editDir').textContent = p.dir;
  for (const el of editForm.elements) if (el.name) el.value = p[el.name] ?? '';
  editDialog.showModal();
}
editDialog.addEventListener('close', async () => {
  if (editDialog.returnValue !== 'save' || !editing) return;
  const body = Object.fromEntries(new FormData(editForm));
  try {
    await api(`/api/projects/${encodeURIComponent(editing.id)}`, { method: 'PUT', body: JSON.stringify(body) });
    toast('Saved to projects.json');
    load();
  } catch (err) { toast(err.message); }
});
document.getElementById('hideBtn').addEventListener('click', async () => {
  if (!confirm(`Hide “${editing.title}” from Launchpad? You can unhide it in projects.json.`)) return;
  await api(`/api/projects/${encodeURIComponent(editing.id)}/hide`, { method: 'POST' });
  editDialog.close();
  load();
});

// ---------- logs ----------

const logDialog = document.getElementById('logDialog');
const logBody = document.getElementById('logBody');
let logTimer;
async function openLogs(p) {
  document.getElementById('logTitle').textContent = `${p.title} — logs`;
  const refresh = async () => {
    const { logs } = await api(`/api/projects/${encodeURIComponent(p.id)}/logs`);
    const atBottom = logBody.scrollTop + logBody.clientHeight >= logBody.scrollHeight - 20;
    logBody.textContent = logs.join('\n') || 'No output yet.';
    if (atBottom) logBody.scrollTop = logBody.scrollHeight;
  };
  await refresh();
  logDialog.showModal();
  logBody.scrollTop = logBody.scrollHeight;
  logTimer = setInterval(refresh, 1500);
}
logDialog.addEventListener('close', () => clearInterval(logTimer));

// ---------- controls ----------

document.querySelectorAll('.seg button').forEach(b => {
  b.classList.toggle('on', b.dataset.sort === sort);
  b.addEventListener('click', () => {
    sort = b.dataset.sort;
    localStorage.setItem('launchpad.sort', sort);
    document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
});
search.addEventListener('input', render);
document.getElementById('refresh').addEventListener('click', async () => { await load(true); toast('Rescanned'); });
document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== search && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    search.focus();
  }
  if (e.key === 'Escape') { closeMenus(); if (document.activeElement === search) search.blur(); }
});

load();
setInterval(() => { if (!document.hidden) load(); }, 4000);
