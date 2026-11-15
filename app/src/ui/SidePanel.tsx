import { useStore, store } from '../hooks';
import type { MapData } from '../core/types';
import type { LayerKey, Selection } from '../store';
import { mapTilerKey, saveMapTilerKey } from '../data/basemap';
import { SIDE_LABEL, UNIT_LABEL, type Side, type UnitKind } from '../core/markers';
import { POSTURE_HINT, POSTURE_LABEL, POSTURE_ORDER, ECHELON_COST, ECHELON_LABEL, ECHELON_ORDER } from '../core/units';
import { neighbourRefs, platoonCap, urbanIndex } from '../core/urban';
import { ORDER_HINT, ORDER_LABEL, ORDER_ORDER } from '../core/orders';

const UNIT_KINDS: UnitKind[] = ['infantry', 'armor', 'artillery', 'recon', 'hq'];
const SIDES: Side[] = ['nato', 'wp'];
import { COVER_LABEL } from '../core/types';
import { sampleBilinear, sampleNearest } from '../core/sample';
import { townFrontage } from '../core/towns';
import { controlAt, CONTROL_LABEL } from '../core/scenario';

const LAYERS: Array<[LayerKey, string]> = [
  ['showTerrain', '地形晕渲'],
  ['showContours', '等高线'],
  ['showHydro', '水系'],
  ['showRoads', '路网'],
  ['showBlocks', '城镇地块'],
  ['showLabels', '城镇标注'],
  ['showUnits', '兵排'],
];

