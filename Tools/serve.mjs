import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { handleApi } from './bake_service.mjs';

const ROOT = fileURLToPath(new URL('../app/dist', import.meta.url));
const START_PORT = Number(process.argv[2] ?? 5183);
const OPEN_BROWSER = !process.argv.includes('--no-open');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
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
    if (await handleApi(req, res)) return;
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    const info = await fileStat(file);
    if (!info) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found: ' + path);
      return;
    }
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { etag, 'cache-control': cache });
      res.end();
      return;
    }
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': cache,
      etag,
      'content-length': buf.length,
    });
    res.end(buf);
  } catch (e) {
    res.writeHead(500).end(String(e));
  }
});

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
    if (OPEN_BROWSER) exec(`start "" "${url}"`);
  });
}

if (!(await exists(join(ROOT, 'index.html')))) {
  console.error('找不到 app/dist/index.html');
  console.error('请先构建：cd app && npm run build');
  process.exit(1);
}

listen(START_PORT);
