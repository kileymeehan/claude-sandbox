const express = require('express');
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const archiver = require('archiver');

const app = express();
const PORT = 3001;
const IMAGES_BASE = '/Users/kiley/Documents/Design Inspiration';
const TAGS_FILE = path.join(__dirname, 'tags.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');

const KNOWN_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc', 'inbox'];
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.tiff', '.tif']);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(IMAGES_BASE));

function scanDir(dirPath, folder) {
  const results = [];
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.startsWith('.')) continue;
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      try {
        const stat = fs.statSync(path.join(dirPath, file));
        if (!stat.isFile()) continue;
        const id = folder === 'root' ? file : `${folder}/${file}`;
        results.push({
          id,
          filename: file,
          folder,
          url: folder === 'root'
            ? `/images/${encodeURIComponent(file)}`
            : `/images/${folder}/${encodeURIComponent(file)}`,
          mtime: stat.mtimeMs
        });
      } catch {}
    }
  } catch {}
  return results;
}

function scanImages() {
  const images = [];
  images.push(...scanDir(IMAGES_BASE, 'root'));
  for (const folder of KNOWN_FOLDERS) {
    images.push(...scanDir(path.join(IMAGES_BASE, folder), folder));
  }
  return images.sort((a, b) => b.mtime - a.mtime);
}

function loadTags() {
  try {
    return JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveTags(tags) {
  fs.writeFileSync(TAGS_FILE, JSON.stringify(tags, null, 2));
}

app.get('/api/images', (req, res) => {
  res.json(scanImages());
});

app.get('/api/tags', (req, res) => {
  res.json(loadTags());
});

app.post('/api/tags', (req, res) => {
  const { id, tags } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const allTags = loadTags();
  if (Array.isArray(tags) && tags.length > 0) {
    allTags[id] = tags;
  } else {
    delete allTags[id];
  }
  saveTags(allTags);
  res.json({ ok: true });
});

const TARGET_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc'];

async function classifyImage(filePath, existingTags) {
  const client = new Anthropic();
  const ext = path.extname(filePath).toLowerCase();
  const mediaTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  const mediaType = mediaTypes[ext];
  if (!mediaType) return null; // skip SVG/etc for vision

  const imageData = fs.readFileSync(filePath).toString('base64');

  const prompt = `You are categorizing a UI/design inspiration image.

Existing tags in this library (prefer these over inventing new ones):
${existingTags.length ? existingTags.map(t => `- ${t}`).join('\n') : '(none yet)'}

Available destination folders:
- components (buttons, cards, inputs, nav, modals, icons, UI elements)
- layouts (page layouts, grids, structure, hero sections, dashboards)
- typography (type specimens, font pairings, text hierarchy, headings)
- motion (animations, transitions, loading states, micro-interactions)
- color (palettes, gradients, swatches, color systems)
- empty-states (zero states, onboarding, placeholders, illustrations)
- misc (anything that doesn't clearly fit above)

Respond with JSON only, no markdown:
{
  "folder": "<one of the folder names above>",
  "tags": ["tag1", "tag2", "tag3"]
}

Rules for tags:
- 2–5 tags max
- Reuse existing tags from the list above whenever they fit
- Only add a new tag if nothing in the existing list captures it
- Lowercase, hyphenated (e.g. "dark-mode", "card-grid")
- Be specific but not overly granular`;

  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [{
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: imageData }
      }, {
        type: 'text',
        text: prompt
      }]
    }]
  });

  const text = response.content[0].text.trim();
  return JSON.parse(text);
}

app.post('/api/sync-inbox', async (req, res) => {
  const inboxDir = path.join(IMAGES_BASE, 'inbox');
  if (!fs.existsSync(inboxDir)) {
    return res.status(404).json({ error: 'inbox folder not found' });
  }

  const allTags = loadTags();
  const existingTagSet = new Set(Object.values(allTags).flat());

  // Find inbox images that have no tags yet
  const files = fs.readdirSync(inboxDir).filter(f => {
    if (f.startsWith('.')) return false;
    const ext = path.extname(f).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) return false;
    return fs.statSync(path.join(inboxDir, f)).isFile();
  });

  const unprocessed = files.filter(f => !allTags[`inbox/${f}`]);

  if (!unprocessed.length) {
    return res.json({ processed: [], message: 'No new images in inbox' });
  }

  // Stream results back as newline-delimited JSON so the UI can show progress
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  const processed = [];

  for (const file of unprocessed) {
    const srcPath = path.join(inboxDir, file);
    try {
      const result = await classifyImage(srcPath, [...existingTagSet]);
      if (!result) {
        res.write(JSON.stringify({ file, skipped: true, reason: 'unsupported format' }) + '\n');
        continue;
      }

      const { folder, tags } = result;
      const destFolder = TARGET_FOLDERS.includes(folder) ? folder : 'misc';
      const destDir = path.join(IMAGES_BASE, destFolder);

      // Move file
      let destFile = file;
      let destPath = path.join(destDir, destFile);
      if (fs.existsSync(destPath)) {
        const base = path.basename(file, path.extname(file));
        const ext = path.extname(file);
        destFile = `${base}-${Date.now()}${ext}`;
        destPath = path.join(destDir, destFile);
      }
      fs.renameSync(srcPath, destPath);

      // Save tags under new id
      const newId = `${destFolder}/${destFile}`;
      allTags[newId] = tags;
      tags.forEach(t => existingTagSet.add(t));
      saveTags(allTags);

      const item = { file, destFolder, destFile, newId, tags };
      processed.push(item);
      res.write(JSON.stringify(item) + '\n');
    } catch (err) {
      res.write(JSON.stringify({ file, error: err.message }) + '\n');
    }
  }

  res.end();
});

function loadProjects() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

app.get('/api/projects', (req, res) => {
  res.json(loadProjects());
});

app.post('/api/projects', (req, res) => {
  const { id, name, images } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const all = loadProjects();
  if (!all[id]) all[id] = { name: name || 'Untitled', created: Date.now(), images: [] };
  if (name !== undefined) all[id].name = name;
  if (images !== undefined) all[id].images = images;
  saveProjects(all);
  res.json({ ok: true });
});

app.delete('/api/projects/:id', (req, res) => {
  const all = loadProjects();
  delete all[req.params.id];
  saveProjects(all);
  res.json({ ok: true });
});

app.get('/api/projects/:id/download', (req, res) => {
  const all = loadProjects();
  const project = all[req.params.id];
  if (!project) return res.status(404).send('Project not found');

  const safeName = (project.name || 'project').replace(/[^a-z0-9_\- ]/gi, '').trim() || 'project';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => console.error('Archive error:', err));
  archive.pipe(res);

  const base = path.resolve(IMAGES_BASE);
  for (const imageId of project.images || []) {
    const fullPath = path.resolve(path.join(IMAGES_BASE, imageId));
    if (!fullPath.startsWith(base)) continue;
    if (fs.existsSync(fullPath)) {
      archive.file(fullPath, { name: path.basename(fullPath) });
    }
  }

  archive.finalize();
});

app.get('/download', (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).send('Missing path');
  const fullPath = path.resolve(IMAGES_BASE, relPath);
  const base = path.resolve(IMAGES_BASE);
  if (!fullPath.startsWith(base + path.sep) && fullPath !== base) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(fullPath)) return res.status(404).send('Not found');
  res.download(fullPath);
});

app.listen(PORT, () => {
  console.log(`\n  Inspo Browser  →  http://localhost:${PORT}\n`);
});
