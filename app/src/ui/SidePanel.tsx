import { useStore, store } from '../hooks';
import type { MapData } from '../core/types';
import type { Selection } from '../store';
import { COVER_LABEL } from '../core/types';
import { sampleBilinear, sampleNearest } from '../core/sample';
import { townFrontage } from '../core/towns';
import { controlAt, CONTROL_LABEL } from '../core/scenario';

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
