import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../app/public', import.meta.url));

const TYPES = {
  '.pmtiles': 'application/octet-stream',
  '.pbf': 'application/x-protobuf',
  '.mvt': 'application/x-protobuf',
  '.json': 'application/json; charset=utf-8',
};

function etagOf(info) {
  return `"${info.size.toString(36)}-${Math.round(info.mtimeMs).toString(36)}"`;
}

export async function serveRange(root, req, res, prefix = '/data/tiles/') {
  const url = String(req.url ?? '');
  if (!url.startsWith(prefix)) return false;
  const path = decodeURIComponent(url.split('?')[0]);
  const base = normalize(root);
  const file = normalize(join(base, path));
  if (file !== base && !file.startsWith(base.endsWith(sep) ? base : base + sep)) {
    res.writeHead(403).end('forbidden');
    return true;
  }
  const info = await stat(file).catch(() => null);
  if (!info || !info.isFile()) return false;
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const size = info.size;
  const etag = etagOf(info);
  // 协商缓存：内容未变时所有请求（含分段）都走 304，避免重复传输大文件
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag, 'cache-control': 'no-cache', 'accept-ranges': 'bytes' });
    res.end();
    return true;
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, {
      'content-type': type,
      'content-length': size,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
      etag,
    });
    res.end();
    return true;
  }
  const raw = String(req.headers.range ?? '');
  const m = /^bytes=(\d*)-(\d*)$/.exec(raw);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    if (!m[1]) start = Math.max(0, size - Number(m[2]));
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
      res.writeHead(416, { 'content-range': `bytes */${size}`, 'accept-ranges': 'bytes' }).end();
      return true;
    }
    end = Math.min(end, size - 1);
    res.writeHead(206, {
      'content-type': type,
      'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${size}`,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
      etag,
    });
    createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': size,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
    etag,
  });
  createReadStream(file).pipe(res);
  return true;
}

export async function servePublicRange(req, res) {
  return serveRange(PUBLIC, req, res);
}
