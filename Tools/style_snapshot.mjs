import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = 'Tools/.style-cache';
const TSC = join(ROOT, 'app', 'node_modules', 'typescript', 'bin', 'tsc');

function fail(msg) {
  console.error(`[style_snapshot] ${msg}`);
  process.exit(2);
}

mkdirSync(join(ROOT, OUT), { recursive: true });
const r = spawnSync(
  process.execPath,
  [TSC, 'Tools/style_snapshot.ts', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020', '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--strict'],
  { cwd: ROOT, encoding: 'utf8' },
);
if (r.status !== 0) fail(`tsc 编译失败：
${(r.stdout ?? '') + (r.stderr ?? '')}`);

const req = createRequire(import.meta.url);
const { build } = req(join(ROOT, OUT, 'Tools', 'style_snapshot.js'));

const base = JSON.parse(readFileSync(join(ROOT, 'app', 'public', 'data', 'tiles', 'base.style.json'), 'utf8'));
const box = [-180, -85.0511287, 180, 85.0511287];
const fc = { type: 'FeatureCollection', features: [] };
const inputs = {
  base,
  tiers: [
    { id: 'world', url: 'pmtiles:///data/tiles/world.pmtiles', bounds: box, minzoom: 0, maxzoom: 6, styleMin: 0, styleMax: 22 },
    { id: 'detail_germany', url: 'pmtiles:///data/tiles/germany.pmtiles', bounds: [5.8, 47.2, 15.1, 55.1], minzoom: 11, maxzoom: 12, styleMin: 11, styleMax: 22 },
  ],
  demTiers: [{ id: 'demx', tiles: '/data/dem/x/{z}/{x}/{y}.png', minzoom: 9, maxzoom: 11, bounds: box, styleMin: 9, styleMax: 22 }],
  slopeTiers: [{ id: 'germany', tiles: '/data/slope/germany/{z}/{x}/{y}.png', minzoom: 11, maxzoom: 11, bounds: [5.8, 47.2, 15.1, 55.1], styleMin: 11 }],
  railsLow: fc,
  railsWorldFine: fc,
  railsWorldCoarse: fc,
  urbanWorld: fc,
  contours: fc,
  grid: fc,
  poi: fc,
};

const spec = build(inputs);
const text = JSON.stringify(spec);
const hash = `sha256:${createHash('sha256').update(text).digest('hex')}`;
if (process.argv.includes('--json')) {
  console.log(text);
  process.exit(0);
}
const raw = (process.argv.find((s) => s.startsWith('--expect=')) || '').slice(9);
const expect = raw ? (raw.startsWith('sha256:') ? raw : `sha256:${raw}`) : '';
if (expect) {
  if (hash === expect) {
    console.log(`[ok] style 输出一致 ${hash.slice(0, 27)}… layers=${spec.layers.length}`);
  } else {
    console.error(`[fail] style 输出变化：
期望 ${expect}
实际 ${hash}`);
    process.exit(1);
  }
} else {
  console.log(hash);
  console.log(`layers=${spec.layers.length} bytes=${Buffer.byteLength(text)}`);
}
