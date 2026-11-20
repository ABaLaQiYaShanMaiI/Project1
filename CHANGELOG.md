# 变更日志（CHANGELOG）

完整版本沿革，自 DEVLOG 迁入（v1.56）。条目内容原样保留，未改写；新版本条目继续追加在此文件。

---

### v0.1–v0.4（六角格时期，已废弃）
需求文档阶段：六角格战术—战役级兵棋、父子编制展开/收缩、指挥链路、交火摇骰、
自然时间流逝 + 倍速暂停、战报史料系统。产出 `Docx/战术地图军棋_需求规格总表_v0.4.xlsx`。

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

### v1.33 结构整理（零行为变更）

只做代码整理，不动设计、不动画面。验收标准是**同一份输入喂新旧实现，输出逐字节相同**。

#### 一、样式分件

`data/militaryStyle.ts` 824 行 → 131 行，其余按职责落到 `data/style/`：

| 文件 | 职责 | 行数 |
| --- | --- | --- |
| `tokens.ts` | 跨文件共用色值与 `URBAN_KINDS` | 22 |
| `types.ts` | `Tier` / `DemTier` / `SlopeTier` / `StyleInputs` / `FC` | 51 |
| `widths.ts` | 线宽随缩放插值（`zoomWidth` / `railWidth` / `railNarrow`） | 32 |
| `restyle.ts` | 底图图层改写 + 公路分级 | 225 |
| `tier.ts` | 按 tier 复制图层、城区补层、缩放钳制 | 117 |
| `boundary.ts` | 行政边界四级 | 61 |
| `rail.ts` | 铁路三层 + 低倍烘焙铁路层 | 82 |
| `contour.ts` | 等高线四层 + 数据解码 | 96 |
| `overlay.ts` | 军用格网、射程圈图层 | 46 |
| `militaryStyle.ts` | 只留装配：源、先后顺序、去重 | 131 |

等价性证据：取真实 `tiles/base.style.json`，配双 tier、双 DEM、双坡度、等高线/铁路/格网夹具，
对「有等高线」「无等高线」两条路径分别跑旧实现（git HEAD）与新实现，`JSON.stringify` 后
SHA-256 完全一致（160 个图层）。图层顺序是这套代码里最容易搬错的资产，拆完必须比对，
不能只看 tsc 通过。

#### 二、死代码与类型检查

`tsconfig.json` 打开 `noUnusedLocals` / `noUnusedParameters`，删掉 7 个零引用导出：
`clampLon` / `clampLat`（markers）、`dmsOf` / `utmToLonLat`（geo）、`ALL_LAYERS`（store）、
`MarkerDraft`（markerStore）、`CITY_R_MIN`（cityEffects）。删完 `tsc` 零错误、零调用点改动，
反证它们确实是死码——之前一直关着这两项检查，等于放弃编译器这道防线。

#### 三、工具链

- `serve.mjs` / `range_serve.mjs`：根目录前缀校验补路径分隔符，`dist-evil/` 这类同前缀兄弟目录不再能穿过；
- 启动后开浏览器由 `exec` 改 `spawn('cmd', ['/c','start','',url])`，URL 不再经 shell 解析；
- `dev_probe` / `dev_shot` / `dev_mapshot` 三份重复的 CDP 脚手架抽成 `Tools/dev_cdp.mjs`；
- 删除一次性补丁 `_glyph_patch.py`（功能早已进 `fetch_basemap.mjs` 的 `GLYPH_RANGES`）。

#### 四、文档对账

- §1 自检补 Python 分支：`strip_comments.py --check`。此前 `.mjs` 只扫 ts/tsx/js/mjs/css，
  「Python 禁 `#` 与 docstring」一直靠人肉遵守；
- 架构边界补 `app/src/map/`（只碰 MapLibre 实例，不持业务状态、不 import React），`data/style/` 归 data 层；
- Readme 管线补 `bake_slope.py` 一步 + 「产物 / 命令 / 是否入库」对账表，`slope/` 入库这件事不再只藏在代码里；
- 启动与构建统一 pnpm；`pnpm-workspace.yaml` 的占位值改成 `allowBuilds: { esbuild: true }`，
  pnpm 11 不再因为「忽略构建脚本」把 install 的退出码顶成 1。

#### 踩坑

1. **搬样式代码最危险的资产是顺序，不是内容**：等高线插在「最后一个 tier 的第一个 `roads` 源图层之前」，
   用 `inserted` 标志控制只插一次；若把这个标志挪到循环外或挪进辅助函数，图层顺序立刻变而 tsc 照过。
2. **不要用「编译通过」证明重构无害**：这次真正的护栏是新旧输出做哈希比对；类型系统只看形状，不看顺序。

### v1.34 判读要素解绑与多层装配修复

#### 一、格网与射程圈不再依赖等高线

`militaryStyle()` 里 `grid` / `rings` 两个 source 与四张图层原本整块包在 `if (inp.contours)` 内：
只要某个区域包没烘 `contours_<key>.json`，UTM 格网和射程圈会**整体消失且无提示**，
`WorldMapLibre` 的格网重建 effect 拿不到 source 就静默 return。这直接踩 CONSTRAINTS §6
「判读要素常驻」。改成无条件装配（无等高线时 `contours` 源不建，格网源给空 FC）。

#### 二、测距剖面不再要求点第三次

`installMeasure()` 在**地图初始化那一刻**取 `getSampler()`，而此时 DEM 还没构造，拿到的必然是 null，
于是订阅永远是空函数——DEM 就绪后剖面不会重算，用户必须再点一次点才看到图。
改为：`render()` 时懒订阅（首次拿到 sampler 就挂监听），并把返回值改成
`{ dispose, refresh }`；`WorldMapLibre` 在 sampler 建好后调 `refresh()`，卸载时调 `dispose()`，
顺带修掉开发态 StrictMode 双挂载残留一套按钮/面板的问题。

#### 三、区域包不再截断到 2 个

`zonesInBounds()` 里 `MAX_REGION_TIERS = 2` 会把重叠包截到两个（按 maxzoom 取最后两个）。
富尔达视图内 europe(8) 与 fulda(13)、core(15) 同时命中，结果 **europe 被静默丢掉**：
z7–8 退化成 world z6 overzoom，而 europe 那 106 MB 白躺在盘上。删除截断后四包同时装配：
world z0–6 / europe z7–8 / fulda z9–13 / core z14–15，307 个 style 图层，徽标显示
`全球 z0–6 + 欧洲 z6–8 + 富尔达缺口 z0–13 + Fulda core z14–15 · 193.3 MB`。

观感变化：z7 起德国全境的村镇标注密度明显上来（原来是 z6 拉伸），这是真实数据，不是样式改动。

#### 验证

- `Tools/check_all.mjs` 7 项全绿（首屏 48.6 KB gzip，最大单文件 665 行）；
- headless Edge 实测：4 包装配 / 307 图层 / 格网要素 2 条；
- 测距面板：两次点击后剖面 SVG 直接出现，`地形数据加载中…` 不再常驻。

#### 遗留

图上仅富尔达 bbox 有 DEM，点选到 bbox 外的点仍显示 `高程 —`；要解决得补 `dem/europe z6–z8`
或按区域扩 DEM 覆盖。

### v1.35 中欧 DEM 与多源高程采样

#### 一、补烘 dem/europe z6–z8

之前高程只有 `world`(z0–5) 与 `fulda`(z9–11)：z6–8 全靠 z5 overzoom，富尔达 bbox 之外更是
根本没有 DEM，读数永久停在「高程 …」。这次按中欧 `0,44,20,56` 烘了 z6–8：

| 项 | 实测 |
| --- | --- |
| 瓦片 | 309 张（z6 20 / z7 64 / z8 225） |
| 体积 | 20.64 MB |
| 耗时 | 约 3 分钟（10 线程，AWS terrarium） |
| 坡度 | `slope/europe` 309 张 / 5.03 MB（2.7 s） |
| DEM 总量 | 86 + 21 + 15 = **122 MB**，仍在 CONSTRAINTS §2 的 200 MB 预算内 |

坡度的 z 范围由 `dem/europe/index.json` 自动推出，不用再传参数。

#### 二、高程采样器改成多源

`DemSampler` 原来只吃一个 `DemTiles`，而 `WorldMapLibre` 里 `pickDem` 只取**一个**区域包：
只要有 europe DEM，富尔达也会被降级成 z8 采样；反之不取 europe，bbox 外就永远没高程。

改成：`DemSampler` 接受多个 `DemTiles`，内部按 `maxzoom` 降序存放，采样时**取第一个
「bbox 命中该点」的层**。于是富尔达内用 z11、中欧用 z8、其余用 z5，缓存与请求也各自独立
（每层 48 张的 LRU）。

同时顺带修掉一类无谓请求：点落在所有 bbox 之外时直接返回 `null`，不再发注定 404 的瓦片请求。

#### 验证

- `Tools/check_all.mjs` 7 项全绿（最大数据文件 1.37 MB，首屏 48.6 KB）；
- 读数实测：法兰克福 `50.10841, 8.68179` → **高程 98 m / 坡度 1% / 坡向 南**（此前是 `—`）；
  富尔达城心 268 m（走 fulda z11），两地各自用对了层；
