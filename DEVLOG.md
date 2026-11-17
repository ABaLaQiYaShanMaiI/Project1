# 开发日志（DEVLOG）

只记大方向改动、决策原因、踩过的坑。代码里不写注释，全部记在这里。

---

**阅读顺序**：先看下节「当前架构」，再按需查「版本沿革」里的具体条目；踩坑集中在文末「踩坑记录」。

**文档分工**（四份，不重叠）：

| 文件 | 管什么 |
| --- | --- |
| `Readme.md` | 门面：方针、怎么跑、有什么、数据管线 |
| `CONSTRAINTS.md` | 硬约束：注释禁令、体量预算、架构边界、数据规则、产品红线 |
| `MAPDESIGN.md` | 地图设计：分层、取景、交通线分级、等高线、格网、视觉基调 |
| `DEVLOG.md` | 决策原因与踩坑历史（本文件） |

## 当前架构（v1.24 起）

```
App.tsx ── TopBar / SidePanel
        └─ WorldMapLibre（懒加载，含 maplibre-gl + pmtiles）
              ├─ data/pmtilesBasemap.ts   index.json → zonesAt → tierBands
              ├─ data/militaryStyle.ts    按 tier 生成整套图层
              ├─ data/terrain.ts          DEM 采样（高程/坡度/坡向）
              ├─ core/cityEffects.ts      城区影响（连续衰减的 buff/debuff）
              └─ core/geo.ts              UTM 正算、格网、射程圈
本地数据（离线）
  tiles/world.pmtiles z0-z6 · tiles/<区域>.pmtiles z0-z13 · base.style.json · glyphs
  dem/world z0-z5 · dem/<区域> z9-z11 · contours_<区域>.json
  cities.json（全世界 5,615 城 / 145 KB 含名）· cities_<区域>.json（区域居民点）
```

- **没有战场视图**（v1.24 删除，勿复辟）；
- 底图按 tier 叠加，后一层从前一层 `maxzoom+1` 接管，缺层不空白；
- 运行时零网络请求；`.mjs` 的 MIME 由 `Tools/serve.mjs` 保证（否则 worker 不加载、整图不渲染）。

---

## 命名

- 曾用名：铁幕六角 / NATO-Hex War（六角格时期）。
- **现名：战术地图军棋 / Tactical Map Wargame**，包名 `tactical-map-wargame`。
- 原因：六角格已废弃，地图改为真实世界连续坐标，名字不能继续绑定"六角"。

---

## 版本沿革

### v0.1–v0.4（六角格时期，已废弃）
需求文档阶段：六角格战术—战役级兵棋、父子编制展开/收缩、指挥链路、交火摇骰、
自然时间流逝 + 倍速暂停、战报史料系统。产出 `Docx/兵棋项目_需求规格总表_v0.4.xlsx`。

### v0.5 去网格化
- 决策：放弃六角格，改连续坐标（米制）。原因：需要真实地图与任意位置布兵。
- 影响：距离、指挥半径、堆叠、ZOC 全部由"格"改为"米/面积"；需求文档 §3/§7/§16 待重写。
- 同版本：路网数据修复、城镇扇区、实控范围。

### v0.6 城镇形态
- 小城镇（外缘 <1000m）改为**单一地块**，不再切同心圆。
- 城镇轮廓不再用正圆：用 OSM 建成区地块做连通生长（间距 <150m），大小取"容纳 80% 面积的半径×1.15"。
- 扇区外缘改为各方向真实伸出距离，分区随形状走。

### v0.7 世界视图
- 新增世界视图（Web Mercator z3 高程晕渲，2048×2048）。
- 烘焙脚本参数化：`--center / --span-km / --name`，任意区域可生成战场。
- 世界视图点击任意点给出经纬度与烘焙命令。


### v0.8 形态自适应分区 + 左栏精简
- 改名：**战术地图军棋 / Tactical Map Wargame**（包名 `tactical-map-wargame`）。
  原因：项目已不含任何六角格元素，名字要直说玩法。
- 城镇分区改为**按形态自动选型**：
  - `parcel`：外缘 <1000m，整块一个地块；
  - `radial`：紧凑型，核心 + 东/北/西/南四扇区；
  - `band`：狭长型（长宽比 ≥1.55），沿主轴并列切成 2–5 段。
  轴与跨度用建成区顶点做 PCA 求得，分区因此跟着城市形状走。
- 战斗宽度不再固定：**容量 = 分区建成区面积 × 0.55 连/km²**（1–8 连，0.5 取整）。
  富尔达约 11 连，Bebra 三段各 1–2 连。
- 左栏只放按钮；选中对象的详细字段改到鼠标悬停（地图悬浮卡）与按钮 `title` 提示。
- 教训：给 renderer 做「按标记替换」的批量改文件很容易切坏方法体，
  正确做法是先用 tsc 验证、备份后再改；这次就是靠 tsc 发现并回滚的。


### v0.9 建成区改为栅格掩膜
- 问题：用 `landuse=residential` 多边形逐块拼，小地块被面积门槛滤掉、块间空隙不补，
  城区看起来是碎片，分区线也盖不住全部建成区。
- 改法：把建成区**栅格化**（80m 格）→ 形态学**闭运算**（膨胀 2 次 + 腐蚀 2 次，补 ≤320m 空隙）
  → 取含城镇中心点的连通分量 → 由该分量算 PCA 主轴、跨度、各扇区外缘与面积。
- 渲染：掩膜烘成 `urban_mask.png`（46KB），作为城区底色绘制；**分区填充与分区线用
  `destination-in` 合成裁剪到掩膜**，所以不再出现「正圆盖在城区外」的问题。
- 容量改为 `面积 × 0.8 连/km²`（上限 8 连），富尔达 13.3 km² → 11.5 连 ≈ 1.3 个营。
- 仍然存在的短板：OSM 的 `landuse=residential` 数据质量不稳——有的城市整片是一个大面
  （会渲成一坨），有的城市被切成很多小块（看起来碎）。当前用「1500 m² ~ 2 km²」过滤折中，
  富尔达仍偏碎。
- 下一步（数据源层面）：改用 **building 轮廓**或**街道密度栅格**生成城区掩膜，
  这两种比 landuse 更贴近真实建成区；算法不用改，只换 raster 的输入。


### v1.0 城区掩膜改用街道密度
- 换输入：从 `landuse=residential` 多边形改为**次要街道网络**
  （`residential / service / unclassified / living_street / pedestrian`），
  因为街道网络才是城区形态的真实骨架，也为将来的班排级巷战提供几何基础。
- 算法：80m 栅格 → 沿街道折线每 40m 打点累计**命中数** → 命中 ≥4 判为城区
  → 闭运算（膨胀 2 + 腐蚀 2）→ 以城镇为中心、半径 4.8km 内取连通分量。
- 关键教训：**不能用连通性判定城区**。住宅路把村镇串成一张网，连通分量会把整个县连成一块
  （富尔达一度算出 24km / 214 km²）。必须用密度阈值 + 距离上限。
- 结果：富尔达 r≈4.2km、34 km²（含 Künzell / Petersberg 连绵区）、23.5 连；
  Alsfeld r≈2.4km、7 km²、7.5 连。
- 可调参数（都在 `bake_map.py`）：命中阈值 4、闭运算次数 2、分量半径 4800m、
  容量密度 0.8 连/km²（上限 8 连/分区）。城镇大小与容量都随这三组参数走。

### 下一步：城镇细节层（街道 + 房屋）
班排级战斗需要街道与建筑几何，但全区一次烘进来体积会爆炸。方案：
- 每个城镇单独烘 `detail_<townId>.json`：次要街道折线 + 建筑**最小外接矩形**
  （x, y, w, h, angle 五个数，比存多边形省 80% 体积），估 0.3–0.8 MB/城。
- 运行时按缩放加载：`scale > 阈值` 时按需 fetch，进入视野才加载，离开可卸载。
- 渲染：建筑画成旋转矩形（L1 灰块，L2 带高度感），街道按等级配色。
- 这些几何同时就是未来巷战的掩体/通行数据（建筑=掩体、街道=通路），不只是贴图。


### v1.1 城镇细节层（街道 + 房屋）
- 新烘焙器 `tools/bake_town_detail.py`：按城镇中心 + 半径抓
  `building=*` 与次要街道，输出 `detail_<town>.json`。
- 建筑压成**最小外接矩形**（x, y, w, h, 角度 五个数），比存多边形省 ~80% 体积；
  用顶点 PCA 求朝向，再取主轴/次轴跨度。
- 富尔达样板：17,829 栋建筑 + 9,540 条街道，**1.64 MB**；
  `detail_index.json` 记录城镇 → 文件映射，供运行时按需加载。
- 运行时：缩放 > 0.035（约 28m/px）时，取视野中心最近的城镇加载细节，
  缩回去就卸载；每 700ms 检查一次，避免每帧判断。
- 渲染：街道两遍描边（亮底 + 细线），建筑一次性拼 Path2D 批量填充（17k 栋 ~数十 ms）。
- 已知：该缩放级别下静态层重建 **~71ms**，缩放操作会有一帧顿挫；
  优化方向是把建筑预烘成固定缩放级别的离屏图（或按视口分块缓存）。
- 这些几何不只是贴图：建筑 = 掩体，街道 = 通路，直接是未来班排级巷战的数据。


### v1.2 细节层性能 + 界面去噪
- 性能：建筑/街道的 `Path2D` 改为**按图层缓存**（世界坐标，与缩放无关），
  只在切换细节层时重建一次。富尔达（17.8k 建筑 / 9.5k 街道）静态层重建
  **71ms → 9.2ms**，缩放不再顿挫。
- 界面：悬停卡片只留两行（城镇·分区 / 容量·防御），并改为**跟随光标上方居中**，
  不再往右下角铺开；状态栏去掉城数、线段数、重建耗时，只留位置、高程、地表、FPS。
- 烘焙器健壮性：查询失败（Overpass 502）时不再写出 0 建筑的垃圾文件与索引项，
  直接报 FAILED 退出。Bebra 曾因此写入 0 栋建筑，已修正并重烘（4,510 栋）。


### v1.3 战场自定义选点 + 夺控点
- 世界视图改成**玩家自己圈战场**：
  - 左上「框选战场 / 平移」切换；框选模式下拖出矩形；
  - 预设尺寸 100×72 / 60×40 / 24×16 km；
  - 右上角实时给出中心经纬度、实际尺寸（Web Mercator 等距换算，副轴也一样），
    并生成烘焙命令，一键复制。
- 夺控点：每座城镇的每个分区在烘焙时算出**夺控点坐标** `cp`（该分区内所有城区栅格
  的重心，不是几何中点），运行时按控制方上色，画成菱形旗标。所以夺控点一定落在建成区里。
