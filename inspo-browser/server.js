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
    .select('id, filename, folder, storage_path, tags, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data.map(img => ({
    ...img,
    tags: img.tags || [],
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
  if (!KNOWN_FOLDERS.includes(folder)) return res.status(400).json({ error: 'Invalid folder' });

  const results = [];
  for (const file of req.files || []) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) { results.push({ filename: file.originalname, error: 'Unsupported format' }); continue; }

    let filename = file.originalname;
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

// ── Projects ────────────────────────────────────────────────

app.get('/api/projects', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  const map = {};
  for (const p of data) {
    map[p.id] = { name: p.name, created: new Date(p.created_at).getTime(), images: p.images || [] };
  }
  res.json(map);
});

app.post('/api/projects', requireAuth, async (req, res) => {
  const { id, name, images } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { error } = await supabase
    .from('projects')
    .upsert({ id, name: name || 'Untitled', images: images || [] }, { onConflict: 'id' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  await supabase.from('projects').delete().eq('id', req.params.id);
  res.json({ ok: true });
});

app.get('/api/projects/:id/download', requireAuth, async (req, res) => {
  const { data: proj } = await supabase.from('projects').select('*').eq('id', req.params.id).maybeSingle();
  if (!proj) return res.status(404).send('Project not found');

  const safeName = (proj.name || 'project').replace(/[^a-z0-9_\- ]/gi, '').trim() || 'project';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.pipe(res);

  for (const imageId of proj.images || []) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(imageId);
    if (!blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    archive.append(buffer, { name: path.basename(imageId) });
  }
  await archive.finalize();
});

app.listen(PORT, () => console.log(`\n  Inspo Browser  →  http://localhost:${PORT}\n`));
