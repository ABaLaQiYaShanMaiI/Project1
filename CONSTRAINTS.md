# 工程约束（CONSTRAINTS）

本文件是硬约束，不是建议。违反即视为不合格改动。
背景与决策原因见 `DEVLOG.md`（近期）与 `CHANGELOG.md`（全史）；踩坑见 `PITFALLS.md`；产品方针见 `Readme.md`「方针」。

## 1. 代码不得有注释

- 禁止：`//` 行注释、`/* */` 块注释、Python 的 `#` 注释与 docstring、JSX 里的 `{/* */}`。
- 说明文字写进文档三件套（`DEVLOG.md` / `CHANGELOG.md` / `PITFALLS.md`），不写进代码。
- 自检：`node Tools/strip_comments.mjs --check` 与 `python Tools/strip_comments.py --check`，都必须输出 `clean`。
- 原因：控制体量；单一事实源，避免注释与代码不同步。

## 2. 体量预算

| 项 | 上限 |
| --- | --- |
| 前端单文件 | 700 行 |
| 单个数据文件 | 4 MB（底图 `.pmtiles` 与 DEM 瓦片除外：底图单包 ≤ 6 GB 且总量 ≤ 12 GB、DEM 总量 ≤ 1 GB；v1.56 按实测校准，旧 64 MB / 200 MB 限额早已被 world9（2.99 GB）突破） |
| 前端首屏 JS（gzip） | 120 KB（世界地图按需加载的 `maplibre-gl` + `pmtiles` 单独成 chunk，不计入首屏） |
| 生产依赖 | 只允许 `react` `react-dom` `maplibre-gl` `pmtiles`；构建期 `vite` `typescript` `@vitejs/plugin-react` |
| Python 依赖 | 只允许 `numpy` `Pillow` `requests`；文档构建（`Tools/build_requirements_workbook.py`）允许 `openpyxl`；Natural Earth 底料（`Tools/bake_ne_*.py`：rails / roads / rivers / urban）允许 `pyshp` |

新增依赖必须在 `DEVLOG.md` 记一条，写清为什么现有依赖做不到。

## 3. 架构边界

- `app/src/core/` 是纯规则层：不得 import DOM、不得 import React、不得请求网络。
- `app/src/data/` 只管数据：解析、装配、样式生成；不持有 React 状态。样式分件放 `app/src/data/style/`。
- `app/src/map/` 只操作 MapLibre 实例：不得持有业务状态、不得 import React、不建 DOM 面板（面板归 `ui/`）。
- `app/src/ui/` 只画面板；游戏视图不得经过 React 逐帧驱动。
- 数值参数集中在源文件顶部常量或 `app/public/data/*.json`，不散落在逻辑里。

## 4. 数据与平台

- 运行时不联网：页面不得请求任何第三方服务（地图、字体、CDN 一律本地）。
- 烘焙期可联网：`Tools/fetch_basemap.mjs` / `bake_dem.py` / `bake_contours.py` 在烘焙期拉取，
  产物必须落盘到 `app/public/data/`，之后必须能离线复现。
- 禁止使用在线瓦片（`tile.openstreetmap.org` 政策明确禁止批量下载、预取与离线打包）。
- 底图统一走**本地 PMTiles**：`fetch_basemap.mjs` 在烘焙期从 Protomaps 母包按 bbox / 全球裁剪，
  运行时由 `pmtiles://` 协议按 HTTP Range 读取本地文件。
- 服务端必须给 `.mjs` 正确 MIME（模块 worker 依赖它），否则世界地图整体不渲染；见 `Tools/serve.mjs`。
- 目标平台 Windows 单机；数据与规则层不得依赖特定平台 API。
- 所有地图数据来源必须可署名：当前为 © OpenStreetMap contributors (ODbL) + AWS Terrain Tiles（SRTM）。

## 5. 性能预算

| 指标 | 预算 |
| --- | --- |
| 帧率 | 60 FPS（拖动、缩放均不跳帧） |
| 单次静态重绘 | < 40 ms |
| 首屏可交互 | < 1.5 s |

超出预算时先做 LOD / 缓存，不得用降低交互质量的方式换帧率。

## 6. 产品红线

- **只做世界地图**：不新增区域沙盘 / 城镇地块 / 巷战类视图（v1.24 已删，勿复辟；v1.28 的方格地块实验已于 v1.29 撤销）。
- **分层采纳**：不追求全球高精度；新增覆盖一律以「区域包」形式叠加，不改前端结构。
- 视觉基调：浅色地形图纸底 + 深色 UI；卫星影像不作为默认底图（读不出等高线与通行性）。
- 交通线只强调主干与铁路；次要道路必须淡化，不得压过地形与标注。
- 军事判读要素常驻：UTM 格网、高程/坡度/坡向读数、射程圈。

## 7. 交付与命名

- 游戏名：**战术地图军棋 / Tactical Map Wargame**；包名 `tactical-map-wargame`。
- 底图包：`app/public/data/tiles/<key>.pmtiles`；索引 `tiles/index.json`；
  共享样式模板 `tiles/base.style.json`。
- DEM：`app/public/data/dem/<key>/{z}/{x}/{y}.png` + `index.json`。
- 等高线：`app/public/data/contours_<key>.json`。
- 提交前必跑：`node Tools/check_all.mjs`（串起两条无注释自检、行数上限、`tsc --noEmit`、`vite build`、首屏 gzip 预算）。
