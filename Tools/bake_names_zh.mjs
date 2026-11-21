import { openAsBlob, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'app', 'public', 'data');
const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'tactical-map-wargame/0.1 (offline map bake)';
const CJK = /[\u3400-\u9FFF]/;

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clean(label) {
  return label.replace(/\s*[（(][^（()）]*[)）]\s*$/, '').trim();
}

const PACK = arg('tiles', join(DATA, 'tiles', 'world.pmtiles'));
const ZOOM = Number(arg('zoom', '6'));
const OUT = arg('out', join(DATA, 'names_zh.json'));
const MAX = Number(arg('max', '1200'));
const BATCH = Number(arg('batch', '160'));

const doc = JSON.parse(readFileSync(OUT, 'utf8'));
const curated = { ...(doc.places ?? {}) };
const archive = new PMTiles(new FileSource(await openAsBlob(PACK)));
const n = 2 ** ZOOM;
const seen = new Map();
let tiles = 0;
let feats = 0;

for (let x = 0; x < n; x += 1) {
  for (let y = 0; y < n; y += 1) {
    const tile = await archive.getZxy(ZOOM, x, y);
    if (!tile) continue;
    tiles += 1;
    const layers = decodeTile(Buffer.from(tile.data));
    const places = layers.get('places');
    if (!places) continue;
    for (const f of places.features) {
      const p = f.props;
      feats += 1;
      const name = String(p.name ?? '');
      if (!name || p['name:zh-Hans'] || p['name:zh-Hant']) continue;
      if (curated[name]) continue;
      const qid = String(p.wikidata ?? '');
      if (!/^Q\d+$/.test(qid)) continue;
      const cur = seen.get(name) ?? { ids: new Set(), rank: 0, pop: 0 };
      cur.ids.add(qid);
      cur.rank = Math.max(cur.rank, Number(p.population_rank ?? 0));
      cur.pop = Math.max(cur.pop, Number(p.population ?? 0));
      seen.set(name, cur);
    }
  }
}

console.log(`tiles=${tiles} places=${feats} missing=${seen.size}`);

const qids = [...new Set([...seen.values()].flatMap((v) => [...v.ids]))];
const labels = new Map();
for (let i = 0; i < qids.length; i += BATCH) {
  const part = qids.slice(i, i + BATCH);
  const query = `SELECT ?item ?label WHERE { VALUES ?item { ${part.map((q) => `wd:${q}`).join(' ')} } ?item rdfs:label ?label. FILTER(LANG(?label) IN ('zh-hans','zh')) }`;
  const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`sparql ${res.status} at ${i}`);
  const json = await res.json();
  for (const b of json.results.bindings) {
    const qid = b.item.value.split('/').pop();
    const lang = b.label['xml:lang'];
    const prev = labels.get(qid);
    if (!prev || (lang === 'zh-hans' && prev.lang !== 'zh-hans')) labels.set(qid, { lang, value: b.label.value });
  }
  console.log(`sparql ${Math.min(i + BATCH, qids.length)}/${qids.length} labels=${labels.size}`);
  await sleep(400);
}

const picked = [];
let ambiguous = 0;
let empty = 0;
for (const [name, info] of seen) {
  const values = new Set();
  for (const id of info.ids) {
    const hit = labels.get(id);
    if (!hit) continue;
    const zh = clean(hit.value);
    if (!zh || !CJK.test(zh)) continue;
    values.add(zh);
  }
  if (!values.size) {
    empty += 1;
    continue;
  }
  if (values.size > 1) {
    ambiguous += 1;
    continue;
  }
  const zh = [...values][0];
  if (zh === name) continue;
  picked.push({ name, zh, rank: info.rank, pop: info.pop });
}

picked.sort((a, b) => b.rank - a.rank || b.pop - a.pop || a.name.localeCompare(b.name));
const kept = picked.slice(0, MAX);
const places = { ...curated };
for (const p of kept) places[p.name] = p.zh;
const sorted = {};
for (const key of Object.keys(places).sort()) sorted[key] = places[key];
const next = {
  v: 2,
  source: '人工词表 + Wikidata zh 标签（烘焙期，CC0）；冲突名跳过',
  places: sorted,
  water: doc.water ?? {},
};
writeFileSync(OUT, JSON.stringify(next, null, 1), 'utf8');
console.log(
  `picked=${picked.length} kept=${kept.length} curated=${Object.keys(curated).length} ambiguous=${ambiguous} empty=${empty} bytes=${statSync(OUT).size}`,
);
