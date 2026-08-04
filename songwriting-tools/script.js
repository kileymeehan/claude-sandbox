import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://zkkyyqfvtulkgmkitewg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ljPI-6lRQVQu0pDJe7v2pw_cH5bjf9C';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const GLUE_WORDS = new Set([
  'a','an','the','in','on','at','to','of','for','with','and','or','but','so','nor','yet',
  'as','by','from','into','onto','than','then','when','while','where','who','whom','whose',
  'which','that','this','these','those','is','are','was','were','be','been','being','am',
  'do','does','did','have','has','had','will','would','shall','should','may','might','must',
  'can','could','i','you','he','she','it','we','they','me','him','her','us','them','my',
  'your','his','its','our','their','mine','yours','hers','ours','theirs','not','no','if',
  'because','about','above','after','again','against','all','any','both','down','during',
  'each','few','further','here','how','more','most','other','out','over','same','some',
  'such','there','through','under','until','up','very','what','why','off','own','too'
]);

const SCRAP_COLORS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
const TORN_VARIANTS = ['torn-1', 'torn-2', 'torn-3', 'torn-4'];

const textInput = document.getElementById('textInput');
const chopBtn = document.getElementById('chopBtn');
const inputPanel = document.getElementById('inputPanel');
const workspace = document.getElementById('workspace');
const wordBank = document.getElementById('wordBank');
const board = document.getElementById('board');
const boardEmpty = document.getElementById('boardEmpty');
const dragLayer = document.getElementById('dragLayer');
const toastEl = document.getElementById('toast');

const shuffleBtn = document.getElementById('shuffleBtn');
const clearBoardBtn = document.getElementById('clearBoardBtn');
const newTextBtn = document.getElementById('newTextBtn');
const songTitleInput = document.getElementById('songTitleInput');

const addTextBtn = document.getElementById('addTextBtn');
const addTextModal = document.getElementById('addTextModal');
const addTextModalClose = document.getElementById('addTextModalClose');
const addTextInput = document.getElementById('addTextInput');
const addTextSubmitBtn = document.getElementById('addTextSubmitBtn');

const exportBtn = document.getElementById('exportBtn');
const exportPanel = document.getElementById('exportPanel');
const exportCopyBtn = document.getElementById('exportCopyBtn');
const exportDownloadBtn = document.getElementById('exportDownloadBtn');
const exportShareBtn = document.getElementById('exportShareBtn');

