# 战术地图军棋 · Tactical Map Wargame

冷战作战级兵棋：真实世界地图 + 自然时间流逝 + 暂停/倍速；玩家只操作北约兵牌；
结束生成史料风格战报。

**当前进度 v0.11：军事地形世界视图 + 无网格战场 + 城镇形态 + 实控范围 + 巷战（连/排/班梯队 + 命令下发 + 按班结算的巷战解算）。**

工程约束见 [CONSTRAINTS.md](CONSTRAINTS.md)，决策与踩坑见 [DEVLOG.md](DEVLOG.md)，
地图设计与引擎选型见 [MAPDESIGN.md](MAPDESIGN.md)。
需求台账：[Docx/铁幕1985_需求规格总表_v0.5.xlsx](Docx/铁幕1985_需求规格总表_v0.5.xlsx)（19 表 / 116 条）。

## 启动

双击 `启动游戏.bat`（起本地服务并打开浏览器），或：

```bash
cd app && npm install && npm run dev
```

打开 <http://127.0.0.1:5183/>。**不要直接双击 `app/index.html`**：`file://` 下模块与
`fetch` 会被拦，必然白屏。

## 三个视图

| 视图 | 内容 |
| --- | --- |
| 世界 | 本地 PMTiles 矢量底图（z0–z13）+ 军事地形叠加：晕渲、50 m 等高线、交通线分级、铁路、UTM 军用格网、射程圈；自由平移缩放；框选后一键烘焙 |
| 战场 | 当前区域（默认富尔达缺口 111×72 km）：地形、等高线、路网、城镇分区、实控范围 |
| 层级 | L0 战略（全局路网 + 主城）/ L1 战役（二级路网 + 乡镇）/ L2 战术（村名 + 25m 等高线） |

## 世界底图（瓦片金字塔）

### 军事地形三层（v1.19 起，世界视图默认）

```bash
python Tools/bake_dem.py      --map app/public/data/map_fulda.json --zmin 9 --zmax 11
python Tools/bake_contours.py --key fulda --map app/public/data/map_fulda.json
node   Tools/fetch_basemap.mjs --key=fulda --bbox=8.849,50.240,10.591,51.000 --name=富尔达缺口
```

产物：`data/dem/<区域>/`（约 15.5 MB / 130 瓦片，gitignore）、`data/contours_<区域>.json`（0.21 MB，入库）、
`data/tiles/`（底图包 + style + 字形，gitignore）。三者都缺时世界视图会退回 Canvas 旧实现（可能全黑，
那就按上面三条重跑一次）。

### 本地 PMTiles（推荐，离线且放大不糊）

```bash
node Tools/fetch_basemap.mjs --key=fulda --maxzoom=13 \
  --bbox=8.849,50.240,10.591,51.000 --name=富尔达缺口
```

首次会自动下载 `pmtiles` CLI（`Tools/bin/`，已 gitignore），然后从 Protomaps 日构建
（约 139 GB，**不下载整包**）按 bbox 裁出 `app/public/data/tiles/fulda.pmtiles`，
并生成离线 style、本地字形与 `index.json`。运行时由 `pmtiles://` 协议按 HTTP Range
只读取视口内的瓦片，断网可用。

- 体积参考：富尔达 111×72 km、z0–z13 → 1585 瓦片 / **45 MB**；`--maxzoom=12` 约减半。
- 数据源优先 Source Cooperative 镜像，失败回退 `build.protomaps.com` 日构建；
  脚本默认 `GODEBUG=http2client=0`（HTTP/2 会被限速），`--threads` 可调并发。
- 底图优先级：本地 PMTiles → MapTiler（需自填 key）→ Canvas 旧世界视图。
- 数据许可：© OpenStreetMap contributors · Protomaps（ODbL），页面右下角常驻署名。

### 旧版自建栅格金字塔