- 教训：Mercator 底图上「度数 → 公里」两个轴的比例不同（y 轴经度压缩），
  一开始按 180° 摊 2048px 算，100×72 的框量出来是 100×144 km。正确做法是用
  `mpp = 2πR/2048 × cos(lat)` 统一换算两个轴。
- 待办：城市**轮廓描边**还只是掩膜填充 + 分区线，没有真正的等值线描边。
  需要从掩膜跑一次 marching squares 得到每城轮廓多边形（烘焙期做，一次性）。


### v1.4 渲染分层 + 一键烘焙 + 地图库
- `renderer.ts` 793 行、超 `CONSTRAINTS.md` §2 的 700 行硬上限，按职责拆开：
  `map/paint.ts`（View 与 PaintCtx、折线/多边形工具）、`map/layers/{landcover,contours,hydro,roads,towns,cities,detail}.ts`、
  `map/control.ts`（控制场画布 + 接触线）；`renderer.ts` 只留编排与帧循环，降到约 425 行。
- 顺带修两处统计错误：等高线段数会被下一次重建的清零覆盖；路网段数在"亮底 + 细线"两遍描边里重复累加。
- 一键烘焙：新增 `Tools/bake_service.mjs`（零依赖），提供 `GET /api/zones`、`GET /api/bake`、
  `POST /api/bake`、`POST /api/bake/cancel`；`Tools/serve.mjs` 与 `app/vite.config.ts` 共用同一个 handler，
  开发模式与 `启动游戏.bat` 行为一致。`bake_map.py` 增加 `--title`（显示名，文件名仍用 `--name`）。
- 世界视图改为「框选 → 生成战场 → 进入战场」：进度按 `bake_map.py` 的日志阶段解析
  （DEM 瓦片 n/total → 路网 → 河流 → 水体 → 林地 → 城镇 → 街道 → 建成区 → 写盘），
  完成后写入 `zones.json` 地图库；已记录区域在世界视图画绿框，单击直达。
- 坑：Overpass 缓存键原来只有 `osm_<tag>.json`，不含区域 —— 新区域烘焙会直接复用富尔达的
  22,085 条路段。已改为 `osm_<区域>_<tag>.json`，并把旧缓存整体迁移为 `osm_fulda_*`，
  不重复下载 197 MB 现有数据。
- 实测：4×4 km 区域、DEM 瓦片全命中时 9 秒完成；输出 1.61 MB 的那次其实串了富尔达路网
  （缓存键 bug），修复后同一区域为 0.31 MB / 529 段路网。
- Overpass 未缓存时单类查询 40–60 s 且偶发 502：4×4 km 首烘实测 8 分钟，主要时间都花在等公共实例。
  因此增加镜像回退（主站 → private.coffee → kumi.systems），`places` 重试 3 次；
  单站 502 不再直接产出"没有城市"的战场。
- 界面与文档的耗时提示按实测改写为"首次约 3–10 分钟，缓存命中后十几秒"。
- 坑：`urban_mask.png` 是固定文件名，烘焙新区域会直接覆盖富尔达的城区掩膜，连
  `map_fulda.json` 的引用一起失效。已改为 `urban_mask_<区域>.png`；现有文件迁移为
  `urban_mask_fulda.png`，`map_fulda.json` 同步更新引用。


### v1.5 世界层瓦片金字塔 + 矢量层
- `bake_world.py` 从"单张 2048² 晕渲"改为瓦片金字塔：输出 `world/t/{z}/{x}_{y}.jpg`（256²，z0..z6 可配）
  与 `world/meta.json`。三种模式：`--download <z>`（只拉 DEM 到缓存）、
  `--from-cache`（缓存拼图后逐瓦片算梯度，避免瓦片接缝）、`--from-image`（现有 world_terrain.jpg
  直接切 z0..z3，零联网）。
- 本次环境外网不可用（S3 单张 20 s 只下到 16 KB；GitHub raw / naciscdn / jsDelivr 连接重置），
  所以先用 `--from-image` 生成 z0..z3（85 张瓦片 + meta，0.95 MB）。网络恢复后补齐高层：
  `python Tools/bake_world.py --download 6` → `python Tools/bake_world.py --from-cache --max-zoom 6`。
- 前端 `core/world.ts` 改为 Web Mercator 归一化坐标（`lonToX/latToY` 返回 0..1）与 `TileSet`
  （LRU 220 张、最多 80 并发、失败记忆）；`WorldCanvas` 按视口裁剪绘制，先铺 minZoom 底图再叠当前层，
  放大上限 `tileSize × 2^maxZoom × 2`，到达上限提示"框选进入战场"。
- 层级选择用 `ceil` 而不是 `floor`（宁可不放大瓦片）：全球铺满时选 z3 而不是 z2，避免一进来就糊。
- 初始视图对准当前战场中心，开局即可看到黄框。`--from-image` 的 z0..z3 与旧单图同分辨率，
  画质不变，但换成按需加载并为 z4..z6 预留了结构；`SIZE = 2048` 的硬编码随之消失。
- 世界层矢量：新增 `Tools/bake_world_vectors.py`（Natural Earth 10m roads / populated places →
  简化 + bbox，输出 `world/vectors.json`）。前端按 zoom 分级：主干道 z0+、次级 z4+、
  城市点按 rank、名称仅 z4+ 且 rank ≤ 3。
- Natural Earth 当前无法下载，已用富尔达战场数据做临时验证（城市点/道路/标签渲染正常），
  验证后删除临时 `vectors.json`，不留假数据。


### v1.6 加载体验：预览图、缓存校验、细节预取
- 新增 `Tools/make_preview.py`：从已烘焙战场的 DEM 生成 512 宽晕渲预览（富尔达 35.5 KB）；
  `bake_map.py` 写盘后自动调用，输出 `preview_<区域>.jpg`；App 的 loading 界面用它做背景。
- `serve.mjs` 静态服务加 ETag：数据文件二次访问走 304（实测 `if-none-match` → 304），
  `assets/` 下带 hash 的文件改 `public, max-age=31536000, immutable`。
- 细节层预取：`nearestDetailKeys()` 返回最近两座城镇，主城镇加载后顺带预取第二座，
  缩放时不必等 700 ms 轮询到下一座。
- 顺带把 App 文案里的 `tools/bake_map.py` 统一成 `Tools/`。


### v1.7 代码质量与约束对齐
- 约束审计发现 `core/` 里出现 `fetch` 与 `new Image()`（world / detail / zones），违反 §3
  "纯规则层不得 import DOM、不得请求网络"。已按层拆开：`core/` 只保留类型与纯函数
  （坐标换算、`pickZoom`、`maxScaleOf`、`nearestDetailKeys`、`makeZoneKey` / `zoneTitle`）；
  DOM 与网络移到 `data/worldSource.ts`（`TileSet` + `loadWorld` + `loadWorldVectors`）、
  `data/loadDetail.ts`、`data/bakeApi.ts`。
- `WorldCanvas.tsx` 630 → 552 行，UI 面板抽到 `ui/WorldPanels.tsx`
  （`WorldTools` / `WorldPickPanel` / `WorldLibraryPanel` / `BakeCard` / `WorldHint`）。
- 清理未使用符号与占位写法：`core/scenario.ts` 的 `Seg`、`bake_map.py` 的 `import sys`、
  `bake_world_vectors.py` 的 `import math`、`catch { void 0 }`、
  `bake_service` 里把 dist 同步失败伪装成 `error = null`（改为写日志）。
- `tsc --noUnusedLocals --noUnusedParameters` 现在也是 0 告警。
- 审计结果：`strip_comments` clean（41 文件）、首屏 gzip 64.9 KB、最大前端文件 552 行、
  最大数据文件 1.67 MB；用 Edge headless 回归了世界视图与战场视图（均 60 FPS）。


### v1.8 城镇可见性
- 问题：L0/L1 远景下城镇真实半径只有几像素，城区掩膜与分区线都被地形淹没。
- 做法：掩膜按层级提亮（L0 0.92 / L1 0.84 / L2 0.72）、掩膜颜色改为更暖的
  `(158,132,104,156)`（`bake_map.py` 同步，现有 `urban_mask_fulda.png` 已重上色）；
  新增 `drawTownGlow`（径向暖色光晕，最小 13 px、超过 320 px 不画）与 `drawTownMarks`
  （中心点，按人口 2.7/3.5/4.4 px）；城镇轮廓线 1.3 → 2.0 px、颜色加深；
  标签改为"深色底衬 + 浅色字"，并按固定 12–44 px 抬升，不再随真实半径缩到看不见。
- 实测：L0 静态层重建 17.8 ms（预算 40 ms）、每帧绘制 0.1 ms、25,487 段、60 FPS。


### v1.9 拖动/缩放性能修复
- 复现：缩小到最小后拖动，实测 **14 FPS**（62 帧 / 4.36 s）。根因是 `panBy()` 里设置
  `this.dirty = true`，导致拖动时每帧重建整层静态图（重建 10–17 ms + 合成开销）。
- 修复：去掉该赋值（平移由 overscan 偏移处理），overscan 220 → 320 px。
  同条件复测 **60 FPS**（126 帧 / 2.09 s）。
- 缩放：连续 wheel 时每帧重建（16 FPS）。加了"缩放预览"——缩放过程中把上一帧静态图按比例
  贴回（关闭插值），停手 180 ms 后重建；**通过 WebGL 探测仅在硬件加速环境启用**，
  软渲染（headless / 无 GPU）自动回退到原路径，避免 70 ms 的软件缩放。
- 结论：卡顿来自渲染调度，不是 Canvas 2D 能力；引擎选择与地图设计方案见 `MAPDESIGN.md`。


### v1.10 在线底图与 z0–z4 世界瓦片
- 网络复测：S3 **恢复**（z6 单张 90 KB / 10 s）；OpenTopoMap 可达但反盗链返回
  "Generic referrer detected" 水印瓦片；TopPlusOpen DNS 不通；GitHub raw 连接重置。
- 新增可插拔底图源 `data/basemap.ts`：本地烘焙 / **Esri World Topo** / **Esri World Imagery** /
  OpenTopoMap。世界视图工具条一键切换，署名随源更新；在线源连续失败 6 次自动回退本地。
  - Esri 两个源免 key、无水印、约 1 s/张，适合做"参考地形图"；在线并发限制 4、LRU 220、不做批量预取。
  - OpenTopoMap 保留但默认不选（水印需按其提示申请）。
- 世界瓦片补齐 z4：`bake_world.py --download 4`（256 张 / 约 1.5 分钟）→
  `--from-cache --max-zoom 4` 生成 z0–z4（341 张 / 3.7 MB），最高清晰度翻倍。
  生成流程改为"从最高完整层向下重采样出所有层"，保证 minZoom 仍有全球底片可兜底。
