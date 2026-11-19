import {
  ADDRESS_LABEL_INK,
  ARTERIAL_CASING,
  ARTERIAL_MINZOOM,
  ARTERIAL_FILL,
  ARTERIAL_ROADS,
  BASE_BOUNDARY_COUNTRY,
  BASE_BOUNDARY_REGION,
  BUILDING_FILL,
  BUILDING_OUTLINE_FADE,
  EARTH,
  FAINT_CASING,
  FAINT_ROAD,
  HALO,
  INK,
  LANDCOVER,
  LANDCOVER_DEFAULT,
  LANDUSE,
  LANDUSE_DEFAULT,
  MAIN_MINZOOM,
  MAIN_ROAD_COLORS,
  MAIN_ROAD_W,
  MAIN_ROADS,
  PAPER,
  RAIL_INK,
  ROAD_LABEL_HALO,
  ROAD_LABEL_INK,
  ROADS,
  WATER_FILL,
  WATER_LABEL_HALO,
  WATER_LABEL_INK,
  WATER_LINE,
  WATER_OUTLINE,
} from './tokens';
import { zoomWidth, railWidth, railNarrow } from './widths';

const MAIN_MINZOOM_MINOR = 12;

function roadClass(id: string): { cls: string; casing: boolean; tunnel: boolean; bridge: boolean } | null {
  if (!id.startsWith('roads_')) return null;
  const rest = id.slice(6);
  if (rest.startsWith('labels_')) return null;
  const casing = rest.includes('_casing');
  const tunnel = rest.includes('tunnels_');
  const bridge = rest.includes('bridges_');
  const body = rest
    .replace('bridges_', '')
    .replace('tunnels_', '')
    .replace('_casing_late', '')
    .replace('_casing_early', '')
    .replace('_casing', '');
  const cls = body.includes('minor_service') ? 'minor_service' : body;
  return { cls, casing, tunnel, bridge };
}

