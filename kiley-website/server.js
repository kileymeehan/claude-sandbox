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
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(post.title)} — Kiley Daniel Meehan</title>
<meta name="description" content="${escHtml(post.excerpt || '')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>

<header class="masthead">
  <div class="wrap masthead-bar">
    <a class="nameplate" href="/">Kiley Daniel Meehan</a>
    <div class="masthead-social">
      <a class="social-link" href="#" aria-label="LinkedIn" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
      </a>
      <a class="social-link" href="mailto:kileymeehan@gmail.com" aria-label="Email">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
      </a>
    </div>
  </div>
</header>

<nav class="toc" aria-label="Sections">
  <div class="wrap toc-inner">
    <a href="/#bio" class="toc-link">Profile</a>
    <a href="/work.html" class="toc-link">My Work</a>
    <a href="/writing.html" class="toc-link" aria-current="page">Writing</a>
    <a href="/cv.html" class="toc-link">CV</a>
    <a href="/#connect" class="toc-link">Connect</a>
  </div>
</nav>

<main>
  <header class="page-head">
    <div class="wrap">
      <div class="page-head-inner">
        <p class="kicker kicker--accent">${escHtml(post.tag || 'Essay')}</p>
        <h1 class="page-title">${escHtml(post.title)}</h1>
        ${post.excerpt ? `<p class="dek">${escHtml(post.excerpt)}</p>` : ''}
        <p class="page-byline">By Kiley Daniel Meehan &middot; ${escHtml(post.date || '')} &middot; ${escHtml(post.read_time || '')}</p>
      </div>
    </div>
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

<footer class="footer footer--page">
  <div class="wrap">
    <div class="footer-page-links">
      <a class="footer-page-link" href="/">Home</a>
      <a class="footer-page-link" href="/work.html">My Work</a>
      <a class="footer-page-link" href="/writing.html">All Writing</a>
      <a class="footer-page-link" href="/cv.html">CV</a>
      <a class="footer-page-link" href="mailto:kileymeehan@gmail.com">kileymeehan@gmail.com</a>
    </div>
    <div class="folio folio--footer" role="presentation">
      <span class="folio-item">Kiley Daniel Meehan</span>
      <span class="folio-item folio-item--right">Set in Newsreader &amp; Archivo</span>
    </div>
  </div>
</footer>

</body>
</html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Not found — Kiley Daniel Meehan</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <main class="wrap" style="padding-block: 6rem;">
    <p class="kicker kicker--accent">404</p>
    <h1 class="page-title">Post not found.</h1>
    <p class="dek"><a href="/" style="color: var(--accent);">&larr; Back home</a></p>
  </main>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server → http://localhost:${PORT}`));