- 待办：z5/z6（`--download 5` / `--download 6`）、Natural Earth 矢量（GitHub 仍不可达）。


### v1.11 去富尔达化（任意区域可玩）
- 审计出 4 处区域硬编码并修掉：`loadScenario` 固定读 `scenario_fulda.json`、用
  `towns.find(t => t.n === 'Fulda')` 定向；`TopBar` 写死"富尔达缺口 · 1985"；
  `bake_map.py` 不生成剧本。
- 现在：`scenario_<区域>.json` 缺失时前端生成默认剧本（中线接触线、3000 m 争夺带），
  控制场按"西侧为 ally"定向；烘焙时也会写一份 `scenario_<区域>.json`（已存在则不覆盖）。
- 验证：复制地图、删掉剧本 → 标题显示"…· 未命名剧本"，控制场正常生成，
  78 座城镇 / 22,085 段路网渲染通过，可直接进入战场。
- 全球化方案写入 `MAPDESIGN.md` §10：三层结构（全球基线 / 热点预置 / 按需生成）、
  成本估算（单战场 1.5–2 MB、50 个热点约 100 MB）、推广性清单与推进顺序。


### v1.12 Overpass 合并查询（全球按需的前置）
- 7 个分类查询合并为 1 个 `union` 查询；按面积自动分块（600 / 2400 / 5400 km² →
  1 / 2×2 / 3×3 / 4×4），也支持 `--block n` 手动指定；数据格式与后续处理不变。
- 坑 1：本机 Python 从注册表读到代理，Overpass 请求报 `ProxyError`；`session.trust_env = False`
  后直连正常（DEM/S3 不受影响）。
- 坑 2：并发 2 触发公共实例 **429**；改为串行 + 块间 1.5 s，重试仍走镜像轮换。
- 坑 3：`t0` 被 band 分区逻辑复用，导致日志耗时显示成时间戳；改名 `t_start`。
- 实测（巴黎市中心 12×9 km，504 km²）：1 次查询 **84.9 MB / 58.7 s**、103,192 要素，
  端到端 **71 s** → 62 城镇 / 9,615 段路 / 0.75 MB，并自动生成 `scenario_test12.json`。
  同量级区域旧方案（7 次串行、无分块）约 3–8 分钟。
- 结论：乡村与中小城市一次查询即可；超大城市中心数据量由 OSM 密度决定，需要更多分块。


### v1.13 区划型地块（poly）
- 新增 `Tools/bake_blocks.py`：把城镇分区从"核心圆 + 四扇区 / 沿轴分带"改写为真实地块。
  - 输入：已有 map JSON 的 urban mask + 主干道（motorway/trunk/primary）
  - 步骤：道路栅格化（80 m 网格、1 px 宽）切分城区 → 连通分量 → 小于 0.35 km² 的块并入邻块
    → 按"约 3 km²/块"合并到目标块数（上限 30）
  - 输出：`districts[].poly`（米坐标、5° 分桶轮廓 + DP 简化）、`area`（真实像素面积）、
    `frontage`（东向边缘 ÷ 1.2 km）、`defense`（1 + builtRatio×4）、`builtRatio`、`roadKm`、`value`、
    `cp`（块重心）
  - 富尔达实测：**5 块**（9.1 / 6.7 / 5.7 / 4.1 / 3.9 km²），Bad Hersfeld 4 块，74 城共 99 块
- 前端：`districtAt` 支持点在多边形内判定、`districtPath` 优先使用 `poly`；
  `drawTownBlocks` 按控制方分组批量填充（4 个 Path2D）+ 一次统一描边。
- 性能坑：逐块 fill/stroke 让 L0 重建从 17.8 ms 涨到 **198 ms**；改成分组 Path2D 后回到 **17.5 ms**。
- 未解决：轮廓是极角分桶（凸化），凹形地块会外扩；后续可换边界追踪提高贴合度。
- 保留回退：没有 `poly` 的旧城镇继续用圆/扇区渲染，命中测试同样兼容。


### v1.14 行政区叠加（M2）
- 合并查询新增两类：`relation[boundary=administrative][admin_level=8|9]` 与
  `place=suburb|neighbourhood|quarter|borough`；写进 `map_<区域>.json` 的 `regions`
  （米坐标、按 level 降序重叠、面积 ≥0.04–0.06 km²）。
- `bake_blocks.py`：先把行政区栅格化成 id 图，再让城区像素"按行政区归并"；
  没有行政区覆盖的地方仍用道路连通分量。这样得到的正是两层叠加：
  **行政区优先切分 → 道路填补空白 → 按目标块数合并**。
- 实测（巴黎 12×9 km）：352 个行政区/街区，数据仅 +0.08 MB；巴黎部分合并为 **7 块 / 19.8 km²**，
  周边市镇 1–2 块。
- 富尔达重烘（`--block 2`，10332 km²）后同样走行政区叠加。


### v1.15 富尔达重烘与地块参数
- VPN 关闭后重试：Overpass 主站可用、两个镜像不可达；合并查询改为**只用主站 + 4 次重试**
  （间隔 3/6/9 s），分块缓存键带上 n（`all3_i`）避免调参时串数据。
- 富尔达 111×72 km 用 `--block 3`（9 块）重烘成功：155,144 要素，端到端约 7 分钟
  （含 3 次 502 重试）。
- 修复：`place` 为 way/relation 时缺 `lat` 导致的 `KeyError`（加字段检查）。
- 体积控制：7182 个行政区/街区单独存 `regions_<区域>.json`（2.16 MB），
  `map_<区域>.json` 回到 **0.95 MB**（重烘后一度 3.11 MB）。
- 地块：富尔达 5 块（9.1/6.7/5.7/4.1/3.9 km²）；`frontage` 改为 east÷2000、clamp 1–6
  （合计 15 连，接近旧模型 11 连）；方位重名自动加序号（东南区 / 东南区2）。
- 悬停卡片新增：面积、建筑密度、道路长度。
- 已知问题：合并查询的主干道原先只含 motorway/trunk/primary，**缺 secondary**，
  路网从 22,085 段降到 8,197 段；已把 secondary 加入查询，下次重烘生效。


### v1.16 增量补路网（add_roads）
- 新增 `Tools/add_roads.py`：给已烘焙地图**增量补路网等级**——按 bbox 分块查询、按几何哈希去重、
  缓存键带查询哈希（避免调参串数据），不需要整张重烘。
- 富尔达补 secondary：9 块查询（每块 1.4–1.9 MB / 40–55 s，含 502/504 重试），
  新增 **13,511 条**，路网 **8,197 → 21,708 段**（旧数据 22,085），地图 0.95 → 2.44 MB。
- 验证：地块仍 70 城 / 95 块（富尔达 5 块，frontage 5/4/3/2/1）；路网翻倍后 L0 重建 **16.8 ms**。
- 用法：`python Tools/add_roads.py --map app/public/data/map_fulda.json --classes secondary --block 3`


### v1.17 MapLibre 世界视图（对标 MapHub/Felt）
- 引入 `maplibre-gl` 6.18（唯一新增运行依赖，`React.lazy` 动态 import → 独立 chunk
  **299 KB gzip**，主包仍 **71 KB gzip**）；`CONSTRAINTS.md` §2 依赖白名单与首屏预算同步放宽。
- 新增 `WorldMapLibre`：MapTiler 矢量底图（`topo-v2` / `satellite-v2` 的 style.json），
  MapLibre 负责标注避让、无级缩放、旋转倾斜；控件含缩放、比例尺、署名。
- 操作：拖动平移 / 滚轮缩放 / 双击放大 / 单击取经纬度；「框选战场」模式拖出矩形 →
  显示中心、尺寸与烘焙命令；「生成战场」直接调本地 API；「地图库」一键进入已烘焙战场。
- 兵牌：DOM `Marker`（draggable），与 `store.markers` 双向同步，右键删除，localStorage 持久化。
- 兜底：未填 MapTiler key 时 App 仍用原 Canvas 世界视图（本地瓦片、完全离线）。
- 实测（headless）：MapLibre 容器/控件挂载正常；在富尔达坐标放置兵牌成功并持久化。

### v1.18 本地 PMTiles 世界底图
- 新增 `Tools/fetch_basemap.mjs`：一条命令完成「取 CLI → 裁区域 → 出 style → 落 index」。
  自动下载 `pmtiles` CLI v1.31.2（GitHub Release；curl 连不上资产 CDN 时回退 PowerShell）；
  从 `build.protomaps.com` 日构建（20261114，139 GB）按 `--bbox` 裁本地包，**不下载整包**。
- 前端新增 `data/pmtilesBasemap.ts`：注册 `pmtiles://` 协议、读 `data/tiles/index.json`、
  按当前战场中心选包（`pickZone`），并对每个包做 HEAD 校验，缺包自动不启用。
- `WorldMapLibre` 底图优先级改为 **本地 PMTiles → MapTiler → Canvas 兜底**，按钮循环切换；
  `App` 改为「有本地包或 MapTiler key 才启用 MapLibre 世界视图」，不再单靠 key。
- 新增 `Tools/range_serve.mjs`：给 `.pmtiles` 提供 HTTP Range（206/416，含 HEAD），
  `vite dev` 与 `Tools/serve.mjs` 共用。没有 Range 时 PMTiles 只能整包读取，按需加载就失效了。
- style 后处理：删掉图标与 POI 符号层，`places`/`roads` 只留文字，`text-font` 统一成单个
  `Noto Sans Regular`，字形从 `/data/tiles/glyphs/` 本地取；否则标签要访问
  `protomaps.github.io`，违反「运行时不联网」。
- 实测：富尔达 bbox `8.849,50.240–10.591,51.000`、z0–z13 → **1585 个瓦片 / 45 MB**；
  裁剪耗时由下行决定（实测 40–140 kB/s，6–16 分钟）。运行时只按视口取 Range，不整包加载。
- 依赖：新增 `pmtiles@4.5.0`，只进世界视图的按需 chunk，首屏包不变。

### v1.19 军事地形底图（等高线 / 晕渲 / 交通线 / 军用格网）

本次把「世界视图是黑的」这件事查到底：不是一个 bug，是**三个独立故障叠加**。