- 网络实测：只请求 `dem/europe/8/...` 与 `dem/world/5/...`，未再出现大面积 404；
- **headless Edge 的 SwiftShader 不画 hillshade**：把三类 hillshade 层全设 `visibility:none`
  后 canvas 的 PNG 哈希完全不变，所以晕渲锐度这次无法用截图验证，需要在真实浏览器里肉眼确认。

#### 遗留

- 中欧以外仍无 z6–8 DEM（伊比利亚、东欧、北非）；要全覆盖得按同样方式再烘几块；
- z9–12 的**矢量**仍只有富尔达，德国其余地区在 z9 以上还是 europe z8 拉伸；
  下一步可用 `v4.pmtiles` 母包再切一个德国 z9–11 包（离线，母包在 `G:\PersonalGame\v4.pmtiles`）。

### v1.36 铁路连续性与一轮代码质量

#### 一、铁路断在哪

大比例尺下铁路看着断，三个原因叠在一起：

1. **低倍烘焙层与瓦片层的交接有缝**：`rails_fulda.json` 只画到 z11（`maxzoom: 11`，而 MapLibre 的
   maxzoom 是开区间，z11 起就隐藏），瓦片铁路虽然 minzoom 10 但 z10–11 的瓦片里没有 rail 要素。
   结果 z11–11.x 有一段只能靠瓦片、瓦片又没数据。改法：烘焙层上限抬到 **12**，瓦片层下限统一到 **11**，
   两套重叠一个缩放级。
2. **绘线三层的 minzoom 不一致**：ink（`roads_rail`）由 `restyle()` 设成 11，光晕/枕木却按
   `max(styleMin, 10)`，于是 10–11 之间只有白底和白色枕木、没有墨线——看起来就是"断线"。
   三层现在统一 `RAIL_MINZOOM = 11`。
3. **城区核心包重复画铁路**：`fulda_core`（z14–15、0.12° 见方）也生成了一套 rail 图层，
   与富尔达包 z13 overzoom 的铁路错位叠加；在核心包 bbox 边界上就出现跳线。改法：
   minzoom ≥ 14 的"建筑级"包不再生成铁路图层（`BUILDING_TIER_MINZOOM`），铁路始终由
   富尔达包 overzoom 提供，跨 bbox 连续。

另外把高倍线宽从"越放越粗"改成"z13 封顶后回落"（z16 ×0.72、z18 ×0.6）：
富尔达站场有十几股道，原来每股 4 px 宽、间距 2 px，糊成一块黑板；现在能看出是轨道群。
枕木虚线在 z14 以上关闭（`RAIL_HATCH_MAXZOOM`），否则密集道岔会变成阶梯噪点。

#### 二、代码质量

- **图层键类型化**：`LAYER_DEFAULT` 改成带 as-const 的唯一事实源，导出 `LayerKey`；
  `LAYER_TREE` 的 `key`、`store.layers`、`setLayer()`、`groupOf()` 全部用 `LayerKey`。
  以前 `groupOf` 返回裸 `string`、`store.layers[g as keyof typeof store.layers]` 的强制转换等于没保护：
  映射写错就静默 `visibility: none`。现在写错直接编译失败。
- **调试全局只在 DEV 暴露**：`window.__ml` / `window.__store` 用 `import.meta.env.DEV` 包起来，
  生产包不再留可变后门。代价是 `Tools/dev_mapshot.mjs` 必须对着 `pnpm dev` 跑（dev 才有 `__ml`）。
- **JSON 读取统一兜底**：新增 `getJson()`，`res.ok` 但返回 HTML（vite dev 的 SPA fallback 就是这样）
  时返回 null 而不是抛 `Unexpected token '<'`。此前 dev 模式下 `fulda_core` 缺失的 slope/dem
  清单会让整张图直接失败黑屏；`loadBaseStyle()` 同样加了 `layers` 结构校验。

#### 验证

`Tools/check_all.mjs` 7 项全绿；dev 服务器下 10.7 / 12 / 13.5 / 15 四级截图对比：
z13.5 的站场从"黑板"变为可分辨的轨道群，核心包边界不再有跳线。

### v1.37 视图预设、设施气泡与低配模式

#### 一、视图预设（替代"第二张地图"）

侧栏顶部加 3 档：**态势 / 地形 / 交通**。实现是 `store.ts` 的 `STYLE_PRESETS`：
每档给一份 `Partial<Record<LayerKey, boolean>>`，`applyPreset()` 以 `BASE_LAYERS` 为底叠加。
手动改任一图层会把预设切成 `custom`（按钮不高亮）。

比"再做一张地图"省的地方：同一套 style、同一套瓦片，只切可见性组合，切换零成本。

#### 二、设施气泡

新烘焙脚本 `Tools/bake_poi.mjs`，从 pmtiles 抽两类点：

| 类型 | 来源 | 数量（富尔达 z12） |
| --- | --- | --- |
| 机场 | `landuse.kind ∈ {aerodrome, airfield}` 质心 | 31 |
| 桥隧 | `roads.is_bridge = true`（高速/干线/主干/次干/铁路） | 115 |

产出 `poi_fulda.json` 6 KB。前端是 geojson 源 + 两个 circle 层（机场 z5+ 深蓝 6.5 px，
桥 z11+ 褐色 2.6 px），归入「判读 / 设施气泡」可开关。港口暂未做——富尔达内陆没有，
要做得给欧洲包单独烘 POI。

#### 三、低配模式

`navigator.hardwareConcurrency <= 4` 或 URL 带 `?lite=1` 时，`BASE_LAYERS` 默认关掉
晕渲与等高线（`?lite=0` 强制全开）。侧栏显示「低配模式」提示。阈值先按核数，
等有真实帧率样本再换成实测驱动。

#### 四、军事用地默认关

`landuse_military` 保留但默认 `false`：德国境内 OSM 军事用地极少且成片，默认开容易误导。

#### 验证

- `check_all` 7 项全绿（首屏 48.9 KB gzip，最大文件 693 行）；
- 预设实测：切「地形」→ urban/poi 变 `none`；切「交通」→ relief/contour 变 `none`、poi 可见；
- 设施气泡实测：把 `poi-airport` 临时改成 14 px 红点后画面出现圆点，确认图层与数据通路正常。

### v1.38 代码拆分与约束审计

#### 一、拆分 WorldMapLibre（693 → 597 行）

上一版加完预设与气泡后已到 693 / 700，先拆再改：

| 移出内容 | 去处 |
| --- | --- |
| `groupOf` / `NEW_IDS`（样式图层 → 图层树映射） | `data/style/layerGroups.ts` |
| `markerEl` | `map/markerElement.ts` |
| `Readout` / `bearing` / 采样组装 | `map/readout.ts`（`buildReadout`） |
| `tierOf` | `data/pmtilesBasemap.ts` |
| `cityZoneAt` | `data/cities.ts` |
| `damageDiscs` | `map/cityDamage.ts` |

顺带把 `tierOf` 的死参数 `_index` 去掉，调用点从 3 参改 2 参。

#### 二、首屏可交互从 2.4 s 降到 1.3 s

实测（headless，本地 dist）：canvas 挂载 ~90 ms，但 loading 遮罩要等到 2.4 s 才消失。
两个原因叠加：

1. 场景装配是串行 await（底图样式 → 4 个 DEM 清单 → 3 个坡度清单 → 等高线 → 铁路 → 设施 → 城镇索引）；
   改成两段 `Promise.all`（样式+DEM 一段，坡度+等高线+铁路+设施+城镇一段）。
2. 遮罩挂在 `map.once('idle')`——要等所有瓦片加载完，这才是 2.4 s 的大头。
   改成 `styledata` 触发 + 8 s 兜底超时：样式就绪即可交互，瓦片继续流式补。

改后实测 1.29 / 1.33 s，落回 §5 的 1.5 s 预算内。

#### 三、约束审计

| 章节 | 结论 |
| --- | --- |
| §1 无注释 | ✅ 44 个文件 clean（JS + Python 两条自检） |
| §2 体量 | ✅ 单文件 597 行 / 数据 1.37 MB / 首屏 48.9 KB / 生产依赖 4 个 |
| §2 Python 依赖 | ⚠️ `build_requirements_workbook.py` 用 `openpyxl`，超出白名单 → 已在 §2 明确登记 |
| §3 架构边界 | ⚠️ `map/measureTool.ts` 自建按钮与面板（`appendChild` + `innerHTML`），违反「map 不建 DOM 面板」 |
| §4 数据 | ✅ 源码零 http(s)、PMTiles + Range、`.mjs` MIME、署名齐全 |
| §5 性能 | ✅ 1.29 s 首屏（改前 2.4 s 超标）；FPS / 单帧重绘仍无自动测量 |
| §6 红线 | ✅ 无阵地/沙盘视图，判读要素常驻（v1.34 已解绑 contours） |
| §7 交付 | ✅ 命名、路径、`check_all` 闸门一致 |

