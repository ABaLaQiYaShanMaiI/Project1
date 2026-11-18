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
