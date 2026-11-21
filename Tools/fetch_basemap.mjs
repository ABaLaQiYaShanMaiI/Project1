import { existsSync, mkdirSync, statSync, readFileSync, writeFileSync, unlinkSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const BIN = join(HERE, 'bin');
const CACHE = join(HERE, '.tile-cache');
const OUT = join(ROOT, 'app', 'public', 'data', 'tiles');
const CLI = join(BIN, process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles');
const CLI_VER = 'v1.31.2';
const CLI_URL = `https://github.com/protomaps/go-pmtiles/releases/download/${CLI_VER}/go-pmtiles_${CLI_VER.replace('v', '')}_Windows_x86_64.zip`;
const BUILDS = 'https://build-metadata.protomaps.dev/builds.json';
const MIRROR = 'https://data.source.coop/protomaps/openstreetmap/v4.pmtiles';
const STYLE_API = 'https://npm-style.protomaps.dev/style.json';
const ATTRIBUTION = '© OpenStreetMap contributors · Protomaps (ODbL) · Wikidata (CC0)';
const DEFAULT_BBOX = '8.849,50.240,10.591,51.000';
const WORLD_BBOX = '-180,-85,180,85';
const FONT = 'Noto Sans Regular';
const GLYPH_FONTS = [FONT, 'Noto Sans Devanagari Regular v1'];
const GLYPH_STEP = 256;
const GLYPH_LIMIT = 65536;
const GLYPH_PARALLEL = 8;

function log(...a) {
  const t = new Date().toTimeString().slice(0, 8);
  console.log(`[basemap ${t}]`, ...a);
}

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl';

function curlText(args) {
  return new Promise((resolve, reject) => {
    const p = spawn(CURL, ['-sS', '-L', '--fail', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => {
      out += c.toString('utf8');
    });
    p.stderr.on('data', (c) => {
      err += c.toString('utf8');
    });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve(out) : reject(new Error(`curl ${code} ${err.trim()}`))));
  });
}

async function download(url, file, quiet = false) {
  const tmp = `${file}.part`;
  if (existsSync(tmp)) unlinkSync(tmp);
  if (!quiet) log('下载', url);
  let ok = false;
  try {
    await curlText(['--retry', '2', '--connect-timeout', '20', '--max-time', '1800', '-o', tmp, url]);
    ok = existsSync(tmp) && statSync(tmp).size > 0;
  } catch (e) {
    log('curl 失败，改用 PowerShell', e.message);
  }
  if (!ok) {
    const ps = `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '${url}' -OutFile '${tmp}' -UseBasicParsing`;
    await new Promise((resolve, reject) => {
      const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'inherit' });
      p.on('error', reject);
      p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`powershell exit ${c}`))));
    });
  }
  if (!existsSync(tmp)) throw new Error(`下载失败 ${url}`);
  if (existsSync(file)) unlinkSync(file);
  renameSync(tmp, file);
  if (!quiet) log('下载完成', `${(statSync(file).size / 1048576).toFixed(1)} MB`);
}

async function fetchText(url) {
  try {
    return await curlText(['--retry', '2', '--max-time', '120', url]);
  } catch (e) {
    log('curl 失败，改用 PowerShell 取文本', e.message);
    const ps = `$ProgressPreference='SilentlyContinue'; (Invoke-WebRequest -Uri '${url}' -UseBasicParsing).Content`;
    return new Promise((resolve, reject) => {
      const p = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      p.stdout.on('data', (c) => {
        out += c.toString('utf8');
      });
      p.on('error', reject);
      p.on('exit', (c) => (c === 0 ? resolve(out) : reject(new Error(`powershell exit ${c}`))));
    });
  }
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function run(bin, args, onLine) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (!env.GODEBUG) env.GODEBUG = 'http2client=0';
    const p = spawn(bin, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env });
    const emit = (buf) => {
      for (const line of buf.toString('utf8').split(/[\r\n]+/)) {
        const s = line.trim();
        if (s) onLine?.(s);
      }
    };
    p.stdout.on('data', emit);
    p.stderr.on('data', emit);
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${bin} exit ${code}`))));
  });
}

async function cliWorks() {
  if (!existsSync(CLI) || statSync(CLI).size < 40000000) return false;
  let ok = false;
  await run(CLI, ['version'], (l) => {
    if (l.includes('pmtiles')) ok = true;
  }).catch(() => undefined);
  return ok;
}

async function ensureCli() {
  if (await cliWorks()) return;
  if (existsSync(CLI)) unlinkSync(CLI);
  ensureDir(BIN);
  ensureDir(CACHE);
  const zip = join(CACHE, 'pmtiles.zip');
  log('下载 pmtiles CLI', CLI_URL);
  await download(CLI_URL, zip);
  log('解压 CLI');
  await new Promise((resolve, reject) => {
    const p = spawn('tar', ['-xf', zip, '-C', BIN], { stdio: 'inherit' });
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`tar exit ${c}`))));
    p.on('error', reject);
  });
  unlinkSync(zip);
  if (!(await cliWorks())) throw new Error('pmtiles CLI 不可执行');
  const ver = [];
  await run(CLI, ['version'], (l) => ver.push(l));
  log('CLI 就绪', ver.join(' '));
}

async function latestBuild() {
  const list = await fetchJson(BUILDS);
  const rows = (Array.isArray(list) ? list : []).filter((b) => String(b.key ?? '').endsWith('.pmtiles'));
  rows.sort((a, b) => String(a.uploaded).localeCompare(String(b.uploaded)));
  const last = rows[rows.length - 1];
  if (!last) throw new Error('builds.json 无可用构建');
  return { url: `https://build.protomaps.com/${last.key}`, key: last.key, size: last.size };
}