遗留：`measureTool` 的界面要么搬进 `ui/`（React 面板 + `map/` 只留 draw/距离函数），
要么在 §3 里显式豁免「地图容器内的自身浮层」。建议前者，下一轮做。

### v1.39 测距面板搬进 ui/，清掉 §3 唯一违规

`map/measureTool.ts` 原来在地图容器里 `appendChild` 按钮和面板、用 `innerHTML` 拼内容，
违反 §3「map/ 不建 DOM 面板」。拆成两半：

| 文件 | 职责 |
| --- | --- |
| `map/measure.ts` | 纯计算：`distanceM` / `bearingDeg` / `toMils` / `fmtDistance` / `fmtBearing` / `profile`，以及 `drawMeasureLine()`（只管 geojson 源和三个图层） |
| `ui/MeasurePanel.tsx` | React 面板：按钮、两点状态、统计渲染、SVG 剖面；点选逻辑用 `map.on('click')`，DEM 通过 `sampler.subscribe` 驱动重算 |

`WorldMapLibre` 只多两个 state（`mapObj` / `sampler`）把它接起来，不再持有 handle。
顺带把内联样式换成 `styles.css` 的 `.ml-measure-btn` / `.ml-measure-panel` / `.mp-*`，
颜色走 `--panel` / `--text` / `--accent` 变量，与其余面板同源。

验证：dev 下按钮切换、两次点选、面板出数（6.30 km / 106° / 1877 mil / −30 m / 剖面折线）；
`check_all` 7 项全绿（601 行，首屏 48.9 KB）。

至此 §1–§7 全部达标，§5 只剩「FPS 与单帧重绘没有自动测量」这一条待补工具。

### v1.40 帧率与重绘测量工具（§5 收尾）

新增 `Tools/perf_probe.mjs`：用 CDP 拖动地图 6 秒，统计 `map.on('render')` 帧间隔，
再循环触发 15 次重绘量静态耗时。输出渲染器名称、FPS、P50/P95、掉帧数、静态中位数；
`--strict` 时低于 60 FPS 或静态 ≥40 ms 退出码为 1。

必须打渲染器名字：同一台机器上 headless 默认走 SwiftShader（1.7 FPS / 590 ms），
换 `--use-angle=d3d11` 才是真显卡，否则测出来的数字毫无意义。

本机实测（Intel HD Graphics 4000，headless + D3D11）：

| 场景 | 结果 | 预算 |
| --- | --- | --- |
| 静态重绘 | median **15.5 ms**、p90 18.5 ms | < 40 ms ✅ |
| 持续拖动 | **24 FPS**、p50 18.6 ms、p95 88.3 ms、164 帧里 68 帧 > 33 ms | 60 FPS ❌ |
| `?lite=1`（关晕渲+等高线） | 22.3 FPS、p95 90 ms | 无改善 |

结论：低配降级关掉晕渲/等高线几乎没用，瓶颈不在着色而在**每帧的瓦片取用与图层量**
（4 层 × 约 77 图层）。要在老 iGPU 上补帧率，得从「拖动时减少参与渲染的 tier 数」入手，
而不是继续关图层。

### v1.41 降 tier 的美术与帧率代价（撤回 v1.40 的错误结论）

v1.40 报「拖动 24 FPS 不达标」，是测量环境伪影。这轮做了四组对照（同一视角 z12、同一拖动脚本）：

| 对照 | FPS |
| --- | --- |
| 完整样式（4 层 306 图层） | 21.6 |
| 隐藏 europe / core 两个低倍 tier | 21.5 |
| 隐藏全部 symbol 层 | 21.2 |
| 画布缩到 666×426（半分辨率） | 21.3 |
| 换成空白样式（无图层无瓦片） | 21.1 |

空白样式也只有 21 FPS，而空闲 rAF 是 60.8 —— 说明 headless 下 canvas 拖动被合成器钉在 ~21 FPS，
和内容无关。**v1.40 的「帧率不足」结论撤回**，§5 的帧率只能在有头窗口里验。

同时回答了「降 tier 会不会掉美术」：把 europe / core 两层全隐藏后，同一视角截图**内容像素完全一致**，
差异 0.77% 全部落在右下角署名条（`AttributionControl` 会列出来源，隐藏图层后少了条目）。
也就是说在当前缩放档，低倍 tier 被上层完全覆盖，删它们不掉画质；但 FPS 一点不涨，纯负收益 —— **不做**。

工具侧：`perf_probe.mjs` 增加 headless 标记与提示，避免再把合成器上限当成应用性能。

### v1.42 地形图档：铁路与主干公路同级出现

「地形」预设改成真正的读图模式：晕渲 + 等高线 + 水系 + 行政边界 + 地名 + 格网，
铁路与主干公路保留，城块 / 建筑 / 次干路 / 机场 / 设施气泡全部隐藏。

关键一条是**取消缩放优先级**：原来低倍烘焙铁路 `rail-low` 是 z5–12，主干公路 z10 起，
地形档里会出现「先有铁路、后有公路」的错位。现在切到地形档时用
`map.setLayerZoomRange()` 把 `rail-low*` 抬到 z10–12，与 `roads_highway|major` 的 z10 对齐，
两者同时出现；切回其他档恢复 z5–12。

实现只在 `WorldMapLibre` 加了一个 effect（依赖 `store.preset` 与 `viewEpoch`），
样式与数据都没动，坡度瓦片也没用上——按决定，地形图不依赖 `bake_slope` 产物。

实测：地形档下 `rail-low` = `[10,12]`、`roads_highway/roads_major` = `[10,22]`，
`landcover_urban` 隐藏、晕渲可见；z11 观感见 DEVLOG 附图说明（纸底 + 等高线 + 地名骨架）。

### v1.43 地形档真正以坡度为主底

v1.42 的地形档只关了城市与建筑，坡度还是关的，等于「没有地形的地形图」。这轮改对：

- 地形档 `slope: true`，`raster-opacity` 0.42 → 0.85，坡度色带成为底图
- 地形档同时关掉 `earth`、`landcover`、`urban`、`building`、`relief`，只留等高线、水系、边界、地名、格网、铁路与主干路
- 坡度层的插入位置改到**第一个 tier 的 roads 之前**：这样它压在所有 tier 的 earth/landcover 填充之上、又在地名与道路之下

关键坑：`earth`（底图那层米的陆地底色）在 `groupOf()` 里没有映射，返回 null，
可见性开关永远碰不到它，于是它在每个 tier 都存在、把坡度整片盖住——画面看着就像"坡度没生效"。
把 `earth` 归进 `landcover` 组后，地形档才真的露出坡度色带。

实测（z11，富尔达）：坡度色带 + 地名 + 铁路/主干路 + 等高线 + 格网同时可见，城块与建筑全部隐藏。

### v1.44 视图收成两档，铁路高倍收细

#### 一、两档视图

按「不要交通图」的决定，预设从三档收成两档，键名也改了：

| key | 名称 | 内容 |
| --- | --- | --- |
| `city` | **城区图** | 原「态势」的全部图层（交通线 + 城区灰块 + 建筑 + 地名 + 地表 + 晕渲 + 等高线 + 判读），只改名不改内容 |
| `terrain` | **地形图** | 坡度主底 0.85 + 等高线 + 水系 + 边界 + 地名 + 格网 + 铁路/主干路；无城块、建筑、地表、晕渲 |

`store.preset` 默认值改为 `city`；手动改任一图层仍然切成 `custom`。

#### 二、铁路密集处（富尔达站场）缩放显示

问题是 z13 以上站场十几股道各按 3-4 px 画，全部糊成一条黑带。调整：

- `railWidth` 高倍收敛：z13 `×0.55`、z15 `×0.38`、z17 `×0.32`（z13 由 `1.0` 降下来，低倍 z≤12 不变）
- 枕木虚线在 z13 以上关闭（`RAIL_HATCH_MAXZOOM = 13`，原来 14）

z13.5 实测：股道不再糊成黑板，单条呈现"墨线 + 白缝 + 纸色光晕"，站场能看出是编组场而不是色块。

### v1.45 三件扩展铺垫：配色外置、层预算、一键区域管线

#### 一、坡度配色外置（raster-color 走不通）

目标是不重烘就能换坡度配色。试了两条路：

1. **索引图 + `raster-color`**：把 PNG 烘成单通道分类号（0–5），配色交给样式。
   结果 **本仓库的 maplibre 6.18 构建不支持**：控制台直接报
   `layers[14].paint.raster-color-mix: unknown property "raster-color-mix"`，
   整张样式被拒，地图白屏。索引图体积倒是小（fulda 1.55 MB vs 2.04 MB），但没法着色。
2. **配色外置到烘焙期**：新增 `Tools/slope_palette.json`（limits + colors），
   `bake_slope.py` 启动时读取，取不到才用内置默认值。

最终采用 2。美术返工路径变成：**改一个 JSON → `bake_slope.py --key=<区域>` 重烘 ≈3 秒**。
其余所有美术（纸底、水系、林地、城区、边界、道路分级、等高线、铁路、战损纹理）都在
`app/src/data/style/*.ts`，纯代码改动，不碰数据。