| # | 故障 | 表现 | 根因 | 修法 |
| --- | --- | --- | --- | --- |
| 1 | 本地底图包缺派生文件 | 世界视图退回 Canvas 兜底，而 `data/world/t/**` 同样不入库 → 全黑 | `index.json` / `*.style.json` / `glyphs/` 都在 `app/public/data/tiles/` 里被 gitignore，从未重新生成；`loadPmtilesZones()` 404 后 `[]` | 重跑 `fetch_basemap.mjs`（已有 `.pmtiles` 会跳过裁剪） |
| 2 | 地图容器高度为 0 | 地图挂载成功但不可见 | `.main` 是 grid，`.ml-wrap{flex:1}` 对 grid 无效；`.ml-map{position:absolute;inset:0}` 被懒加载 chunk 后注入的 `.maplibregl-map{position:relative}` 覆盖（同权重、后者靠后） | `.main` 加 `grid-template-rows:minmax(0,1fr)`；`.ml-wrap > .ml-map` 提高权重并显式 `width/height:100%` |
| 3 | maplibre worker 加载不了 | 瓦片能下（206）、能解析出要素，但**一个图元都不画** | maplibre-gl 6 用 `new URL('./maplibre-gl-worker.mjs', import.meta.url)` 动态解析 worker，预打包/rollup 都带不出这个兄弟文件；生产端 `serve.mjs` 又缺 `.mjs` MIME，模块 worker 按严格 MIME 被拒 | `setWorkerUrl(import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'))`，`vite build` 产出 `assets/maplibre-gl-worker-<hash>.mjs`；`serve.mjs` 补 `.mjs`/`.pbf` MIME |

第 3 条的排查代价最大，记下判定顺序，下次直接照这个来：

1. `map.loaded()` / `isStyleLoaded()` —— 都为 false 说明风格没加载完，别怀疑着色；
2. `map.queryRenderedFeatures({layers:['earth']})` 有要素、像素却是纯背景色 → 数据没问题，是渲染/合成；
3. 控制台 `Worker failed to load` 才是真凶；
4. **不要用 `Page.captureScreenshot` 判断 MapLibre 画没画**：headless 下 WebGL 图层常拿到过期帧。改为在 `map.once('render')` 里取 `canvas.toDataURL()`，这是唯一可靠的取帧方式（`Tools/dev_mapshot.mjs` 就这么干）。

还有一个隐蔽坑：**MapLibre 的 vector/raster 源不给 `bounds` 就会请求包外瓦片**，404 重试使 `loaded` 永远为 false，
整张图只在首帧画出 `background`（看着像"底图样式没生效"）。现在 `protomaps` 与 `dem` 源都显式写了 `bounds`。

#### 新增图层

| 图层 | 数据 | 实现 |
| --- | --- | --- |
| 地形晕渲 | 本地 DEM `dem/<区域>/z9–z11`（terrarium PNG，130 瓦片 / 15.5 MB） | `raster-dem` + `hillshade`（注意：必须插在 `earth` 之后、`landcover` 之前，否则被不透明底色盖住） |
| 等高线 | `contours_<区域>.json`（50 m 等高距，250 m 计曲线，16 层 / 1.7 万顶点 / 0.21 MB） | marching squares → 折线缝合 → Douglas-Peucker(190 m) → GeoJSON 每层一条 MultiLineString；随缩放淡入（z5 0.16 → z14 0.62），计曲线加粗 |
| 高程标注 | 同文件 `labels`（309 个锚点） | symbol 层，`text-rotate` 沿线方向，MapLibre 碰撞自动取舍 |
| 交通线 | Protomaps `roads` | 按 `highway/major/minor/minor_service/link/other` 分级配色 + casing；桥梁/隧道/跑道/滑行道独立配色 |
| 铁路 | Protomaps `roads:kind=rail` | 深灰实线 + 白色 `line-dasharray` 叠一层，做出经典铁路虚线符号 |
| 军用格网 | 运行时生成 | **UTM 33 带真格网**（东/北向线二分求解，不是经纬网），随缩放切 1/2/5/10/25/50 km，每 4–5 条加粗 |
| 射程圈 | 运行时生成 | 单击放中心，5 级同心圆 + `line-center` 标注，滑杆调圈距 |

#### 判读读数

十字光标实时给出：**DD 经纬 / UTM（带号+6 位东向+7 位北向）/ 高程 / 坡度% / 坡向**。
DEM 采样用 `groundResolution = 156543·cosφ / 2^z`（米/像素），隔 4 像素取差分；
瓦片 LRU 90 张，瓦片到货后自动补画读数（不依赖下一次鼠标移动）。

实测（富尔达缺口）：富尔达城 308 m / 3% / 南；伦山 661 m / 13% / 西。

#### 工具与流程

```bash
python Tools/bake_dem.py       --map app/public/data/map_fulda.json --zmin 9 --zmax 11
python Tools/bake_contours.py  --key fulda --map app/public/data/map_fulda.json
node   Tools/fetch_basemap.mjs --key=fulda --bbox=8.849,50.240,10.591,51.000
```

`fetch_basemap.mjs` 顺带修了一个真 bug：pmtiles CLI 的 `--header-json` 字段从 `min_lon…`
变成了 `bounds`/`center` **数组**，旧代码读 `h.min_lon` 得到 `undefined`，`index.json` 里
`bbox`/`center` 全成 `null`（`pickZone` 靠兜底才没炸）。现在两种 schema 都兼容。

#### 遗留

- DEM 只有 z9–z11，放大到 z13+ 晕渲会略糊（等高线是矢量不受影响）；
- `contours_<区域>.json` 按 50 m/250 m 生成，若以后要 25 m 战术级等高线，`--interval 25 --grid 800`；
- 世界视图目前仍以「一个区域一个 PMTiles 包」为单位，跨包无缝拼接未做。

### v1.20 城市巷战：城区容量 + 兵排实体 + 邻接图

需求是「按城镇轮廓划分城区，在每个城区里放兵排」。**城区划分不用重做**——现有 74 镇 / 109 块
本来就是从真实建成区（WorldCover built-up）+ 行政区/道路切出来的，形状不规则、大小不等，
正是巷战需要的东西。真正缺的是三件事：容量换算、邻接关系、兵排作为实体。

#### 三层模型

| 层 | 是什么 | 提供什么 |
| --- | --- | --- |
| 城区 `District` | **战斗容器** | 容量（排）、防御加成、建筑密度、路长、夺控价值、邻接街区 |
| 兵排 `Platoon` | 容器内的**实体** | 位置（吸附到街区内部）、姿态（据守/街垒/预备/渗透）、兵力 |
| 建筑/街道（detail 层） | 掩体与通路 | L2 已有机理，后续接掩体等级 |

#### 容量换算：`排容量 = frontage × 3`

`frontage` 原本就是「连当量」（`bake_blocks.py` 按面向接触线一侧边缘 ÷ 1.2 km，clamp 1–6）。
1 连 = 3 排，所以：

| 城区 | frontage | 排容量 |
| --- | --- | --- |
| 富尔达 北区 | 6 连 | 18 排 |
| 富尔达 西区 | 5 连 | 15 排 |
| 富尔达 东南区 | 3 连 | 9 排 |
| 富尔达 东北区 | 2 连 | 6 排 |
| 富尔达 东南区2 | 1 连 | 3 排 |

富尔达全城 17 连 ≈ **51 个排位** ≈ 1.5 个营。超编沿用 §6 的硬规则：**不加火力，只加暴露与伤亡**，
侧栏直接给红字警告，不软性拦截——玩家可以堆，但要认伤亡。

#### 邻接图（能不能打 / 能不能走）

`urbanIndex()` 一次性算好并缓存（WeakMap 键是 towns 数组）：

- `poly` 镇：多边形**顶点最小间距 ≤ 260 m** 视为相邻；退化时用质心 ≤ 1.5 km 兜底；
- `radial` 镇：核心 ↔ 全部扇区，扇区 ↔ 相邻扇区（角度序）；
- `band` 镇：按 `t0` 排序后相邻两段相连。

实测富尔达 5 块全连通（41 个有邻接的街区 key）。侧栏「相邻街区」直接给出对方的
`已占/容量`，点一下就能把选中的排移过去——这就是巷战的机动单位：**一跳一街区**。

#### 两个踩坑（都已修）

1. **`poly` 与 `cp` 都是绝对米坐标**，不是相对城镇原点。原作者注释写的 `cp` 是「建筑密度重心」，
   `districtPath()` 也是直接把 `poly` 丢进世界坐标画的。我一开始按「相对原点」写了
   `t.x + cp[0]`，结果兵排全部落在城南野地里。判定方法很简单：`districtAt()` 里
   `pointInPoly(k.poly, x, y)` 传的就是世界坐标——**它怎么用，你就怎么用**。
2. **建筑密度重心会落在凹多边形外面**。直接拿 `cp` 当锚点，兵排会飘到街区外、点击也点不中。
   现在 `insideAnchor()` 在 bbox 上打 18×18 网格，取「在多边形内且离 `cp` 最近」的点作为锚，
   按 key 缓存；`slotPoint()` 从锚点做黄金角螺旋散开，越界就回落到锚点。

另外 `districtNearScreen()` 加了 18 px 的邻近兜底：低倍下小镇只有几像素，点准中心很难，
现在点「大致那个位置」也算命中。

#### 交互

| 操作 | 结果 |
| --- | --- |
| 选兵种 → 点城区内部 | 放一个排；锚点自动找街区内的空位 |
| 点兵排 | 选中，侧栏出姿态按钮 |
| 右键兵排 | 撤出 |
| 侧栏「相邻街区」 | 选中的排直接移防过去（只列真正相邻的） |
| 城区轮廓 | 绿=未满 / 黄=刚好满编 / 红虚线=超编 |

兵排符号按 APP-6 简化：矩形 + 兵种图标（步兵 X、装甲椭圆、炮兵实心圆、侦察斜线、指挥旗），
上方 3 个点表示排级，左下红叉表示减员；预备=虚线框，渗透=点线框，街垒=底部双横线。
符号固定屏幕尺寸（不随缩放变大），20 个排同屏仍是 60 FPS。

#### 已知限制与下一步

- **还没有战斗解算**：现在只解决「谁在哪个街区、能不能动」。下一步同街区火力交换（攻方 vs 守方，
  按 `defense`/`builtRatio`/姿态修正伤亡与压制），跨街区只能打相邻；
- 排以下没有拆（班/火力组），城区内也没有真正的掩体个体——建筑 detail 层已经能画出房屋，
  接「建筑格 + 掩体等级」是自然的第二步；
- 姿态目前只影响显示与文案，数值修正要等解算落地再定，避免先写死一套假参数。

### v1.21 梯队拆分：连 → 排 → 班，父级带动子级

上一版只有「排」一级。现在按 APP-6 的编成往下拆两层，并让**上级兵牌一移动，下属整棵树跟着走**。

#### 编成与容量

```
连 company  = 3 排 = 9 班     占 3 个排位
  排 platoon = 3 班           占 1 个排位
    班 squad                  占 1/3 排位
```

