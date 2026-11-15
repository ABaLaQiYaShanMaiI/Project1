# 工程约束（CONSTRAINTS）

本文件是硬约束，不是建议。违反即视为不合格改动。
背景与决策原因见 `DEVLOG.md`；需求见 `Docx/兵棋项目_需求规格总表_v0.5.xlsx`。

## 1. 代码不得有注释

- 禁止：`//` 行注释、`/* */` 块注释、Python 的 `#` 注释与 docstring、JSX 里的 `{/* */}`。
- 说明文字一律写进 `DEVLOG.md`，不写进代码。
- 自检：`node tools/strip_comments.mjs --check`，必须输出 `clean`。
- 原因：控制体量；单一事实源，避免注释与代码不同步。

## 2. 体量预算

| 项 | 上限 |
| --- | --- |
| 前端单文件 | 700 行 |
| 单个数据文件 | 4 MB（本地底图 `.pmtiles` 例外：按区域裁剪，单包 ≤ 64 MB） |
| 前端首屏 JS（gzip） | 120 KB（世界视图按需加载的 `maplibre-gl` + `pmtiles` 单独成 chunk，不计入首屏） |
| 生产依赖 | 只允许 `react` `react-dom` `maplibre-gl` `pmtiles`；构建期 `vite` `typescript` `@vitejs/plugin-react` |
| Python 依赖 | 只允许 `numpy` `Pillow` `requests` |

新增依赖必须在 `DEVLOG.md` 记一条，写清为什么现有依赖做不到。

## 3. 架构边界

- `app/src/core/` 是纯规则层：不得 import DOM、不得 import React、不得请求网络。
- `app/src/map/` 只管画：不得读写全局状态，只能吃 `RenderState`。
- React 只画面板：游戏循环不得经过 React，面板 10Hz 限流推送。
- 数值参数集中在 `app/public/data/*.json` 或脚本顶部常量，不散落在逻辑里。

## 4. 数据与平台

- 运行时不联网：游戏进程不得请求任何第三方服务（地图、字体、CDN 一律本地）。
- 烘焙期可联网：`Tools/bake_map.py` / `bake_town_detail.py` 按需拉取 DEM 与 OSM；产物必须落盘到
  `app/public/data/`，带来源与生成时间，之后必须能离线复现同一张战场。
- 禁止使用在线瓦片（`tile.openstreetmap.org` 政策明确禁止批量下载、预取与离线打包）；
  地形一律烘焙成本地 JSON/JPG，OSM 数据只走 Overpass 的区域查询并做本地缓存。
- 底图统一走**本地 PMTiles**（`Tools/fetch_basemap.mjs` 在烘焙期从 Protomaps 日构建按 bbox 裁剪），
  运行时由 `pmtiles://` 协议按 HTTP Range 读取本地文件，不请求任何第三方服务。
  在线 MapTiler 仅在玩家自填 key 时作为参考底图，可随时关闭。
- 目标平台 Windows 单机；数据与规则层不得依赖特定平台 API。
- 所有地图数据来源必须可署名：当前为 SRTM/AWS Terrain Tiles + © OpenStreetMap contributors (ODbL)。

## 5. 性能预算

| 指标 | 预算 |
| --- | --- |
| 帧率 | 60 FPS（4x 倍速下不跳帧） |
| 每帧绘制 | < 2 ms |
| 静态层重建 | < 40 ms |
| 地图数据加载 | < 1.5 s |

超出预算时先做 LOD/缓存，不得用降低交互质量的方式换帧率。

## 6. 设计红线

- 不使用六角格：连续坐标（米制），任意位置布兵。
- 城镇分区必须贴合真实建成区轮廓：小城镇单一地块，紧凑城市核心+扇区，狭长城市并列分段；容量随分区面积变化，不写死固定值。
- 城区战斗宽度是硬规则：超编不增加火力，只增加暴露。
- 我方视角：只操作北约；不做可操作的华约阵营。

## 7. 交付与命名

- 游戏名：**战术地图军棋 / Tactical Map Wargame**；包名 `tactical-map-wargame`。
- 战场数据文件：`app/public/data/map_<region>.json`。
- 剧本文件：`app/public/data/scenario_<region>.json`。
- 提交前必跑：`node tools/strip_comments.mjs --check`、`tsc --noEmit`、`vite build`。
