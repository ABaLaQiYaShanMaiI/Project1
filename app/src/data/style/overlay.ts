export function gridLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'grid-minor',
      type: 'line',
      source: 'grid',
      filter: ['==', ['get', 'major'], false],
      paint: { 'line-color': '#4a6b8a', 'line-opacity': 0.34, 'line-width': 0.8 },
    },
    {
      id: 'grid-major',
      type: 'line',
      source: 'grid',
      filter: ['==', ['get', 'major'], true],
      paint: { 'line-color': '#3f5f7d', 'line-opacity': 0.42, 'line-width': 1.1 },
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
        'circle-color': '#3f5570',
        'circle-opacity': 0.9,
        'circle-stroke-color': '#f3eee1',
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
        'circle-color': '#1f6f8b',
        'circle-opacity': 0.9,
        'circle-stroke-color': '#eaf2f5',
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
        'circle-color': '#8a5a3c',
        'circle-opacity': 0.75,
        'circle-stroke-color': '#f3eee1',
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
        'line-color': '#c04227',
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
      paint: { 'text-color': '#8f2f1f', 'text-halo-color': '#f6f0e4', 'text-halo-width': 1.4 },
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
      paint: { 'fill-color': '#b9b3a7', 'fill-opacity': 0.45 },
    },
  ];
}