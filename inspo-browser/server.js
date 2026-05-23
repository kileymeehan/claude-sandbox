require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const archiver = require('archiver');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const BUCKET = 'inspo';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const upload = multer({ storage: multer.memoryStorage() });

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

const KNOWN_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc', 'inbox'];
const TARGET_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc'];
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp']);

function publicUrl(storagePath) {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config (public) ─────────────────────────────────────────

app.get('/api/config', (req, res) => {
  res.json({ url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY });
});

// ── Images ──────────────────────────────────────────────────

app.get('/api/images', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('images')
    .select('id, filename, folder, storage_path, tags, comments, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(img => ({
    ...img,
    tags: img.tags || [],
    comments: img.comments || [],
    url: publicUrl(img.storage_path),
    mtime: new Date(img.created_at).getTime()
  })));
});

// ── Tags ────────────────────────────────────────────────────

app.get('/api/tags', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('images').select('id, tags');
  if (error) return res.status(500).json({ error: error.message });
  const map = {};
  for (const img of data) {
    if (img.tags?.length) map[img.id] = img.tags;
  }
  res.json(map);
});

app.post('/api/tags', requireAuth, async (req, res) => {
  const { id, tags } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await supabase
    .from('images')
    .update({ tags: tags || [] })
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Upload ──────────────────────────────────────────────────

app.post('/api/upload', requireAuth, upload.array('images'), async (req, res) => {
  const folder = req.body.folder || 'inbox';
  const { data: folderRow } = await supabase.from('folders').select('id').eq('id', folder).maybeSingle();
  if (!folderRow && !KNOWN_FOLDERS.includes(folder)) return res.status(400).json({ error: 'Invalid folder' });

  const results = [];
  for (const file of req.files || []) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) { results.push({ filename: file.originalname, error: 'Unsupported format' }); continue; }

    let filename = file.originalname.replace(/:/g, '-').replace(/\s{2,}/g, ' ').trim();
    let storagePath = `${folder}/${filename}`;

    const { data: existing } = await supabase.from('images').select('id').eq('id', storagePath).maybeSingle();
    if (existing) {
      const base = path.basename(filename, ext);
      filename = `${base}-${Date.now()}${ext}`;
      storagePath = `${folder}/${filename}`;
    }

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype });

    if (uploadErr) { results.push({ filename: file.originalname, error: uploadErr.message }); continue; }

    await supabase.from('images').insert({ id: storagePath, filename, folder, storage_path: storagePath, tags: [] });
    results.push({ filename, id: storagePath, url: publicUrl(storagePath) });
  }
  res.json({ results });
});

// ── AI Sync Inbox ───────────────────────────────────────────

app.post('/api/sync-inbox', requireAuth, async (req, res) => {
  const { data: inboxImages, error } = await supabase
    .from('images')
    .select('*')
    .eq('folder', 'inbox');
  if (error) return res.status(500).json({ error: error.message });

  const unprocessed = inboxImages.filter(img => !img.tags?.length);
  if (!unprocessed.length) {
    return res.json({ message: 'No new images in inbox' });
  }

  const { data: allTagData } = await supabase.from('images').select('tags');
  const existingTagSet = new Set(allTagData?.flatMap(r => r.tags || []) || []);

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  const client = new Anthropic();

  for (const img of unprocessed) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(img.storage_path);
      if (dlErr) { res.write(JSON.stringify({ file: img.filename, error: dlErr.message }) + '\n'); continue; }

      const ext = path.extname(img.filename).toLowerCase();
      const mediaTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
      const mediaType = mediaTypes[ext];
      if (!mediaType) { res.write(JSON.stringify({ file: img.filename, skipped: true, reason: 'unsupported format' }) + '\n'); continue; }

      const imageData = Buffer.from(await blob.arrayBuffer()).toString('base64');

      const prompt = `You are categorizing a UI/design inspiration image.

Existing tags in this library (prefer these over inventing new ones):
${existingTagSet.size ? [...existingTagSet].map(t => `- ${t}`).join('\n') : '(none yet)'}

Available destination folders:
- components (buttons, cards, inputs, nav, modals, icons, UI elements)
- layouts (page layouts, grids, structure, hero sections, dashboards)
- typography (type specimens, font pairings, text hierarchy, headings)
- motion (animations, transitions, loading states, micro-interactions)
- color (palettes, gradients, swatches, color systems)
- empty-states (zero states, onboarding, placeholders, illustrations)
- misc (anything that doesn't clearly fit above)

Respond with JSON only, no markdown:
{"folder": "<one of the folder names above>", "tags": ["tag1", "tag2", "tag3"]}

Rules: 2-5 tags max, reuse existing tags when they fit, lowercase hyphenated.`;

      const response = await client.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 256,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } },
          { type: 'text', text: prompt }
        ]}]
      });

      const result = JSON.parse(response.content[0].text.trim());
      const destFolder = TARGET_FOLDERS.includes(result.folder) ? result.folder : 'misc';

      let destFilename = img.filename;
      let destPath = `${destFolder}/${destFilename}`;
      const { data: collision } = await supabase.from('images').select('id').eq('id', destPath).maybeSingle();
      if (collision) {
        const base = path.basename(img.filename, ext);
        destFilename = `${base}-${Date.now()}${ext}`;
        destPath = `${destFolder}/${destFilename}`;
      }

      await supabase.storage.from(BUCKET).copy(img.storage_path, destPath);
      await supabase.storage.from(BUCKET).remove([img.storage_path]);
      await supabase.from('images').delete().eq('id', img.id);
      await supabase.from('images').insert({ id: destPath, filename: destFilename, folder: destFolder, storage_path: destPath, tags: result.tags });

      result.tags.forEach(t => existingTagSet.add(t));
      res.write(JSON.stringify({ file: img.filename, destFolder, destFile: destFilename, newId: destPath, tags: result.tags }) + '\n');
    } catch (err) {
      res.write(JSON.stringify({ file: img.filename, error: err.message }) + '\n');
    }
  }
  res.end();
});

