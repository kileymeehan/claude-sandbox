#!/usr/bin/env node
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const IMAGES_BASE = '/Users/kiley/Documents/Design Inspiration';
const TAGS_FILE = path.join(__dirname, 'tags.json');
const PROJECTS_FILE = path.join(__dirname, 'projects.json');
const KNOWN_FOLDERS = ['components', 'layouts', 'typography', 'motion', 'color', 'empty-states', 'misc', 'inbox'];
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif', '.bmp', '.tiff', '.tif']);
const MAX_IMAGES = 4;

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.avif': 'image/avif', '.bmp': 'image/bmp',
  '.tiff': 'image/tiff', '.tif': 'image/tiff'
};

function loadTags() {
  try { return JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8')); } catch { return {}; }
}

function loadProjects() {
  try { return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')); } catch { return {}; }
}

function scanDir(dirPath, folder) {
  const results = [];
  try {
    for (const file of fs.readdirSync(dirPath)) {
      if (file.startsWith('.')) continue;
      const ext = path.extname(file).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      try {
        const stat = fs.statSync(path.join(dirPath, file));
        if (!stat.isFile()) continue;
        results.push({ id: folder === 'root' ? file : `${folder}/${file}`, filename: file, folder, mtime: stat.mtimeMs });
      } catch {}
    }
  } catch {}
  return results;
}

function scanImages() {
  const imgs = [...scanDir(IMAGES_BASE, 'root')];
  for (const folder of KNOWN_FOLDERS) imgs.push(...scanDir(path.join(IMAGES_BASE, folder), folder));
  return imgs.sort((a, b) => b.mtime - a.mtime);
}

function imageToBase64(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] || 'image/jpeg';

  if (ext === '.svg') {
    return { data: fs.readFileSync(filePath).toString('base64'), mimeType };
  }

  // Resize to max 1200px with sips (macOS built-in), fall back to original
  const tmpFile = path.join(os.tmpdir(), `inspo-${crypto.randomBytes(8).toString('hex')}${ext === '.tiff' || ext === '.tif' ? '.jpg' : ext}`);
  try {
    const result = spawnSync('sips', ['-Z', '600', filePath, '--out', tmpFile], { timeout: 10000 });
    if (result.status === 0 && fs.existsSync(tmpFile)) {
      const data = fs.readFileSync(tmpFile).toString('base64');
      fs.unlinkSync(tmpFile);
      return { data, mimeType };
    }
  } catch {}

  return { data: fs.readFileSync(filePath).toString('base64'), mimeType };
}

function imageContentBlocks(imageIds, tags) {
  const blocks = [];
  for (const id of imageIds.slice(0, MAX_IMAGES)) {
    const fullPath = path.join(IMAGES_BASE, id);
    if (!fs.existsSync(fullPath)) continue;
    const imgTags = tags[id] || [];
    try {
      const { data, mimeType } = imageToBase64(fullPath);
      blocks.push({ type: 'text', text: `**${path.basename(id)}**${imgTags.length ? ` — ${imgTags.join(', ')}` : ''}` });
      blocks.push({ type: 'image', data, mimeType });
    } catch {}
  }
  return blocks;
}

// ── Server ──

const server = new Server(
  { name: 'inspo-browser', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_projects',
      description: 'List all design inspiration projects with their image counts and tags summary.',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'get_project_images',
      description: 'Get images from a named project. Returns the actual images so you can see and analyze them, plus tags and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          project_name: { type: 'string', description: 'Project name — partial match is fine, e.g. "blog" matches "Blog Inspo"' },
          limit: { type: 'number', description: `Max images to return visually (default ${MAX_IMAGES})` }
        },
        required: ['project_name']
      }
    },
    {
      name: 'search_images',
      description: 'Search design inspiration images by folder category, tag, or filename keyword. Returns the actual images so you can see them.',
      inputSchema: {
        type: 'object',
        properties: {
          query:  { type: 'string', description: 'Keyword to match against filenames' },
          folder: { type: 'string', description: 'Filter by folder: components, layouts, typography, motion, color, empty-states, misc, inbox' },
          tag:    { type: 'string', description: 'Filter by tag (exact match)' },
          limit:  { type: 'number', description: `Max results to return (default ${MAX_IMAGES})` }
        }
      }
    },
    {
      name: 'list_tags',
      description: 'List all tags used across the inspiration library, with counts.',
      inputSchema: { type: 'object', properties: {} }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (name === 'list_projects') {
    const projects = loadProjects();
    const tags = loadTags();
    const list = Object.entries(projects).sort((a, b) => b[1].created - a[1].created);
    if (!list.length) {
      return { content: [{ type: 'text', text: 'No projects yet — create one in the Inspo Browser app at http://localhost:3001.' }] };
    }
    const lines = list.map(([, proj]) => {
      const count = (proj.images || []).length;
      const allProjTags = [...new Set((proj.images || []).flatMap(id => tags[id] || []))];
      return `• **${proj.name}** — ${count} image${count !== 1 ? 's' : ''}${allProjTags.length ? ` | tags: ${allProjTags.slice(0, 6).join(', ')}` : ''}`;
    });
    return { content: [{ type: 'text', text: `${list.length} project(s):\n\n${lines.join('\n')}` }] };
  }

  if (name === 'get_project_images') {
    const projects = loadProjects();
    const tags = loadTags();
    const q = (args.project_name || '').toLowerCase();
    const match = Object.entries(projects).find(([, p]) => p.name.toLowerCase().includes(q));
    if (!match) {
      const names = Object.values(projects).map(p => p.name).join(', ');
      return { content: [{ type: 'text', text: `No project matching "${args.project_name}". Available: ${names || 'none'}` }] };
    }
    const [, proj] = match;
    const imageIds = (proj.images || []).filter(id => fs.existsSync(path.join(IMAGES_BASE, id)));
    const limit = Math.min(args.limit || MAX_IMAGES, MAX_IMAGES);
    const shown = imageIds.slice(0, limit);
    const header = `**${proj.name}** — ${imageIds.length} image${imageIds.length !== 1 ? 's' : ''}${imageIds.length > limit ? ` (showing first ${limit})` : ''}:`;
    return { content: [{ type: 'text', text: header }, ...imageContentBlocks(shown, tags)] };
  }

  if (name === 'search_images') {
    const tags = loadTags();
    const limit = Math.min(args.limit || MAX_IMAGES, MAX_IMAGES);
    const q = (args.query || '').toLowerCase();
    const filtered = scanImages().filter(img => {
      if (args.folder && img.folder !== args.folder) return false;
      if (args.tag && !(tags[img.id] || []).includes(args.tag)) return false;
      if (q && !img.filename.toLowerCase().includes(q)) return false;
      return true;
    }).slice(0, limit);

    if (!filtered.length) {
      return { content: [{ type: 'text', text: 'No images found matching your search.' }] };
    }
    const header = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}:`;
    return { content: [{ type: 'text', text: header }, ...imageContentBlocks(filtered.map(i => i.id), tags)] };
  }

  if (name === 'list_tags') {
    const tags = loadTags();
    const counts = {};
    Object.values(tags).flat().forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!sorted.length) return { content: [{ type: 'text', text: 'No tags yet.' }] };
    const lines = sorted.map(([t, n]) => `• ${t} (${n})`);
    return { content: [{ type: 'text', text: `${sorted.length} tag${sorted.length !== 1 ? 's' : ''}:\n\n${lines.join('\n')}` }] };
  }

  return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