#### 二、层预算

`zonesInBounds()` 恢复上限 `MAX_REGION_TIERS = 5`：重叠包按 maxzoom 升序，超出时丢弃最低倍的那几包
（它们本来就是 fallback）。4 包现状不触发；扩到几十个包时不会无限叠图层。

#### 三、一键区域管线

新增 `Tools/bake_region.mjs`：`dem → contours → rail → poi → slope → cities` 六步串行，
任一步失败即停。支持 `--key --bbox --zmin --zmax --skip=dem,slope --dry-run`。
底图包不存在时直接提示先跑 `fetch_basemap.mjs`。

### v1.46 全球 z7–8 落地，europe 矢量包退役

切包：`pmtiles.exe extract` 全球 bbox、z7–8，**19 秒 / 476 MB / 1568 tiles/s**（母包在本地，纯磁盘 IO）。

装配调整：

- `index.json` 删掉 `europe` 区，加 `world8`（`kind: world`，z7–8）
- 阶梯变成 world z0–6 → world8 z7–8 → fulda z9–13 → core z14–15
- `europe.pmtiles`（106 MB）与 `europe.style.json` 删除，磁盘回收 106 MB
- `dem/europe`、`slope/europe` 的瓦片目录保留，由新建的 `dem/world8`、`slope/world8` 清单**别名**复用
  （清单里 `tiles` 指向 `/data/dem/europe/...`），这样 z7–8 仍有真实高程与坡度，不必重烘

实测：

| 视角 | 装配 | 图层 |
| --- | --- | --- |
| 日本 z7 | 全球 z0–6 + 全球 z7–8 | 157 |
| 美国 z8 | 同上 | 157 |
| 富尔达 z8 | 四包 | 305 |
| 富尔达 z15 | 四包 | 305 |

日本 z7 截图可见日文/汉字地名与路网，说明全球 z7–8 生效。

### v1.47 地形图海洋显示修正 + 首屏慢的两个真因

#### 一、海面被坡度盖成陆地色

坡度瓦片按 DEM 差分着色，海面高程是 0 而不是 nodata，所以整片海也被画成"缓坡绿"；
而坡度层原来插在第一个 tier 的 roads 之前——**在 water 之上**，于是海面被它盖住。

改：坡度层插到 `landcover` 之后、`landuse`/`water`/`roads` 之前。这样
water 填充压在海面之上→蓝色；坡度只覆盖陆地。北海 z8 实测已恢复蓝色。

#### 二、首屏 8.4 秒的两个原因

1. **`base.style.json` 自带一个 `protomaps` 源**，url 指向已退役的 `europe.pmtiles`。
   `militaryStyle()` 原本只覆盖 tier 源、保留了 base 的其余 sources，MapLibre 会把它们
   实例化并去拉文件头——等于每次开图都多打一个已删的 476 MB/106 MB 包的请求。
   改：进入 `militaryStyle()` 时先清空 base 的所有 sources，只保留我们现建的。
2. **world z0–6 那一层的 `styleMax` 一直是 22**，z7 以上与 world8 同时渲染：
   两套各约 77 个图层、两套瓦片请求，视觉上后者覆盖前者，纯浪费。
   改：world 类 tier 若后面还跟着另一个 world tier，就把 `styleMax` 截到后者的起始级；
   区域 tier 不动（它们要靠 overzoom 撑住自己 bbox 之外的邻域）。

实测（headless + D3D11，同一 z7 视角）：

| 指标 | 修前 | 修后 |
| --- | --- | --- |
| 首屏可交互 | 8.4 s（冷） | **1.22 s** |
| 首次传输 | 8.6 MB | **1.9–2.5 MB** |
| 多余包请求 | 每次都拉 `europe.pmtiles` | 无 |

### v1.48 低倍铁路形态修复：拼接、去噪、分档

用户看到的问题是宽视角下铁路出现「倒 U」和「对角线直连」。查下来是两个叠在一起的原因：

1. **MVT 多段线被拼成一条**：`Tools/mvt.mjs` 的 `readGeometry()` 收到第二个 `MoveTo`（多段线的第二段起点）时
   没有断开，`LineTo` 继续往同一条 ring 里累加——两段不相连的轨道被一条直线连起来，
   就是画面上的「对角线」和「倒 U」。修：`MoveTo` 即开新 ring，并把起点写进该 ring。
2. **碎段与重复段**：从 z11 瓦片抽出来的 rail 是 OSM way 粒度的短段，fulda 一块 518 段里
   347 段短于 2 km、227 段短于 500 m，画出来是断断续续的碎线。修：烘焙后先按端点吸附
   （25 m 网格）**把同一条线路串成长链**，再 RDP、再按长度过滤。

分档：新增 `rails_<key>_low.json`（tol 0.0012 ≈130 m、minlen 3 km、51 KB），服务 z4–9；
原 `rails_<key>.json`（tol 3 m、minlen 600 m、253 KB）服务 z9–12。宽视角画粗链，近景画细节。

数据流水线：`bake_region.mjs` 里 rail 那步之后应补跑一次 `--tol=0.0012 --minlen=3000` 产物（待补）。

### v1.49 全球覆盖审计：富尔达的设计有几项能跟着走

在 6 个视角（日本/美国/巴西/埃及/澳大利亚/富尔达）逐项探测，结论：

| 设计 | 全球 | 只在中欧 | 只在富尔达 |
| --- | --- | --- | --- |
| 底图矢量·地名·水系·地表·城区填充 | ✅ z0–8（z9+ 拉伸） | | |
| 军用格网 / 射程圈 / 战损标记 | ✅ | | |
| 高程·坡度·坡向读数 | ✅（world DEM z0–5 全球） | | |
| 晕渲 / 坡度图 | ✅（world 层，粗） | 精细 z6–8 | |
| 等高线 | | | ✅ |
| 铁路（烘焙层） | | | ✅ |
| 设施气泡 | | | ✅ |

实测读数：日本 z8 高程 42 m、尼泊尔 5508 m、富尔达 274 m——全球都能读，只是 1.2 km/像素级的粗粒度。

#### 顺手修掉的 bug

军用格网只在 `gridStepFor()` 变化（即缩放档变化）时重建，**平移不重建**：跳到日本后格网还停在富尔达，
所以早期检查里 US/Brazil 的 grid 要素是 0。改成每次 `moveend` 都按当前视口重算（约 20 条线，开销可忽略），
现在五个视角 grid 要素 15–24 条，稳定。

#### 全球仍缺的三样（数据缺口，不是代码）

1. **铁路**：world/world8 的 z7–8 瓦片里没有 rail 要素，全球低倍铁路层得单独抽（母包 z12 或 Natural Earth）
2. **设施气泡**：只有 poi_fulda，要按区域补烘
3. **等高线**：需要全球 DEM z6–8，成本最高

### v1.50 全球铁路与机场点位补齐

全球两张底图（world z0–6、world8 z7–8）的瓦片里都没有 `kind=rail` 要素（实测 z7/z8 抽样 rail=0），
所以富尔达之外的铁路一直缺失。解法是引入 Natural Earth 1:10m 底料，一次性烘成小文件：

| 产物 | 来源 | 体积 | 用法 |
| --- | --- | --- | --- |
| `rails_world.json` | NE 1:10m railroads（shp → RDP 0.01° / 25 km） | 1.6 MB | `rail-world` 源，z3–9 |
| `poi_world.json` | NE 1:10m airports | 0.03 MB | 合并进 `poi` 源，机场全局可见 |

新增 `Tools/bake_ne_rails.py`（`pyshp`，已在 CONSTRAINTS §2 登记）；机场用一次性 python 片段转点。
NE 数据来自 naciscdn.org（jsdelivr 对 15 MB 以上的文件返回 403）。

装配：`rails-world` 与富尔达的 `rails-low/rails-low2` 分层——全球 z3–9 走 NE，富尔达 z4–12 走本地烘焙，
z9 以上全球仍是 world8 拉伸（那里没有 rail 数据，符合预期）。

实测（六个视角）：日本/美国/埃及/澳大利亚都出现铁路线与机场圆点；富尔达不变（本地数据优先）。
`check_all` 7 项全绿，单数据文件最大仍是 1.6 MB。

### v1.51 港口与全球城区面补齐

上一版只补了铁路与机场，这轮补港口和城区：

| 产物 | 来源 | 体积 | 装配 |
| --- | --- | --- | --- |
| `poi_world.json` 追加 1081 个港口 | NE 1:10m ports | 0.07 MB | `poi-port` 圆点，z4+ |
| `urban_world.json` | NE 1:10m urban areas（shp，闭合环 + 外环逆时针） | 1.78 MB | `urban-world` 填充，z4–14，走 `urban` 图层组 |
| 铁路 NE 层 | 同上 | — | 上限从 z9 提到 z13 |

两个踩坑：

1. **闭合环不能直接 RDP**：形状文件的环首尾同点，首尾弦长为 0，RDP 会把整个环压成 2 个点
   （第一版 4147 个环全部被丢，输出 0 环）。先去掉重复尾点、简化、再补回。
