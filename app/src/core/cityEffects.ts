export interface CityMods {
  move: number;
  defend: number;
  recon: number;
  arty: number;
  supply: number;
}

export const CITY_BASE: CityMods = {
  move: -0.3,
  defend: 0.25,
  recon: -0.25,
  arty: -0.35,
  supply: 0.2,
};

export const MOD_KEYS: Array<keyof CityMods> = ['move', 'defend', 'recon', 'arty', 'supply'];

export const MOD_LABEL: Record<keyof CityMods, string> = {
  move: '机动',
  defend: '防御',
  recon: '侦察',
  arty: '炮兵',
  supply: '补给',
};

export const CITY_FADE = 1.25;

export function urbanWeight(distM: number, radiusM: number): number {
  if (radiusM <= 0) return 0;
  const t = 1 - distM / (radiusM * CITY_FADE);
  return Math.max(0, Math.min(1, t));
}

export function cityScale(radiusM: number): number {
  return Math.max(0.55, Math.min(1.35, 0.55 + radiusM / 16000));
}

export function cityMods(weight: number, radiusM: number): CityMods {
  const k = weight * cityScale(radiusM);
  return {
    move: CITY_BASE.move * k,
    defend: CITY_BASE.defend * k,
    recon: CITY_BASE.recon * k,
    arty: CITY_BASE.arty * k,
    supply: CITY_BASE.supply * k,
  };
}

export function fmtMod(v: number): string {
  const pct = Math.round(Math.abs(v) * 100);
  if (pct === 0) return '±0%';
  return `${v > 0 ? '+' : '−'}${pct}%`;
}

export interface CityZone {
  name: string;
  lon: number;
  lat: number;
  r: number;
  weight: number;
  mods: CityMods;
}
