// Minimal static file server for dist/ (no dependencies).
// PORT (default 4400) and HOST (default 127.0.0.1, i.e. not reachable from the LAN).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const HOST = process.env.HOST || '127.0.0.1';
const START_PORT = Number(process.env.PORT) || 4400;
const PORT_ATTEMPTS = process.env.PORT ? 1 : 10;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    sendText(res, 400, 'Neplatná adresa');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.resolve(ROOT, '.' + pathname);
  if (!file.startsWith(ROOT + path.sep)) {
    sendText(res, 404, 'Nenájdené');
    return;
  }
  const info = await stat(file).catch(() => null);
  if (!info || !info.isFile()) {
    sendText(res, 404, `Nenájdené: ${pathname}`);
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

function listen(port, attemptsLeft) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) sendText(res, 500, 'Chyba servera');
      else res.destroy();
    });
  });
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE' && attemptsLeft > 1) listen(port + 1, attemptsLeft - 1);
    else {
      console.error(`Server sa nespustil: ${error.message}`);
      process.exit(1);
    }
  });
  server.listen(port, HOST, () => {
    const shown = HOST === '127.0.0.1' || HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`PitchIt beží na http://${shown}:${port}/  (Ctrl+C ukončí)`);
  });
}

listen(START_PORT, PORT_ATTEMPTS);