2. **环的绕向要统一**：shp 里外环顺/逆时针混用，GeoJSON 要求外环逆时针；统一到逆时针，
   否则部分多边形被当成"洞"不渲染。

验证：日本 z5 全国可见城区红色块状填充（临时改红验证），恢复为灰后与底图叠加正常；
鹿特丹 z10 有港口点；东京 z12 一带 NE 城区面本身覆盖不到，属数据粒度限制，不是渲染问题。

仍然不全球的三样（都是数据量问题）：
- **次干路/支路**：z9 以上只有 world8 的 z8 拉伸，没有支路
- **建筑与街区**：同上
- **等高线**：需要全球 DEM z6–8

### v1.52 全球 z9–10 补齐 + dist 瘦身

#### 一、全球 z9–10 包

母包离线切 `--minzoom=9 --maxzoom=10` 全球：**3.0 GB / 3 分 52 秒**。
阶梯变成 world z0–6 → world8 z7–8 → **world9 z9–10** → fulda z11–13 → core z14–15。

顺带修了一个潜伏 bug：`tierOf()` 原来用 `zone.kind === 'world'` 判断 id，
于是 `world` / `world8` / `world9` 三个包**都拿到 id `'world'`**——source 名互相覆盖、
图层 id 重复被去重，等于只有第一个全球包真正生效。改成按 `zone.key` 取名
（`world` 只有 key 恰好是 world 时才用），才有现在的 155 个全球图层。

效果：东京 z10 的路网密度、地名数量、街区轮廓都比 z8 拉伸时高一个量级。

#### 二、dist 从 3.9 GB 降到 1.8 MB

`vite build` 会把 `app/public` 整份拷进 `app/dist`，加入 world9 后每次构建要写 3.5 GB。
改成数据不再进 dist：

- `vite.config.ts`：`publicDir: false`
- dev：新增 `Tools/dev_static.mjs`（+ `.d.mts`）中间件，`/data/*` 直接从 `app/public` 读
- prod：`Tools/serve.mjs` 对 `/data/` 前缀改用 `app/public` 做根（`.pmtiles` 仍走 Range）

代价：dist 不再自包含（拷走 dist 单独跑会缺数据）。启动方式没变，仍是仓库根跑 `serve.mjs`。

实测：构建产物 1.8 MB / 7 个文件；prod 冒烟正常（无 ml-fail、无 JS 异常）；
首屏 2.05 s（5 个包各一次 HEAD + 场景装配）。

### v1.53 德国区域包落地

按「先落实德国」推进，只做矢量，旁挂数据按需再说：

| 项 | 结果 |
| --- | --- |
| 切包 | `pmtiles extract --bbox=5.8,47.2,15.1,55.1 --minzoom=11 --maxzoom=12` → **689 MB / 1 分 21 秒** |
| 装配 | world 0–6 → world8 7–8 → world9 9–10 → **德国 11–12** → fulda 13 → core 14–15 |
| 图层 | 德国视角 227 个（原 155） |
| 渲染 | 法兰克福 z11 / 慕尼黑 z12 / 汉堡 z11 街区、地名、城区面均到位 |

不烘的东西及原因：
- **铁路烘焙层**：瓦片本身 z11+ 就有 rail，配 NE 全球层已够，省掉 12.6 MB 的 `rails_germany.json`
- **等高线**：德国 25 m 等高距约 75 MB，超过单数据文件 4 MB 上限，需要分级切块才做
- **DEM**：z11–z12 共 19457 张，按 AWS 实测速率要 3 小时，先只烘 z11（3942 张，约 35 分钟），
  z12 的坡度/晕渲暂用 z11 overzoom

DEM 实烘结果：**z11 共 3942 张 / 384 MB / 约 20 分钟**（16 线程，含少量重试）；坡度 3942 张 / 45.9 MB / 42 秒。
慕尼黑 z11 地形档已能看到坡度色带与路网叠加。

### v1.54 修 NE 层压过局部数据：铁路错位与灰块漫盖

两个现象都出自「全球 Natural Earth 层铺得太高」：

1. **铁路错位**：`rail-world` 的 maxzoom 给到了 13，而德国/富尔达的瓦片铁路从 z11 就有。
   NE 1:10m 的线是概化过的，z11 以上和真实线路偏差几百米，叠上去就成了乱线。
   改：`rail-world` maxzoom **13 → 10**，z11 起只画瓦片铁路。
2. **灰块漫盖**：`urban-world` maxzoom 14 + opacity 0.6，NE 的建成区面本身粗糙
   （法兰克福那块把整个莱茵-美因平原都罩住了）。z11 以上的瓦片有精确的
   `landuse_residential`，不需要 NE。
   改：`urban-world` maxzoom **14 → 9**，opacity **0.6 → 0.45**。

现在分工明确：z≤10 用全球概化层补空白，z≥11 交给区域瓦片。
法兰克福 z11 复查：建成区边界贴着真实街区，铁路沿实际线路走，无跨城直线。
z9 复查：仍是概化灰块 + NE 铁路，符合这一级的精度预期。

### v1.55 slope/germany 入库与美术资源方针

- 决策变更：`app/public/data/slope/germany/`（3943 文件 / 约 45.9 MB）从 .gitignore 忽略改为入库。
  理由：换机 / 重装后不再依赖本机 DEM 重烘，避免 `bake_slope.py` 因 DEM 版本差异引入色彩漂移。
- 方针：美术资源（`Arts/` 与 public 下的图像产物）一律入库，今后不再为美术资源新增忽略规则；
  `tiles/` 与 `dem/` 维持不入库。Readme §10 对账表已同步。

### v1.0.20 全球铺开与战役焦点符号

- 新增 world8（z7–8）/ world9（z9–10）/ 德国（z11–12）/ 德国 z13 四个矢量包，欧洲包退役
- 全球铁路、机场、港口、建成区面接入 Natural Earth；铁路容差由 1.1 km 收紧到 390 m
- 建筑改「密度镜像瓦片 + 城区面」，不再画独栋轮廓；富尔达核心试点 0.14 MB
- 车站不建模备用车道，改「站区面 + 站点」；地块符号收敛为站场/医院/机场/港口/厂区五类
- 图层改为语义排序（面→界→道路→铁路→等高线→注记→格网→点位），灰块不再压地名
- 坡度瓦片改调色板 PNG（省 45%）；构建产物由 3.9 GB 降到 1.8 MB
- 新增第 8 道质量闸「样式表达式合法」，防止嵌套 zoom 导致整图不渲染
- 交互：图层可见性改差量更新，点击到首帧 74–84 ms → 24–26 ms

### v1.65 UI 重设计 + 图层顺序与缩放档修正

对照需求规格总表 §20（地图符号规范）与固定图层顺序逐项核查，修掉六处偏差；同轮重写 UI。

- **注记层级**：`rankOf` 原把所有 symbol 放 rank 5，画在铁路(6)/等高线(7)之下，等高线数字
  与地名会被铁路线压住。改为注记 rank 7.5（等高线之上、格网之下），射程圈标注随圈线 rank 9.5
  ——对齐「面→界→道路→铁路→等高线→注记→格网→射程圈→点位」。
- **建筑密度瓦片被城区面盖住**：density 原插在首个 tier 的 landcover 之后，稳定排序后落在
  所有后继 tier 的城区灰块（0.92 不透明）之下，z15 等于没画。改为在全部 tier 装配完之后追加，
  排序后稳定处于城区面之上、行政界之下，对齐规格「铺在城区面之上」。
- **z14 档接错包**：germany13(13–13) 与富尔达(0–13) 并列 maxzoom 时富尔达排前，
  tierBands 把 fulda_core 顶到 z15 才接管，z14 显示的是 germany13 过缩放的 z13 数据。
  regions 排序加 tie-break（maxzoom 并列时 minzoom 大者在前），germany13 接管 z13、
  fulda_core 从 z14 接管原生 z14 建筑；富尔达包在富尔达视图内让出 z13（germany13 同源数据），
  z14+ 作为 bbox 内 overzoom 兜底仍在场。
- **图层树开关失效**（PITFALLS §5）：`urban-world`、`density-*`、`landuse_station`、
  `landuse_port` 没进 `groupOf()`，关不掉也开不了。补映射：urban-world → 城区灰块、
  density-* → 建筑物、站场/港口面 → 城区灰块。
- **符号对齐 §20**：厂区面透明度 0.2 → 0.22；车站点从朱红（RING_INK）改墨色圆点（INK）。
- **UI 重设计**：styles.css 全量重写（约 699 行）——设计令牌扩充、自绘复选框、分区面板标题
  加琥珀色条、顶栏状态徽章带指示点、英文副标、地图浮层统一卡片语言（blur+圆角+边框）、
  MapLibre 导航/比例尺/署名控件暗色化、滚动条与滑块适配。地图左上工具条去重：底图层数与
  体积只在顶栏和侧栏「底图」面板显示，地图上只留战损开关与 FPS。组件只动类名与浮层结构，
  逻辑零改动。
