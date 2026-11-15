import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../app/public', import.meta.url));

const TYPES = {
  '.pmtiles': 'application/octet-stream',
  '.pbf': 'application/x-protobuf',
  '.mvt': 'application/x-protobuf',
  '.json': 'application/json; charset=utf-8',
};

export async function serveRange(root, req, res, prefix = '/data/tiles/') {
  const url = String(req.url ?? '');
  if (!url.startsWith(prefix)) return false;
  const path = decodeURIComponent(url.split('?')[0]);
  const base = normalize(root);
  const file = normalize(join(base, path));
  if (!file.startsWith(base)) {
    res.writeHead(403).end('forbidden');
    return true;
  }
  const info = await stat(file).catch(() => null);
  if (!info || !info.isFile()) return false;
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const size = info.size;
  if (req.method === 'HEAD') {
    res.writeHead(200, {
      'content-type': type,
      'content-length': size,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
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
    });
    createReadStream(file, { start, end }).pipe(res);
    return true;
  }
  res.writeHead(200, {
    'content-type': type,
    'content-length': size,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
  return true;
}

export async function servePublicRange(req, res) {
  return serveRange(PUBLIC, req, res);
}
