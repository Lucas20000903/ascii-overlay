// Static server for the demo, the tuner and the banner scripts.
//
// The point of it over `python -m http.server` is one header. The pages import
// /dist/index.js, which statically imports its own modules, and a cache buster
// on the entry does nothing for those. A browser then keeps running the build
// from an hour ago while the source on disk has moved on, which reads as the
// library being broken rather than the page being stale.
//
//   node scripts/serve.mjs [port]

import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const PORT = Number(process.argv[2] ?? 8901);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let path = join(ROOT, normalize(decodeURIComponent(url.pathname)));

  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end('outside the project');
    return;
  }

  try {
    if (statSync(path).isDirectory()) path = join(path, 'index.html');
  } catch {
    res.writeHead(404).end('not found');
    return;
  }

  let size;
  try {
    size = statSync(path).size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': 'no-store, must-revalidate',
  });
  createReadStream(path).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT} on http://127.0.0.1:${PORT}`);
  console.log(`  demo    http://127.0.0.1:${PORT}/demo/`);
  console.log(`  tuner   http://127.0.0.1:${PORT}/assets/tuner.html`);
});