async function reachable(url) {
  try {
    const head = await curlText(['-I', '--max-time', '20', url]);
    return /^HTTP\/[\d.]+ 200/m.test(head);
  } catch {
    return false;
  }
}

async function pickSource() {
  if (await reachable(MIRROR)) return { url: MIRROR, key: 'v4', size: 0 };
  return latestBuild();
}

async function extract(src, dst, bbox, maxzoom, minzoom, threads) {
  const args = ['extract', src, dst, `--bbox=${bbox}`, `--maxzoom=${maxzoom}`, `--download-threads=${threads}`];
  if (minzoom !== null) args.push(`--minzoom=${minzoom}`);
  log('裁剪', bbox, `z${minzoom ?? 0}-z${maxzoom}`, `threads=${threads}`);
  await run(CLI, args, (l) => log(l));
}

async function header(file) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (!env.GODEBUG) env.GODEBUG = 'http2client=0';
    const p = spawn(CLI, ['show', file, '--header-json'], { cwd: ROOT, env });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => {
      out += c.toString('utf8');
    });
    p.stderr.on('data', (c) => {
      err += c.toString('utf8');
    });
    p.on('error', reject);
    p.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`show exit ${code} ${err.trim()}`));
        return;
      }
      try {
        resolve(JSON.parse(out));
      } catch {
        reject(new Error(`header 解析失败：${out.slice(0, 120)}`));
      }
    });
  });
}

async function mapLimit(items, limit, fn) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await fn(items[index]);
    }
  });
  await Promise.all(workers);
}

function glyphRanges() {
  const out = [];
  for (let start = 0; start < GLYPH_LIMIT; start += GLYPH_STEP) out.push(`${start}-${start + GLYPH_STEP - 1}`);
  return out;
}

async function fetchGlyphs(root) {
  const ranges = glyphRanges();
  const failed = [];
  for (const font of GLYPH_FONTS) {
    const dir = join(root, font);
    ensureDir(dir);
    const missing = ranges.filter((r) => !existsSync(join(dir, `${r}.pbf`)));
    if (!missing.length) {
      log('字形已齐', font, `${ranges.length} 片`);
      continue;
    }
    log('字形', font, `待补 ${missing.length}/${ranges.length} 片`);
    await mapLimit(missing, GLYPH_PARALLEL, async (r) => {
      const url = `https://protomaps.github.io/basemaps-assets/fonts/${encodeURIComponent(font)}/${r}.pbf`;
      try {
        await download(url, join(dir, `${r}.pbf`), true);
      } catch (e) {
        failed.push(`${font}/${r}: ${e.message}`);
      }
    });
    const size = ranges.reduce((sum, r) => sum + (existsSync(join(dir, `${r}.pbf`)) ? statSync(join(dir, `${r}.pbf`)).size : 0), 0);
    log('字形完成', font, `${(size / 1048576).toFixed(1)} MB`);
  }
  if (failed.length) throw new Error(`字形下载失败 ${failed.length} 片：${failed.slice(0, 3).join('；')}`);
}

