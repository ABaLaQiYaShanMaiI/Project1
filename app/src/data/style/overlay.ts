import { GRID_MAJOR, GRID_MINOR, HALO, INK, POI_AIRPORT, POI_BRIDGE, POI_PORT, POI_PORT_STROKE, POI_STROKE, RING_INK, RING_LABEL_HALO, RING_LABEL_INK, URBAN_GREY, WATER_LABEL_HALO, WATER_LABEL_INK } from './tokens';
export function gridLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'grid-minor',
      type: 'line',
      source: 'grid',
      filter: ['==', ['get', 'major'], false],
      paint: { 'line-color': GRID_MINOR, 'line-opacity': 0.34, 'line-width': 0.8 },
    },
    {
      id: 'grid-major',
      type: 'line',
      source: 'grid',
      filter: ['==', ['get', 'major'], true],
      paint: { 'line-color': GRID_MAJOR, 'line-opacity': 0.42, 'line-width': 1.1 },
    },
    {
      id: 'grid-label',
      type: 'symbol',
      source: 'grid',
      filter: ['all', ['==', ['get', 'k'], 'label'], ['==', ['get', 'major'], true]],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 8, 10, 9.5, 14, 10.5],
        'text-padding': 2,
        'text-allow-overlap': false,
      },
      paint: { 'text-color': GRID_MAJOR, 'text-halo-color': HALO, 'text-halo-width': 1.4 },
    },
  ];
}

export function poiLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'poi-airport',
      type: 'circle',
      source: 'poi',
      filter: ['==', ['get', 'k'], 'airport'],
      minzoom: 5,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 4, 14, 6.5],
        'circle-color': POI_AIRPORT,
        'circle-opacity': 0.9,
        'circle-stroke-color': POI_STROKE,
        'circle-stroke-width': 1.2,
      },
    },
    {
      id: 'poi-port',
      type: 'circle',
      source: 'poi',
      filter: ['==', ['get', 'k'], 'port'],
      minzoom: 4,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.2, 8, 3.4, 12, 5],
        'circle-color': POI_PORT,
        'circle-opacity': 0.9,
        'circle-stroke-color': POI_PORT_STROKE,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'poi-station',
      type: 'circle',
      source: 'poi',
      filter: ['==', ['get', 'k'], 'station'],
      minzoom: 9,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 1.8, 13, 2.8, 16, 4],
        'circle-color': INK,
        'circle-opacity': 0.95,
        'circle-stroke-color': POI_STROKE,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'poi-bridge',
      type: 'circle',
      source: 'poi',
      filter: ['==', ['get', 'k'], 'bridge'],
      minzoom: 11,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.1, 14, 1.9, 17, 2.6],
        'circle-color': POI_BRIDGE,
        'circle-opacity': 0.75,
        'circle-stroke-color': POI_STROKE,
        'circle-stroke-width': 0.5,
      },
    },
  ];
}

export function ringLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'ring-line',
      type: 'line',
      source: 'rings',
      paint: {
        'line-color': RING_INK,
        'line-opacity': 0.88,
        'line-width': ['case', ['==', ['%', ['get', 'km'], 50], 0], 1.8, 1.1],
        'line-dasharray': [3, 2],
      },
    },
    {
      id: 'ring-label',
      type: 'symbol',
      source: 'rings',
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'km']], ' km'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
        'symbol-placement': 'line-center',
      },
      paint: { 'text-color': RING_LABEL_INK, 'text-halo-color': RING_LABEL_HALO, 'text-halo-width': 1.4 },
    },
  ];
}
export function seaLabelLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'sea-label',
      type: 'symbol',
      source: 'sea-labels',
      minzoom: 3,
      maxzoom: 8,
      layout: {
        'text-field': ['get', 'n'],
        'text-font': ['Noto Sans Regular'],
        'text-transform': 'uppercase',
        'text-letter-spacing': ['interpolate', ['linear'], ['zoom'], 3, 0.24, 6, 0.14],
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          ['case', ['==', ['get', 's'], 1], 15, ['==', ['get', 's'], 2], 12, 10],
          6,
          ['case', ['==', ['get', 's'], 1], 21, ['==', ['get', 's'], 2], 15, 12],
        ],
        'text-max-width': 8,
        'text-padding': 12,
        'symbol-sort-key': ['get', 's'],
      },
      paint: {
        'text-color': WATER_LABEL_INK,
        'text-halo-color': WATER_LABEL_HALO,
        'text-halo-width': 1.6,
        'text-opacity': 0.9,
      },
    },
  ];
}

export function urbanWorldLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'urban-world',
      type: 'fill',
      source: 'urban-world',
      minzoom: 4,
      maxzoom: 9,
      paint: { 'fill-color': URBAN_GREY, 'fill-opacity': 0.45 },
    },
  ];
}