- 文档同步：Readme 交通线起始缩放（z10）与接手速览版本号；MAPDESIGN 装配规则补 tie-break、
  铁路「永远压最上层」改为「压公路之上，等高线与注记再压铁路」。
- 验证：check_all 8 项全绿；style_snapshot 基线 sha256:b102a289…（170 layers）；
  z6 / z9 / z12 / z14 / z15 五档截图复核注记、密度、fulda_core 接管与 UI。

### v1.66 铁路低倍档重排：烘焙层首次真正渲染，NE 只补区域外

用户反馈「铁路在缩放中偏移、曲线变直线」。排查结论与改法：

1. `rail-low` 三层在样式里 minzoom=maxzoom=13，被 militaryStyle 的 min<max 过滤器整层删掉，
   运行时 setLayerZoomRange 找不到层——**烘焙铁路层自引入以来从未渲染过**。z5–10 实际显示的是
   NE 1:10m 概化线（偏差数百米、长直线段），z11–12 是「NE 淡出 + 瓦片」双线并存，
   z12→z13 再跳回瓦片位置——即「偏移」与「直线化」的来源。
2. 改法：`rail-low` 样式层直接声明 z3–10，z10→z11 交瓦片铁路（交接偏差 ≤1px）；
   新烘 `rails_germany.json`（germany.pmtiles z11 抽取，tol 0.00065°/minlen 800，3.6 MB，已登记 manifest）；
   `mergeRails` 细包让位（fulda bbox 内只用 fulda 细线）；NE 全球层装载时按区域包 bbox 做
   Liang-Barsky 分段裁剪（`data/railsWorld.ts`），区域内不再有概化线叠影，区域外保留 z10→z12 淡出
   （v1.59 的断联修复仍有效）；删除冗余的 `rail-low2`。
3. 原则：每一档缩放只允许一套铁路几何；交接放在瓦片起始缩放；NE 永不与烘焙线同框。
4. 校验：z8/z10/z11/z13 富尔达走廊单一几何；汉堡 z9 有德国烘焙铁路；华沙 z11 NE 淡线连续。
   check_all 8 项全绿；restore 台账 rails_germany 一致。

### v1.67 图种制：地势·交通图 / 用地·政区图

原「城区图/地形图」预设只切可见性，三类信息（地势/人文/交通）在任何缩放全量叠加，z9–12 视觉最挤。
按军用地形图/政区图体系分成两个图种（详表见 MAPDESIGN §十二）：

- **地势·交通图（默认）**：晕渲 exaggeration +15%、等高线加强、河流 ×1.3、地表 0.35 淡底、
  灰块/建筑/次级道路隐藏、国界弱化（州县乡 0.12）、铁路+主干公路+跑道。
- **用地·政区图**：地表全量 + 灰块 + 建筑 + 全级路网 + 四级行政界 + 设施气泡；等高线默认关。
- 实现：图种 = {可见性表, 强度规则表}（store.ts `PERSONAS`）；规则按 base id 前缀匹配（ruleHits）+
  属性族过滤（propFits），* 通配晕渲 exaggeration；运行时 setPaintProperty 差量应用，**不重建样式**
  （避开 1–4s 跨档停顿）；跨档重建后 paintSig(key|epoch) 变化自动重放；custom 沿用上一个图种强度。
- 基线表达式单一事实源：tokens/contour/widths 导出基线，用地图规则 = 基线回填，样式装配同步引用；
  style_snapshot 哈希不变（sha256:989356b4…，171 层）——图种是运行时差量，不改样式装配。
- UI：侧栏顶部图种双按钮（带副标），18 叶图层树折叠进「高级图层」面板（默认收起）；
  默认图种 = 地势·交通图（约束 §4 军事判读优先）。
- 修复：样式合并编辑把 .lg-items 规则体删丢，浏览器从未闭合块起吞掉后半 CSS
  （.ml-wrap/.main 布局与背景失效 → 生产页整页黑屏，且首次缩放后图层开关全部失效）。
  check_all 新增第 9 道闸「CSS 结构」（花括号配平 + 声明分号 + 散句），此类损坏构建期即拦；
  顺带修复 appliedRef 在样式重建后未重置导致的差量可见性失效。

### v1.68 NE 铁路重烘（分档 + 去轮渡）与地势图图册化

**一、铁路 z9–12 的「形变 / 断开 / 海上线条」**

三个静默过滤器叠加所致：`MINLEN 18 km` 按长度丢段（俄罗斯一屏 49–60°E / 55–61°N 源数据 647 段里
删掉 494 段）、RDP 容差写成「度」`0.0035°`（58°N 上东西向 206 m、南北向 389 m，斜线被拉歪）、
不读属性表（18 条 `Railroad ferry` 轮渡航线画成海上铁路，1508 条 `ne_1d4_north_america_dup` 副本双画北美）。

- 重写 `Tools/bake_ne_rails.py`：只收 `featurecla = Railroad`、剔除北美副本、RDP 改**米制 300 m**、
  删除长度门槛，按 `disp_scale` 分两档：`rails_world_fine`（1:10m/1:5m/1:3m，15738 段 / 2.21 MB，z3–12）、
  `rails_world_coarse`（1:20m–1:80m，8100 段 / 1.71 MB，z1–3）；`rails_world.json` 退役。
- 样式：`railWorldLayers({source, minzoom, maxzoom, suffix, haloMin, opacity, hatch})`，全球层补枕木（z9+，三层与本地烘焙层同款）；
  z9–12 不再出现 1:40m/1:80m 骨架线，z1–2 也不再把 1:3m 细节铺满全球。
- 实测：同一视野可见段数 153 → 647，波罗的海纵向线消失；单数据文件 2.21 / 1.71 MB 均低于 4 MB 闸。
- **修复「缩小后铁路消失」**：两处叠加——① 相机 `minZoom` 是 1，但最底层铁路原从 z3 起，缩到 z1–2 干脆没有；
  ② 粗档（1:20m–1:80m）只有 8100 段，若铺 z4–5，从 z5 缩到 z4 时该区域 566 段会掉到 81 段，看起来像整片消失。
  改法：精细档一路铺 **z3–12**，粗档只负责 **z1–3** 的全球骨架（无光晕、只开墨线、opacity 0.6→1），
  `railWidth` 加 z1 = ×0.22 / z3 = ×0.32 两档；粗档不做区域裁剪（否则 z1–2 在区域包 bbox 内出现空洞）。

**二、地势图改成图册式**

- 新增 `color-relief` 分层设色层 `relief-tint__<dem>`（`tokens.HYPSOMETRIC_RAMP`：绿 0 m → 黄 600–900 m →
  褐 4000 m），基础 0.5，地势档差量调到 0.62；归「晕渲」叶，用地·政区图（relief=false）自动隐藏。
- 地势·交通图不再画城市：`urban / building / landcover / airport / poi` 全关，只留地形 + 等高线 +
  水系 + 铁路 + 主干公路 + 地名。
- 样式快照 sha256:9a952038…（174 层，171 → 174）；check_all 9 项全绿。
- 已知边界：DEM 只到 z5（区域到 z11），区域外分层设色是 z5 overzoom；等高线仍只有富尔达。

### v1.69 等高线三档阶梯：地势图终于有地形细节

v1.68 的地势图只有富尔达有等高线，且样式层盯死在 `minzoom 12`（细线）/ `10.5`（计曲线），
z10 以下一片空白；德国与中欧虽然有 DEM，却从未烘过等高线。这轮把等高距按缩放做成阶梯：

| 档 | 数据 | 等高距 / 计曲线 | 缩放 | 体积 |
| --- | --- | --- | --- | --- |
| europe | `contours_europe.json`（0–20°E / 44–56°N，DEM z8） | 500 / 1500 m | z7–10 | 1.27 MB / 88k 顶点 |
| germany | `contours_germany.json`（德国 bbox，DEM z11） | 200 / 400 m | z10–13 | 3.45 MB / 243k 顶点 |
| fulda | `contours_fulda.json`（富尔达 bbox，DEM z9–11） | 25 / 125 m | z13+ | 1.37 MB / 114k 顶点 |

- 烘焙：`bake_contours.py` 新增 `--min-elev`（丢掉海平面以下的 DEM 噪声层）与「按 bbox 只读相交瓦片」；
  德国整块 z11 的 mosaic 有 625 MB，不裁瓦片列表会白读四分之三。
- 装配：`CONTOUR_BANDS`（`style/contour.ts`）成为唯一事实源，每档出「细线 / 计曲线 / 计曲线标注」三层，
  `filter` 打 `band` 属性；档区间 7–10 / 10–13 / 13+ 首尾相接、互不重叠；装载时只取与视口相交的档。
- 基线透明度 0.18(z5) → 0.65(z14)、计曲线 0.28 → 0.82；地势图再叠加图种强度（原有规则按 base id 前缀命中新 id）。
- 数据总量 6.1 MB / 445k 顶点，单文件最大 3.45 MB（4 MB 闸内）；样式 174 → 180 层。
- 已知边界：z13 之后德国只有富尔达有等高线；中欧 20°E 以外、以及全球其它地区仍无等高线——
  等两份图种稳定后按 DEM 分块铺（每块沿用这三档等高距）。