放一个连 = 一次生成 **13 个兵牌**（1 连 + 3 排 + 9 班）。容量统计只算**根节点**的排位价，
不重复计子级：`districtOccupancy = Σ ECHELON_COST[根节点.echelon]`。所以富尔达北区 18 排位
= 6 个连，或者 18 个排，或者混编。

#### 父级移动 = 子树整体重排

`moveUnit(id, ref)`：把该节点连同 `descendantsOf()` 一起搬到目标街区，然后**递归重排**
（父级放在锚点，子级按 `childSlots()` 在父级周围环形展开，越界回落到父级位置）。

为什么不是"保留相对偏移"？因为街区形状和大小不同——保留偏移会把子级甩到街区外。
重排的代价是每次搬动后队形会"重新集合"，但这恰好符合巷战里"逐屋重新展开"的直觉。

姿态也随树同步：改一次姿态，整棵树一起改（`setPosture` 里对子树批量赋值）。

#### 缩放自动展开（这就是"微观里自动移动"的可见部分）

| 视野比例 | 显示 | 实测可见兵牌 |
| --- | --- | --- |
| `scale < 0.028` | 只画**连** | 2（2 个连） |
| `0.028 ≤ scale < 0.058` | 画**排**，父级连收起 | 8（8 个排） |
| `scale ≥ 0.058` | 画**班**，父级排与连收起 | 27（27 个班） |

规则写在 `visibleUnitIds()`：从最深层往浅层扫，某节点只要已有子节点被显示，它自己就收起。
这样同一时刻每个位置的兵牌总量恒定（不会父子上下一齐堆着），放大就是"展开"，缩小就是"收拢"。
`renderer.visibleUnitCount()` 暴露当前可见数，便于调试与后续上状态栏。

#### 实测

- 放 1 个连 → `units=13`，`countsOf` 返回 `1 连 · 3 排 · 9 班`，占 3 排位（东南区 cap 9）；
- 把该连移到相邻街区 → **13 个兵牌全部换街区**，坐标在新街区内重新展开；
- 5 个上级 / 35 个兵牌同屏：60 FPS，每帧绘制 0.6 ms，静态层重建 17.4 ms。

#### 符号

APP-6 梯队标记：班 ●、排 ●●●、连 ｜（竖线）；尺寸 连 36×23 / 排 28×18 / 班 20×13 px。
兵种图标不变（步兵 X、装甲椭圆、炮兵圆、侦察斜线、指挥旗），姿态仍用框线区分。

#### 下一步

- 上级收起时**不画任何痕迹**，放大后容易忘了"这堆班属于哪个连"——可以给父级留一个淡色包围框或括号；
- 战斗解算要按**班**结算伤亡、再向上汇总成排/连战力，这样拆班才有意义；
- 班目前只是几何细分，没有独立武器/编制数据（`units_preset_nato.json` 还没建）。

### v1.22 命令系统：上级下令，下级自动执行

上一版只有"跟随移动"。这一版把**命令**做成一等概念：给连下令"攻击某某街区"，
下辖 3 排 9 班自动接收同一条命令、各自算自己的目标点、各自走、各自打；
同时任何下级都能被单独指挥，且不会被上级命令覆盖。

#### 命令模型

```ts
Order { type, district?, tx?, ty?, pinned, since }
type ∈ hold 守线 | fire 开火 | move 移动 | attack 攻击 | withdraw 撤离
```

`pinned` 是"这条命令是玩家单独下的"，决定它会不会被上级覆盖。

#### 下发规则（这是核心）

| 情形 | 结果 |
| --- | --- |
| 对任意兵牌下令 | 该兵牌 + 全部下级继承同一条命令 |
| 下级已被单独下令（`pinned`） | 上级再下令时**跳过它**，保持原命令 |
| 点「解除单独指令」 | 清掉该子树的 `pinned`，下次上级下令就会覆盖 |

实测：给一个班单独下「开火」，再给它的连下「守线」——3 个排变 `hold`，那个班仍是 `fire`；
点「解除单独指令」后再下令，班跟着变 `hold`。

`move`/`attack` 的目标不是父级那一个点：下发时就地算好整棵树的落位
（父级在目标街区锚点，子级按 `childSlots` 环形展开），所以到达后是一个展开的队形，不是一个点。

#### 执行（时间驱动）

游戏时钟 1x = **1 游戏分钟 / 真实秒**（4x 即 4 分钟/秒）。每帧把 `dtMin` 交给 `stepOrders`：

- **移动**：按兵种速度（步兵 90、装甲 320、炮兵 70、侦察 480、指挥 260 m/游戏分钟）× 姿态系数
  （街垒 0、据守 1、预备 1.1、渗透 1.3），逐帧向目标点推进；到达（≤45 m）后
  **攻击→开火、移动→守线**，不会到达后还傻站着。
- **开火 / 攻击**：按街区聚合，只统计**叶子节点（班）**的战力，避免"连和它的班重复计"：
  `power = 兵种系数 × 排位价 × 兵力 × 姿态火力系数`，兵种系数 步兵 1 / 装甲 1.7 / 炮兵 1.15 / 侦察 0.6 / 指挥 0.35。
- **损失**：`loss = (敌战力 / 我方叶子数) × 0.12 × dtMin / 防御系数`，
  防御系数 = `(1 + 0.2×(defense−1) + 0.6×builtRatio) × 姿态防御`（街垒 1.28、预备 0.82、渗透 0.85）。
- **向上汇总**：班掉血后，排/连的兵力取子级均值——兵牌上看到的是真实减员，不是满编假象。
- **撤离**：朝远离最近敌军的方向退 1500 m，不改街区（脱离接触而不是跑路）。

#### 实测

| 场景 | 结果 |
| --- | --- |
| 步兵连（3 排位）攻击驻守装甲排（1 排位，建筑 40%） | 28 游戏分钟后装甲排被歼，步兵连掉到 94% |
| 连 vs 连同街区对射 32 分钟 | 双方 0.80 / 0.77，守方（建筑加成）略占优 |
| 给班单独下「开火」，再给连下「守线」 | 班保持 fire，3 个排变 hold |

#### 踩坑：移动不更新 `districtKey`

第一版移动只改 `x/y`，不改 `districtKey`，于是"同街区交战"的判定永远不成立——
两个连在同一个街区对射 32 分钟，**零伤亡**，日志一片安静。
现在 `stepOrders` 每帧对移动中的单位做一次 `districtAtPoint()` 重定位（退出街区边界即换块），
到达时直接用命令里的目标街区。这条教训值得记：**几何位置和逻辑归属是两个字段，改一个必须改另一个**。

#### 已知限制

- 跨街区不能互相支援射击（只有同街区才交火）；
- 没有压制、士气、弹药、油料；
- 夺控点与实控范围目前**不随战果变化**（`ControlField` 是烘焙好的静态场，要改成动态生成）；
- 敌军不会自己下令——目前只能手动摆位，没有 AI。

### v1.23 底图铺满 + 交通线分级 + 代码体检

**取景**：原来 `fitBounds`（contain）导致两侧留纸色空白，一拖就出界，看着像「只有富尔达有图」。
改为 cover 取景 + 相机限位。踩坑：手算 `156543*cos/2^z` 与实际渲染差一档——`Emulation` 环境下
`getZoom()` 与 `getBounds()` 不一致，**不要手算 zoom，只信 `getBounds()` 的反馈闭环**。
（v1.24 有了全球层后，限位与 cover 逻辑整体删除。）

**交通线分级**：Protomaps 把 primary/secondary/tertiary 都塞进 `kind=major_road`，之前一片橙色麻线。
查瓦片属性发现 `kind_detail` 带 OSM 原值，据此分级：主干（motorway/trunk/primary + link）描边加粗；
次级淡化 62% 且宽度 0.45 折；`minor_service/other/link` 设 `minzoom 13`。铁路深灰实线 + 白虚线。
实现限制：MapLibre **同一属性只允许一个 zoom 插值**，宽度必须写成
`['*', interpolate(zoom), ['case', isMain, 1, 0.45]]`。

**代码体检**：

| 项 | 结果 |
| --- | --- |
| CONSTRAINTS §3 core 不碰 DOM | **发现并修复**：`core/towns.ts` 的 `districtPath()` 用了 `Path2D`，移到 `map/` |
| 死代码 | 删 `capacityOf/capOf/childEchelon/isMoving`、`movePlatoon/toggleUnits`、`M_PER_DEG_LAT`、`StyleInputs.origin/mPerDegLon`；`districtContains` 收为私有 |
| 隐患 | `anchorCache` 是模块级 `Map<districtKey>`，换图撞 key → 改 `WeakMap<Town, Map>` |
| 死代码转功能 | `renderer.visibleUnitCount()` 进状态栏 |

---

### v1.24 转向：只做世界地图，删掉战场视图

产品方向变了：**世界地图是产品本体，战场视图删掉**。理由：战场渲染信息量不够、观感不理想，
与其修补不如把力气全放在世界地图上；初版也不再绑定富尔达一块地区。

#### 删掉的东西

| 类别 | 内容 | 规模 |
| --- | --- | --- |
| 渲染 | `MapCanvas`、`map/renderer.ts`、`map/layers/*`（8 图层）、`map/{basemap,control,terrain,paint,districtPath}` | 约 2,300 行 |
| 旧 Canvas 世界视图 | `WorldCanvas.tsx` + `ui/WorldPanels.tsx` | 约 760 行 |
| 规则层 | `core/{towns,units,urban,orders,scenario,detail,sample,time,world,types}.ts` | 约 1,500 行 |
| 数据层 | `data/{loadMap,loadScenario,loadDetail,unitStore,worldSource,basemap,zones,bakeApi}.ts` | 约 400 行 |
| 战场数据 | `map_fulda/regions_fulda/detail_*/scenario_*/terrain/urban/preview/world_*` | 约 7.7 MB |
| 烘焙工具 | `bake_map / bake_blocks / bake_town_detail / add_roads / make_preview / bake_terrain / bake_world / bake_world_vectors / bake_service` | 9 个 |
| 样式 | `styles.css` 960 → 396 行 | −564 行 |

前端 **约 4,700 行 → 1,769 行（−62%）**，14 个文件；首屏 JS 80 KB → 49 KB gzip。

#### 底图改成「全球 + 区域」分层

`militaryStyle()` 改为按 **tier 列表**生成：每层复制一套 base 图层、绑各自 source、按
`styleMin/styleMax` 裁剪 minzoom/maxzoom。`zonesAt()` 取命中坐标的全部区域包 + 全部全球包；
`tierBands()` 分配接管区间（后一层 `styleMin` = 前一层 `maxzoom+1`）。全球层一直渲染（超出
maxzoom 就 overzoom），区域层叠在上面——**任何位置都至少有图，缺层也不会空白**。
有全球层后，`setMaxBounds` + `fitCover` 那套取景限位**全部删除**。