export function restyle(layer: Record<string, unknown>): Record<string, unknown> {
  const rawId = String(layer.id);
  const id = rawId.includes('__') ? rawId.slice(0, rawId.indexOf('__')) : rawId;
  const next = { ...layer } as Record<string, unknown>;
  const paint = { ...(layer.paint as Record<string, unknown> | undefined) } as Record<string, unknown>;
  const layout = { ...(layer.layout as Record<string, unknown> | undefined) } as Record<string, unknown>;
  const sourceLayer = String(layer['source-layer'] ?? '');

  if (id === 'background') {
    paint['background-color'] = PAPER;
  } else if (id === 'earth') {
    paint['fill-color'] = EARTH;
  } else if (id === 'landcover') {
    const match: unknown[] = ['match', ['get', 'kind']];
    for (const [k, v] of Object.entries(LANDCOVER)) match.push(k, v);
    match.push(LANDCOVER_DEFAULT);
    paint['fill-color'] = match;
    paint['fill-opacity'] = 0.95;
  } else if (sourceLayer === 'landuse') {
    const kind = id.replace('landuse_', '');
    paint['fill-color'] = LANDUSE[kind] ?? LANDUSE_DEFAULT;
    paint['fill-opacity'] = ['interpolate', ['linear'], ['zoom'], 6, 0.6, 10, 0.9, 13, 0.96];
  } else if (sourceLayer === 'water' && layer.type === 'fill') {
    paint['fill-color'] = WATER_FILL;
    paint['fill-outline-color'] = WATER_OUTLINE;
  } else if (sourceLayer === 'water') {
    paint['line-color'] = WATER_LINE;
    paint['line-width'] = [
      'interpolate',
      ['linear'],
      ['zoom'],
      6,
      ['case', ['==', ['get', 'kind_detail'], 'river'], 0.8, 0.4],
      10,
      ['case', ['==', ['get', 'kind_detail'], 'river'], 1.5, 0.7],
      14,
      ['case', ['==', ['get', 'kind_detail'], 'river'], 2.6, 1.2],
    ];
    paint['line-opacity'] = 0.9;
  } else if (id === 'buildings') {
    paint['fill-color'] = BUILDING_FILL;
    paint['fill-outline-color'] = [...BUILDING_OUTLINE_FADE];
  } else if (sourceLayer === 'boundaries') {
    const country = id === 'boundaries_country';
    paint['line-color'] = country ? BASE_BOUNDARY_COUNTRY : BASE_BOUNDARY_REGION;
    paint['line-width'] = country
      ? ['interpolate', ['linear'], ['zoom'], 2, 0.6, 4, 0.8, 10, 1.4]
      : ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 0.9];
    paint['line-dasharray'] = country ? [3, 2] : [4, 3];
  } else if (sourceLayer === 'roads' && layer.type === 'line') {
    const rc = roadClass(id);
    layout['line-join'] = 'round';
    layout['line-cap'] = 'round';
    if (rc && rc.cls === 'rail') {
      paint['line-color'] = RAIL_INK;
      paint['line-width'] = railWidth(3.4, railNarrow());
      paint['line-opacity'] = 1;
      delete paint['line-dasharray'];
      next.minzoom = 11;
    } else if (rc) {
      const key: unknown = ['coalesce', ['get', 'kind_detail'], ['get', 'kind']];
      const isMain: unknown = ['in', key, ['literal', MAIN_ROADS]];
      const isArterial: unknown = ['in', key, ['literal', ARTERIAL_ROADS]];
      const arterialFade: unknown = ['interpolate', ['linear'], ['zoom'], MAIN_MINZOOM, 0, ARTERIAL_MINZOOM, 1];
      const spec = ROADS[rc.cls] ?? ROADS.other;
      const isStrip = rc.cls === 'runway' || rc.cls === 'taxiway' || rc.cls === 'pier';
      const widthFactor: unknown = isStrip
        ? 1
        : rc.cls === 'link'
          ? 0.62
          : ['case', isMain, 1, isArterial, 0.62, 0.4];
      if (isStrip) {
        paint['line-color'] = spec.fill;
        paint['line-width'] = zoomWidth(spec.w);
        paint['line-opacity'] = 0.8;
        if (rc.cls !== 'pier') next.minzoom = 13;
      } else {
        const cmatch: unknown[] = ['match', key];
        const fmatch: unknown[] = ['match', key];
        for (const [kind, [fill, casing]] of Object.entries(MAIN_ROAD_COLORS)) {
          fmatch.push(kind, fill);
          cmatch.push(kind, casing);
        }
        fmatch.push(FAINT_ROAD);
        cmatch.push(FAINT_CASING);
        if (rc.casing) {
          paint['line-color'] = rc.bridge
            ? PAPER
            : ['case', isMain, cmatch, isArterial, ARTERIAL_CASING, FAINT_CASING];
          paint['line-width'] = zoomWidth(rc.bridge ? 2 : 1.7, widthFactor);
          paint['line-opacity'] = ['case', isMain, 0.9, isArterial, ['*', 0.5, arterialFade], 0.38];
        } else {
          paint['line-color'] = ['case', isMain, fmatch, isArterial, ARTERIAL_FILL, FAINT_ROAD];
          paint['line-width'] = zoomWidth(MAIN_ROAD_W, widthFactor);
          paint['line-opacity'] = ['case', isMain, 0.9, isArterial, ['*', 0.8, arterialFade], 0.55];
        }
      }
      if (rc.tunnel) paint['line-opacity'] = ['case', isMain, 0.4, 0.22];
      if (rc.cls === 'minor' && !isStrip) next.minzoom = MAIN_MINZOOM_MINOR;
      else if (!isStrip && rc.cls !== 'minor_service' && rc.cls !== 'other') next.minzoom = MAIN_MINZOOM;
      if (rc.cls === 'minor_service' || rc.cls === 'other') next.minzoom = 13;
    }
  } else if (sourceLayer === 'places') {
    const size = id === 'places_country' ? 13 : id === 'places_region' ? 11.5 : id === 'places_locality' ? 11.5 : 10.5;
    paint['text-color'] = INK;
    paint['text-halo-color'] = HALO;
    paint['text-halo-width'] = 1.5;
    layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 3, size * 0.8, 10, size * 1.1];
  } else if (sourceLayer === 'roads' && layer.type === 'symbol') {
    paint['text-color'] = ROAD_LABEL_INK;
    paint['text-halo-color'] = ROAD_LABEL_HALO;
    paint['text-halo-width'] = 1.3;
  } else if (id.startsWith('water_label') || id.startsWith('water_waterway_label')) {
    paint['text-color'] = WATER_LABEL_INK;
    paint['text-halo-color'] = WATER_LABEL_HALO;
  } else if (id === 'address_label') {
    paint['text-color'] = ADDRESS_LABEL_INK;
    paint['text-halo-color'] = HALO;
  }

  next.paint = paint;
  if (Object.keys(layout).length) next.layout = layout;
  return next;
}