const authLoggedOut = document.getElementById('authLoggedOut');
const authLoggedIn = document.getElementById('authLoggedIn');
const userEmailLabel = document.getElementById('userEmailLabel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const saveSongBtn = document.getElementById('saveSongBtn');
const mySongsBtn = document.getElementById('mySongsBtn');

const loginModal = document.getElementById('loginModal');
const loginModalClose = document.getElementById('loginModalClose');
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const loginStatus = document.getElementById('loginStatus');

const songsModal = document.getElementById('songsModal');
const songsModalClose = document.getElementById('songsModalClose');
const songsList = document.getElementById('songsList');

const themeBtn = document.getElementById('themeBtn');
const themePanel = document.getElementById('themePanel');
const themeOptions = Array.from(document.querySelectorAll('.theme-option'));

const DEFAULT_TITLE = 'Untitled Song';
const THEME_STORAGE_KEY = 'songwritingToolsTheme';
const THEME_LABELS = { default: 'Default', cbgb: 'CBGB', homespun: 'Homespun' };

let scrapId = 0;
let currentUser = null;
let currentSongId = null;
let currentSourceText = '';

// ---------- Tokenizing ----------

function tokenize(text) {
  const words = text.match(/[A-Za-z0-9']+/g) || [];
  const chunks = [];
  let buffer = [];

  const flushBuffer = () => {
    while (buffer.length) {
      const takeThree = buffer.length >= 3 && Math.random() < 0.35;
      const size = takeThree ? 3 : Math.min(2, buffer.length);
      chunks.push({ text: buffer.splice(0, size).join(' '), type: 'glue' });
    }
  };

  for (const w of words) {
    if (GLUE_WORDS.has(w.toLowerCase())) {
      buffer.push(w);
    } else {
      flushBuffer();
      chunks.push({ text: w, type: 'content' });
    }
  }
  flushBuffer();
  return chunks;
}

// ---------- Rendering ----------

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function buildScrapDescriptor(chunk) {
  const torn = TORN_VARIANTS[Math.floor(Math.random() * TORN_VARIANTS.length)];
  const colorVar = chunk.type === 'content' ? SCRAP_COLORS[Math.floor(Math.random() * SCRAP_COLORS.length)] : '';
  const hasTape = chunk.type === 'content' && Math.random() < 0.25;
  const tapeColor = hasTape ? SCRAP_COLORS[Math.floor(Math.random() * SCRAP_COLORS.length)] : '';
  return { text: chunk.text, type: chunk.type, colorVar, torn, hasTape, tapeColor, rotation: randomBetween(-7, 7) };
}

function createScrapElement(desc) {
  const el = document.createElement('div');
  el.className = `scrap ${desc.type} ${desc.torn}`;
  el.dataset.id = String(scrapId++);
  el.dataset.type = desc.type;
  el.dataset.colorVar = desc.colorVar || '';
  el.dataset.torn = desc.torn;
  el.dataset.hasTape = desc.hasTape ? '1' : '0';
  el.dataset.tapeColor = desc.tapeColor || '';
  el.dataset.rotation = String(desc.rotation);
  el.textContent = desc.text;

  if (desc.colorVar) el.style.background = `var(--${desc.colorVar})`;
  el.style.rotate = `${desc.rotation}deg`;

  if (desc.hasTape) {
    const tape = document.createElement('span');
    tape.className = 'tape-accent';
    tape.style.background = `var(--${desc.tapeColor})`;
    el.appendChild(tape);
  }

  attachDrag(el);
  return el;
}

function readScrapDescriptor(el) {
  return {
    text: el.textContent,
    type: el.dataset.type,
    colorVar: el.dataset.colorVar || '',
    torn: el.dataset.torn,
    hasTape: el.dataset.hasTape === '1',
    tapeColor: el.dataset.tapeColor || '',
    rotation: parseFloat(el.dataset.rotation),
  };
}

function chopText() {
  const text = textInput.value.trim();
  if (!text) {
    textInput.focus();
    return;
  }
  const chunks = tokenize(text);
  if (!chunks.length) {
    showToast("Couldn't find any words in there — try pasting some text.");
    return;
  }

  currentSourceText = text;
  currentSongId = null;
  songTitleInput.value = DEFAULT_TITLE;

  chunks.forEach((chunk) => {
    wordBank.appendChild(createScrapElement(buildScrapDescriptor(chunk)));
  });

  inputPanel.hidden = true;
  workspace.hidden = false;
  updateBoardEmptyState();
}

function addTextToBank(text) {
  const chunks = tokenize(text);
  if (!chunks.length) {
    showToast("Couldn't find any words in there — try pasting some text.");
    return false;
  }
  currentSourceText = currentSourceText ? `${currentSourceText}\n${text}` : text;
  chunks.forEach((chunk) => {
    wordBank.appendChild(createScrapElement(buildScrapDescriptor(chunk)));
  });
  return true;
}

function updateBoardEmptyState() {
  const hasBoardScraps = board.querySelector('.scrap') !== null;
  boardEmpty.style.display = hasBoardScraps ? 'none' : 'flex';
}

// ---------- Dragging ----------

let dragState = null;

function attachDrag(el) {
  el.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (dragState) return;
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();

  dragState = {
    el,
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
  };

  el.classList.add('dragging');
  el.style.scale = '1.08';
  el.style.rotate = '0deg';

  // Move into the drag layer, pinned at its current screen position, so it
  // can travel over anything. Movement itself is driven by `translate`
  // (compositor-only) rather than left/top, so dragging stays smooth.
  dragLayer.appendChild(el);
  el.style.position = 'fixed';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.margin = '0';
  el.style.translate = '0px 0px';

  // Track the drag on window rather than the element itself: reparenting
  // the element mid-drag can silently drop native pointer capture, which
  // would otherwise leave the drag stuck with no further move/up events.
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  e.preventDefault();
}

function onPointerMove(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const dx = e.clientX - dragState.startClientX;
  const dy = e.clientY - dragState.startClientY;
  dragState.el.style.translate = `${dx}px ${dy}px`;
}

function onPointerUp(e) {
  if (!dragState || e.pointerId !== dragState.pointerId) return;
  const { el } = dragState;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  el.classList.remove('dragging');
  el.style.scale = '1';

  const elRect = el.getBoundingClientRect();
  const centerX = elRect.left + elRect.width / 2;
  const centerY = elRect.top + elRect.height / 2;
  const boardRect = board.getBoundingClientRect();

  const droppedOnBoard =
    centerX >= boardRect.left && centerX <= boardRect.right &&
    centerY >= boardRect.top && centerY <= boardRect.bottom;

  if (droppedOnBoard) {
    const x = centerX - boardRect.left - elRect.width / 2;
    const y = centerY - boardRect.top - elRect.height / 2;
    const clampedX = Math.max(0, Math.min(x, board.clientWidth - elRect.width));
    const clampedY = Math.max(0, Math.min(y, board.clientHeight - elRect.height));

    const rot = randomBetween(-4, 4);
    el.dataset.rotation = rot.toFixed(2);

    board.appendChild(el);
    el.style.position = 'absolute';
    el.style.left = `${clampedX}px`;
    el.style.top = `${clampedY}px`;
    el.style.margin = '0';
    el.style.translate = '0px 0px';
    el.style.rotate = `${rot}deg`;
  } else {
    // Settle back into the word bank flow.
    wordBank.appendChild(el);
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.margin = '';
    el.style.translate = '0px 0px';
    el.style.rotate = `${el.dataset.rotation}deg`;
  }

  dragState = null;
  updateBoardEmptyState();
}

// ---------- Toolbar ----------

function shuffleBank() {
  const scraps = Array.from(wordBank.children);
  for (let i = scraps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [scraps[i], scraps[j]] = [scraps[j], scraps[i]];
  }
  scraps.forEach((s) => wordBank.appendChild(s));
}

function clearBoard() {
  const scraps = Array.from(board.querySelectorAll('.scrap'));
  if (!scraps.length) return;
  scraps.forEach((el) => {
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.margin = '';
    el.style.translate = '0px 0px';
    el.style.rotate = `${el.dataset.rotation}deg`;
    wordBank.appendChild(el);
  });
  updateBoardEmptyState();
}

function buildLyricsText() {
  const scraps = Array.from(board.querySelectorAll('.scrap'));
  if (!scraps.length) return null;

  const positioned = scraps.map((el) => ({
    text: el.textContent,
    x: el.offsetLeft,
    y: el.offsetTop,
    h: el.offsetHeight,
  }));

  // Group into rows by vertical position, then read each row left to right.
  positioned.sort((a, b) => a.y - b.y);
  const rows = [];
  positioned.forEach((s) => {
    const row = rows.find((r) => Math.abs(r.y - s.y) < r.h * 0.6);
    if (row) {
      row.items.push(s);
      row.y = (row.y + s.y) / 2;
    } else {
      rows.push({ y: s.y, h: s.h, items: [s] });
    }
  });

  return rows.map((row) => row.items.sort((a, b) => a.x - b.x).map((i) => i.text).join(' ')).join('\n');
}

function startOver() {
  if (!confirm('Start over with new text? This clears the word bank and board.')) return;
  wordBank.innerHTML = '';
  board.querySelectorAll('.scrap').forEach((el) => el.remove());
  updateBoardEmptyState();
  workspace.hidden = true;
  inputPanel.hidden = false;
  textInput.value = '';
  textInput.focus();
  currentSongId = null;
  currentSourceText = '';
  songTitleInput.value = DEFAULT_TITLE;
}

let toastTimer = null;
function showToast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

// ---------- Export / share ----------

function setExportPanelOpen(open) {
  exportPanel.hidden = !open;
  exportBtn.setAttribute('aria-expanded', String(open));
}

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setExportPanelOpen(exportPanel.hidden);
});

document.addEventListener('click', (e) => {
  if (!exportPanel.hidden && !exportPanel.contains(e.target) && e.target !== exportBtn) {
    setExportPanelOpen(false);
  }
});

if (navigator.share) {
  exportShareBtn.hidden = false;
}

exportCopyBtn.addEventListener('click', () => {
  const text = buildLyricsText();
  setExportPanelOpen(false);
  if (!text) {
    showToast('Drag some scraps onto the board first.');
    return;
  }
  navigator.clipboard.writeText(text).then(
    () => showToast('Copied to clipboard!'),
    () => showToast('Could not copy — try selecting the text manually.')
  );
});

exportDownloadBtn.addEventListener('click', () => {
  const text = buildLyricsText();
  setExportPanelOpen(false);
  if (!text) {
    showToast('Drag some scraps onto the board first.');
    return;
  }
  const filename = `${getSongTitle().replace(/[^\w\- ]+/g, '').trim() || 'song'}.txt`;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

exportShareBtn.addEventListener('click', async () => {
  const text = buildLyricsText();
  setExportPanelOpen(false);
  if (!text) {
    showToast('Drag some scraps onto the board first.');
    return;
  }
  try {
    await navigator.share({ title: getSongTitle(), text });
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Could not share.');
  }
});

// ---------- Style switcher ----------

function setThemePanelOpen(open) {
  themePanel.hidden = !open;
  themeBtn.setAttribute('aria-expanded', String(open));
}

function applyTheme(theme) {
  if (theme === 'default') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  themeBtn.textContent = `Style: ${THEME_LABELS[theme] || THEME_LABELS.default} ▾`;
  themeOptions.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeValue === theme);
  });
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

themeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  setThemePanelOpen(themePanel.hidden);
});

