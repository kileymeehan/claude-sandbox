require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cookieSession = require('cookie-session');
const { createClient } = require('@supabase/supabase-js');
const MarkdownIt = require('markdown-it');
const path = require('path');

const app = express();
const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.use(cookieSession({
  name: 'km_session',
  keys: [process.env.SESSION_SECRET || 'dev-secret-change-me'],
  maxAge: 7 * 24 * 60 * 60 * 1000
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/admin/login');
}

// ── PUBLIC API ──────────────────────────────────────────────

app.get('/api/posts', async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('slug, title, date, tag, read_time, excerpt, storage_path')
    .eq('published', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const posts = data.map(p => ({
    ...p,
    href: p.storage_path?.startsWith('static:')
      ? '/' + p.storage_path.replace('static:', '')
      : `/posts/${p.slug}`
  }));
  res.json(posts);
});

// ── DYNAMIC POST PAGES ──────────────────────────────────────

app.get('/posts/:slug', async (req, res) => {
  const { data: post, error } = await supabase
    .from('posts')
    .select('*')
    .eq('slug', req.params.slug)
    .eq('published', true)
    .single();

  if (error || !post) return res.status(404).send(notFoundPage());

  // Static posts stored as flat HTML files — redirect
  if (post.storage_path?.startsWith('static:')) {
    return res.redirect('/' + post.storage_path.replace('static:', ''));
  }

  const { data: blob, error: fileError } = await supabase.storage
    .from('posts')
    .download(post.storage_path);

  if (fileError) return res.status(500).send('Could not load post content.');

  const contentHtml = md.render(await blob.text());
  res.send(renderPost(post, contentHtml));
});

// ── ADMIN AUTH ──────────────────────────────────────────────

app.get('/admin/login', (req, res) => {
  if (req.session.user) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin-login.html'));
});

app.post('/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password.' });
  }
  req.session.user = { email: 'admin' };
  res.redirect('/admin');
});

app.post('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

// ── ADMIN DASHBOARD ─────────────────────────────────────────

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/admin/api/posts', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/admin/upload', requireAuth, upload.single('markdown'), async (req, res) => {
  const { title, date, tag, read_time, excerpt, published } = req.body;
  const file = req.file;

  if (!file)  return res.status(400).json({ error: 'No file uploaded.' });
  if (!title) return res.status(400).json({ error: 'Title is required.' });

  const slug = title.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  const storagePath = `${slug}.md`;

  const { error: uploadError } = await supabase.storage
    .from('posts')
    .upload(storagePath, file.buffer, { contentType: 'text/markdown', upsert: true });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { error: dbError } = await supabase
    .from('posts')
    .upsert({ slug, title, date, tag, read_time, excerpt, storage_path: storagePath, published: published === 'true' });

  if (dbError) return res.status(500).json({ error: dbError.message });

  res.json({ success: true, title, url: `/posts/${slug}` });
});