全球晕渲用 `dem/world`（z0–z5，1,366 文件 / 86 MB）单独一个 `raster-dem` tier，
和区域 DEM（`dem/fulda` z9–z11）叠加。

#### 踩坑：`pmtiles extract` 的「假卡死」

提取全球包时输出文件大小长时间停在 42.36 MB 不动，`show` 报 `magic number not detected`，
看起来像卡死。**其实是预分配了文件大小**，下载仍在继续；我用 `Select-Object -Last` 把进度条
缓冲了，看不到而已。教训：**不要用输出文件大小判断 extract 进度**。

带宽差异极大：不开 VPN 时 15–30 kB/s，开 VPN 后先到 200 kB/s 再跌到 3–20 kB/s，
23 分钟只完成 13/43 MB。**半成品已删除**（避免留坏包），全球矢量包留待带宽好时重跑：

```bash
node Tools/fetch_basemap.mjs --key=world --world    # z0-z6，约 44 MB
```

`fetch_basemap.mjs` 已支持 `--world`（无 bbox、maxzoom 默认 6、`index.json` 写 `kind:'world'`、
额外产出共享 `base.style.json`）。`bake_contours.py` 去掉对已删的 `map_<区域>.json` 的依赖，
改为直接吃 `--bbox`，投影用常量（`mPerDegLat 110540`、`mPerDegLon 111320*cos`）。

#### 踩坑：两处 MapLibre 崩溃

1. `maxBounds: [[-180,-85],[180,85]]` 会让 `calcMatrices` 空指针（整张地图不挂载）——
   去掉 maxBounds，MapLibre 自己已限制 ±85°。
2. 图层开关 effect 里 `map.getStyle().layers` 在样式未就绪时是 `undefined` → 崩 React。
   现在先取 `style` 再判 `Array.isArray(style.layers)`，并对 `setLayoutProperty` 逐个 try/catch。

#### 另一个事故：文档被覆盖

整理文档时用整文件写入覆盖了本文件，丢掉 v1.23/v1.24 两条记录。
`git checkout HEAD -- DEVLOG.md` 恢复到已提交的 v1.22 版本，再把这两条重新补回来。
**教训：整理长文档只能插入/替换片段，不要整文件重写。**

### v1.25 等高线精度：25 m 等高距、逐条标注、Mercator 对齐

玩家反馈两件事：① 只有 250/500 有数字；② 等高线跟绿/黄色块对不上。都成立，根因不同。

**① 只有计曲线有数字**：标注层按 `b == 1` 过滤，而 `bold = interval x 5`，所以只有 250/500/750 有字。
改为两层：`contour-label`（计曲线，z >= 9）+ `contour-label-all`（全部等级，z >= 11.5），
都用 `symbol-placement: 'line'`，沿等高线自动排布、随缩放调整间距（`symbol-spacing` 随 zoom 插值 260->640 px）。
标注不再使用烘焙时打的固定锚点——那批锚点按地面 6 km 间距生成，缩放后密度不变，这才是"缩放后看不见"的根本原因。
`bake_contours.py` 已停止生成锚点数组（`labels`），JSON 从 1.40 MB 降到 1.37 MB。

**② 等高线与色块不重合**，两个独立原因：

| 原因 | 影响 | 修法 |
| --- | --- | --- |
| DEM 裁剪按**纬度线性**取行，而瓦片是 Mercator 投影 | 0.76 度跨度内纵向错位可达数百米 | `crop_bbox()` 改用 `asinh(tan(lat))` 做 y 映射 |
| 等高线网格只有 277 m/px（`--grid 400`），放大后是折线块 | 压不住矢量色块的细节 | 默认改为 `--grid 1200`（约 103 m/px）、`--tol 45`、`--min-km 0.6` |

同时 `bake_contours.py` 把实际用的投影常量写进 JSON（`mPerDegLat` / `mPerDegLon`），
前端优先用它们换算米->度；以前前端自己按 `110540 / 111320*cos(lat)` 猜，和烘焙时的常量可能不一致。

**参数变更**：等高距 50 -> **25 m**，计曲线 250 -> **125 m**，层数 16 -> **33**，
顶点 16,785 -> **113,954**，文件 0.21 MB -> **1.37 MB**（仍在 4 MB 上限内）。

**踩坑**：用 PowerShell `Set-Content -Encoding UTF8` 改 Python 文件会写入 BOM，
Python 报 `invalid non-printable character U+FEFF`。改 Python 文件一律用 Python 读写
（`io.open(..., encoding='utf-8-sig')` 读、`utf-8` 写）——这是 DEVLOG 踩坑 #3 的重演。

### v1.26 全球矢量包落地：本地母包 + 两层叠加跑通

玩家把 125.55 GB 的整星母包放在 `E:\PersonalGame\v4.pmtiles`（z0–z15，全球 bounds 完整）。
有了本地母包，**裁剪不再需要网络**：

```bash
Tools\bin\pmtiles.exe extract "E:\PersonalGame\v4.pmtiles" \
  "app\public\data\tiles\world.pmtiles" --maxzoom=6 --download-threads=8
# 实测 1.2 秒 / 36 MB/s，产出 42.36 MB
node Tools/fetch_basemap.mjs --key=world --world --source="E:\PersonalGame\v4.pmtiles"
```

`fetch_basemap.mjs` 的 `--source` 参数直接接受本地路径，跳过所有网络请求（母包校验、裁剪都不用联网）。

#### 结果

- `index.json` 两条：`world z0–6 (42.36 MB, kind=world)` + `fulda z0–13 (41.67 MB, kind=region)`；
  旧条目缺 `kind` 字段，已回填 `region`（`zonesInBounds` 里 `undefined !== 'world'` 也能工作，但显式更清楚）。
- 运行时挂上 **2 层**：`world` + `detail_fulda`，共 **137 个图层**，底图 84 MB，无报错。
- z3 看欧洲：国界、国名、主要公路、城市全有；z6 看德国：高速路网与城市清晰；z7 起富尔达区域层接管。

#### 两个当场修掉的问题

| 问题 | 现象 | 修法 |
| --- | --- | --- |
| 等高线没有 minzoom | z6 时整个富尔达 bbox 糊成一团棕色（33 层等高线压进十几像素） | `contour` / `contour-bold` 加 `minzoom: 8`（标注本来就是 9 / 11.5） |
| 字形只有 0–255 | 西里尔与扩展拉丁（Москва、Ř）回退到系统字体，控制台刷 404 | 补 `256-511.pbf`、`512-767.pbf` 两个字形分片（各约 100 KB） |

#### 仍未做

- **L1 大区包**（欧洲 z6–z8）：母包本地，随时可裁，只需一条命令；
- `fetch_basemap.mjs` 的字形分片列表还没写进脚本（本轮是手工补的两个 pbf），下次重跑只拉 0–255；
- 多层叠加的**性能**实测：137 层在软件渲染下偏慢，真机 GPU 未测；
- 桥梁/隧道/渡口/机场符号（属性已在两层瓦片里，纯样式活）。

### v1.27 交接状态（换会话前必读）

#### 已完成并能跑

| 能力 | 关键文件 | 状态 |
| --- | --- | --- |
| 三层底图 | `tiles/index.json` | world z0–6 42 MB / europe z6–8 106 MB / fulda z0–13 42 MB，共 190 MB |
| 图层装配 | `data/militaryStyle.ts` | 按 tier 复制整套图层，`tierBands` 分配接管区间 |
| 视口自动挂载 | `data/pmtilesBasemap.ts` | `zonesInBounds` + `moveend` 防抖重建，同屏最多 2 个区域层 |
| 等高线 | `Tools/bake_contours.py` | 25 m 等高距 / 1200 网格 / Mercator 配准 / 沿线标注两层 |
| 坡度通行 | `Tools/bake_slope.py` | 6 级色块瓦片，富尔达 2.04 MB、全球 3.58 MB，默认关闭 |
| 测距/方位/剖面 | `map/measureTool.ts` | 大圆距离、真方位 + 密位、65 点剖面 SVG |
| 交通线 | `militaryStyle.ts` | 主/次/支分级、匝道继承主路宽度与描边、桥隧纸色光晕 |
| 铁路 | `railsOf()` | 黑 2.3px + 白枕木虚线 [1.1,2.1]，minzoom 7 |
| 军事要素 | `tierLayers()` | 军事用地填充、机场虚线轮廓 |
| 性能 | `WorldMapLibre.tsx` | renderWorldCopies:false、fadeDuration:0、DEM 缓存 48；实测 61 FPS / 91 MB 堆 / 200 图层 |

#### 已知问题

1. **高程采样器不回退全球 DEM**：measureTool 只挂区域 DEM（富尔达 z9–11），出区域显示 `—`。修法：复合采样器（区域优先，超 bbox 回退 world），约 40 行。
2. **铁路大倍率偏「串珠」**：可降到白线 1.5 + 虚线 [2,2]。
3. 200 图层在软件渲染 61 FPS，真机 GPU 未测。
4. 字形分片已写进 `fetch_basemap.mjs`，但现有 `tiles/` 里的分片是手工补的。

#### 下一步

**城市单元格与占领**，契约见 `MAPDESIGN.md §11`，实现走浏览器内切分。

#### 常用命令

```powershell
cd E:\PersonalGame\Project1\app; npm run dev
Get-NetTCPConnection -State Listen -LocalPort 5183 | %{ Stop-Process -Id $_.OwningProcess -Force }
Tools\bin\pmtiles.exe extract "E:\PersonalGame\v4.pmtiles" "app\public\data\tiles\xx.pmtiles" --bbox=W,S,E,N --maxzoom=13
node Tools/fetch_basemap.mjs --key=xx --bbox=W,S,E,N --name=名称 --source="E:\PersonalGame\v4.pmtiles"
python Tools/bake_dem.py --bbox=W,S,E,N --key=xx --zmin=9 --zmax=11
python Tools/bake_contours.py --key=xx --bbox=W,S,E,N
python Tools/bake_slope.py --key=xx
node Tools/strip_comments.mjs --check; cd app; npx tsc --noEmit; npx vite build
```

#### 踩坑索引

1. `maxBounds` 设成整个世界 → `calcMatrices` 空指针，整图不挂载。
2. `map.getStyle()` 在样式就绪前是 undefined，取 `.layers` 会崩 React。
3. 动态图层在 tier 循环里插入会重复，已有按 id 去重兜底，新增层要小心。
4. PowerShell 写 UTF-8 给 Python 文件加 BOM → 报 `U+FEFF`，改 Python 文件用 Python 读写。
5. 服务读 `app/dist`，改 `app/public/data/**` 后必须重新 build 或拷到 dist。
6. `pmtiles extract` 输出文件是预分配的，别用大小判断进度。
7. 整文件覆盖写长文档会丢历史——只插入片段。

