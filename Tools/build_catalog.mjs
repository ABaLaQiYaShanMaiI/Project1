import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'Tools/.tile-cache/ne_admin0.geojson';
const OUT = 'Tools/country_catalog.json';
const PAD = 0.15;
const SPLIT_AREA = 6_000_000;
const SLICE_AREA = 3_000_000;
const ORDER = ['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania', 'Seven seas (open ocean)'];
const ALIAS = {
  czech_republic: 'czechia',
  people_s_republic_of_china: 'china',
  united_states_of_america: 'united_states',
  democratic_republic_of_the_congo: 'dr_congo',
  republic_of_the_congo: 'congo',
  turkish_republic_of_northern_cyprus: 'northern_cyprus',
};
const SKIP = new Set(['french_southern_and_antarctic_lands']);

function slug(name) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function rings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((p) => p[0]);
  return [];
}

function bboxOf(ring) {
  let w = 180;
  let s = 90;
  let e = -180;
  let n = -90;
  for (const [lon, lat] of ring) {
    if (lon < w) w = lon;
    if (lon > e) e = lon;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  return [w, s, e, n];
}

function areaKm2(box) {
  const [w, s, e, n] = box;
  const mid = ((s + n) / 2) * (Math.PI / 180);
  return (e - w) * 111.32 * Math.cos(mid) * (n - s) * 110.57;
}

const geo = JSON.parse(readFileSync(SRC, 'utf8'));
const used = new Set();
const entries = [];

for (const feature of geo.features) {
  const p = feature.properties ?? {};
  const nameEn = String(p.NAME_EN ?? p.NAME ?? '').trim();
  if (!nameEn || nameEn === 'Antarctica') continue;
  const parts = rings(feature.geometry);
  if (!parts.length) continue;
  let best = null;
  for (const ring of parts) {
    const box = bboxOf(ring);
    if (!best || areaKm2(box) > areaKm2(best)) best = box;
  }
  if (!best) continue;
  const box = [best[0] - PAD, best[1] - PAD, best[2] + PAD, best[3] + PAD];
  const area = areaKm2(box);
  const base = slug(nameEn) || 'country';
  if (SKIP.has(base)) continue;
  const zh = String(p.NAME_ZH ?? '').trim();
  const label = zh || nameEn;
  const stem = ALIAS[base] ?? base;
  const slices = area > SPLIT_AREA ? Math.min(4, Math.max(2, Math.ceil(area / SLICE_AREA))) : 1;
  for (let i = 0; i < slices; i += 1) {
    let key = stem;
    let part = null;
    if (slices > 1) {
      key = `${stem}_${i + 1}`;
      part = `${label}·${i + 1}`;
    }
    let n = 1;
    let unique = key;
    while (used.has(unique)) {
      n += 1;
      unique = `${key}_${n}`;
    }
    used.add(unique);
    const span = (box[2] - box[0]) / slices;
    const sub = slices > 1 ? [box[0] + span * i, box[1], box[0] + span * (i + 1), box[3]] : box;
    entries.push({
      key: unique,
      name: part ?? label,
      name_en: slices > 1 ? `${nameEn} (${i + 1}/${slices})` : nameEn,
      continent: String(p.CONTINENT ?? ''),
      bbox: sub.map((v) => Number(v.toFixed(3))),
      area_km2: Math.round(areaKm2(sub)),
      split_of: slices > 1 ? base : null,
    });
  }
}

entries.sort((a, b) => {
  const ai = ORDER.indexOf(a.continent);
  const bi = ORDER.indexOf(b.continent);
  return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || b.area_km2 - a.area_km2;
});

const doc = { v: 1, source: 'Natural Earth 110m admin_0（最大陆块 bbox，海外属地不计）', count: entries.length, entries };
writeFileSync(OUT, JSON.stringify(doc, null, 1) + '\n', 'utf8');
const byContinent = {};
for (const e of entries) byContinent[e.continent] = (byContinent[e.continent] ?? 0) + 1;
console.log('entries', entries.length, JSON.stringify(byContinent));
for (const key of ['france', 'china_1', 'russia_1', 'united_states_of_america', 'brazil_1', 'australia_1']) {
  const hit = entries.find((e) => e.key === key) ?? entries.find((e) => e.key.startsWith(key));
  if (hit) console.log(hit.key, hit.name, JSON.stringify(hit.bbox), hit.area_km2);
}
