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

const FONTS = `<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/css/style.css">`;

function siteBar(current) {
  const link = (href, label, key) =>
    `<a href="${href}"${key === current ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-bar">
  <div class="wrap bar">
    <a class="brand" href="/"><video class="brand-av" src="/assets/kiley-avatar.mp4" poster="/assets/kiley-avatar.webp" autoplay muted loop playsinline aria-hidden="true" width="42" height="42"></video>Kiley Daniel Meehan</a>
    <nav class="site-nav" aria-label="Site">
      <a class="nav-locked" data-story="index.html" href="https://stories.kileymeehan.com/">Case stories<svg class="nav-lock" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><span class="visually-hidden"> (password protected)</span></a>
      ${link('/apps.html', 'My apps', 'apps')}
      ${link('/writing.html', 'Writing', 'writing')}
      ${link('/cv.html', 'CV', 'cv')}
    </nav>
    <button class="theme-btn" type="button" aria-label="Switch colour theme"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path class="half" d="M12 4a8 8 0 0 1 0 16z"/></svg></button>
  </div>
</header>`;
}

const SITE_FOOT = `<footer class="site-foot" id="connect">
  <div class="wrap">
    <div class="connect">
      <span class="label">Connect</span>
      <h2>Let&rsquo;s talk about making the complex <em>simple</em>.</h2>
      <div class="intro-links">
        <a class="btn btn--solid" href="mailto:kileymeehan@gmail.com">kileymeehan@gmail.com</a>
        <a class="btn" href="/writing.html">All writing</a>
      </div>
      <span class="footer-cat" aria-hidden="true" title="Shh, sleeping"><img class="cat-sleep" src="/assets/cat-sleep.webp" alt="" width="760" height="583" loading="lazy"><img class="cat-awake" src="/assets/cat-awake.webp" alt="" width="760" height="583" loading="lazy"></span>
    </div>
    <div class="foot-row">
      <span>Kiley Daniel Meehan</span>
      <nav aria-label="Footer"><a data-story="index.html" href="https://stories.kileymeehan.com/">Case stories</a><a href="/apps.html">My apps</a><a href="/writing.html">Writing</a><a href="/cv.html">CV</a></nav>
    </div>
  </div>
</footer>
<script src="/js/main.js"></script>`;

function renderPost(post, contentHtml) {
  const meta = [post.date, post.read_time].filter(Boolean).map(escHtml).join(' &middot; ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(post.title)} · Kiley Daniel Meehan</title>
<meta name="description" content="${escHtml(post.excerpt || '')}">
${FONTS}
</head>
<body>
${siteBar('writing')}

<main class="page wrap" id="main">
  <header class="page-head">
    <p class="kicker kicker--accent">${escHtml(post.tag || 'Essay')}</p>
    <h1 class="page-title">${escHtml(post.title)}</h1>
    ${post.excerpt ? `<p class="dek">${escHtml(post.excerpt)}</p>` : ''}
    <p class="page-byline">By Kiley Daniel Meehan${meta ? ' &middot; ' + meta : ''}</p>
  </header>

  <article class="essay">
    <div class="wrap">
      <div class="prose essay-prose">
        ${contentHtml}
        <p class="essay-end" aria-hidden="true">End</p>
      </div>
    </div>
  </article>
</main>

${SITE_FOOT}
</body>
</html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found · Kiley Daniel Meehan</title>
${FONTS}
</head>
<body>
${siteBar('writing')}
<main class="page wrap" id="main">
  <header class="page-head">
    <span class="label">404</span>
    <h1 class="page-title">Post not found.</h1>
    <p class="dek"><a href="/writing.html">&larr; Back to all writing</a></p>
  </header>
</main>
${SITE_FOOT}
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
