import type { LayerKey } from '../../store';

export function baseIdOf(id: string): string {
  return id.includes('__') ? id.slice(0, id.indexOf('__')) : id;
}

const NEW_IDS: Partial<Record<string, LayerKey>> = {
  relief: 'relief',
  contour: 'contour',
  'contour-bold': 'contour',
  'contour-label': 'contour',
  'rail-hatch': 'rail',
  'grid-minor': 'grid',
  'grid-major': 'grid',
  'sea-label': 'label',
  'road-world': 'road',
  'road-world-casing': 'road',
  'river-world': 'water',
};

export function groupOf(id: string): LayerKey | null {
  const base = baseIdOf(id);
  const fixed = NEW_IDS[base];
  if (fixed) return fixed;
  if (base.startsWith('contour')) return 'contour';
  if (base === 'urban-world') return 'urban';
  if (base.startsWith('density-')) return 'building';
  if (base === 'relief-tint') return 'relief';
  if (base.includes('-relief') || base === 'relief') return 'relief';
  if (base === 'roads_rail' || base.startsWith('rail-')) return 'rail';
  if (base.startsWith('roads_labels') || base === 'address_label') return 'label';
  if (base.startsWith('roads_runway') || base.startsWith('roads_taxiway')) return 'airport';
  if (base.startsWith('roads_minor') || base.startsWith('roads_other')) return 'minor';
  if (base.startsWith('roads_')) return 'road';
  if (base.startsWith('water')) return base.includes('label') ? 'label' : 'water';
  if (base.startsWith('slope')) return 'slope';
  if (base === 'buildings' || base === 'address_label' || base.startsWith('buildings_glow')) return 'building';
  if (base.startsWith('places')) return 'label';
  if (base.startsWith('boundary')) return 'boundary';
  if (base === 'landcover_urban') return 'urban';
  if (base === 'earth' || base === 'landcover') return 'landcover';
  if (base === 'landuse_urban_glow' || base === 'landuse_residential') return 'urban';
  if (base.startsWith('poi-')) return 'poi';
  if (base === 'landuse_military') return 'military';
  if (base === 'landuse_aerodrome' || base === 'landuse_runway' || base === 'aerodrome_mark') return 'airport';
  if (base === 'landuse_hospital' || base === 'landuse_school' || base === 'landuse_industrial') return 'urban';
  if (base === 'landuse_station' || base === 'landuse_port') return 'urban';
  if (base.startsWith('landuse_')) return 'landcover';
  return null;
}
