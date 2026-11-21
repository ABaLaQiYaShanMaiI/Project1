import type { MapLang } from './style/lang';

const KEY = 'map.lang.v1';

export function loadLang(): MapLang {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === 'zh' || raw === 'en' || raw === 'local') return raw;
  } catch {
    return 'zh';
  }
  return 'zh';
}

export function saveLang(lang: MapLang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    return;
  }
}
