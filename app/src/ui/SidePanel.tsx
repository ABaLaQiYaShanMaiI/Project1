import { useState } from 'react';
import { useStore, store } from '../hooks';
import type { Side, UnitKind } from '../core/markers';
import { LITE_MODE, LAYER_TREE, PERSONAS } from '../store';
import { strings } from '../i18n';

const UNIT_KINDS: UnitKind[] = ['infantry', 'armor', 'artillery', 'recon', 'hq'];
const SIDES: Side[] = ['nato', 'wp'];

export function SidePanel(): JSX.Element {
  useStore();
  const base = store.basemap;
  const [advanced, setAdvanced] = useState(false);
  const s = strings(store.lang);

  return (
    <aside className="side">
      <div className="layer-panel">
        <div className="lp-title">{s.mapType}</div>
        <div className="persona-list">
          {PERSONAS.map((p) => {
            const ui = s.persona[p.key] ?? { label: p.label, sub: p.sub };
            return (
              <button
                key={p.key}
                className={`persona ${store.preset === p.key ? 'on' : ''}`}
                onClick={() => store.applyPreset(p.key)}
              >
                <span>{ui.label}</span>
                <span className="persona-sub dim">{ui.sub}</span>
              </button>
            );
          })}
        </div>
        <label className="lp-item lp-force">
          <input
            type="checkbox"
            checked={store.forceDetail}
            onChange={(e) => store.setForceDetail(e.target.checked)}
          />
          <span>{s.forceDetail}</span>
        </label>
        <div className="lp-hint">{s.forceHint}</div>
        {LITE_MODE && <div className="lp-hint">{s.liteHint}</div>}
        <div className="lp-hint">{s.customHint}</div>
      </div>

      <div className="layer-panel">
        <button className="lp-fold" onClick={() => setAdvanced((v) => !v)}>
          <span className="lp-title">{s.advanced}</span>
          <span className="lp-caret mono">{advanced ? '▾' : '▸'}</span>
        </button>
        {advanced &&
          LAYER_TREE.map((group) => (
            <div key={group.key} className="lg">
              <label className="lg-head">
                <input
                  type="checkbox"
                  checked={store.groupOn(group.key)}
                  onChange={(e) => store.setGroup(group.key, e.target.checked)}
                />
                <span>{s.groups[group.key] ?? group.label}</span>
              </label>
              <div className="lg-items">
                {group.items.map((item) => (
                  <label key={item.key} className="lp-item">
                    <input
                      type="checkbox"
                      checked={Boolean(store.layers[item.key])}
                      onChange={(e) => store.setLayer(item.key, e.target.checked)}
                    />
                    <span>{s.items[item.key] ?? item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="layer-panel">
        <div className="lp-title">{s.markersPanel}</div>
        <div className="unit-sides">
          {SIDES.map((side) => (
            <button
              key={side}
              className={`unit-side ${side} ${store.markerSide === side ? 'on' : ''}`}
              onClick={() => store.setMarkerSide(side)}
            >
              {s.sides[side]}
            </button>
          ))}
        </div>
        <div className="unit-grid">
          {UNIT_KINDS.map((k) => (
            <button
              key={k}
              className={`unit-btn ${store.placing && store.markerKind === k ? 'on' : ''}`}
              onClick={() => store.setMarkerKind(k)}
            >
              {s.units[k]}
            </button>
          ))}
        </div>
        <div className="lp-hint">
          {store.placing
            ? s.placing(s.sides[store.markerSide], s.units[store.markerKind])
            : s.placeHint}
        </div>
        {store.markers.length > 0 && (
          <button className="btn small" onClick={() => store.clearMarkers()}>
            {s.clearMarkers(store.markers.length)}
          </button>
        )}
      </div>

      <div className="layer-panel">
        <div className="lp-title">{s.basemap}</div>
        {base ? (
          <>
            <div className="lp-hint">{base.name}</div>
            {base.tiers.map((t) => (
              <div key={t} className="lp-hint mono">
                {t}
              </div>
            ))}
            <div className="lp-hint">{s.basemapMeta(base.sizeMB)}</div>
          </>
        ) : (
          <div className="lp-hint">{s.reading}</div>
        )}
      </div>
    </aside>
  );
}

