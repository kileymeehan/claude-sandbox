// Regenerates assets/kiley-daniel-meehan-cv.pdf from cv-print.html with headless Chrome.
//   node scripts/build-cv-pdf.mjs
// Edit cv-print.html (keep it in sync with cv.html), then run this and commit the PDF.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!chrome) throw new Error('Chrome not found; set CHROME=/path/to/chrome');

const out = join(root, 'assets', 'kiley-daniel-meehan-cv.pdf');
const profile = mkdtempSync(join(tmpdir(), 'cv-pdf-'));
try {
  execFileSync(chrome, [
    '--headless=new', `--user-data-dir=${profile}`, '--no-pdf-header-footer',
    '--virtual-time-budget=8000', // let the web fonts load before printing
    `--print-to-pdf=${out}`, pathToFileURL(join(root, 'cv-print.html')).href,
  ], { stdio: 'ignore' });
} finally {
  rmSync(profile, { recursive: true, force: true });
}
console.log('wrote', out);