---

### v1.28 地块 v2：全球方格 + 城市加密

> **已被 v1.29 撤销**：格子玩法被判定为退回普通兵棋，改走「城区影响场」。此条只作决策存档。

任务：把 `MAPDESIGN §11` 的"城市单元格"从**按城烘焙**改成**全世界零数据铺满**——乡村一格，
城市按规模裂成多格。设计契约已按 v2 重写（见 §11），这里只记决策与坑。

#### 决策：地块改成 UTM 方格，不再切真实轮廓

v1 的"行政区 / 主干道切分"走不通，原因是数据、体积、可复现性三样都卡死：全球底图只到 z6，
99% 的城市没有切分数据；烘全世界是几百 MB 到 GB；瓦片简化会让同一城市两次切出不同结果。
改成 **UTM 公里方格 + 四叉降级**：

| 项 | 值 |
| --- | --- |
| 层级 | 8 km → 4 → 2 → 1 km（逐级四叉） |
| 乡村 | 半径 < 1.2 km 的居民点不参与分裂，一个 8 km 地块就是一格 |
| 城市 | 格内 5×5 采样，城市圆盘覆盖率 ≥ 16% 且边长 > 1 km 就裂成 4 格 |
| 半径 | `8·√pop`，夹在 400 m – 40 km |
| 预算 | 单视口 420 格，按 `覆盖率 × 面积` 从高到低裂 |

#### 数据：一条城镇记录，几何 0 B

| 产物 | 来源 | 体积 |
| --- | --- | --- |
| `data/cities.json` | 世界包 z6 的 `places` 点 | 5,615 城镇 / **73 KB** |
| `data/cities_fulda.json` | 富尔达包 z13 | 1,623 居民点 / **18 KB** |
| 地块几何 | 运行时现算 | **0 B**（单视口 ≤ 420 格 / ≤ 20 KB） |

对比：烘全世界 = 6M 格 × 100–150 B = 几百 MB。**省了四个数量级**，而且新增城市不用重烘。

#### 实测

| 场景 | 格数 | 耗时 |
| --- | --- | --- |
| 富尔达 z14（7 万） | 56（48 × 1 km） | 4.4 ms |
| 柏林 z12（370 万） | 258（256 × 1 km） | 2.1 ms |
| 上海 z11 | 420（预算上限） | 1.5 ms |
| 乡村 z13 | 1（8 km） | < 0.2 ms |

#### 踩坑

1. **MVT 几何是 zigzag 编码**：自己写解码器时按无符号 varint 读坐标，柏林被解到 15.54°E
   （偏 2.1°，20 多公里）。几何 delta 一律 `(n >> 1) ^ -(n & 1)`。属性标签不受影响，所以
   前几个城市看着"差不多对"，是坑里最阴的一个。
2. **`places` 在不同缩放是不同东西**：z6 是干净的点（正是我们要的），z13 变成边界面/中心点，
   同一个 Fulda 能出现在 9.684/50.533（市政边界质心，pop 136k）和 9.676/50.551（镇点，pop 68k）
   两处。烘焙只收 `type === 1` 的点；面留到以后做"格边贴街区"的装饰时再处理。
3. **半径公式单位写错**：`Math.min(50, ...)` 想写 50 km 实际是 50 m，全部半径归零 → 覆盖率恒 0
   → 格子永远不分裂，看起来"算法不工作"。修完先用离线脚本打格数直方图，别在浏览器里猜。
4. **图层插错位置会被底图压住**：一开始把 `cell-*` 插到第一个 symbol 层之前，结果落在 buildings
   填充之下，格线在城里完全看不见（截图里只有乡村边界）。改插到栈顶（与军用格网一致）。
5. PowerShell 正则批量改 TS 文件不稳（换行、引号），本轮改代码一律用 Python 读写。

#### 下一步

- 期 2：兵牌进出驱动归属（拖动兵牌 → 格子变色）；
- 邻接移动：`cellAt` 探点算跨级邻接，不存邻接表；
- 区域包逐个补 `cities_<key>.json`（一条命令：`node Tools/bake_cities.mjs --pack=... --zoom=13`）。

### v1.29 撤销地块，改城区影响；铁路升为陆路核心

两件事同一天定的，都记在这里。

#### 一、地块（v1.28）整体撤销

v1.28 的全球方格地块虽然省内存，但玩法上退回"占格子"的普通兵棋，格子本身不产生战术含义。
**决定：删掉地块，改成连续影响场。**

| 删掉 | 规模 |
| --- | --- |
| `core/cells.ts` / `data/cellStore.ts` / `map/cellLayer.ts` | 约 460 行 |
| store 的 `cellsOn / cellOwners / cellHover` 与四个方法 | 约 40 行 |
| 地图上的「地块」按钮、面板、点击占领 | 约 50 行 |
| `MAPDESIGN §11` 旧契约 | 整节重写 |

保留并改用途：`cities.json` / `cities_<区域>.json`（城镇点 + 半径 + 名字）现在是**城区影响场**的数据源，
`Tools/bake_cities.mjs` / `Tools/mvt.mjs` 不动。

#### 二、城区影响（无格）

单位在城区内 → 按距离连续衰减的修饰，没有格子、没有占领、没有归属存档：

| 项 | 城心满值 | 理由 |
| --- | --- | --- |
| 机动 | −30% | 街巷、拥堵、废墟、路口瓶颈 |
| 防御 | +25% | 掩蔽、工事、制高点 |
| 侦察 | −25% | 遮蔽、视界受限 |
| 炮兵 | −35% | 城市化目标、附带损伤顾虑 |
| 补给 | +20% | 兵站、仓库、铁路枢纽 |

`t = clamp(1 − d/(1.25r), 0, 1)`，规模系数 `k = clamp(0.55 + r/16000, 0.55, 1.35)`，
生效值 = 表值 × t × k。富尔达实测：`−22% / +18% / −18% / −25% / +14%`（t≈0.97、r≈3.0 km）。
右下角面板只在光标进城区时出现，纯读数，尚未接进解算——单位还没有数值模型。

#### 三、铁路升为陆路交通核心

玩家反馈：高速权重太高，铁路应该当主角。改法：

| 元素 | 之前 | 现在 |
| --- | --- | --- |
| 铁路 | 2.3 px 墨线 + 2.3 px 白虚线 | **4.8 纸色光晕 + 3.2 墨线 + 1.5 px 白枕木 `[1.3,2.6]`**，压在最上层 |
| 高速 | 3.1 px 暗红 + 独立描边，单独一副面孔 | 与主干**同级同色同宽**：`#c1855c` / 描边 `#a76a42` / 1.45 px |
| 次要 | 0.45 折宽 | 0.42 折宽，`minzoom 9` 起 |

高速与主干现在同时出现、同时消失；铁路永远比任何公路粗——"陆路交通"读的就是铁路网。

**数据现实（实测）**：Protomaps 的 `roads` 层只在 **z11 及以上**才带 `kind=rail`：

| 缩放 | 富尔达包里的 rail 要素 |
| --- | --- |
| z9 / z10 | 0 |
| z11 | 3–10 |
| z12 | 3–18 |

所以 z10 以下的战役/战略尺度**根本没有铁路几何**，不是样式藏掉了。低倍要显示铁路网，
只能另做一层全球铁路（Natural Earth 1:10m railroads，或从母包 z12 抽 rail 单独成层），已进 `MAPDESIGN §十` 待办。
样式里的 `minzoom 7` 是留给将来那层的，现有底图在 7–10 段是空跑。

#### 四、顺手挖出三个真 bug

1. **`restyle()` 用带后缀的 layer id 做判断**：第二层起 id 是 `buildings__detail_europe` 这类，
   `id === 'buildings'` 全部不成立 → 欧洲/富尔达层的陆地色、建筑、铁路都走了错分支。
   铁路被画成淡色路面，这就是"铁路看着像白色虚线"的直接原因。
   修：比较前先剥掉 `__tier` 后缀。
2. **等高线只认"第一个区域层"**：加了欧洲层之后，`tiersZones.find(z => z.kind !== 'world')`
   命中欧洲，去找 `contours_europe.json`（不存在）→ **整个 app 的等高线静默消失**。
   修：区域层按 `maxzoom` 从高到低试，取第一个有文件的。
3. **等高线插错层级**：原来插在第一个 `roads` 层之前，被更细层的 `landuse` 填充盖住。
   修：插到**最细层**的 `roads` 之前（所有填充之上、道路之下）。

教训：多 tier 之后，任何 `id ===` 判断都要先想"这一层有没有后缀"。

### v1.30 城区灰块、城区战损、公路同级不同色

#### 一、公路：同级不同色，不加粗

上一版把所有主干压成同一个土赭，读不出等级。现在**宽度统一 1.45 px、描边统一 1.95 px、
minzoom 统一**，只用颜色区分：

| 等级 | 填充 | 描边 |
| --- | --- | --- |
| 高速 motorway | `#b4553a` | `#8e4530` |
| 干线 trunk | `#bf7a45` | `#9c6035` |
| 主干 primary | `#c49a68` | `#a17c50` |

铁路仍然最粗最黑，压在所有公路之上。

#### 二、城区 = 纯灰块

玩家要"一眼看出哪是城区"。做法是不画纹理，只给灰：

| 层 | 颜色 |
| --- | --- |
| `landcover urban_area` | `#b9b3a7`（z5 0.75 → z13 0.96） |
| `landuse residential` | `#c2bcb1` |
| `landuse commercial / industrial` | `#b9b3a8` / `#b0aaa0` |
| `buildings` | `#a9a297` |

绿=植被、米=农田、灰=城区。公园保持绿，用来提示"城里也有绿地"。

#### 三、城区战损（新）

每城存 1–3 级战损（`localStorage['city.damage.v1']`），渲染时只挑**一部分城区地块**受损：

| 等级 | 受损比例 | 图案 |
| --- | --- | --- |
| 1 | 34% | rubble 斜纹，alpha 0.4 |
| 2 | 62% | alpha 0.6 |
| 3 | 92% | rubble-heavy 密斜纹，alpha 0.8 |

- 图案在运行时用 canvas 生成（12×12，斜线 + 随机点），`map.addImage`，**不带任何图片资源**；
- 挑哪些块：地块质心做整数哈希取模，等级越高阈值越低——同一等级每次渲染结果一致；
- 受损块另加红色虚线描边（`#8a3a2b`，`[2,2]`）；
- 操作：顶部「战损」开关 → 单击城区 +1 级、Shift+单击清零；面板里显示"战损 N 级"。

