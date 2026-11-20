import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = fileURLToPath(new URL('../app/public', import.meta.url));

const MIME = {
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.pbf': 'application/x-protobuf',
  '.pmtiles': 'application/octet-stream',
};

function etagOf(st) {
  return `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}"`;
}

export function servePublicFile(req, res) {
  const url = String(req.url ?? '');
  if (!url.startsWith('/data/')) return false;
  const path = normalize(join(PUBLIC, decodeURIComponent(url.split('?')[0])));
  if (path !== PUBLIC && !path.startsWith(`${PUBLIC}\\`) && !path.startsWith(`${PUBLIC}/`)) {
    res.writeHead(403).end('forbidden');
    return true;
  }
  let st;
  try {
    st = statSync(path);
  } catch {
    return false;
  }
  if (!st.isFile()) return false;
  const etag = etagOf(st);
  const headers = {
    'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-cache',
    etag,
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag, 'cache-control': 'no-cache' });
    res.end();
    return true;
  }
  res.writeHead(200, headers);
  createReadStream(path).pipe(res);
  return true;
}