### v1.70 地形精修：DEM 分档互斥、分层设色改色阶、铁路补档

**一、地形「糊」的三层原因**

- **DEM 档不互斥**：`world`（z0–5）与区域 DEM 的晕渲/分层设色都开到 z22，德国 z11+ 上同时叠了两层晕渲
  + 两层分层设色——糊、发灰、饱和度翻倍。新增 `DEM_BANDS` 表（world 0 / europe 6 / germany 9），
  按「视口中心 + 当前缩放」只选一档，粗档在细档起点封顶；`viewSig()` 带上档名，跨档才重建样式。
- **`dem/europe` 从未生效**：z6–8 一直用 world z5（2–8 倍 overzoom）。现已挂上（0–20°E / 44–56°N，z6–8）。
- **德国 z9–10 只有 z5 高程**：16–32 倍 overzoom。现补烘到 z9–11（5208 文件 / 520 MB，`demZoom [9,11]`，
  manifest 与 restore 台账同步），地形/晕渲/高程坡度读数一起变准。

**二、图册观感**

- `HYPSOMETRIC_RAMP` 由连续 interpolate 改为 `step`（100/200/300/450/600/800/1000/1300/1600/2000/2500/3000/4000 m），
  分层设色变成等高色带而不是渐变糊；不透明度 0.5 → 0.45（地势档 0.62 → 0.6）。
- 晕渲 exaggeration 整体 +5–15%（z12 0.6 → 0.72，z16 0.52 → 0.62），细节档切换后斜坡更立体。

**三、铁路**

- **z10–11 断档**：`rail-low` 原 z3–10、瓦片 z11 起 —— z10–11 之间德国境内一条铁路都没有；改为 z3–11。
- 枕木层低倍不再出现（`rail-low-hatch` 从 z9 起），与全局 NE 层一致。

**四、顺带修的真 bug**

- 样式重建判据：`mountedRef` 存的是 `key|bandFrom`，moveend 里却先拿 `key` 比对（永远不等），
  于是**每次平移结束都会重建整张样式**（1–4 s 停顿、图层闪一下）。现在两处共用 `viewSig()`（zones|bandFrom|demBand），
  只在真正换档时重建。

- 校验：check_all 9 项全绿；style_snapshot sha256:85aeebd2…（180 层）；样式规范校验 0 error。

### v1.71 地势图改彩色分层设色（图册风）

按「像地图册那样一眼区分地形」重做色阶：

- `HYPSO_LADDER` 16 级（0/100/200/300/400/500/700/900/1100/1400/1700/2000/2500/3000/3500/4000 m）：
  低地绿 `#9ac98f` → 浅绿 → 黄绿 → 黄 → 橙黄 → 橙 → 浅褐 → 深褐 `#b86d55` → 灰岩 `#a89890` → 雪线近白 `#e8e6e2`，
  比上一版那套灰调粉彩饱和一档。
- **每档用自己的色阶，并与该档等高距对齐**：`world`（无等高线）200/500/1000/1500/…、`europe`（500 m 等高线）
  250/500/750/1000/…、`germany`（200 m 等高线）100/200/300/…——色带边界与等高线同梯，读图时两者互相印证。
  `DemTier.ramp` 字段承载，`reliefTintLayer()` 没给就用默认档。
- 不透明度 0.8（地势档 0.88；原 0.45 / 0.62），色块不再被纸底洗淡；水系面仍在设色之上，不会被染成陆地色。
- 校验：check_all 9 项全绿；style_snapshot sha256:04613c00…（180 层）；样式规范校验 0 error。

### v1.72 地势图默认开启「坡度通行」

- **地势·交通图 `slope: true`**（副标加「坡度」）。坡度沿用原来的 6 级配色
  （<3% 浅绿 → 3–8% 绿 → 8–15% 卡其 → 15–25% 赭黄 → 25–35% 橙红 → >35% 砖红），
  调色板、不透明度（0.85）、叠加位置都不动，与改动前完全一致。
- 中途试过「坡度 < 8% 烘成透明、让缓坡保留设色」的写法，**观感过于极端**（大片地形没有坡度色），
  已整体回滚：`slope_palette.json` 与 `bake_slope.py` 恢复原状，四套 slope 重烘为不透明。
- 只保留两处**不改观感**的结构修正：
  - `slopeTiers` 原按区域包 `band.from` 起（德国 z11），z9–10 一直在用 world 的 z5 坡度（25 倍 overzoom），
    且 world 档开到 z22 与区域档叠画；现在与 `DEM_BANDS` 同表（world 0 / europe 6 / germany 9，
    粗档在细档起点封顶），**`slope/europe` z6–8 首次被加载**。
  - 德国坡度补到 z9–10（重烘 5208 张 / 33.6 MB），坡度总量 31 → 39.4 MB；manifest 的 files/bytes 同步。
- 叠加关系不变：坡度（raster，rank 1、后 push）压在分层设色与晕渲之上，0.85 不透明。
- 校验：check_all 9 项全绿；样式快照仍是 sha256:04613c00…（180 层，与 v1.71 一致——坡度只动数据与档位）；
  `slope-world z0–9` / `slope-germany z9–22` 装配实测无重叠；抽检瓦片透明像素 0%。

### v1.73 跨级显示细节：道路不再被比例尺吃掉

主干道路 `minzoom` 是 10、次级 12、生活道路 11–13、跑道 13，缩到对应比例尺以下整类要素就没了——
看「走廊」时很别扭。新增侧栏「图种」面板里的开关 **跨级显示细节**（`store.forceDetail`，默认关）：

- 开启后对四组图层调用 `map.setLayerZoomRange(id, 0, 原 maxzoom)`：`road`（主干 + 次级）、
  `minor`（生活道路）、`airport`（跑道 / 滑行道）、`poi`（设施气泡）——任意比例尺都画；关闭时按记录还原。
- 只改运行时 zoom range，不动样式装配：样式快照仍 sha256:04613c00…（180 层）。
- 原始 min/max 在**每次样式重建后按 epoch 重新采样**（从 `map.getStyle()` 读），
  避免「关掉开关后回不到原区间」。
- 铁路与等高线不在此列：它们本来就分档连续（z1–17 都有），强开会让多档几何叠画成黑块。
- 判定逻辑落在新文件 `app/src/map/forceDetail.ts`，`WorldMapLibre` 只留一个 effect 调用（行数闸 700 内）。

### v1.74 全球美术扩展：主干公路下探 z7、铁路续到 z16、等高线全球配准

三件「只在德国/富尔达做过的」美术资源改成全球通用：

- **主干公路 minzoom 10 → 7**：瓦片在 z7–10 本来就有 `highway/motorway|trunk|primary`
  （z8 抽检纽约 227 段、北京 65 段、内罗毕 22 段），此前被 `MAIN_MINZOOM=10` 整类挡掉，
  z7–9 全世界没有一条主路。现在 `MAIN_MINZOOM=7`（出现）+ `MAIN_FULL_MINZOOM=10`（满强度）：
  z7 0.45 不透明细线 → z10 回到 0.9；次级公路仍 z12 渐显，生活道路 11、支路 12 不动。
- **NE 全球铁路细档 maxzoom 12 → 16**（不透明 z12 0.35 → z14 0.3 → z16 0.25）：
  德国之外放大过 z12 不再整片铁路消失；德国/富尔达 bbox 内仍由烘焙线接管，互不叠影。
- **NE 裁剪只按有铁路数据的区域包**：`mergeRails` 回传实际命中的 boxes，`WorldMapLibre` 用它裁剪 NE 细档。
  以前按「所有区域包 bbox」裁，新加一个没烘 `rails_<key>.json` 的区域包就会在 NE 层上挖出空洞。
- **等高线新增 world_mid 档**：`contours_world_mid.json`（1000 m / 2000 m 计曲线，z7–10，全球但挖掉欧洲 bbox），
  与 europe 档零重叠；`ContourBand.exclude` 同时用于装配过滤——视口整个落在欧洲时不下载这一档。
- **全球等高线配准修复（重要）**：`bake_contours.py` 原来把 Mercator DEM 裁剪后直接当线性纬度网格用，
  小区域（欧洲 12°、德国 8°）误差只有数百米，全球跨度下纬度错位达数十度——旧 `contours_world.json`
  的 4000 m 以上等高线簇落在 16°N（应在喜马拉雅/安第斯）。新增 `crop_linear()`：横向 LANCZOS 重采样后，
  按 `asinh(tan(lat))` 反查源行做垂直线性插值，输出真正的线性纬度网格；`--warp=merc` 保留旧行为。
- 重烘：`contours_world.json` 2.82 MB / 167,484 顶点、`contours_world_mid.json` 2.79 MB / 165,735 顶点；
  修复后 ≥4000 m 顶点纬度 p5/p50/p95 = −24.9 / 31.9 / 38.6（安第斯—青藏），经度中位 83.7°E。
