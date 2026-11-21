export type MapLang = 'zh' | 'en' | 'local';

export const LANGS: MapLang[] = ['zh', 'en', 'local'];

export const LANG_LABEL: Record<MapLang, string> = { zh: '中文', en: 'EN', local: '本地名' };

export interface ZhNames {
  places?: Record<string, string>;
  water?: Record<string, string>;
}

export interface ZhNamesDoc {
  v?: number;
  places?: Record<string, string>;
  water?: Record<string, string>;
}

export type NameScope = 'places' | 'water';

export function nameField(lang: MapLang, dict: ZhNames | null, scope: NameScope): unknown {
  if (lang === 'en') return ['coalesce', ['get', 'name:en'], ['get', 'name']];
  if (lang !== 'zh') return null;
  const table = (dict ? dict[scope] : null) ?? {};
  const match: unknown[] = ['match', ['get', 'name']];
  for (const [local, zh] of Object.entries(table)) match.push(local, zh);
  match.push(['get', 'name:en']);
  return [
    'coalesce',
    ['get', 'name:zh-Hans'],
    ['get', 'name:zh-Hant'],
    match,
    ['get', 'name:en'],
    ['get', 'name'],
  ];
}
