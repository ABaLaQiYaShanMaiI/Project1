import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { serveRange } from './range_serve.mjs';

const ROOT = fileURLToPath(new URL('../app/dist', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../app/public', import.meta.url));
const START_PORT = Number(process.argv[2] ?? 5183);
const OPEN_BROWSER = !process.argv.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pbf': 'application/x-protobuf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function fileStat(p) {
  try {
    return await stat(p);
  } catch {
    return null;
  }
}

async function exists(p) {
  return Boolean(await fileStat(p));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/data/' || path.startsWith('/data/')) {
      if (await serveRange(PUBLIC, req, res)) return;
      const dataFile = normalize(join(PUBLIC, path));
      if (dataFile !== PUBLIC && !dataFile.startsWith(PUBLIC.endsWith(sep) ? PUBLIC : PUBLIC + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const dInfo = await fileStat(dataFile);
      if (!dInfo) {
        res.writeHead(404).end('not found');
        return;
      }
      const dBuf = await readFile(dataFile);
      res.writeHead(200, {
        'content-type': MIME[extname(dataFile).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
        'content-length': dBuf.length,
      });
      res.end(dBuf);
      return;
    }
    if (path === '/' || path === '') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (file !== ROOT && !file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await fileStat(file);
    if (!info) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found: ' + path);
      return;
    }
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const ext = extname(file).toLowerCase();
    const cache =
      path.startsWith('/assets/') && ext !== '.mjs' ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': cache });
      res.end();
      return;
    }
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[ext] ?? 'application/octet-stream',
      'cache-control': cache,
      etag,
      'content-length': buf.length,
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

let opened = false;

function listen(port, tries = 12) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && tries > 0) {
      listen(port + 1, tries - 1);
      return;
    }
    console.error('启动失败：', err.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log('');
    console.log('  TACTICAL MAP WARGAME · 战术地图军棋');
    console.log('  已启动：' + url);
    console.log('  （关闭本窗口即停止服务）');
    console.log('');
    if (OPEN_BROWSER && !opened) {
      opened = true;
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    }
  });
}

if (!(await exists(join(ROOT, 'index.html')))) {
  console.error('找不到 app/dist/index.html');
  console.error('请先构建：cd app && pnpm build');
  process.exit(1);
}

listen(START_PORT);