```bash
python Tools/bake_world.py --from-image                    # 零联网：用现有 world_terrain.jpg 切 z0–z3
python Tools/bake_world.py --download 6                    # 联网：拉 z6 高程瓦片到 Tools/.tile-cache
python Tools/bake_world.py --from-cache --max-zoom 6        # 拼缓存 → 逐瓦片晕渲
python Tools/bake_world_vectors.py                          # 城市 + 主干道（Natural Earth，需联网）
```

瓦片输出 `app/public/data/world/t/{z}/{x}_{y}.jpg`，元数据 `world/meta.json`；
矢量叠加数据为 `world/vectors.json`（缺失则只画地形）。

## 任意区域都能变成战场

在游戏里：切到「世界」视图 → 拖动框选区域（或点 100×72 / 60×40 / 24×16 km 预设）→
点「生成战场」。本机服务会调用烘焙器，进度与阶段实时显示，完成后战场进入「地图库」，
世界视图上出现绿框，单击即可直接开打。首次烘焙约 3–10 分钟（取决于公共 Overpass 与网络），
同一区域再进是秒开，且永久离线可用。

命令行等价：

```bash
python Tools/bake_map.py --center 48.85,2.35 --span-km 120,80 --name paris
# 打开 http://127.0.0.1:5183/?map=/data/map_paris.json
```

DEM 与 OSM 结果按区域缓存在 `Tools/.tile-cache/`（`osm_<区域>_*.json`），重复区域几秒完成。
已烘焙区域记录在 `app/public/data/zones.json`（运行时生成，不入库）。

## 城镇模型

- **轮廓**：OSM 建成区地块 → 归属最近聚落 → 连通生长（间距 <150m）→ 简化 25m，逐块绘制；
  飞地与卫星村不并入主城。
- **规模**：容纳 80% 建成区面积的半径 ×1.15，下限 600m。
- **两种形态**：`parcel`（外缘 <1000m，整块一个地块）/ `town`（核心整圆 + 东/北/西/南四扇区，
  扇区外缘取该方向真实伸出距离）。
- **战斗宽度**（连当量）：核心 3 / 外环扇区 2 / 单地块 1.5；富尔达全城 11 连 ≈ 1.2 个营。
  超出宽度的部队不增加火力，只增加暴露与伤亡。

## 城市巷战（v0.9）

城区是从真实建成区 + 行政区/道路切出来的不规则地块，每个城区是一个**战斗容器**：

- **容量**：`frontage × 3` 个排位（富尔达全城 17 连 = 51 排位）；
- **邻接**：只能移动到相邻街区（`core/urban.ts` 一次性算好并缓存）；
- **超编**：超出容量不增加火力，只增加暴露与伤亡（硬规则，侧栏红字警告）。

**梯队**：连 = 3 排 = 9 班（放一个连一次生成 13 个兵牌）。排位价 连 3 / 排 1 / 班 1/3，
只算根节点，所以 18 排位可以放 6 个连或 18 个排，也能混编。

操作：左侧选兵种 + 梯队（连/排/班）→ **点城区内部**放置；点兵牌选中后改姿态（据守 / 街垒 / 预备 / 渗透，
整棵树一起改）；右键撤出（含下级）；侧栏「相邻街区」把该兵牌连同下属一起移防。

**缩放自动展开**：缩小只看得到连，放大到 L1 换成排，再放大换成班——同一时刻不会父子堆叠。

城区轮廓 绿=未满 / 黄=满编 / 红虚线=超编。

兵牌符号按 APP-6 简化：兵种图标 + 梯队标记（班 ●、排 ●●●、连 ｜）+ 左下红叉（减员）。
部队存 `localStorage['wargame.units.v1']`，与世界视图的兵牌图钉分开。

### 命令（v0.11）

选中兵牌后有五个命令：**守线 / 开火 / 移动 / 攻击 / 撤离**。

