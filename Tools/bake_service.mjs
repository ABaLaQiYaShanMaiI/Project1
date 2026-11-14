import { openSync, readSync, closeSync, existsSync, readFileSync, writeFileSync, copyFileSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PUBLIC_DATA = join(ROOT, 'app', 'public', 'data');
const DIST_DATA = join(ROOT, 'app', 'dist', 'data');
const CACHE = join(HERE, '.tile-cache');
const SCRIPT = join(HERE, 'bake_map.py');
const ZONES = join(PUBLIC_DATA, 'zones.json');
const PY = process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3');

const DEM_Z = 10;
const DEM_PAD = 6000;
const DEM_WORKERS = 10;
const MAX_SPAN_KM = 200;
const MAX_LOG = 240;

const task = {
  id: 0,
  state: 'idle',
  key: '',
  title: '',
  stage: '待机',
  progress: 0,
  startedAt: 0,
  finishedAt: 0,
  log: [],
  estimate: null,
  result: null,
  error: null,
};
let child = null;

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new Error('请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function metaHead(file) {
  try {
    const size = statSync(file).size;
    const len = Math.min(65536, size);
    const fd = openSync(file, 'r');
    const buf = Buffer.alloc(len);
    readSync(fd, buf, 0, len, 0);
    closeSync(fd);
    const s = buf.toString('utf8');
    const cut = s.indexOf('"dem"');
    if (cut < 0) return null;
    const head = s.slice(0, cut).replace(/,\s*$/, '').replace(/,\s*$/, '');
    const obj = JSON.parse(head + '}}');
    return obj.meta ?? null;
  } catch {
    return null;
  }
}

function loadZones() {
  try {
    const raw = JSON.parse(readFileSync(ZONES, 'utf8'));
    return Array.isArray(raw.zones) ? raw.zones : [];
  } catch {
    return [];
  }
}

function saveZones(zones) {
  const body = JSON.stringify({ zones }, null, 1);
  writeFileSync(ZONES, body, 'utf8');
  if (existsSync(DIST_DATA)) {
    try {
      writeFileSync(join(DIST_DATA, 'zones.json'), body, 'utf8');
    } catch {
      return;
    }
  }
}

function scanZones() {
  const byKey = new Map();
  for (const z of loadZones()) if (z?.key) byKey.set(z.key, z);
  let files = [];
  try {
    files = readdirSync(PUBLIC_DATA).filter((f) => /^map_.+\.json$/.test(f));
  } catch {
    files = [];
  }
  for (const file of files) {
    const key = file.slice(4, -5);
    if (byKey.has(key)) continue;
    const full = join(PUBLIC_DATA, file);
    const meta = metaHead(full);
    let sizeMB = 0;
    try {
      sizeMB = Math.round((statSync(full).size / 1048576) * 100) / 100;
    } catch {
      sizeMB = 0;
    }
    byKey.set(key, {
      key,
      name: meta?.name ?? key,
      file,
      center: meta?.center ?? null,
      spanKm: meta?.spanM ? [Math.round(meta.spanM[0] / 1000), Math.round(meta.spanM[1] / 1000)] : null,
      bbox: meta?.bbox ?? null,
      generated: meta?.generated ?? null,
      sizeMB,
    });
  }
  return [...byKey.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

function demTiles(lat, lon, wKm, hKm) {
  const spanW = wKm * 1000;
  const spanH = hKm * 1000;
  const mPerDegLat = 110540;
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const south = lat - (spanH / 2 + DEM_PAD) / mPerDegLat;
  const north = lat + (spanH / 2 + DEM_PAD) / mPerDegLat;
  const west = lon - (spanW / 2 + DEM_PAD) / mPerDegLon;
  const east = lon + (spanW / 2 + DEM_PAD) / mPerDegLon;
  const n = 2 ** DEM_Z;
  const px = (lo) => ((lo + 180) / 360) * n * 256;
  const py = (la) => ((1 - Math.asinh(Math.tan((la * Math.PI) / 180)) / Math.PI) / 2) * n * 256;
  const tx0 = Math.floor(px(west) / 256);
  const tx1 = Math.floor(px(east) / 256);
  const ty0 = Math.floor(py(north) / 256);
  const ty1 = Math.floor(py(south) / 256);
  const tiles = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) tiles.push(`z${DEM_Z}_${tx}_${ty}.png`);
  return tiles;
}

function estimateBake(lat, lon, wKm, hKm) {
  const tiles = demTiles(lat, lon, wKm, hKm);
  let cached = 0;
  for (const t of tiles) if (existsSync(join(CACHE, t))) cached++;
  const fresh = tiles.length - cached;
  const seconds = Math.round((fresh * 0.35 + cached * 0.03 + 25) * 10) / 10;
  return { tiles: tiles.length, cached, fresh, seconds };
}

const STEPS = [
  ['region:', '准备区域', 1],
  ['bbox', '计算范围', 2],
  ['DEM tiles', '下载高程瓦片', 4],
  ['DEM ok:', '高程就绪', 40],
  ['query roads', '抓取路网', 44],
  ['  roads ', '路网完成', 50],
  ['query rivers', '抓取河流', 53],
  ['  rivers ', '河流完成', 56],
  ['query water', '抓取水体', 58],
  ['water polys', '水体完成', 61],
  ['query forest', '抓取林地', 63],
  ['forest polys', '林地完成', 70],
  ['query places', '抓取城镇', 72],
  ['  places ', '城镇完成', 75],
  ['sampling hexes', '生成城区分区', 78],
  ['query minor streets', '抓取街道', 83],
  ['minor streets', '街道完成', 86],
  ['query built-up', '抓取建成区', 87],
  ['builtup polys', '建成区完成', 91],
  ['landcover raster', '生成地表覆盖', 93],
  ['urban mask', '生成城区掩膜', 94],
  ['towns ', '生成城镇', 96],
  ['dem grid', '生成高程栅格', 97],
  ['wrote ', '写入战场数据', 99],
];

function stageFor(line) {
  let m = line.match(/^\s+(\d+)\/(\d+)\s+tiles/);
  if (m) {
    const done = Number(m[1]);
    const total = Math.max(1, Number(m[2]));
    return { label: `高程瓦片 ${done}/${total}`, progress: 4 + Math.round((36 * done) / total) };
  }
  if (/^\s+forest part/.test(line)) return { label: '抓取林地', progress: 66 };
  if (/^\s+builtup part/.test(line)) return { label: '抓取建成区', progress: 89 };
  for (const [k, label, progress] of STEPS) {
    if (line.includes(k)) return { label, progress };
  }
  return null;
}

function pushLog(line) {
  if (!line) return;
  task.log.push(line);
  if (task.log.length > MAX_LOG) task.log.splice(0, task.log.length - MAX_LOG);
  const st = stageFor(line);
  if (!st) return;
  task.stage = st.label;
  if (st.progress > task.progress) task.progress = Math.min(99, st.progress);
}

function makeKey(lat, lon) {
  const enc = (n) => String(Math.round(n * 100)).replace('-', 'm');
  return `z${enc(lat)}_${enc(lon)}`;
}

function finishBake(ok, error) {
  child = null;
  task.finishedAt = Date.now();
  if (!ok) {
    task.state = 'error';
    task.error = error || '烘焙失败';
    task.stage = '失败';
    return;
  }
  const file = `map_${task.key}.json`;
  const full = join(PUBLIC_DATA, file);
  if (!existsSync(full)) {
    task.state = 'error';
    task.error = '烘焙结束但未找到输出文件';
    task.stage = '失败';
    return;
  }
  if (existsSync(DIST_DATA)) {
    try {
      copyFileSync(full, join(DIST_DATA, file));
    } catch {
      pushLog('dist 同步失败：重新构建或刷新页面后生效');
    }
  }
  const meta = metaHead(full);
  let sizeMB = 0;
  try {
    sizeMB = Math.round((statSync(full).size / 1048576) * 100) / 100;
  } catch {
    sizeMB = 0;
  }
  const entry = {
    key: task.key,
    name: meta?.name ?? task.title ?? task.key,
    file,
    center: meta?.center ?? null,
    spanKm: meta?.spanM ? [Math.round(meta.spanM[0] / 1000), Math.round(meta.spanM[1] / 1000)] : null,
    bbox: meta?.bbox ?? null,
    generated: meta?.generated ?? null,
    sizeMB,
  };
  const zones = loadZones().filter((z) => z.key !== entry.key);
  zones.push(entry);
  saveZones(zones);
  task.state = 'done';
  task.progress = 100;
  task.stage = '完成';
  task.result = { ...entry, url: `/data/${file}`, seconds: Math.round((task.finishedAt - task.startedAt) / 1000) };
}

function startBake(opts) {
  const { lat, lon, wKm, hKm, key, title, estimate } = opts;
  task.id += 1;
  task.state = 'running';
  task.key = key;
  task.title = title;
  task.stage = '启动烘焙';
  task.progress = 1;
  task.startedAt = Date.now();
  task.finishedAt = 0;
  task.log = [];
  task.estimate = estimate;
  task.result = null;
  task.error = null;

  const args = [SCRIPT, '--center', `${lat},${lon}`, '--span-km', `${wKm},${hKm}`, '--name', key];
  if (title) args.push('--title', title);
  child = spawn(PY, args, {
    cwd: ROOT,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    windowsHide: true,
  });

  let buf = '';
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      pushLog(line.trim());
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('error', (err) => finishBake(false, err.message));
  child.on('close', (code) => {
    if (buf.trim()) pushLog(buf.trim());
    if (task.state !== 'running') return;
    if (code === 0) finishBake(true, null);
    else finishBake(false, `烘焙进程退出码 ${code}`);
  });
}

function statusPayload() {
  return {
    id: task.id,
    state: task.state,
    key: task.key,
    title: task.title,
    stage: task.stage,
    progress: task.progress,
    elapsed: task.startedAt ? Math.round(((task.finishedAt || Date.now()) - task.startedAt) / 1000) : 0,
    estimate: task.estimate,
    result: task.result,
    error: task.error,
    log: task.log.slice(-14),
  };
}

export async function handleApi(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;

  if (path === '/api/zones' && req.method === 'GET') {
    sendJson(res, 200, { zones: scanZones() });
    return true;
  }

  if (path === '/api/bake' && req.method === 'GET') {
    sendJson(res, 200, statusPayload());
    return true;
  }

  if (path === '/api/bake/cancel' && req.method === 'POST') {
    if (!child) {
      sendJson(res, 409, { error: '没有运行中的烘焙任务' });
      return true;
    }
    task.state = 'error';
    task.error = '已取消';
    task.stage = '已取消';
    task.finishedAt = Date.now();
    try {
      child.kill();
    } catch {
      task.error = '已取消';
    }
    child = null;
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (path === '/api/bake' && req.method === 'POST') {
    if (child || task.state === 'running') {
      sendJson(res, 409, { error: '已有烘焙任务在进行，请等待完成' });
      return true;
    }
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      sendJson(res, 400, { error: '请求体不是合法 JSON' });
      return true;
    }
    const center = Array.isArray(body.center) ? body.center.map(Number) : [];
    const span = Array.isArray(body.spanKm) ? body.spanKm.map(Number) : [];
    const lat = center[0];
    const lon = center[1];
    const wKm = Math.round(span[0]);
    const hKm = Math.round(span[1]);
    if (!Number.isFinite(lat) || Math.abs(lat) > 85 || !Number.isFinite(lon) || Math.abs(lon) > 180) {
      sendJson(res, 400, { error: '中心经纬度不合法' });
      return true;
    }
    if (!Number.isFinite(wKm) || !Number.isFinite(hKm) || wKm < 4 || hKm < 4 || wKm > MAX_SPAN_KM || hKm > MAX_SPAN_KM) {
      sendJson(res, 400, { error: `跨度需在 4–${MAX_SPAN_KM} km 之间` });
      return true;
    }
    const key =
      typeof body.key === 'string' && /^[a-z0-9][a-z0-9_-]{0,23}$/.test(body.key) ? body.key : makeKey(lat, lon);
    const title = typeof body.title === 'string' ? body.title.slice(0, 40) : '';
    const estimate = estimateBake(lat, lon, wKm, hKm);
    startBake({ lat, lon, wKm, hKm, key, title, estimate });
    sendJson(res, 202, { id: task.id, key, estimate });
    return true;
  }

  if (path.startsWith('/api/')) {
    sendJson(res, 404, { error: '未知接口' });
    return true;
  }

  return false;
}

export function isBaking() {
  return Boolean(child);
}
