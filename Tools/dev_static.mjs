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
  res.writeHead(200, {
    'content-type': MIME[extname(path).toLowerCase()] ?? 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-cache',
  });
  createReadStream(path).pipe(res);
  return true;
}