- 对上级下令，**下辖全部兵牌继承**并各自执行（各自算落位、各自走、各自打）；
- 任何下级都能单独下令，单独过的下级**不会被上级命令覆盖**，点「解除单独指令」回归；
- 时间驱动：1x = 1 游戏分钟/真实秒；到达后 攻击→开火、移动→守线；
- 同街区交火，伤亡**按班结算**再向上汇总成排/连兵力。

尚未实现：跨街区支援射击、压制/士气、夺控点随战果动态变化、敌军 AI。见 `MAPDESIGN.md` §12.6。

## 实控范围

接触线把战场分为我方（蓝）/ 敌方（红）/ 争夺带（黄，3.8km），288×216 栅格、边界平滑；
敌情掌握度随纵深衰减（贴前线 85% → 45km 深处 12%）。参数在
`app/public/data/scenario_fulda.json`。

## 目录

| 路径 | 说明 |
| --- | --- |
| `app/src/core/` | 纯规则层：时间、城镇分区、控制场、栅格采样、细节层与地图库 |
| `app/src/map/` | 战场渲染：`renderer.ts` 编排；`paint.ts` 视图/绘制上下文；`layers/` 各地理图层 |
| `app/src/WorldCanvas.tsx` | 世界视图：框选战场、地图库、一键烘焙 |
| `app/public/data/` | 烘焙数据（战场 0.95MB + 世界底图 0.7MB + 区划 2.2MB），全程离线 |
| `app/public/data/tiles/` | 本地 PMTiles 底图包 + 离线 style + 字形（`fetch_basemap.mjs` 生成，已 gitignore） |
| `Tools/bake_map.py` | 区域烘焙（`--center / --span-km / --name / --title`） |
| `Tools/bake_service.mjs` | 本地烘焙服务与地图库接口（`/api/bake`、`/api/zones`） |
| `Tools/make_preview.py` | 战场预览图（`preview_<区域>.jpg`，loading 背景用） |
| `Tools/bake_world.py` | 世界底图瓦片金字塔（`--download` / `--from-cache` / `--from-image`） |
| `Tools/fetch_basemap.mjs` | 本地 PMTiles 底图（取 CLI → 裁 bbox → 出 style/字形/index） |
| `Tools/bake_dem.py` | 本地 DEM 瓦片（terrarium z9–z11，世界视图晕渲 + 高程/坡度采样） |
| `Tools/bake_contours.py` | 等高线矢量（50 m 等高距 / 250 m 计曲线 + 高程标注锚点） |
| `Tools/dev_mapshot.mjs` | 取 MapLibre 画布真实帧（headless 截图对 WebGL 不可靠，见 DEVLOG v1.19） |
| `Tools/range_serve.mjs` | `.pmtiles` 的 HTTP Range 服务（dev 与生产共用） |
| `Tools/bake_blocks.py` | 区划型地块（道路切分 + 行政区归并 + 参数） |
| `Tools/add_roads.py` | 增量补路网等级（bbox 分块 + 几何哈希去重） |
| `Tools/bake_world_vectors.py` | 世界层矢量（Natural Earth 城市 + 主干道 → `world/vectors.json`） |
| `Tools/serve.mjs` | 零依赖静态服务器（启动器用） |
| `Tools/strip_comments.mjs` `tools/strip_comments.py` | 去注释 / 自检（代码不允许注释） |

## 性能（实测）

战场：22,085 条路段、97 座城镇，60 FPS，每帧绘制 0.1ms，静态层重建 13–33ms。

## 待办

1. ~~世界视图分块加载~~ 已完成（本地 PMTiles + DEM + 等高线，v1.19）；下一步给其他热点区域预裁包并做跨包无缝拼接。
   可继续加：坡度通行性着色、通视（LOS）、桥梁/隧道/机场符号（见 MAPDESIGN §11.5）。
2. 编制数据与行军 —— 兵牌上地图。
3. 单位接入后控制场改为动态生成（占领点 + 半径）。
4. 需求台账按无网格重写 §3/§7/§16。
