import { createServer } from 'node:http';
import { stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseByteRange } from './src/media.js';

const root = fileURLToPath(new URL(process.argv.includes('--dist') ? './dist/' : '.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.md': 'text/plain; charset=utf-8' };
const port = Number(process.env.PORT || 5173);
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(part => part.startsWith('.'))) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const publicRootFile = ['index.html', 'LICENSE', 'NOTICE.md'].includes(relative);
    const publicAsset = ['src', 'assets'].includes(relative.split(path.sep)[0]) && /\.(js|css|svg|png|jpe?g|webp|ico|woff2?)$/i.test(relative);
    if (!publicRootFile && !publicAsset) { res.writeHead(404).end('Not found'); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end('Not found'); return; }
    const range = req.method === 'GET' ? parseByteRange(req.headers.range, info.size) : null;
    if (range === false) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
    const headers = { 'Content-Type': path.basename(file) === 'LICENSE' ? 'text/plain; charset=utf-8' : types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Length': range ? range.length : info.size };
    if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = createReadStream(file, range ? { start: range.start, end: range.end } : undefined);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Buffalo Syntax Club · http://127.0.0.1:${port}`));