themeOptions.forEach((btn) => {
  btn.addEventListener('click', () => {
    applyTheme(btn.dataset.themeValue);
    setThemePanelOpen(false);
  });
});

document.addEventListener('click', (e) => {
  if (!themePanel.hidden && !themePanel.contains(e.target) && e.target !== themeBtn) {
    setThemePanelOpen(false);
  }
});

applyTheme(localStorage.getItem(THEME_STORAGE_KEY) || 'default');

// ---------- Auth ----------

function setUser(user) {
  currentUser = user;
  const loggedIn = !!user;
  authLoggedOut.hidden = loggedIn;
  authLoggedIn.hidden = !loggedIn;
  if (loggedIn) userEmailLabel.textContent = user.email;
}

function openModal(modal) {
  modal.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  setUser(session?.user ?? null);

  supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null);
    if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });
}

loginBtn.addEventListener('click', () => {
  loginStatus.textContent = '';
  loginEmail.value = '';
  openModal(loginModal);
  loginEmail.focus();
});

loginModalClose.addEventListener('click', () => closeModal(loginModal));
loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) closeModal(loginModal);
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  if (!email) return;

  loginSubmitBtn.disabled = true;
  loginStatus.textContent = 'Sending…';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });

  loginSubmitBtn.disabled = false;
  loginStatus.textContent = error
    ? `Couldn't send it: ${error.message}`
    : `Check ${email} for your login link!`;
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentSongId = null;
  showToast('Logged out.');
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  setExportPanelOpen(false);
  setThemePanelOpen(false);
  closeModal(loginModal);
  closeModal(songsModal);
  closeModal(addTextModal);
});