// ── Comments ─────────────────────────────────────────────────

app.post('/api/images/:id/comment', requireAuth, async (req, res) => {
  const imageId = decodeURIComponent(req.params.id);
  const { text, avatar, name } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  const { data: img } = await supabase.from('images').select('comments').eq('id', imageId).maybeSingle();
  if (!img) return res.status(404).json({ error: 'Image not found' });
  const comment = { id: `c-${Date.now()}`, text: text.trim(), timestamp: new Date().toISOString(), avatar: avatar || '', name: name || 'You' };
  const comments = [...(img.comments || []), comment];
  const { error } = await supabase.from('images').update({ comments }).eq('id', imageId);
  if (error) return res.status(500).json({ error: error.message });
  res.json(comment);
});

app.delete('/api/images/:id/comment/:commentId', requireAuth, async (req, res) => {
  const imageId = decodeURIComponent(req.params.id);
  const { data: img } = await supabase.from('images').select('comments').eq('id', imageId).maybeSingle();
  if (!img) return res.status(404).json({ error: 'Image not found' });
  const comments = (img.comments || []).filter(c => c.id !== req.params.commentId);
  const { error } = await supabase.from('images').update({ comments }).eq('id', imageId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Delete image ─────────────────────────────────────────────

app.delete('/api/images/:id', requireAuth, async (req, res) => {
  const imageId = decodeURIComponent(req.params.id);
  const { data: img } = await supabase.from('images').select('storage_path').eq('id', imageId).maybeSingle();
  if (!img) return res.status(404).json({ error: 'Image not found' });
  await supabase.storage.from(BUCKET).remove([img.storage_path]);
  await supabase.from('images').delete().eq('id', imageId);
  res.json({ ok: true });
});

app.post('/api/images/bulk-delete', requireAuth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'ids required' });
  const { data: imgs } = await supabase.from('images').select('id, storage_path').in('id', ids);
  if (!imgs?.length) return res.json({ ok: true, deleted: 0 });
  await supabase.storage.from(BUCKET).remove(imgs.map(i => i.storage_path));
  await supabase.from('images').delete().in('id', ids);
  res.json({ ok: true, deleted: imgs.length });
});

// ── Folders ──────────────────────────────────────────────────

app.get('/api/folders', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('folders').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  const map = {};
  for (const f of data || []) map[f.id] = { name: f.name, color: f.color };
  res.json(map);
});

app.post('/api/folders', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const id = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  if (!id) return res.status(400).json({ error: 'Invalid folder name' });
  const PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#6366f1','#14b8a6','#f97316','#ef4444','#06b6d4','#84cc16','#fb923c'];
  const { data: existing } = await supabase.from('folders').select('color');
  const used = new Set((existing || []).map(f => f.color));
  const available = PALETTE.filter(c => !used.has(c));
  const color = available.length ? available[0] : PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const { error } = await supabase.from('folders').upsert({ id, name: name.trim(), color }, { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id, name: name.trim(), color });
});

// ── Move image ────────────────────────────────────────────────

app.post('/api/images/:id/move', requireAuth, async (req, res) => {
  const imageId = decodeURIComponent(req.params.id);
  const { folder } = req.body;
  if (!folder) return res.status(400).json({ error: 'folder required' });

  const { data: img } = await supabase.from('images').select('*').eq('id', imageId).maybeSingle();
  if (!img) return res.status(404).json({ error: 'Image not found' });
  if (img.folder === folder) return res.json({ ok: true, id: imageId });

  const ext = path.extname(img.filename);
  let destFilename = img.filename;
  let destPath = `${folder}/${destFilename}`;
  const { data: collision } = await supabase.from('images').select('id').eq('id', destPath).maybeSingle();
  if (collision) {
    destFilename = `${path.basename(img.filename, ext)}-${Date.now()}${ext}`;
    destPath = `${folder}/${destFilename}`;
  }

  const { error: copyErr } = await supabase.storage.from(BUCKET).copy(img.storage_path, destPath);
  if (copyErr) return res.status(500).json({ error: copyErr.message });
  await supabase.storage.from(BUCKET).remove([img.storage_path]);
  await supabase.from('images').delete().eq('id', img.id);
  await supabase.from('images').insert({ id: destPath, filename: destFilename, folder, storage_path: destPath, tags: img.tags || [] });

  res.json({ ok: true, id: destPath, filename: destFilename, folder, url: publicUrl(destPath) });
});

app.listen(PORT, () => console.log(`\n  Inspo Browser  →  http://localhost:${PORT}\n`));