#### 踩坑

1. **`querySourceFeatures` 会把粗层的巨大多边形也吐出来**：z13 查 `landcover` 时带出了 z6 世界的
   `urban_area` 大块，结果整个视口糊上斜纹。修：只查最细一层（`tiers[last]`）+ 按外环跨度过滤
   （跨度 > 2.6r 的块直接丢）。
2. **战损在 `moveend` 刷新会扑空**：那一刻瓦片还没回来，`querySourceFeatures` 返回空。
   改在 `idle` 刷新（`moveend` 只置脏标记），首屏从存档恢复的战损也能正确画出来。
3. 城区灰块一上，等高线被压住了——上一版已把等高线放到"最细层 roads 之前"，这次没再动。

#### 下一步

战损目前是手动标记，等战斗解算落地后改成由交战结果写入；城区影响（§11）同样待接。

### v1.31 铁路分层显隐、公路细化、城区灰块补漏

#### 一、缩放层级：小倍只有铁路，大倍才出公路

| 层 | 出现缩放 |
| --- | --- |
| 铁路（低倍烘焙层 `rails_<key>.json`） | z5–11 |
| 铁路（瓦片） | z11+ |
| 主干公路（高速/干线/主干） | z11+ |
| 次级（secondary/tertiary） | z12+ |
| 支路（service/other） | z13+ |

宽度：主干 **1.2 px**（描边 1.7），铁路墨线 3.4 px + 纸色光晕 5.2 + 白枕木 1.05 px。
铁路永远比任何公路粗一档。

#### 二、为什么必须自己烘低倍铁路

Protomaps 的 `roads` 层 **z10 及以下没有 rail 要素**，低倍只能靠自己烘：

- `Tools/bake_rail.mjs` 读区域包的 z11 瓦片，抽 `kind=rail` 的线，RDP 简化（容差 4e-5°）后写成
  `rails_<key>.json`：富尔达 198 条 / 6,934 点 / **260 KB**；
- 样式里作为 `rails-low` geojson source，z5–11 显示，z11 起交给瓦片铁路。

#### 三、城区：灰块补漏 + 真实建筑

原来只有 `landuse` 的多边形，OSM 覆盖不全 → 城区灰块到处是洞。三个补法叠起来：

1. **补全类别**：除居住/商业/工业，把 retail、railway、医院、学校、幼儿园、大学、学院也算城区灰；
2. **描边膨胀**：给城区多边形加一层同色 `line`（4–16 px 随缩放），把相邻街区的缝糊上；
3. **建筑膨胀**：z14+ 给 `buildings` 加一层 2–3.2 px 的描边，再把建筑填充压到 `#9f998f`，
   城区就成一整片深灰、街道留白。

#### 四、补一个"城区核心包"（关键）

富尔达区域包 maxzoom 13，**z13 一个瓦片只有约 10 栋建筑**（planetiler 只放大的），所以高倍没房子。
从母包裁 z14–15、0.12°×0.12° 的小包 `fulda_core.pmtiles`：**3.2 MB**，z15 单瓦片 **1,807 栋建筑**。
tier 系统自动接管 z14+（`index.json` 里加一条 `kind: region, maxzoom: 15`），前端一行没改。

#### 踩坑

1. **低倍铁路要按"哪个区域有 rails 文件"挑 key**：一开始取最细层（`fulda_core`）去找 `rails_fulda_core.json`，
   404 → 低倍铁路整层消失，而公路已按 z11 隐藏，画面只剩地形。改成按 maxzoom 从高到低逐个试。
2. **公路 minzoom 提到 11 后必须同时验证铁路**：这两件事互为前提，单独看截图会误判成"地图空了"。
3. 城区灰块的洞不是渲染 bug，是数据缺口：`landuse` 本身不全，`buildings` 在 z13 几乎没有。

#### 下一步

- 城区核心包可以按城市批量产出（每城 3 MB 级），比整区域上 z15 便宜得多；
- 战损与城区影响都还没接战斗解算。

### v1.32 行政分级、美术 pass 1、图层树

按"先美术、再全球化、最后功能"的顺序，这一轮只动富尔达。

#### 一、行政边界分级

原来所有边界共用一条灰虚线，和等高线、道路撞色。改成按 `kind_detail` 分四级，冷灰色系：

| 级 | 判据 | 颜色 | 虚线 | minzoom |
| --- | --- | --- | --- | --- |
| 国界 | `kind_detail ≤ 2` | `#5f6670` | `[6,3]` | 2 |
| 州/大区 | 3–8 | `#6d7a88` | `[4,3]` | 5 |
| 县 | 9–12 | `#8b96a2` | `[3,2]` | 8 |
| 乡镇 | > 12 | `#aeb5bd` | `[1,2]` | 11 |

底图自带的 `boundaries` / `boundaries_country` 两层在 `tierLayers` 里跳过，改由这四个显式图层接管。
数据里没有边界名称（只有 `kind_detail` / `sort_rank`），所以暂不做界线标注。

#### 二、美术 pass 1

| 项 | 之前 | 现在 |
| --- | --- | --- |
| 水系 | 填充 `#a3bccb`，河流 0.4–0.6 px 几乎看不见 | 填充 `#9cc0d2`、描边 `#7fa6bb`；河流按 `kind_detail` 分级宽度（z10 干流 1.5 / 支流 0.7，z14 2.6 / 1.2） |
| 晕渲 | `exaggeration 0.55` 恒定，山地没体积 | **随缩放**：z4 1.05 → z8 0.85 → z12 0.6 → z16 0.52（低倍看大起伏，高倍让位给等高线） |
| 等高线 | 全部等级 z8 起，z9 就是一片棕色麻线 | 索引线（125 m）**z10.5**、全部等级（25 m）**z12**、标注 z11 / z13 |
| 城区 | 只有 hospital/industrial/school 等零星面 + 描边膨胀 | 新增 `landuse residential / commercial / retail / railway` 填充，`landcover urban_area` 单独成层，城区第一次是真的"一整块灰" |

#### 三、图层树（可开关的图例）

原来只有 8 个平铺开关，现在按一级标题分组、组开关 = 全选子项：

```
地形   晕渲 / 等高线 / 坡度通行
水系   水域·河流
交通   铁路 / 主干公路 / 次要道路 / 机场·跑道
居民地 城区灰块 / 建筑物 / 地名标注
行政   行政边界
地表   林地·农田·绿地
军事   军事用地 / 城区战损
判读   军用格网 / 射程圈
```

- 实现：`store.ts` 的 `LAYER_TREE` 描述树，`setLayer` / `setGroup` / `groupOn`；
  `groupOf(layerId)` 把每个 style 图层映射到叶子，`useEffect` 统一 setLayoutProperty；
- 运行时图层（射程圈、战损）也进了树：战损走 `damageRef.setVisible`，射程圈走 `store.layers.rings`；
- 顶部工具条只留「战损」标记工具与状态，格网/射程圈都归到树里。

#### 踩坑

1. **加粗描边遮住了等高线**：城区描边膨胀一层压住了等高线，改成先画填充、描边只做"接缝"（低透明度）。
2. **晕渲一加强就"发毛"**：0.9 的恒定 exaggeration 在 z9–12 让 DEM 细节变成满屏噪点，
   必须随缩放回落——低倍看山、高倍看线。
3. **等高线 LOD 是观感大头**：z9 那一片棕色麻线不是数据错，是 25 m 等高线在 147 m/px 下重叠成一团。

#### 下一步

美术 pass 2：纹理（林地/沼泽点纹）与设施符号（机场/车站/桥隧/渡口），以及标签的字重分级。

## 技术决策与原因

| 决策 | 原因 |
| --- | --- |
| 前端 Vite + React（仅面板）+ Canvas 2D | 面板用 React 省事，地图用 Canvas 直控，二者解耦 |
| 游戏循环不经过 React | 每帧 setState 会拖垮帧率；改为 rAF 直接画 + 10Hz 推送 |
| 静态层离屏 + 200px overscan | 平移只搬图，越界才重建；重建 13–33ms，每帧绘制 0.1ms |
| 规则层纯 TS、无 DOM | 可单测，将来换渲染器不用动规则 |
| 地图离线烘焙 | OSM 官方瓦片禁止离线/批量下载；单机必须离线可复现 |
| 数据用米制本地坐标 | 直接对应真实距离，省去投影换算 |

---

## 踩坑记录

1. **`file://` 打开必白屏**：`/src/main.tsx` 绝对路径 + `fetch('/data/...')` 被 CORS 拦。
   必须走 HTTP（`启动游戏.bat` 或 `npm run dev`）。
2. **pnpm 供应链策略**：`pnpm dev` 会触发 minimumReleaseAge 校验失败；直接 `node node_modules/vite/bin/vite.js`。
3. **PowerShell 写文件会加 BOM**：JSON/TS 带 BOM 会导致解析失败（`Unexpected token '﻿'`）。
   统一用 Python 写 UTF-8 无 BOM。
4. **Vite `fs.watch` 在 Windows 上 EBUSY**：文件刚写入时 watch 报错退出；改 `usePolling: true`。
5. **AWS 高程瓦片单连很慢**（~20KB/s）：必须并发（10 线程）+ 磁盘缓存 `.tile-cache/`。
6. **Overpass 大查询 502**：整块 bbox 的林地查询被拒，切成 2×2 小块逐个取。
7. **OSM 道路被切成很多短 way**：按长度过滤会断网；简化容差过大会变直线。现在不丢短段、容差 20–35m。
8. **城镇被"带状郊区"拉长到 12km**：改成"容纳 80% 面积的半径"限幅。
9. **城镇同心圆装不下房子**：外缘改为从真实地块顶点量取，分区不再套圆。
10. **六角格时期的地图数据全部作废**：`map_test.json`、hex 模块已删除。

---

## 数据来源与许可

| 数据 | 来源 | 许可 |
| --- | --- | --- |
| 高程 / 等高线 | AWS Terrain Tiles（Terrarium，SRTM 派生） | 开放数据 |
| 路网 / 水系 / 城镇 / 建成区 | OpenStreetMap | ODbL，需署名 |

地图上已固定显示署名；分发衍生数据需同样开放。

---

## 待办

- [ ] 需求台账 v0.6：按无网格重写 §3/§7/§16 与验收 A-01~A-12。
- [x] 世界视图分块加载（PMTiles 按视口 Range 取瓦片，z0–z13 无级缩放）。
- [ ] 城镇外缘系数可配置（`R80` 与 `×1.15`），目前写死在 `tools/bake_map.py`。
- [ ] 编制数据与行军（兵牌上市地图）。
- [ ] 单位接入后，控制场应由"占领点 + 半径"动态生成，替换剧本静态基线。