export function SidePanel(): JSX.Element {
  useStore();
  const sel = store.selected;
  const map = store.map;

  const summary =
    sel?.kind === 'district' && sel.district
      ? `${sel.district.townName} · ${sel.district.label}`
      : sel?.kind === 'point'
        ? `地点 ${(sel.x / 1000).toFixed(1)}, ${(sel.y / 1000).toFixed(1)} km`
        : '未选中';

  return (
    <aside className="side">
      <div className="side-buttons">
        <button
          className={`btn toggle ${store.showControl ? 'on' : ''}`}
          onClick={() => store.toggleControl()}
          title="实控范围：我方蓝 / 敌方红 / 争夺带黄，接触线为深色虚线"
        >
          {store.showControl ? '◉' : '○'} 实控范围
        </button>
        <button
          className={`btn toggle ${store.showIntel ? 'on' : ''}`}
          onClick={() => store.toggleIntel()}
          title="敌情掌握度：贴前线 85%，越往敌方纵深越暗（12%）"
        >
          {store.showIntel ? '◉' : '○'} 敌情掌握
        </button>
        <button
          className="btn"
          disabled
          title="展开/收缩需要先载入编制数据（units_preset_nato.json）"
        >
          展开 / 收缩
        </button>
        <button className="btn danger" disabled title="结束游戏并生成史料战报（战报系统未接入）">
          结束游戏 · 战报
        </button>
      </div>

      <UrbanPanel />

      {store.mode !== 'world' && (
        <div className="layer-panel">
          <div className="lp-title">地图效果</div>
          {LAYERS.map(([key, label]) => (
            <label key={key} className="lp-item">
              <input
                type="checkbox"
                checked={store[key]}
                onChange={(e) => store.setLayer(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
          <label className="lp-item">
            <input type="checkbox" checked={store.onlineBasemap} onChange={() => store.toggleBasemap()} />
            <span>在线底图（Esri）</span>
          </label>
          <div className="lp-key">
            <input
              type="password"
              placeholder="MapTiler Key（可选）"
              defaultValue={mapTilerKey()}
              onChange={(e) => saveMapTilerKey(e.target.value)}
              spellCheck={false}
            />
            <div className="lp-hint">填好后到世界视图点底图按钮循环选择</div>
          </div>
        </div>
      )}

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
        <div className="echelon-row">
          {ECHELON_ORDER.map((e) => (
            <button
              key={e}
              className={`echelon-btn ${store.markerEchelon === e ? 'on' : ''}`}
              title={e === 'company' ? '连：含 3 排 × 3 班，占 3 个排位' : e === 'platoon' ? '排：含 3 班，占 1 个排位' : '班：占 1/3 排位'}
              onClick={() => store.setEchelon(e)}
            >
              {ECHELON_LABEL[e]}
            </button>
          ))}
        </div>
        <div className="lp-hint">
          {store.placing
            ? `点城区放置 ${SIDE_LABEL[store.markerSide]}${UNIT_LABEL[store.markerKind]}${ECHELON_LABEL[store.markerEchelon]}；下层自动随行`
            : '选兵种与梯队后点击城区；右键撤出。放大到 L1/L2 才看得到下级'}
        </div>
      </div>

      <div className="side-status" title={detail(map, sel)}>
        <div className="ss-line">{summary}</div>
        {sel?.kind === 'district' && sel.district && (
          <div className="ss-line dim">
            {sel.district.frontage} 连 · 防御 +{sel.district.defense}
          </div>
        )}
      </div>
    </aside>
  );
}

function UrbanPanel(): JSX.Element | null {
  const map = store.map;
  if (!map) return null;
  const idx = urbanIndex(map.towns);
  const unit = store.units.find((u) => u.id === store.selectedPlatoon);
  const townSel = store.selected?.kind === 'district' ? store.selected : null;
  const activeKey = unit?.districtKey ?? townSel?.district.key ?? null;
  const ref = activeKey ? idx.byKey.get(activeKey) : null;
  if (!ref) {
    return (
      <div className="layer-panel">
        <div className="lp-title">巷战</div>
        <div className="lp-hint">点城区看容量与邻接；点兵排改姿态。兵排只能进城，野战请用野外布防。</div>
      </div>
    );
  }

  const cap = platoonCap(ref.district);
  const cost = (side: Side): number =>
    store.units
      .filter((u) => u.districtKey === ref.key && u.side === side && !u.parentId)
      .reduce((s, u) => s + ECHELON_COST[u.echelon], 0);
  const mine = cost('nato');
  const foe = cost('wp');
  const total = mine + foe;
  const over = total > cap;
  const neighbours = neighbourRefs(idx, ref.key);
  const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

  return (
    <div className="layer-panel">
      <div className="lp-title">巷战 · {ref.town.n}</div>
      <div className="urban-head">
        <span className="urban-name">{ref.district.label}</span>
        <span className={`urban-cap ${over ? 'over' : Math.abs(total - cap) < 1e-6 ? 'full' : ''}`}>
          {fmt(total)}/{cap} 排
        </span>
      </div>
      <div className="urban-bar">
        <i className="mine" style={{ width: `${Math.min(100, (mine / Math.max(1, cap)) * 100)}%` }} />
        <i className="foe" style={{ width: `${Math.min(100, (foe / Math.max(1, cap)) * 100)}%` }} />
      </div>
      <div className="lp-hint">
        防御 +{ref.district.defense} · 建筑 {Math.round((ref.district.builtRatio ?? 0) * 100)}% · 路{' '}
        {(ref.district.roadKm ?? 0).toFixed(1)} km
      </div>
      {over && (
        <div className="urban-warn">
          超编 {fmt(total - cap)} 个排：不增加火力，只增加暴露与伤亡（城区战斗宽度是硬规则）。
        </div>
      )}

      {unit ? (
        <>
          <div className="urban-sub">
            {SIDE_LABEL[unit.side]} · {unit.label} · {POSTURE_LABEL[unit.posture]}
          </div>
          <div className="urban-tree">
            {(() => {
              const c = store.countsOf(unit.id);
              return `编成：${c.company} 连 · ${c.platoon} 排 · ${c.squad} 班`;
            })()}
          </div>
          <div className="posture-grid">
            {POSTURE_ORDER.map((k) => (
              <button
                key={k}
                className={`posture-btn ${unit.posture === k ? 'on' : ''}`}
                title={POSTURE_HINT[k]}
                onClick={() => store.setPosture(k)}
              >
                {POSTURE_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="urban-hint">{POSTURE_HINT[unit.posture]}（整棵树一起改）</div>
          <div className="order-row">
            {ORDER_ORDER.map((t) => (
              <button
                key={t}
                className={`order-btn ${store.orderMode === t ? 'on' : ''}`}
                title={ORDER_HINT[t]}
                onClick={() => {
                  const needsTarget = t === 'move' || t === 'attack';
                  if (needsTarget) store.setOrderMode(t);
                  else store.issueOrder(t);
                }}
              >
                {ORDER_LABEL[t]}
              </button>
            ))}
          </div>
          <div className="urban-hint">
            {store.orderMode
              ? `已选「${ORDER_LABEL[store.orderMode]}」：点目标街区下达，下级自动跟进`
              : `当前命令：${ORDER_LABEL[unit.order.type]}${
                  unit.parentId ? (unit.order.pinned ? '（单独指令）' : '（随上级）') : '（本部）'
                }`}
          </div>
          {unit.order.pinned && unit.parentId ? (
            <button className="btn small" onClick={() => store.releasePinnedOrders()}>
              解除单独指令
            </button>
          ) : null}
          <button className="btn small danger" onClick={() => store.removePlatoon(unit.id)}>
            撤出{ECHELON_LABEL[unit.echelon]}（含下级）
          </button>
        </>
      ) : null}

      {neighbours.length > 0 && (
        <>
          <div className="lp-title urban-gap">相邻街区 · {neighbours.length}</div>
          <div className="urban-adj">
            {neighbours.map((n) => {
              const nCap = platoonCap(n.district);
              const nOwn = store.districtOccupancy(n.key);
              return (
                <button
                  key={n.key}
                  className="adj-item"
                  onClick={() => {
                    if (unit) store.moveUnit(unit.id, n);
                    else store.select({ kind: 'district', townId: n.town.id, district: n.district, x: 0, y: 0 });
                  }}
                  title={unit ? `把该${ECHELON_LABEL[unit.echelon]}（含下级）移入${n.district.label}` : '选中该街区'}
                >
                  <span>{n.district.label}</span>
                  <span className={`mono adj-cap ${nOwn > nCap ? 'over' : ''}`}>
                    {fmt(nOwn)}/{nCap}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="lp-hint">
            {unit ? `点街区即可把该${ECHELON_LABEL[unit.echelon]}连同下属一起移过去` : '点街区选中，看它的容量'}
          </div>
        </>
      )}

      {store.units.length > 0 && (
        <button className="btn small" onClick={() => store.clearPlatoons()}>
          清空全部部队（{store.units.filter((u) => !u.parentId).length} 个上级 / {store.units.length} 个兵牌）
        </button>
      )}

      {store.battleLog.length > 0 && (
        <div className="battle-log">
          {store.battleLog.slice(0, 3).map((l, i) => (
            <div key={i} className="bl-line">
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function detail(map: MapData | null, sel: Selection | null): string {
  if (!map) return '';
  if (sel?.kind === 'district' && sel.district) {
    const d = sel.district;
    const town = map.towns.find((t) => t.id === sel.townId);
    const total = town ? townFrontage(town) : 0;
    const ctl = store.field ? controlAt(store.field, sel.x, sel.y) : null;
    const layout = town?.kind === 'band' ? '并列分段' : town?.kind === 'parcel' ? '单一地块' : '核心 + 四扇区';
    return [
      `${d.townName} · ${d.label}`,
      `形态：${layout}（长宽比 ${town ? town.elong.toFixed(2) : '-'}）`,
      `面积：${d.area.toFixed(1)} km²`,
      `战斗宽度：${d.frontage} 个连当量（全城 ${total} 连 ≈ ${(total / 9).toFixed(1)} 个营）`,
      `防御加成：+${d.defense}`,
      ctl ? `控制方：${CONTROL_LABEL[ctl.control]}　掌握度 ${Math.round(ctl.conf * 100)}%` : '',
      '超出战斗宽度的部队不增加火力，只增加暴露；扩大正面只能到城外野战。',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (sel?.kind === 'point') {
    const [spanX, spanY] = map.meta.spanM;
    const elev = Math.round(sampleBilinear(map.meta.dem, spanX, spanY, sel.x, sel.y));
    const cover = COVER_LABEL[sampleNearest(map.meta.landcover, spanX, spanY, sel.x, sel.y)] ?? '-';
    let nearest = { n: '-', d: Infinity };
    for (const c of map.cities) {
      const d = Math.hypot(c.x - sel.x, c.y - sel.y);
      if (d < nearest.d) nearest = { n: c.n, d };
    }
    const ctl = store.field ? controlAt(store.field, sel.x, sel.y) : null;
    const lat = map.meta.center[0] + sel.y / map.meta.projection.mPerDegLat;
    const lon = map.meta.center[1] + sel.x / map.meta.projection.mPerDegLon;
    return [
      `地点 ${(sel.x / 1000).toFixed(2)}, ${(sel.y / 1000).toFixed(2)} km`,
      `高程 ${elev} m　地表 ${cover}`,
      `最近聚落 ${nearest.n}（${(nearest.d / 1000).toFixed(2)} km）`,
      `经纬 ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      ctl ? `控制方 ${CONTROL_LABEL[ctl.control]}　掌握度 ${Math.round(ctl.conf * 100)}%` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
  return '点击地图上的城区或任意地点；悬停可看分区信息。';
}
