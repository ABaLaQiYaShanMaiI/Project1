import type { BakeStatus, ZoneEntry } from '../core/zones';

const PRESETS: Array<[string, number, number]> = [
  ['100 × 72', 100, 72],
  ['60 × 40', 60, 40],
  ['24 × 16', 24, 16],
];

export interface PickInfo {
  lat: number;
  lon: number;
  wKm: number;
  hKm: number;
}

export interface FinishedZone {
  name: string;
  sizeMB: number;
  seconds: number;
  url: string;
}

export function WorldTools(props: {
  selecting: boolean;
  zoneCount: number;
  basemapLabel: string;
  onToggleSelect: () => void;
  onCycleBasemap: () => void;
  onPreset: (w: number, h: number) => void;
}): JSX.Element {
  return (
    <div className="world-tools">
      <button
        className={`btn toggle ${props.selecting ? 'on' : ''}`}
        onClick={props.onToggleSelect}
        title={props.selecting ? '拖动框选战场；点此切回平移' : '当前为平移；点此切到框选'}
      >
        {props.selecting ? '◉ 框选战场' : '○ 平移'}
      </button>
      {PRESETS.map(([label, w, h]) => (
        <button key={label} className="btn small" onClick={() => props.onPreset(w, h)}>
          {label} km
        </button>
      ))}
      <button
        className="btn small"
        onClick={props.onCycleBasemap}
        title="切换底图源：本地 / 地形 / 卫星 / OpenTopoMap"
      >
        {props.basemapLabel}
      </button>
      {props.zoneCount > 0 && <span className="zone-count">已记录 {props.zoneCount}</span>}
    </div>
  );
}

export function WorldPickPanel(props: {
  info: PickInfo;
  cmd: string;
  copied: boolean;
  apiReady: boolean;
  failure: string | null;
  running: boolean;
  tileCount: number | null;
  finished: FinishedZone | null;
  onBake: () => void;
  onCopy: () => void;
  onEnter: (url: string) => void;
}): JSX.Element {
  const { info } = props;
  return (
    <div className="world-pick">
      <div className="wp-title">选定战场</div>
      <div className="wp-row mono">
        {info.lat.toFixed(3)}, {info.lon.toFixed(3)}
      </div>
      <div className="wp-row mono">
        {info.wKm.toFixed(0)} × {info.hKm.toFixed(0)} km
      </div>
      {props.finished ? (
        <>
          <div className="wp-row mono">{props.finished.name}</div>
          <div className="wp-hint">
            {props.finished.sizeMB} MB · 用时 {props.finished.seconds}s ·{' '}
            {props.tileCount ? `高程瓦片 ${props.tileCount}` : '已烘焙'}
          </div>
          <div className="bake-row">
            <button className="btn small primary" onClick={() => props.onEnter(props.finished!.url)}>
              进入战场
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="wp-hint">首次约 3–10 分钟（公共数据源繁忙时更久），结果永久离线可用</div>
          <div className="bake-row">
            <button className="btn small primary" onClick={props.onBake} disabled={!props.apiReady || props.running}>
              生成战场
            </button>
            <button className="btn small" onClick={props.onCopy}>
              {props.copied ? '已复制' : '复制命令'}
            </button>
          </div>
          {props.failure && <div className="wp-error">{props.failure}</div>}
          {!props.apiReady && <div className="wp-error">当前服务未提供烘焙接口，请用 启动游戏.bat 启动</div>}
        </>
      )}
      <div className="wp-cmd mono">{props.cmd}</div>
    </div>
  );
}

export function WorldLibraryPanel(props: { zones: ZoneEntry[]; onEnter: (url: string) => void }): JSX.Element {
  return (
    <div className="world-pick">
      <div className="wp-title">地图库 · {props.zones.length}</div>
      {props.zones.slice(0, 6).map((z) => (
        <button key={z.key} className="zone-item" onClick={() => props.onEnter('/data/' + z.file)}>
          <span className="zone-name">{z.name || z.key}</span>
          <span className="mono zone-meta">
            {z.spanKm ? `${z.spanKm[0]}×${z.spanKm[1]} km` : `${z.sizeMB} MB`}
          </span>
        </button>
      ))}
      <div className="wp-hint">拖动框选新区域即可生成新战场</div>
    </div>
  );
}

export function BakeCard(props: { job: BakeStatus; onCancel: () => void }): JSX.Element {
  const { job } = props;
  return (
    <div className="bake-card">
      <div className="bake-title">{job.title || job.key}</div>
      <div className="bake-bar">
        <i style={{ width: `${Math.max(2, job.progress)}%` }} />
      </div>
      <div className="bake-stage">
        <span>{job.stage}</span>
        <span className="mono">
          {job.progress}% · {job.elapsed}s
        </span>
      </div>
      <div className="bake-row">
        <button className="btn small" onClick={props.onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}

export function WorldHint(props: { zoomHint: boolean; maxZoom: number; selecting: boolean }): JSX.Element {
  return (
    <div className="map-hint">
      {props.zoomHint
        ? `已到世界视图上限（z${props.maxZoom}），框选后进入战场查看细节`
        : props.selecting
          ? '拖动框选战场 · 单击已记录战场进入 · 滚轮缩放'
          : '拖动平移 · 滚轮缩放 · 单击取经纬度'}
    </div>
  );
}
