// Launchpad — a local dashboard for every project in claude-sandbox.
// Zero dependencies: run `node server.js` and open http://localhost:4400
const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const net = require('net');
const { spawn, execFile } = require('child_process');

const PORT = Number(process.env.PORT) || 4400;
const ROOT = __dirname;
const SANDBOX = path.resolve(ROOT, '..');
const CONFIG_PATH = path.join(ROOT, 'projects.json');
const THUMBS = path.join(ROOT, 'thumbnails');
const PUBLIC = path.join(ROOT, 'public');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Folders that never count toward "last worked on".
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.vite', '.cache', '.turbo', 'coverage']);
const IGNORE_FILES = new Set(['.DS_Store']);

fs.mkdirSync(THUMBS, { recursive: true });

// ---------- config ----------

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return { hidden: [], projects: {} };
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2) + '\n');
}

// Every top-level folder in the sandbox is a project. projects.json adds
// titles, ports and commands; folders it doesn't know about still show up
// with sensible guesses so new projects appear without any setup.
function discover() {
  const cfg = readConfig();
  const hidden = new Set(cfg.hidden || []);
  const dirs = fs.readdirSync(SANDBOX, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && !hidden.has(d.name))
    .map(d => d.name);

  const usedPorts = new Set(Object.values(cfg.projects || {}).map(p => p.port).filter(Boolean));
  let nextStatic = 8101;

  return dirs.map(id => {
    const dir = path.join(SANDBOX, id);
    const pkg = readJson(path.join(dir, 'package.json'));
    const saved = (cfg.projects || {})[id] || {};
    const guess = {};
    if (!saved.kind) {
      if (pkg && pkg.scripts && (pkg.scripts.dev || pkg.scripts.start)) {
        guess.kind = 'server';
        guess.command = pkg.scripts.dev ? 'npm run dev' : 'npm start';
      } else {
        guess.kind = 'static';
      }
    }
    if (!saved.port && (saved.kind || guess.kind) === 'static') {
      while (usedPorts.has(nextStatic)) nextStatic++;
      guess.port = nextStatic;
      usedPorts.add(nextStatic);
    }
    return {
      id,
      dir,
      title: id,
      description: '',
      railway: '',
      notes: '',
      path: '/',
      ...guess,
      ...saved,
      configured: Boolean((cfg.projects || {})[id]),
      stack: detectStack(dir, pkg),
    };
  });
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function detectStack(dir, pkg) {
  if (!pkg) return ['HTML'];
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const tags = [];
  if (deps.next) tags.push('Next');
  if (deps.react) tags.push('React');
  if (deps.vite) tags.push('Vite');
  if (deps.express) tags.push('Express');
  if (deps['@supabase/supabase-js']) tags.push('Supabase');
  if (deps['drizzle-orm']) tags.push('Postgres');
  if (deps.tailwindcss) tags.push('Tailwind');
  if (fs.existsSync(path.join(dir, 'tsconfig.json'))) tags.push('TS');
  return tags.length ? tags : ['Node'];
}

// ---------- last worked on ----------

const mtimeCache = new Map(); // id -> { at, value }

async function lastModified(dir, depth = 0) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  const times = await Promise.all(entries.map(async e => {
    if (e.isDirectory()) {
      if (IGNORE_DIRS.has(e.name) || depth > 8) return 0;
      return lastModified(path.join(dir, e.name), depth + 1);
    }
    if (e.isFile() && !IGNORE_FILES.has(e.name) && !e.name.endsWith('.log')) {
      try { return (await fsp.stat(path.join(dir, e.name))).mtimeMs; } catch {}
    }
    return 0;
  }));
  return Math.max(0, ...times);
}