// ---------- Adding more text ----------

addTextBtn.addEventListener('click', () => {
  addTextInput.value = '';
  openModal(addTextModal);
  addTextInput.focus();
});

addTextModalClose.addEventListener('click', () => closeModal(addTextModal));
addTextModal.addEventListener('click', (e) => {
  if (e.target === addTextModal) closeModal(addTextModal);
});

function submitAddText() {
  const text = addTextInput.value.trim();
  if (!text) return;
  const added = addTextToBank(text);
  if (added) {
    closeModal(addTextModal);
    showToast('Added to the word bank!');
  }
}

addTextSubmitBtn.addEventListener('click', submitAddText);
addTextInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitAddText();
});

// ---------- Saving & loading songs ----------

function getSongTitle() {
  return songTitleInput.value.trim() || DEFAULT_TITLE;
}

songTitleInput.addEventListener('focus', () => songTitleInput.select());
songTitleInput.addEventListener('blur', () => {
  if (!songTitleInput.value.trim()) songTitleInput.value = DEFAULT_TITLE;
});

function serializeScraps() {
  const bank = Array.from(wordBank.children).map(readScrapDescriptor);
  const boardScraps = Array.from(board.querySelectorAll('.scrap')).map((el) => ({
    ...readScrapDescriptor(el),
    x: el.offsetLeft,
    y: el.offsetTop,
  }));
  return { bank, board: boardScraps };
}