function offlineStyle(json, key) {
  const layers = [];
  for (const l of json.layers) {
    if (l.type === 'background' || l.type === 'fill' || l.type === 'line') {
      layers.push(l);
      continue;
    }
    if (l.type !== 'symbol') continue;
    const src = l['source-layer'];
    if (src !== 'places' && src !== 'roads') continue;
    const layout = { ...(l.layout ?? {}) };
    delete layout['icon-image'];
    delete layout['icon-size'];
    delete layout['icon-anchor'];
    delete layout['icon-allow-overlap'];
    delete layout['icon-ignore-placement'];
    delete layout['icon-padding'];
    if (!layout['text-field']) continue;
    layout['text-font'] = [FONT];
    const paint = {};
    for (const [k, v] of Object.entries(l.paint ?? {})) {
      if (!k.startsWith('icon-')) paint[k] = v;
    }
    layers.push({ ...l, layout, paint });
  }
  return {
    version: 8,
    name: `战术地图军棋 · 本地底图 ${key}`,
    glyphs: '/data/tiles/glyphs/{fontstack}/{range}.pbf',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles:///data/tiles/${key}.pmtiles`,
        attribution: ATTRIBUTION,
      },
    },
    layers,
  };
}

function readIndex(file) {
  try {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(j.zones) ? j : { generated: '', zones: [] };
  } catch {
    return { generated: '', zones: [] };
  }
}

async function main() {
  ensureDir(OUT);
  ensureDir(CACHE);
  const world = arg('world', '') === '1' || process.argv.includes('--world');
  const key = arg('key', world ? 'world' : 'fulda');
  const bbox = world ? WORLD_BBOX : arg('bbox', DEFAULT_BBOX);
  const maxzoom = Number(arg('maxzoom', world ? '6' : '13'));
  const minzoomArg = arg('minzoom', '');
  const minzoom = minzoomArg ? Number(minzoomArg) : null;
  const name = arg('name', world ? '全球底图' : '富尔达缺口');
  const theme = arg('theme', 'light');
  const force = arg('force', '') === '1';
  const skipCli = arg('skip-cli', '') === '1';
  const threads = Number(arg('threads', '8'));

  if (arg('glyphs-only', '') === '1') {
    await fetchGlyphs(join(OUT, 'glyphs'));
    log('字形就绪', GLYPH_FONTS.join(' · '));
    return;
  }

  if (!skipCli) await ensureCli();

  const given = arg('source', '');
  const build = given ? { url: given, key: given.split('/').pop(), size: 0 } : await pickSource();
  log('数据源', build.url, build.size ? `${Math.round(build.size / 1e9)} GB` : '');

  const out = join(OUT, `${key}.pmtiles`);
  const had = existsSync(out) && !force;
  if (had) {
    log('已存在，跳过裁剪（--force=1 覆盖）', `${(statSync(out).size / 1048576).toFixed(1)} MB`);
  } else {
    await extract(build.url, out, bbox, maxzoom, minzoom, threads);
  }
  const size = statSync(out).size;
  log('体积', `${(size / 1048576).toFixed(1)} MB`);

  const h = await header(out);
  const styleUrl = `${STYLE_API}?version=4&theme=${theme}&tiles=${encodeURIComponent(build.url)}&lang=en`;
  log('取 style', theme);
  const style = offlineStyle(await fetchJson(styleUrl), key);
  writeFileSync(join(OUT, `${key}.style.json`), JSON.stringify(style), 'utf8');
  writeFileSync(join(OUT, 'base.style.json'), JSON.stringify(style), 'utf8');
  log('图层', style.layers.length, '（符号层改为纯文字 + 本地字形）');

  await fetchGlyphs(join(OUT, 'glyphs'));

  const idxFile = join(OUT, 'index.json');
  const idx = readIndex(idxFile);
  const bounds = Array.isArray(h.bounds)
    ? h.bounds
    : [h.min_lon, h.min_lat, h.max_lon, h.max_lat];
  const center = Array.isArray(h.center) ? [h.center[0], h.center[1]] : [h.center_lon, h.center_lat];
  const entry = {
    key,
    name,
    file: `${key}.pmtiles`,
    style: `${key}.style.json`,
    bbox: bounds,
    center,
    kind: world ? 'world' : 'region',
    minzoom: h.minzoom,
    maxzoom: h.maxzoom,
    sizeMB: Number((size / 1048576).toFixed(2)),
    source: build.key,
    theme,
    attribution: ATTRIBUTION,
    generated: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
  idx.zones = idx.zones.filter((z) => z.key !== key);
  idx.zones.push(entry);
  idx.generated = entry.generated;
  writeFileSync(idxFile, JSON.stringify(idx, null, 1), 'utf8');
  log('写入 index.json', `${idx.zones.length} 个底图包`);
  log('完成', entry.file, `${entry.sizeMB} MB`, `z${entry.minzoom}-z${entry.maxzoom}`);
}

main().catch((e) => {
  log('失败', e.message);
  process.exit(1);
});