async function cachedLastModified(project, force) {
  const hit = mtimeCache.get(project.id);
  if (!force && hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
  const value = await lastModified(project.dir);
  mtimeCache.set(project.id, { at: Date.now(), value });
  return value;
}

// ---------- process management ----------

const procs = new Map(); // id -> { child, logs: [], exitCode, startedAt }

function portOpen(port, host) {
  return new Promise(resolve => {
    const sock = net.connect({ port, host });
    const done = ok => { sock.destroy(); resolve(ok); };
    sock.setTimeout(250, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

async function isListening(port) {
  if (!port) return false;
  const [v4, v6] = await Promise.all([portOpen(port, '127.0.0.1'), portOpen(port, '::1')]);
  return v4 || v6;
}

function commandFor(project) {
  if (project.kind === 'static') return `python3 -m http.server ${project.port} --bind 127.0.0.1`;
  return project.command;
}

function start(project) {
  const existing = procs.get(project.id);
  if (existing && existing.exitCode === null) return;
  const cmd = commandFor(project);
  if (!cmd) throw new Error('No start command configured');

  // Login shell so Homebrew node/npx are on PATH; detached so the whole
  // process group (e.g. vite + api) can be stopped together.
  const child = spawn('/bin/zsh', ['-lc', cmd], {
    cwd: project.dir,
    detached: true,
    env: { ...process.env, PORT: String(project.port || ''), FORCE_COLOR: '0', BROWSER: 'none' },
  });
  const entry = { child, logs: [], exitCode: null, startedAt: Date.now() };
  const log = chunk => {
    entry.logs.push(...chunk.toString().split('\n').filter(Boolean));
    if (entry.logs.length > 400) entry.logs.splice(0, entry.logs.length - 400);
  };
  entry.logs.push(`$ ${cmd}`);
  child.stdout.on('data', log);
  child.stderr.on('data', log);
  child.on('exit', code => {
    entry.exitCode = code ?? 0;
    entry.logs.push(`— exited (${code ?? 'signal'})`);
  });
  procs.set(project.id, entry);
}

function killGroup(pid, signal) {
  try { process.kill(-pid, signal); } catch {}
}

async function stop(project) {
  const entry = procs.get(project.id);
  if (entry && entry.exitCode === null) {
    entry.stopped = true;
    killGroup(entry.child.pid, 'SIGTERM');
    setTimeout(() => entry.exitCode === null && killGroup(entry.child.pid, 'SIGKILL'), 3000);
    return;
  }
  // Started outside Launchpad (e.g. in a terminal): stop whatever holds its port.
  if (project.port && await isListening(project.port)) {
    const pids = await new Promise(resolve =>
      execFile('lsof', ['-ti', `tcp:${project.port}`, '-sTCP:LISTEN'], (err, out) =>
        resolve(err ? [] : out.trim().split('\n').filter(Boolean).map(Number))));
    pids.forEach(pid => { try { process.kill(pid, 'SIGTERM'); } catch {} });
  }
}

async function status(project) {
  const entry = procs.get(project.id);
  const listening = await isListening(project.port);
  if (listening) return { state: 'running', managed: Boolean(entry && entry.exitCode === null) };
  if (entry && entry.exitCode === null) return { state: 'starting', managed: true };
  if (entry && entry.exitCode !== 0 && !entry.stopped) return { state: 'crashed', managed: false };
  return { state: 'stopped', managed: false };
}

function cleanup() {
  for (const entry of procs.values()) if (entry.exitCode === null) killGroup(entry.child.pid, 'SIGTERM');
  process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ---------- thumbnails ----------

function thumbFile(id) {
  for (const ext of ['jpg', 'png', 'webp']) {
    const f = path.join(THUMBS, `${id}.${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function run(file, args, timeout) {
  return new Promise((resolve, reject) =>
    execFile(file, args, { timeout }, (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve()));
}

async function waitForPort(port, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await isListening(port)) return true;
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function capture(project) {
  let startedForCapture = false;
  if (!(await isListening(project.port))) {
    if (project.kind !== 'static') throw new Error('Start the server first, then capture.');
    start(project);
    startedForCapture = true;
    if (!(await waitForPort(project.port, 15000))) {
      await stop(project);
      throw new Error('Static server did not start');
    }
  }
  const url = `http://localhost:${project.port}${project.path || '/'}`;
  const png = path.join(THUMBS, `${project.id}.capture.png`);
  try {
    await run(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
      `--user-data-dir=${path.join(require('os').tmpdir(), 'launchpad-chrome')}`,
      '--window-size=1440,900', '--virtual-time-budget=6000',
      `--screenshot=${png}`, url,
    ], 45000);
    await run('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', '-Z', '1200', png, '--out', path.join(THUMBS, `${project.id}.jpg`)], 20000);
    for (const old of ['png', 'webp']) fs.rmSync(path.join(THUMBS, `${project.id}.${old}`), { force: true });
  } finally {
    fs.rmSync(png, { force: true });
    if (startedForCapture) await stop(project);
  }
}

// ---------- http ----------

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

async function listProjects(force) {
  const projects = discover();
  return Promise.all(projects.map(async p => {
    const thumb = thumbFile(p.id);
    const entry = procs.get(p.id);
    return {
      ...p,
      lastModified: await cachedLastModified(p, force),
      ...(await status(p)),
      thumbnail: thumb ? `/thumbs/${encodeURIComponent(path.basename(thumb))}?v=${Math.round(fs.statSync(thumb).mtimeMs)}` : null,
      hasLogs: Boolean(entry),
    };
  }));
}

const EDITABLE = ['title', 'description', 'railway', 'notes', 'kind', 'port', 'command', 'path'];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  try {
    if (parts[0] === 'api') {
      if (parts[1] === 'projects' && parts.length === 2 && req.method === 'GET') {
        return send(res, 200, await listProjects(url.searchParams.has('refresh')));
      }
      const project = discover().find(p => p.id === parts[2]);
      if (parts[1] === 'projects' && !project) return send(res, 404, { error: 'Unknown project' });
      const action = parts[3];

      if (req.method === 'POST' && action === 'start') { start(project); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && action === 'stop') { await stop(project); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && action === 'capture') { await capture(project); return send(res, 200, { ok: true }); }
      if (req.method === 'POST' && action === 'reveal') { execFile('open', [project.dir]); return send(res, 200, { ok: true }); }
      if (req.method === 'GET' && action === 'logs') return send(res, 200, { logs: (procs.get(project.id) || { logs: [] }).logs });
      if (req.method === 'PUT' && !action) {
        const body = await readBody(req);
        const cfg = readConfig();
        cfg.projects = cfg.projects || {};
        const current = cfg.projects[project.id] || {};
        for (const key of EDITABLE) {
          if (!(key in body)) continue;
          const val = key === 'port' ? (Number(body.port) || undefined) : String(body[key] ?? '').trim();
          if (val === '' || val === undefined) delete current[key]; else current[key] = val;
        }
        cfg.projects[project.id] = current;
        writeConfig(cfg);
        return send(res, 200, { ok: true });
      }
      if (req.method === 'POST' && action === 'hide') {
        const cfg = readConfig();
        cfg.hidden = [...new Set([...(cfg.hidden || []), project.id])];
        writeConfig(cfg);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'Not found' });
    }

    // Static files: thumbnails and the dashboard itself.
    const base = parts[0] === 'thumbs' ? THUMBS : PUBLIC;
    const rel = parts[0] === 'thumbs' ? parts.slice(1).join('/') : (parts.join('/') || 'index.html');
    const file = path.join(base, rel);
    if (!file.startsWith(base)) return send(res, 403, 'Forbidden', 'text/plain');
    const data = await fsp.readFile(file);
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, 'Not found', 'text/plain');
    send(res, 500, { error: err.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`\n  Launchpad  →  http://localhost:${PORT}\n`));