async function saveSong() {
  if (!currentUser) {
    loginBtn.click();
    return;
  }
  const hasScraps = wordBank.children.length || board.querySelectorAll('.scrap').length;
  if (!hasScraps) {
    showToast('Nothing to save yet — chop up some text first.');
    return;
  }

  saveSongBtn.disabled = true;
  const payload = {
    user_id: currentUser.id,
    title: getSongTitle(),
    source_text: currentSourceText,
    scraps: serializeScraps(),
    updated_at: new Date().toISOString(),
  };

  let error;
  if (currentSongId) {
    ({ error } = await supabase.from('songs').update(payload).eq('id', currentSongId));
  } else {
    const result = await supabase.from('songs').insert(payload).select().single();
    error = result.error;
    if (!error) currentSongId = result.data.id;
  }
  saveSongBtn.disabled = false;

  if (error) {
    showToast(`Couldn't save: ${error.message}`);
    return;
  }
  showToast('Song saved!');
}

async function openSongsModal() {
  if (!currentUser) {
    loginBtn.click();
    return;
  }
  openModal(songsModal);
  songsList.innerHTML = '<p class="songs-empty">Loading…</p>';

  const { data, error } = await supabase
    .from('songs')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    songsList.innerHTML = `<p class="songs-empty">Couldn't load songs: ${error.message}</p>`;
    return;
  }
  renderSongsList(data);
}

function renderSongsList(songs) {
  if (!songs.length) {
    songsList.innerHTML = '<p class="songs-empty">No saved songs yet — write something and hit Save.</p>';
    return;
  }

  songsList.innerHTML = '';
  songs.forEach((song) => {
    const row = document.createElement('div');
    row.className = 'song-row';

    const info = document.createElement('div');
    info.className = 'song-row-info';
    const title = document.createElement('div');
    title.className = 'song-row-title';
    title.textContent = song.title;
    const date = document.createElement('div');
    date.className = 'song-row-date';
    date.textContent = new Date(song.updated_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    info.append(title, date);

    const actions = document.createElement('div');
    actions.className = 'song-row-actions';
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-ghost btn-small';
    loadBtn.textContent = 'Load';
    loadBtn.addEventListener('click', () => loadSong(song.id));
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-ghost btn-small';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteSong(song.id, song.title, row));
    actions.append(loadBtn, deleteBtn);

    row.append(info, actions);
    songsList.appendChild(row);
  });
}

async function loadSong(id) {
  const { data, error } = await supabase.from('songs').select('*').eq('id', id).single();
  if (error || !data) {
    showToast("Couldn't load that song.");
    return;
  }

  wordBank.innerHTML = '';
  board.querySelectorAll('.scrap').forEach((el) => el.remove());

  (data.scraps?.bank || []).forEach((desc) => wordBank.appendChild(createScrapElement(desc)));
  (data.scraps?.board || []).forEach((desc) => {
    const el = createScrapElement(desc);
    board.appendChild(el);
    el.style.position = 'absolute';
    el.style.left = `${desc.x}px`;
    el.style.top = `${desc.y}px`;
    el.style.margin = '0';
    el.style.translate = '0px 0px';
  });

  currentSongId = data.id;
  songTitleInput.value = data.title || DEFAULT_TITLE;
  currentSourceText = data.source_text || '';
  textInput.value = currentSourceText;

  inputPanel.hidden = true;
  workspace.hidden = false;
  updateBoardEmptyState();
  closeModal(songsModal);
  showToast(`Loaded "${data.title}"`);
}

async function deleteSong(id, title, row) {
  if (!confirm(`Delete "${title}"? This can't be undone.`)) return;
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) {
    showToast("Couldn't delete that song.");
    return;
  }
  row.remove();
  if (currentSongId === id) {
    currentSongId = null;
  }
  if (!songsList.children.length) {
    songsList.innerHTML = '<p class="songs-empty">No saved songs yet — write something and hit Save.</p>';
  }
}

saveSongBtn.addEventListener('click', saveSong);
mySongsBtn.addEventListener('click', openSongsModal);
songsModalClose.addEventListener('click', () => closeModal(songsModal));
songsModal.addEventListener('click', (e) => {
  if (e.target === songsModal) closeModal(songsModal);
});

// ---------- Wire up ----------

chopBtn.addEventListener('click', chopText);
textInput.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') chopText();
});
shuffleBtn.addEventListener('click', shuffleBank);
clearBoardBtn.addEventListener('click', clearBoard);
newTextBtn.addEventListener('click', startOver);

initAuth();
