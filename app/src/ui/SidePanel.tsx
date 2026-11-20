import { useState } from 'react';
import { useStore, store } from '../hooks';
import { SIDE_LABEL, UNIT_LABEL, type Side, type UnitKind } from '../core/markers';
import { LITE_MODE, LAYER_TREE, PERSONAS } from '../store';

const UNIT_KINDS: UnitKind[] = ['infantry', 'armor', 'artillery', 'recon', 'hq'];
const SIDES: Side[] = ['nato', 'wp'];

export function SidePanel(): JSX.Element {
  useStore();
  const base = store.basemap;
  const [advanced, setAdvanced] = useState(false);

  return (
    <aside className="side">
      <div className="layer-panel">
        <div className="lp-title">图种</div>
        <div className="persona-list">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              className={`persona ${store.preset === p.key ? 'on' : ''}`}
              onClick={() => store.applyPreset(p.key)}
            >
              <span>{p.label}</span>
              <span className="persona-sub dim">{p.sub}</span>
            </button>
          ))}
        </div>
        {LITE_MODE && <div className="lp-hint">低配模式：晕渲与等高线默认关闭</div>}
        <div className="lp-hint">手动改「高级图层」会退出当前图种</div>
      </div>

      <div className="layer-panel">
        <button className="lp-fold" onClick={() => setAdvanced((v) => !v)}>
          <span className="lp-title">高级图层</span>
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
                <span>{group.label}</span>
              </label>
              <div className="lg-items">
                {group.items.map((item) => (
                  <label key={item.key} className="lp-item">
                    <input
                      type="checkbox"
                      checked={Boolean(store.layers[item.key])}
                      onChange={(e) => store.setLayer(item.key, e.target.checked)}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="layer-panel">
        <div className="lp-title">兵牌</div>
        <div className="unit-sides">
          {SIDES.map((s) => (
            <button
              key={s}
              className={`unit-side ${s} ${store.markerSide === s ? 'on' : ''}`}
              onClick={() => store.setMarkerSide(s)}
            >
              {SIDE_LABEL[s]}
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
              {UNIT_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="lp-hint">
          {store.placing
            ? `点击地图放置${SIDE_LABEL[store.markerSide]}${UNIT_LABEL[store.markerKind]}；右键删除`
            : '选兵种后点击地图放置；拖动移动，右键删除'}
        </div>
        {store.markers.length > 0 && (
          <button className="btn small" onClick={() => store.clearMarkers()}>
            清空全部兵牌（{store.markers.length}）
          </button>
        )}
      </div>

      <div className="layer-panel">
        <div className="lp-title">底图</div>
        {base ? (
          <>
            <div className="lp-hint">{base.name}</div>
            {base.tiers.map((t) => (
              <div key={t} className="lp-hint mono">
                {t}
              </div>
            ))}
            <div className="lp-hint">
              体积 {base.sizeMB} MB · 全程离线 · 数据 © OpenStreetMap contributors (ODbL)
            </div>
          </>
        ) : (
          <div className="lp-hint">正在读取 data/tiles/index.json …</div>
        )}
      </div>
    </aside>
  );
}

