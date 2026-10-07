// Serve the production build (_site) under /bitmark-editor/, as GitHub Pages
// does: node serve.mjs [port]. For the smoke tests and a local look.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '_site');
const PREFIX = '/bitmark-editor/';
const port = Number(process.argv[2] ?? 4630);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (url === '/' || url === '/bitmark-editor') {
    res.writeHead(302, { Location: PREFIX }).end();
    return;
  }
  let file = url.startsWith(PREFIX) ? path.join(root, url.slice(PREFIX.length)) : '';
  if (file && existsSync(file) && statSync(file).isDirectory())
    file = path.join(file, 'index.html');
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}${PREFIX}`));