- **跨档 zoom range 回写修复（关键）**：`applyForceDetail` 之前在换档窗口里从**旧样式**记录 `[min,max]` 并回写到新图层，
  把世界瓦片层（world9）的上限从 22 压回旧值 11——德国以外 z11 以上道路与设施气泡全灭，且会随每次跨档累积。
  现在：`isStyleLoaded()` 未就绪时不写、`forceDetail` 关闭（默认）时完全不写，只在用户开启后记录/恢复。
  CDP 复核：`roads_highway__detail_world9` 由 9–11 回到 9–22，巴黎 z14 主路恢复；`跨级显示细节` 开关仍可开/还原。
- 校验：check_all 全绿；样式表达式合法。

### v1.75 全球地形补档：z6 DEM 与坡度、档位互斥修正、产品台账

AWS Terrarium 恢复可访问后补的第一块全球地形：

- 新增 **`dem/world6` z6（4096 瓦片 / 203 MB）**：此前 z6 以上全球地形一直是 `dem/world` z5 的 16–32 倍 overzoom
  （z10 时 4.8 km/px 的晕渲被硬拉到 300 m/px），跳出中欧就看不清山形。`DEM_BANDS` 加 `world6`（from 6）。
- **档位互斥修正**：`europe` 的起点从 6 改到 **7**。四档 `from` 必须互不相同——两档同 from 时
  `styleMax` 公式会给两档都放开到 22，两层晕渲 + 两层设色叠着画（v1.70 修过同样的问题，这次是新增档位带回来的）。
  europe 瓦片本身是 z6–8，从 7 起不损失原生分辨率；z6 全球由 world6 提供。
- **坡度同步**：新增 `slope/world6`（z6），档位 0 / 6 / 7 / 9（world / world6 / europe / germany），与 `DEM_BANDS` 同表。
- 体积：DEM 总量 641 → **844 MB**（CONSTRAINTS §2 的 1 GB 上限还剩约 155 MB；全球 z7 单档约 800 MB，补不了）；
  `slope/world6` 6.7 MB（入库，与其余 slope 一样跟随 DEM 版本）。
- **修复 `Tools/restore.mjs` 报错**：v1.0.27 换了 `poi_fulda.json`（9473 B / 新 sha256），`dem/fulda` 也有 7 KB 漂移，
  但 `Tools/data_manifest.json` 没跟着更新，`restore.mjs` 会对 fulda 报两条 bad。台账已按实际产物校正，复核 2/2 ok。
- 校验：check_all 9 项全绿；CDP 实测 z6/z7 交界只有一层晕渲 + 一层设色（world 在 6 封顶、world6 在 7 让位、
  europe 从 7 接管）；伊朗 / 中国等非欧洲点位出图正常，高程读数切到 z6 原生瓦片。

### v1.76 dev 下 worker 被 Vite 注入 HMR：整图只剩栅格

只在 `pnpm dev` 出现：控制台 `Worker failed to load. Check that the worker URL is correct.`，
画面只剩坡度 PNG + 纸底，矢量 / 晕渲 / 分层设色 / 等高线全空；生产包（`vite build` + `serve.mjs`）正常。

- 根因：`import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` 在 dev 返回
  `/node_modules/.pnpm/.../maplibre-gl-worker.mjs`，浏览器再取这个地址时 Vite 当作源码模块 transform，
  在开头插入 `import { injectQuery } from "/@vite/client"`；worker 里没有 `document`，初始化即抛，
  MapLibre 只把 worker 的 `error` 事件翻译成「worker URL 不对」，看起来像路径问题。
- 修法：`Tools/dev_static.mjs` 新增 `serveMlWorker`，`vite.config.ts` 加 `/ml-worker.mjs` 路由**原样吐字节**；
  `setWorkerUrl(import.meta.env.DEV ? '/ml-worker.mjs' : mapWorkerUrl)`。生产仍走 `?url` 资产（`.mjs` MIME 由 `serve.mjs` 保证）。
- 复核：dev 下无 console 错误、`map.loaded()=true`、`pmtiles` 206 正常，伊朗 z8 出图含水系与主路；
  生产端口同样无 worker 报错。
- `PITFALLS.md` 增 A 级第 6 条（现象 + 判定顺序：先看 worker 错误，再看有没有 206）。

### v1.77 全球等高线分区细化：五条山系 500 m 档

照德国/富尔达「按地形分档」的做法，把 z7–10 这一层从「全球一套 1000 m」扩成「分区细档」：

- 新增 5 个 500 m 山系档（DEM z6，原生 2.4 km/px；interval 500 / bold 1000；单档均 < 4 MB）：
  喜马拉雅—青藏 3.57 MB / 238k 顶点、安第斯 2.22 MB / 146k、落基山 1.80 MB / 116k、
  扎格罗斯—厄尔布尔士 0.83 MB / 57k、东非裂谷 0.73 MB / 47k。
- `world_mid` 重烘：用 `--exclude` 把这 5 个 bbox 连同欧洲一起挖空（`;` 分隔多矩形），
  z7–10 同一位置只留一套线；体积 2.79 → **1.96 MB**（省下的正是这些山系）。
- `CONTOUR_BANDS` 增至 **10 档**，等高线图层 +15（每档细线 / 计曲线 / 计曲线标注三层）。
- 复核：各档最高一层等高线都落在真实山系（≥7000 m 只在 74–87°E / 28–36°N；
  东非 ≥4000 m 在 30–40°E / −3…13°N），world_mid 仍无纬度错位。
- 校验：check_all 全绿；五个新档合计 9.15 MB，单档最大 3.57 MB（4 MB 闸内）。

### v1.78 全球海域名注记：z3–8 图册式海名

- 新增 `seas_world.json`（**58 条**：5 大洋 / 32 海 / 21 湾与海峡；中心点手选、避开陆地，约 3 KB）。
- 样式层 `sea-label`：z3–8，大写 + 0.14–0.24 字距，水路蓝 `#6f8fa0` + 纸色光晕；
  `symbol-sort-key` 让大洋先排，碰撞交给 MapLibre（同屏只留放得下的），归「地名标注」叶，两个图种都可见。
- 接入：`docLoaders.seaLabelFc()` 把紧凑数组转 GeoJSON；`militaryStyle` 只在数据存在时建源与图层（缺失不报错）。
- 复核：大西洋 z4 实拍「ATLANTIC OCEAN」大字距小号落在洋面，与底图国名/城市名不打架；z8 起自动退场；无 console 错误。

### v1.79 全球低倍主干公路骨架：z4–6 不再只有铁路

德国/富尔达之外，z4–6 一直只有 NE 铁路与等高线，公路要等到 z7（瓦片主路）。补一层 NE 主干骨架：

- 新增 `roads_world.json`：NE 1:10m 的 **Major Highway 9,771 段 + Secondary Highway 9,035 段**（共 18,806 段 /
  **3.40 MB**；米制 RDP 300 m；剔除 Road/Track/Ferry Route 等 37,823 段）。
- 样式层 `road-world` / `road-world-casing`（`style/road.ts`）：z4–6，干线橙 / 主干米，与瓦片主路同色系；
  z4 0.5 → z6 0.8 不透明，z7 交瓦片（同缩放不叠影）。归「主干公路」叶，随开关一起走。
- 烘焙脚本 `Tools/bake_ne_roads.py`（与 `bake_ne_rails.py` 同款：米制投影 + RDP + 分段），
  pyshp 已在 CONSTRAINTS §2 白名单内。
- 顺带加固 `getJson()`：只有 `content-type` 含 `json` 才解析并缓存，404/HTML 不再被当数据缓存——
  新增数据文件后不会「整层静默消失」。
- 复核：z5 利比亚—埃及实拍可见沿海干线（的黎波里—班加西—托布鲁克—亚历山大）与开罗周边路网；
  z7 交瓦片；check_all 全绿。

### v1.80 低倍全球河网：z3–8 的河流补位

底图 `water_river` 从 **z9** 才出现（`water_stream` z14），所以 z3–8 的亚马逊、尼罗河、伏尔加、长江全是空白——
地形判读少了主干水系。按铁路/公路同款做法补一层 NE 数据：

- 新增 `rivers_world.json`：NE 1:10m 河网 River + Lake Centerline，**2,252 段 / 3.05 MB**
  （米制 RDP 300 m；剔除 River (Intermittent) 与 Canal 13 段）。
- 样式层 `river-world`（`style/water.ts`）：z3–8，淡蓝 `#7fa8bd`，按 `scalerank` 分三档线宽
  （≤2 主河、≤5 支干、其余细线），z3 0.55 → z8 0.85 不透明；**z9 交瓦片**（`water_river` 起点）。
- 排序：图层 rank **3.5**（行政界 3 与道路 4 之间），读图次序固定为「面 → 行政界 → 水系 → 道路」；归「水系」叶。
- 烘焙脚本 `Tools/bake_ne_rivers.py`（与 rails/roads 同款米制投影 + RDP）。
- 复核：z5 亚马逊实拍 `river-world` 命中 **98 个要素**，河色像素 1,450（水系面 29,223），无 console 错误；
  check_all 全绿。
