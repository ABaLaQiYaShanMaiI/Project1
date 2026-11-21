import { useStore, store } from '../hooks';
import { fpsTone } from '../store';
import { LANGS, LANG_LABEL } from '../data/style/lang';
import { strings } from '../i18n';

export function TopBar(): JSX.Element {
  useStore();
  const base = store.basemap;
  const s = strings(store.lang);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">⬡</span>
        <div className="brand-text">
          <span className="brand-name">{s.brand}</span>
          <span className="brand-sub">{s.brandSub}</span>
        </div>
        <span className="scenario">{base ? (store.lang === 'en' ? base.nameEn : base.name) : s.worldMap} · 1985</span>
      </div>

      <div className="clock">
        <div className="clock-main">{base ? s.layers(base.tiers.length) : s.loading}</div>
        <div className="clock-sub">{base ? s.offline(base.maxzoom, base.sizeMB) : s.localPmtiles}</div>
      </div>

      <div className="group">
        <div className="seg" role="group" aria-label={s.ariaLang}>
          {LANGS.map((lang) => (
            <button
              key={lang}
              className={`seg-btn ${store.lang === lang ? 'active' : ''}`}
              onClick={() => store.setLang(lang)}
            >
              {LANG_LABEL[lang]}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label={s.ariaStatus}>
          <span className={`seg-btn ${store.markers.length ? 'active' : ''}`}>
            <i className="dot dot-blue" />
            {s.markers(store.markers.length)}
          </span>
          <span className={`seg-btn fps fps-${fpsTone(store.perf.fps)}`}>
            <i className="dot dot-amber" />
            {store.perf.fps} FPS
          </span>
        </div>
      </div>
    </header>
  );
}