app.patch('/admin/posts/:slug', requireAuth, async (req, res) => {
  const { published } = req.body;
  const { error } = await supabase
    .from('posts')
    .update({ published })
    .eq('slug', req.params.slug);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete('/admin/posts/:slug', requireAuth, async (req, res) => {
  const { data: post } = await supabase
    .from('posts')
    .select('filename')
    .eq('slug', req.params.slug)
    .single();

  if (post?.storage_path && !post.storage_path.startsWith('static:')) {
    await supabase.storage.from('posts').remove([post.storage_path]);
  }
  await supabase.from('posts').delete().eq('slug', req.params.slug);
  res.json({ success: true });
});

// ── RENDERERS ───────────────────────────────────────────────

function renderPost(post, contentHtml) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(post.title)} · Kiley Meehan</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --cream: #F5EEDB;
    --ink: #0C0805;
    --ink-soft: #1A1610;
    --ink-mute: rgba(12,8,5,0.72);
    --ink-quiet: rgba(12,8,5,0.46);
    --terracotta: #BB5E3E;
    --rule: #1A1610;
    --rule-soft: rgba(26,22,16,0.18);
    --dark-green: #0C1A14;
    --serif: 'Cormorant Garamond', Georgia, serif;
    --mono: 'IBM Plex Mono', monospace;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--ink); }
  body { font-family: var(--mono); min-height: 100vh; -webkit-font-smoothing: antialiased; }

  .site-header { position: sticky; top: 0; z-index: 100; background: var(--dark-green); color: #F5EEDB; border-bottom: 1px solid #F5EEDB; }
  .hdr-inner { display: grid; grid-template-columns: 56px 1fr auto 56px; align-items: stretch; height: 72px; }
  .hdr-brand, .hdr-nav { display: flex; align-items: center; font-family: var(--mono); font-size: 13px; letter-spacing: 0.18em; text-transform: uppercase; color: #F5EEDB; }
  .hdr-brand { grid-column: 2; padding: 0 28px; }
  .hdr-brand a { color: inherit; text-decoration: none; }
  .hdr-nav { grid-column: 3; justify-content: flex-end; padding: 0; height: 100%; }
  .hdr-nav a { color: #F5EEDB; text-decoration: none; display: flex; align-items: center; height: 100%; padding: 0 28px; border-left: 1px solid rgba(245,238,219,0.55); transition: background 0.2s, color 0.2s; }
  .hdr-nav a:hover { background: var(--terracotta); color: #FBF5E2; }

  .shell { background: color-mix(in oklab, var(--cream), white 18%); display: grid; grid-template-columns: 56px 1fr 56px; border-left: 1px solid var(--rule); border-right: 1px solid var(--rule); min-height: calc(100vh - 72px); }
  .rail { position: relative; overflow: hidden; }
  .rail.left { grid-column: 1; border-right: 1px solid var(--rule); background-image: repeating-linear-gradient(135deg, transparent 0 9px, rgba(26,22,16,0.07) 9px 10px); }
  .rail.right { grid-column: 3; border-left: 1px solid var(--rule); }
  .vlabel { position: absolute; top: 80px; left: 50%; transform: translateX(-50%) rotate(-90deg); white-space: nowrap; font-family: var(--mono); font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--ink-soft); }
  .rail.right .vlabel { top: auto; bottom: 80px; }

  .article-shell { grid-column: 2; }

  .crumb { border-bottom: 1px solid var(--rule); display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 22px 56px; font-family: var(--mono); font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--ink-soft); }
  .crumb a { color: var(--ink-soft); text-decoration: none; display: inline-flex; align-items: center; gap: 10px; transition: color 0.2s; }
  .crumb a:hover { color: var(--terracotta); }
  .crumb-right { color: var(--ink-quiet); }

  .cover {
    border-bottom: 1px solid var(--rule);
    padding: 96px 56px 80px;
    display: grid; grid-template-columns: 200px 1fr 200px;
    gap: 48px; align-items: end;
    background-color: color-mix(in oklab, var(--cream), white 18%);
    background-image: radial-gradient(rgba(26,22,16,0.36) 1px, transparent 1.2px);
    background-size: 8px 8px;
  }
  .cover-num { font-family: var(--mono); font-size: 11px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--ink-quiet); writing-mode: vertical-lr; transform: rotate(180deg); align-self: center; }
  .cover-center { display: flex; flex-direction: column; gap: 20px; }
  .cover-eyebrow { background: color-mix(in oklab, var(--cream), white 18%); display: inline-block; padding: 4px 10px; margin: 0 -10px; font-family: var(--mono); font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--terracotta); }
  .cover-title { font-family: var(--serif); font-weight: 300; font-size: clamp(42px, 5vw, 80px); line-height: 1.05; letter-spacing: -0.015em; color: var(--ink); }
  .cover-title em { font-style: italic; }
  .cover-chip { background: color-mix(in oklab, var(--cream), white 18%); display: inline; padding: 0 10px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  .cover-meta-row { font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-mute); display: inline-flex; align-items: center; gap: 12px; background: color-mix(in oklab, var(--cream), white 18%); padding: 4px 10px; margin: 0 -10px; }
  .cover-meta-row .sep { opacity: 0.5; }

  .article-body { padding: 72px 56px 96px; max-width: 720px; }
  .article-body p { font-family: var(--mono); font-size: 18px; line-height: 1.8; color: var(--ink); margin-bottom: 1.6em; }
  .article-body h1, .article-body h2 { font-family: var(--serif); font-weight: 400; font-size: clamp(28px, 3vw, 42px); line-height: 1.15; letter-spacing: -0.01em; color: var(--ink); margin: 2em 0 0.75em; }
  .article-body h3 { font-family: var(--mono); font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--terracotta); margin: 2em 0 1em; }
  .article-body blockquote { border-left: 2px solid var(--terracotta); padding-left: 28px; margin: 2.5em 0; }
  .article-body blockquote p { font-family: var(--serif); font-style: italic; font-size: clamp(20px, 2vw, 26px); color: var(--ink-soft); margin-bottom: 0; }
  .article-body ul, .article-body ol { padding-left: 2em; margin-bottom: 1.6em; }
  .article-body li { font-family: var(--mono); font-size: 18px; line-height: 1.8; color: var(--ink); margin-bottom: 0.4em; }
  .article-body a { color: var(--terracotta); text-decoration: underline; text-underline-offset: 3px; }
  .article-body a:hover { color: var(--ink); }
  .article-body strong { font-weight: 600; }
  .article-body em { font-style: italic; }
  .article-body hr { border: none; border-top: 1px solid var(--rule-soft); margin: 3em 0; }
  .article-body pre { background: var(--ink); color: var(--cream); padding: 24px; overflow-x: auto; margin-bottom: 1.6em; font-size: 14px; line-height: 1.6; }
  .article-body code { font-family: var(--mono); font-size: 0.9em; background: rgba(26,22,16,0.08); padding: 2px 6px; }
  .article-body pre code { background: none; padding: 0; }

  .article-footer { border-top: 1px solid var(--rule); padding: 56px; display: flex; justify-content: space-between; align-items: center; }
  .article-footer a { font-family: var(--mono); font-size: 12px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--ink-soft); text-decoration: none; transition: color 0.2s; }
  .article-footer a:hover { color: var(--terracotta); }

  .site-footer { background: var(--dark-green); color: #F5EEDB; border-top: 1px solid #F5EEDB; padding: 48px 56px 32px; font-family: var(--mono); display: flex; justify-content: space-between; align-items: center; }
  .foot-name { font-family: var(--serif); font-size: 24px; }
  .foot-copy { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(245,238,219,0.55); }
</style>
</head>
<body>

<header class="site-header">
  <div class="hdr-inner">
    <div class="hdr-brand"><a href="/">Kiley Meehan</a></div>
    <nav class="hdr-nav">
      <a href="/#work">Work</a>
      <a href="/#writing">Writing</a>
      <a href="/cv.html">CV</a>
      <a href="/#about">About</a>
      <a href="mailto:kileymeehan@gmail.com">Contact me</a>
    </nav>
  </div>
</header>

<div class="shell">
  <div class="rail left"><div class="vlabel">Essay</div></div>
  <div class="article-shell">
    <div class="crumb">
      <a href="/#writing">← Writing</a>
      <span class="crumb-right">${escHtml(post.tag || 'Essay')} · ${escHtml(post.read_time || '')}</span>
    </div>
    <div class="cover">
      <div class="cover-num">Kiley Meehan</div>
      <div class="cover-center">
        <span class="cover-eyebrow">${escHtml(post.tag || 'Essay')}</span>
        <h1 class="cover-title"><span class="cover-chip">${escHtml(post.title)}</span></h1>
        <div class="cover-meta-row">
          <span>${escHtml(post.date || '')}</span>
          <span class="sep">·</span>
          <span>${escHtml(post.read_time || '')}</span>
        </div>
      </div>
      <div></div>
    </div>
    <div class="article-body">
      ${contentHtml}
    </div>
    <div class="article-footer">
      <a href="/#writing">← Back to writing</a>
      <a href="/">Kiley Meehan →</a>
    </div>
  </div>
  <div class="rail right"><div class="vlabel">Ongoing</div></div>
</div>

<footer class="site-footer">
  <span class="foot-name">Kiley Meehan</span>
  <span class="foot-copy">© ${year}</span>
</footer>
</body>
</html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not found</title></head><body style="font-family:monospace;padding:56px;background:#F5EEDB">Post not found. <a href="/" style="color:#BB5E3E">← Home</a></body></html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
