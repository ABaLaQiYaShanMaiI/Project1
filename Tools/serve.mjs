import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../app/dist', import.meta.url));
const START_PORT = Number(process.argv[2] ?? 5183);

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

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = decodeURIComponent(url.pathname);
    if (path === '/' || path === '') path = '/index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!(await exists(file))) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found: ' + path);
      return;
    }
    const buf = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
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
    exec(`start "" "${url}"`);
  });
}

if (!(await exists(join(ROOT, 'index.html')))) {
  console.error('找不到 app/dist/index.html');
  console.error('请先构建：cd app && npm run build');
  process.exit(1);
}

listen(START_PORT);
