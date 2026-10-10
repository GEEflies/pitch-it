// Builds dist/ from the canvas export in canvas/.
//
// Each canvas/<Name>.dc.html stays the source of truth (re-export from the
// canvas and drop it in). The build only:
//   1. moves the <helmet> fonts and styles into <head>,
//   2. wraps the <x-dc> markup in <script type="text/x-dc-template"> for runtime/dc-runtime.js,
//   3. swaps the canvas-only ./support.js for React + the local runtime,
//   4. points /_blob/<id> asset URLs at assets/<id>.<ext>,
//   5. replaces the Google Fonts link with self-hosted Fontsource files (no third-party requests).
import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANVAS_DIR = path.join(ROOT, 'canvas');
const ASSETS_DIR = path.join(ROOT, 'assets');
const DIST_DIR = path.join(ROOT, 'dist');
const ENTRY_PAGE = 'Main.dc.html';
const SUPPORT_TAG = '<script src="./support.js"></script>';
// Slovak needs latin-ext (č, ď, ľ, ň, ŕ, ť, ž…); other subsets are never used.
const FONT_SUBSETS = ['latin-ext', 'latin'];

const RUNTIME_TAGS = [
  '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
  '<script defer src="vendor/react.production.min.js"></script>',
  '<script defer src="vendor/react-dom.production.min.js"></script>',
  '<script defer src="runtime/dc-runtime.js"></script>'
].join('\n');

const VENDOR_FILES = {
  'react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'react-dom.production.min.js': 'node_modules/react-dom/umd/react-dom.production.min.js'
};

const GOOGLE_FONTS_LINK = /<link\b[^>]*href="https:\/\/fonts\.googleapis\.com\/css2\?([^"]+)"[^>]*>/g;
const GOOGLE_PRECONNECT = /<link\b[^>]*rel="preconnect"[^>]*href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\s*/g;

/** Adds the families and weights of one css2 query (family=DM+Sans:wght@400;700&…) to `fonts`. */
function collectGoogleFonts(query, fileName, fonts) {
  for (const part of query.replace(/&amp;/g, '&').split('&')) {
    if (!part.startsWith('family=')) continue;
    const [rawName, axes = 'wght@400'] = part.slice('family='.length).split(':');
    if (!axes.startsWith('wght@')) throw new Error(`${fileName}: nepodporovaný font ${part} (iba wght@…)`);
    const family = decodeURIComponent(rawName.replace(/\+/g, ' '));
    const weights = fonts.get(family) || new Set();
    axes.slice('wght@'.length).split(';').forEach((w) => weights.add(w));
    fonts.set(family, weights);
  }
}

export function transformPage(html, fileName, assetFiles, fonts) {
  const open = html.indexOf('<x-dc>');
  const close = html.lastIndexOf('</x-dc>');
  if (open === -1 || close < open) throw new Error(`${fileName}: chýba blok <x-dc>`);
  if (!html.includes(SUPPORT_TAG)) throw new Error(`${fileName}: chýba riadok ${SUPPORT_TAG}`);

  let headExtra = '';
  let markup = html
    .slice(open + '<x-dc>'.length, close)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<helmet>([\s\S]*?)<\/helmet>/g, (_, inner) => {
      headExtra += inner.trim() + '\n';
      return '';
    });
  if (/<\/script/i.test(markup)) throw new Error(`${fileName}: šablóna nesmie obsahovať </script>`);

  let fontLinked = false;
  headExtra = headExtra.replace(GOOGLE_PRECONNECT, '').replace(GOOGLE_FONTS_LINK, (_, query) => {
    collectGoogleFonts(query, fileName, fonts);
    if (fontLinked) return '';
    fontLinked = true;
    return '<link rel="stylesheet" href="fonts/fonts.css">';
  });

  const rewriteBlobs = (text) =>
    text.replace(/\/_blob\/([0-9a-f]{32})/g, (_, id) => {
      const file = assetFiles.get(id);
      if (!file) throw new Error(`${fileName}: chýba asset ${id} v assets/`);
      return `assets/${file}`;
    });
  markup = rewriteBlobs(markup);
  headExtra = rewriteBlobs(headExtra);

  const before = html.slice(0, open).replace(SUPPORT_TAG, RUNTIME_TAGS).replace('</head>', `${headExtra}</head>`);
  const mount =
    '<div data-dc-root><noscript>Táto stránka potrebuje zapnutý JavaScript.</noscript></div>\n' +
    `<script type="text/x-dc-template">${markup}</script>`;
  return before + mount + html.slice(close + '</x-dc>'.length);
}

