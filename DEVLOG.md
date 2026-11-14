# 开发日志（DEVLOG）

只记大方向改动、决策原因、踩过的坑。代码里不写注释，全部记在这里。

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

---

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
- [ ] 世界视图分块加载（tile + LOD），现在是单张 2048² 底图，放大糊。
- [ ] 城镇外缘系数可配置（`R80` 与 `×1.15`），目前写死在 `tools/bake_map.py`。
- [ ] 编制数据与行军（兵牌上市地图）。
- [ ] 单位接入后，控制场应由"占领点 + 半径"动态生成，替换剧本静态基线。
