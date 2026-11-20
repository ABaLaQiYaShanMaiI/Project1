import { HYPSOMETRIC_OPACITY, HYPSOMETRIC_RAMP } from './tokens';
import type { DemTier } from './types';

export function reliefTintLayer(dem: DemTier): Record<string, unknown> {
  return {
    id: `relief-tint__${dem.id}`,
    type: 'color-relief',
    source: dem.id,
    minzoom: dem.styleMin,
    maxzoom: dem.styleMax,
    paint: {
      'color-relief-opacity': HYPSOMETRIC_OPACITY,
      'color-relief-color': dem.ramp ?? HYPSOMETRIC_RAMP,
      resampling: 'linear',
    },
  };
}