/** Writes dist/fonts/fonts.css and the font files it references from @fontsource/<family>. */
async function buildFonts(fonts) {
  const outDir = path.join(DIST_DIR, 'fonts');
  await mkdir(path.join(outDir, 'files'), { recursive: true });
  let css = '/* Self-hosted from @fontsource packages (SIL Open Font License). */\n';
  const files = new Set();
  for (const [family, weights] of fonts) {
    const pkg = `@fontsource/${family.toLowerCase().replace(/\s+/g, '-')}`;
    const pkgDir = path.join(ROOT, 'node_modules', pkg);
    await access(pkgDir).catch(() => {
      throw new Error(`font ${family}: chýba balík ${pkg} (spusti npm install ${pkg})`);
    });
    for (const weight of [...weights].sort()) {
      for (const subset of FONT_SUBSETS) {
        const face = await readFile(path.join(pkgDir, `${subset}-${weight}.css`), 'utf8');
        for (const [, file] of face.matchAll(/url\(\.\/files\/([^)]+)\)/g)) files.add([pkgDir, file]);
        css += face.trim() + '\n';
      }
    }
  }
  await writeFile(path.join(outDir, 'fonts.css'), css);
  await Promise.all([...files].map(([pkgDir, file]) => copyFile(path.join(pkgDir, 'files', file), path.join(outDir, 'files', file))));
}

async function listAssets() {
  const files = await readdir(ASSETS_DIR);
  return new Map(files.map((file) => [path.parse(file).name, file]));
}

export async function build() {
  const assetFiles = await listAssets();
  const pages = (await readdir(CANVAS_DIR)).filter((file) => file.endsWith('.dc.html'));
  if (!pages.includes(ENTRY_PAGE)) throw new Error(`canvas/ neobsahuje ${ENTRY_PAGE}`);

  await rm(DIST_DIR, { recursive: true, force: true });
  await Promise.all(['assets', 'vendor', 'runtime'].map((dir) => mkdir(path.join(DIST_DIR, dir), { recursive: true })));

  const fonts = new Map();
  for (const page of pages) {
    const html = await readFile(path.join(CANVAS_DIR, page), 'utf8');
    const out = transformPage(html, page, assetFiles, fonts);
    await writeFile(path.join(DIST_DIR, page), out);
    if (page === ENTRY_PAGE) await writeFile(path.join(DIST_DIR, 'index.html'), out);
  }

  await Promise.all([
    buildFonts(fonts),
    ...[...assetFiles.values()].map((file) => copyFile(path.join(ASSETS_DIR, file), path.join(DIST_DIR, 'assets', file))),
    ...Object.entries(VENDOR_FILES).map(([name, from]) => copyFile(path.join(ROOT, from), path.join(DIST_DIR, 'vendor', name))),
    copyFile(path.join(ROOT, 'runtime', 'dc-runtime.js'), path.join(DIST_DIR, 'runtime', 'dc-runtime.js')),
    copyFile(path.join(ROOT, 'runtime', 'favicon.svg'), path.join(DIST_DIR, 'favicon.svg'))
  ]);
  return pages;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build()
    .then((pages) => console.log(`Build OK: ${pages.length} stránok → dist/`))
    .catch((error) => {
      console.error(`Build zlyhal: ${error.message}`);
      process.exit(1);
    });
}
