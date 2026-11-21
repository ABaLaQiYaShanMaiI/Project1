# 地图设计（MAP DESIGN）

目标：**一张离线、可缩放、能用于军事判读的世界地图**。
分层采纳，不追求全球高精度；细节按区域叠加。

---

## 一、分层结构

```
L0 全球      tiles/world.pmtiles      z0-z6    42 MB     全世界始终有图
L1 全球 z7-8  tiles/world8.pmtiles     z7-z8    476 MB    村镇级标注与路网
L1b 全球 z9-10 tiles/world9.pmtiles     z9-z10   3.0 GB    街区级路网与更密地名
L2 热点      tiles/fulda.pmtiles      z0-z13   42 MB     战术尺度
L2b 国家     tiles/<country>.pmtiles z11-z12  目标 ≤100 GB  全球 200 片（目录见 Tools/country_catalog.json）
L3 城区核心  tiles/<city>_core.pmtiles z14-z15 118 MB   13 城真实建筑
地形        dem/world z0-z5（86 MB） + dem/world6 z6（约 200 MB） + dem/europe z6-z9（151 MB） + dem/germany z9-z11（520 MB）
坡度        slope/world z0-z5（3.6 MB） + slope/world6 z6（约 6 MB） + slope/europe z6-z9（9.2 MB） + slope/germany z9-z11（35 MB）
判读        contours_<key>.json、运行时 UTM 格网、射程圈
```

富尔达视图内 7 个 tier 同时在场、约 454 个 style 图层；世界其余地区是 world + world8 + world9 三包（约 186 层）。
层预算 MAX_REGION_TIERS = 5，超出按 maxzoom 丢弃最低倍包。
dem/europe 与 slope/europe 的瓦片目录由 dem/world8 / slope/world8 的清单别名复用，不再有独立的 europe 矢量包。

**地形档互斥（v1.70，v1.75 加全球 z6 档）**：`DEM_BANDS`（`WorldMapLibre`）列 world 0 / world6 6 / europe 7 / germany 9 四档，
按「视口中心 + 当前缩放」选一档，粗档在细档起点封顶——之前 world（z0–5）与区域 DEM 同时开到 z22，
德国 z11+ 是两层晕渲 + 两层分层设色叠着画（糊且发灰），并且 `dem/europe` 根本没被挂上过。
**四档的 `from` 必须互不相同**：早期 world 与 europe 都从 6 起，`styleMax` 公式会给两档都放开到 22，叠画出灰底；
v1.75 起 z6 交给 world6、europe 从 7 接管（europe 瓦片本身是 z6–8，从 7 起不损失原生分辨率）。
z9–10 用 germany 的原生 z9–10 瓦片（此前是全球 z5 的 16–32 倍 overzoom）。
**国家包约定（v1.95）**：目录由 `Tools/build_catalog.mjs` 从 Natural Earth 110m 生成
（`Tools/country_catalog.json`，**200 片**）：取每国**最大陆块**的 bbox（海外属地不计），
bbox 面积 > 6M km² 的国家按经度切 2–4 片（`china_1..4` / `russia_1..4` / `united_states_1..4` …）。
构建走 `node Tools/build_world.mjs [--limit-gb=100] [--only=Europe] [--count=N]`，**断点续跑**（已存在的包跳过）。
命名固定 `<key>.pmtiles` + `rails_<key>.json` + `poi_<key>.json` + `cities_<key>.json`（英文 slug，不随语言变）。
预算：单包 ≤ 12 GB、总量 ≤ 100 GB；国家包**不带 DEM/等高线**——地形由 europe z9 兜底
（要原生 z9–11 得另立 DEM 预算）。矩形 bbox 会在边境多加载空 tier，属已知取舍。

**美术改动的影响面（v1.95）**：颜色/线型/字重全在 `data/style/tokens.ts` 与底图样式模板，
改完热更新即可，**不碰任何数据包**；坡度/密度这类「烘焙时着色」的派生素材用
`node Tools/art_refresh.mjs` 重烘（slope 全量约 40 s，density 每城数秒），仍不需要重切国家包。
只有改「数据规格」（图层属性、缩放档位、bbox）才需要重烘国家包。



装配规则（`data/pmtilesBasemap.ts`）：
- `zonesAt(zones, lon, lat)` 取**命中该坐标的全部区域包**，加上全部全球包，按 `maxzoom` 升序
  （并列时 `minzoom` 大者在前——germany13 先于富尔达接管 z13，fulda_core 从 z14 接管）；
- `tierBands()` 给每层分配接管区间：**后一层的 `styleMin` = 前一层的 `maxzoom + 1`**；
- 每层都是完整的一套 base 图层（`militaryStyle()` 复制并绑定各自 source），
  所以任何一层缺失都不会导致空白——上一层会继续 overzoom 撑住。

## 二、为什么是「部分采纳」

| 方案 | 体积 | 可行性 |
| --- | --- | --- |
| 全球 z0-z13 | 数百 GB | 不可能，也不必要 |
| 全球 z0-z8 | 543 MB | 体积过大，低倍用不到 |
| **全球 z0-z6** | **44 MB** | **全世界有图** |
| 区域 z6-z8 / z9-z13 | 每块 30-60 MB | 按需叠加 |

结论：**全球低倍铺满 + 区域高倍叠加**。这也是 `pmtiles extract --bbox` 的设计前提。

## 三、取景

- 不再做相机限位。全球层覆盖全图，任何时候都不会看到空白。
- 初始相机停在富尔达、`zoom 7`，即 L2 热点区的入口。
- **不要手算 cover 缩放**：`getZoom()` 与 `getBounds()` 在某些环境（`Emulation` 覆盖设备指标）
  会差一级，手算必偏。要判断可视范围只信 `getBounds()`。

## 四、交通线分级

**铁路是陆路交通的核心，公路只做底纹。** 层级从高到低：铁路 > 主干公路 > 次要公路 > 支路。

| 级别 | 依据 | 表现 |
| --- | --- | --- |
| 铁路（低倍） | `rails_<key>.json`，z3–11 | 与瓦片铁路同款三层（光晕/墨线/枕木，枕木 z9 起）；多区域合并时细包让位（fulda bbox 内只用 fulda 细线）；z11 起交瓦片铁路（v1.70 前是 z3–10，z10–11 之间德国境内一条都没有）；z1–2 由全球粗档铺（无光晕，细线） |
| 铁路（全球 NE） | `rails_world_coarse.json` z1–3 / `rails_world_fine.json` z3–11 | 粗档无光晕、只开墨线（薄线 + 0.6→1 透明）；细档 z3 起就上，避免 z5 以下「大片线消失」；细档 **opacity 1、与瓦片铁路同三层同宽度**（光晕 5.2 / 墨线 3.4 / 枕木 1.05，枕木 z9–11），**z11 起交给瓦片/核心铁路**；**烘焙时按端点串联 + 400 m 桥接**（细档 8,411 段 / 平均 21 点），高倍不再碎成短段；绘制层序在等高线之上、注记之下；**只在 fine 档**按「有烘焙铁路的区域包」bbox 裁剪 |
| 铁路（瓦片） | `kind = rail`，z11+ | 纸色光晕 5.2 + 墨色实线 3.4 + 白色枕木 1.05（`[1.1, 2.1]`），宽度随缩放缓慢收敛；**城市核心包（z14–15）也出原生铁路**，`min = tier.minzoom + 1` 与前一层错开 |
| 主干公路 | `motorway / trunk / primary`（含 link），**z7+** | **同级不同色**：高速 `#b4553a` / 干线 `#bf7a45` / 主干 `#c49a68`，宽度统一 **1.2**、描边 1.7；z7 起 0.45 不透明细线（LOD），z10 满强度 0.9 |
| 低倍主干骨架（全球） | `roads_world.json` z4–6 | NE 1:10m 的 Major / Secondary Highway（18,806 段 / 3.4 MB，米制 300 m 容差），干线橙 / 主干米；z4 0.5 → z6 0.8 不透明，z7 起交瓦片主路（同色系，不叠影） |
| 次级公路 | `secondary / tertiary`，z12+ | 浅米色 `#f0e8d8`、描边 `#cfc6b2`、0.62 折宽——城区里的"大路" |
| 生活道路 | `residential / service`，z12–13+ | 极淡 `#cfc7b4`、0.4 折宽、无描边——"小路" |
| 支路 | `minor_service / other` | `minzoom 13` |
| 跑道 / 滑行道 | `runway / taxiway` | 单色 2.0，`minzoom 13` |

规则：**铁路先出、公路后出**——z4–6 只有 NE 主干骨架路（细、低透明），主干公路 z7 起以细线半透明出现（低倍只做骨架提示），z10 满强度；z11 起瓦片铁路加入；
高速与主干同时出现、同时消失（同一 `minzoom`、同一套描边与宽度）；
铁路压在所有公路之上，等高线与注记再压铁路（固定顺序见 Readme 接手速览），且比任何公路都粗——它才是"陆路交通"的本体。

**数据现实**：Protomaps 的 `roads` 层只在 **z11 及以上**才带 `kind=rail`（实测 z10 及以下为 0 条）。
所以低倍铁路用 `bake_rail.mjs` 从区域包 z11 抽出来单独成层（`rails_<key>.json`，富尔达 260 KB / 德国 3.6 MB），
z3–10 只画它；NE 全球层装载时按区域包 bbox 裁剪，只在区域包之外显示（v1.66 起，区域内不再有概化线叠影；
v1.68 起裁剪只作用于 fine 档 z3–12，粗档 z1–2 不裁，否则缩到 z1–2 时区域包内会出现空洞）。

NE 烘焙的四条硬规则（v1.68，`bake_ne_rails.py`）：只收 `featurecla = Railroad`（轮渡航线会横跨波罗的海/英吉利/
日本/库克海峡）、剔除 `part = ne_1d4_north_america_dup` 副本（否则北美双线）、RDP 容差用**米制** 300 m（度制
`0.0035°` 在高纬东西向只剩 206 m、南北向 389 m，斜线会被拉歪）、**不设长度门槛**（`MINLEN 18 km` 曾在俄罗斯
一屏删掉 76% 的段落，网络碎成断枝）。全球 23838 段分两档：fine 15738 段 / 2.21 MB（z3–12）、
coarse 8100 段 / 1.71 MB（z1–3）。

低倍连续性规则（v1.68 补）：相机 `minZoom` 是 1，铁路必须铺到 z1 才不「缩小后消失」；
精细档一路铺 z3–12（若让粗档铺 z4–5，从 z5 缩到 z4 会一下少掉八成线，看起来像整片消失）；
粗档只负责 z1–3 的全球骨架，无光晕、只开墨线，`railWidth` 为此加 z1 = ×0.22、z3 = ×0.32 两档，
opacity 由 z1 的 0.6 升到 z2.5 的 1；相邻档首尾相接，每档只允许一套几何。

实现约束：MapLibre **同一属性只允许一个 zoom 插值**，所以宽度写成
`['*', interpolate(zoom), ['case', isMain, 1, 0.42]]`，不能写两个分支各带插值。

## 五、等高线

等高线用**烘焙矢量**（每层一条 MultiLineString），不烘栅格：

| 方案 | 体积 | 缩放 | 结论 |
| --- | --- | --- | --- |
| 每瓦片烘 PNG（z9-z13） | ~10 MB / 1300+ 文件 | z13 以上糊 | 否 |
| 浏览器实时 marching squares | 0 | 平移卡顿 | 否 |
| 烘焙 GeoJSON | 6.1 MB / 3 档 | 无限清晰 | 是 |

等高距按缩放成阶梯（v1.69，`app/src/data/style/contour.ts` 的 `CONTOUR_BANDS` 是唯一事实源）：

| 档 | 数据来源 | 等高距 / 计曲线 | 缩放 | 体积 |
| --- | --- | --- | --- | --- |
| world | `contours_world.json`（全球，DEM z5） | 1000 / 2000 m | z4–7 | 2.82 MB / 167k 顶点 |
| world_mid | `contours_world_mid.json`（全球**挖掉** 20 个 500 m 区） | 1000 / 2000 m | z7–10 | 1.74 MB / 102k 顶点 |
| asia_himal | `contours_asia_himal.json`（65–105°E / 20–45°N，DEM z6） | 500 / 1000 m | z7–10 | 3.57 MB / 238k 顶点 |
| zagros | `contours_zagros.json`（35–62°E / 25–42°N，DEM z6） | 500 / 1000 m | z7–10 | 0.83 MB / 57k 顶点 |
| andes | `contours_andes.json`（−80…−58°E / −55…12°N，DEM z6） | 500 / 1000 m | z7–10 | 2.22 MB / 146k 顶点 |
| rockies | `contours_rockies.json`（−130…−100°E / 25–55°N，DEM z6） | 500 / 1000 m | z7–10 | 1.80 MB / 116k 顶点 |
| africa_rift | `contours_africa_rift.json`（28–46°E / −15…15°N，DEM z6） | 500 / 1000 m | z7–10 | 0.73 MB / 47k 顶点 |
| europe | `contours_europe.json`（0–20°E / 44–56°N，DEM z8） | 500 / 1500 m | z7–10 | 1.27 MB / 88k 顶点 |
| carpathians | `contours_carpathians.json`（17–27°E / 44–50°N，DEM z6） | 500 / 1000 m | z7–10 | 0.09 MB |
| scandes | `contours_scandes.json`（4–20°E / 58–71°N，DEM z6） | 500 / 1000 m | z7–10 | 0.28 MB |
| urals | `contours_urals.json`（55–68°E / 50–68°N，DEM z6） | 500 / 1000 m | z7–10 | 0.07 MB |
| caucasus | `contours_caucasus.json`（37–50°E / 42–45°N，DEM z6） | 500 / 1000 m | z7–10 | 0.09 MB |
| altai | `contours_altai.json`（82–100°E / 47–55°N，DEM z6） | 500 / 1000 m | z7–10 | 0.44 MB |
| atlas | `contours_atlas.json`（−10…0°E / 29–36°N，DEM z6） | 500 / 1000 m | z7–10 | 0.10 MB |
| drakensberg | `contours_drakensberg.json`（27–32°E / −33…−25°N，DEM z6） | 500 / 1000 m | z7–10 | 0.08 MB |
| japan_alps | `contours_japan_alps.json`（135–142°E / 34–38°N，DEM z6） | 500 / 1000 m | z7–10 | 0.06 MB |
| mesoamerica | `contours_mesoamerica.json`（−108…−96°E / 15–25°N，DEM z6） | 500 / 1000 m | z7–10 | 0.28 MB |
| pyrenees | `contours_pyrenees.json`（−10…3°E / 36–44°N，DEM z6） | 500 / 1000 m | z7–10 | 0.14 MB |
| new_guinea | `contours_new_guinea.json`（131–151°E / −11…1°N，DEM z6） | 500 / 1000 m | z7–10 | 0.12 MB |
| madagascar | `contours_madagascar.json`（46–51°E / −26…−12°N，DEM z6） | 500 / 1000 m | z7–10 | 0.09 MB |
| new_zealand | `contours_new_zealand.json`（166–179°E / −48…−34°N，DEM z6） | 500 / 1000 m | z7–10 | 0.14 MB |
| borneo | `contours_borneo.json`（95–119°E / −6…7°N，DEM z6） | 500 / 1000 m | z7–10 | 0.30 MB |
| germany | `contours_germany.json`（德国 bbox，DEM z11） | 200 / 400 m | z10–13 | 3.45 MB / 243k 顶点 |
| fulda | `contours_fulda.json`（富尔达 bbox，DEM z9–11） | 25 / 125 m | z13+ | 1.37 MB / 114k 顶点 |

规则：**一档只画一套等高线**——按缩放首尾相接（4–7 / 7–10 / 10–13 / 13+），每层用 `filter` 打 `band` 属性，
相邻档永不重叠。z7–10 这一层里**细档（500 m）按山系分区**，粗档 world_mid 在烘焙时就用 `--exclude`
把这些 bbox 置 NaN 挖空（`;` 分隔多个矩形），于是同一缩放只有一套线；`ContourBand.exclude` 另外让装配端
在视口整个落进欧洲时不下载 world_mid。透明度 z5 0.18 → z14 0.65、细线 z5 0.4 → z13 1.0 px，
地势图再由图种强度抬高。烘焙参数：world 3600 px / 简化 1500 m / 最短 20 km；十九个 500 m 区 2000–2400 px /
700 m / 6 km（DEM z6，原生 2.4 km/px）；europe 2400 px / 400 m / 6 km；germany 3000 px / 120 m / 2 km；
fulda 1200 px / 45 m / 0.6 km；`--min-elev 0` 丢掉海平面以下的 DEM 噪声层。

**跨视口补载（v1.88）**：等高线原来只在样式重建时按当时视口装载，平移到另一个山系（同一 tier 内）
不会补载 —— 新增的 9 个 500 m 区会「看不见」。现在 `map/contourDocs.ts` 在 `moveend` 比较
「当前视口应活跃的 band 集合」，有变化就补拉缺失档并 `setData` 到 `contours` 源，不重建样式；
文档与合并结果各留 LRU（8 / 6 份），避免长时间平移把内存堆满。

LOD 分层与透明度随缩放淡入见上表：每档只在自身缩放段出现，低倍不再被 25 m 等高线糊住。
标注：`symbol-placement: 'line'` 沿线上字（不烘固定锚点，避免放大变稀、缩小被碰撞剔除）。
每档只出计曲线标注（档内 z+0.5 起），富尔达档 z14 起再叠一层全部等级标注；间距随 zoom 插值（260 → 640 px）。

**坡度通行（v1.72）**：`slope/<key>` 是 6 级调色板 PNG（索引色，仅 nodata 透明），配色沿用
`<3% 浅绿 → 3–8% 绿 → 8–15% 卡其 → 15–25% 赭黄 → 25–35% 橙红 → >35% 砖红`；
样式按档互斥（world 0 / world6 6 / europe 7 / germany 9，与 `DEM_BANDS` 同表，粗档在细档起点封顶），
0.85 不透明叠在分层设色与晕渲之上。地势图默认开启——需要时在「高级图层」里单独关掉。

**地理配准**：DEM 瓦片是 Mercator，裁剪必须用 `asinh(tan(lat))` 做 y 映射，按纬度线性取行会在
0.76 度跨度内产生数百米纵向错位、全球跨度下则错位到几十度（v1.74 前 `contours_world.json` 里
4000 m 以上的线簇落在 16°N）。`bake_contours.py` 默认 `--warp=linear`：横向 LANCZOS 重采样后，
按 `asinh(tan(lat))` 反查每一输出行在 mosaic 中的源行做垂直插值，输出**线性纬度网格**；
`--warp=merc` 只用于复现旧产物。烘焙时把实际投影常量写进 JSON（`mPerDegLat` / `mPerDegLon`），
前端优先采用，不再自己猜。

`bake_contours.py` 直接吃 `--bbox`，投影用常量（`mPerDegLat 110540`、`mPerDegLon 111320*cos(lat)`），
不再依赖区域 JSON；`--dem` 指定读取的 DEM 目录（world_mid 读 `dem/world`），
`--exclude` 挖掉由更细档接管的 bbox（world_mid 挖欧洲）。

## 六、军用格网

经纬网在 50°N 处经度方向被压扁 0.64，量距离要换算；UTM 是等距格网，一格就是 1 km，
带号 + 东向/北向可直接当坐标口令。

实现：给定目标东向值，对经度做 40 次二分（`core/geo.ts`），24 个采样点连成折线，
所以格网线是**微微弯曲**的（Mercator -> UTM 的真实形变），不是栅格。缩放切换 1/2/5/10/25/50/100/200/500/1000 km。

**格网注记（v1.81）**：格网线原来没有数字，只能靠左下读数。补 `grid-label` 符号层（归「格网」叶）：

- **单带制**：`buildUtmGrid` 只用「视口中心带」（`utmIn(zone, …)`）。按每个点自己所属带算东向，会在带界跳变、
  整段线缺失（z7 实测只剩 7 条）；单带制下 6° 视口内数值连续，跨带才出现形变。
- **z<7 切经纬网**：视口跨多个带时 UTM 会出现负里程这类无意义读数，改用 `buildGraticule`
  （1/2/5/10/15/30°，边注 `45°N` / `15°E`）；`buildGrid(bounds, zoom)` 按 zoom 自动切换（阈值 7：
  z6 视口约 12°，单带已在边缘产生负值）。
- **锚点内缩 2%**：里程注记取线的北缘 / 西缘点，正好落在视口边上会被 MapLibre 丢弃（z7 实测 0 条）。
- 左上角注带号 + 纬度带（`32U`）；`gridStepFor` 的 m/px 常数按 MapLibre 的 512 px 世界改正
  （156543 → 78271），步长表补到 1000 km，低倍格网不再 16 px 一条。

## 七、视觉基调

浅色地形图纸底 + 深色 UI。纸色 `#e9e4d8`，陆地 `#e8e2d4`，林地 `#bfcdab`，
水域 `#a3bccb`，等高线 `#9a6b3c`，**城区灰 `#b9b3a7`**，铁路墨色 `#1f1f19`，
主干公路统一细线、按等级分色：高速 `#b4553a` / 干线 `#bf7a45` / 主干 `#c49a68`。

卫星影像不作为默认底图：读不出等高线与通行性。

**低倍河网（v1.80）**：底图 `water_river` 从 z9 才出现，z3–8 一直是空白。`rivers_world.json` 用 NE 1:10m
河网补位（2,252 段，按 `scalerank` 分三档线宽），z3–8 淡蓝细线、z9 交瓦片；归「水系」叶。
图层排序 rank 3.5（行政界 3 与道路 4 之间），保证「面 → 行政界 → 水系 → 道路」的读图次序。

**海洋注记（v1.78）**：`seas_world.json` 存 58 个海域名与手选中心点（等级 1 洋 / 2 海 / 3 湾·海峡），
样式层 `sea-label` 在 z3–8 用大写 + 0.14–0.24 字距、水路蓝 `#6f8fa0` + 纸色光晕，`symbol-sort-key` 让洋先排；
碰撞交给 MapLibre（`text-allow-overlap: false`），同屏只留放得下的名字。归「地名标注」叶，两个图种都可见。

**地名语言（v1.86）**：`places` 与 `water` 的 `text-field` 由语言档决定，回退链
`name:zh-Hans → name:zh-Hant → names_zh.json → name:en → name`；EN 档 `name:en → name`；
本地名档保留底图原表达式（按 `baseIdOf` 从 `base.style.json` 回填）。`names_zh.json` 为
**1,371 条居民地 + 33 条河流**（人工 150 条 + `Tools/bake_names_zh.mjs` 从 Wikidata 补 1,221 条，
同名冲突跳过），覆盖富尔达热点与全球低倍地名；海名 58 条在 `seas_world.json`
第 5 项带中文名。切换只改符号层 `text-field`，不重建样式；默认中文，记 `localStorage['map.lang.v1']`。
汉名河流由新增的 `water_label` 层绘制（z10–17，沿线上字，绑**当前缩放所在 tier**；绑最细 tier 会取到
`fulda_core` z14–15，z13 查询为空）。
汉字不请求字形分片——MapLibre 6 的 `localIdeographFontFamily`（默认 `sans-serif`）走本机字形。

## 八、性能

| 场景 | 实测 |
| --- | --- |
| 单帧绘制 | 0.6 ms |
| 静态层重建 | 17 ms |
| 拖动 / 缩放 | 60 FPS |

真实瓶颈是**瓦片请求**而不是绘制：`pmtiles://` 按视口做 Range 读取，图层数量（每层一套）会
线性增加请求。目前 7 层 × 约 65 图层（454 个 style 图层）仍稳定。

## 九、历史方案（已废弃）

以下为 v1.23 之前的设计，**代码已删除**，仅存档备查：

- Canvas 2D 战场渲染器（22,085 路段 / 97 城镇 / 60 FPS）；
- 城镇区划型地块（`bake_blocks.py`）+ 连当量战斗宽度；
- 巷战梯队（连/排/班）+ 命令下发 + 按班结算伤亡（git v1.22）。

废弃原因：信息密度撑不起一个视图，观感不理想；把资源集中到世界地图。

## 十、待办

1. **全球低倍铁路已铺满**（v1.74）：`rails_world_coarse` z1–3 / `rails_world_fine` z3–16（z12 后降透明），
   德国/富尔达 bbox 内由烘焙线接管；再往上要「城际弯曲准确」需按国家切 z11–12 包（每国数百 MB），
   并把裁剪范围扩展成该国的 `rails_<key>.json`。
2. L1 大区包（欧洲各走廊）实做与观感验证。
3. **国名 / 海洋名标签**：海洋名已补（v1.78，58 条，z3–8）；国名沿用底图 `places`。更细的海区分名（如「波罗的海北部」）与海峡名后续按需再加。
4. **等高线**：全球 1000 m（z4–10）已铺满，中欧 + 喜马拉雅/扎格罗斯/安第斯/落基山/东非裂谷 500 m（z7–10），
   德国 200 m、富尔达 25 m；想再加密到 200 m/100 m 需先补 z8+ 区域 DEM（全球 z6 已是预算上限）。
5. 桥隧、机场、军事用地符号（`roads.is_bridge` / `landuse.aerodrome|military` 属性已可取）。

## 十一、城区影响（无格设计）

**地块已撤销。** 走格子会把棋局拉回"占格子"的普通兵棋，而且格子本身不产生任何战术含义。
改成：**城市是一个连续影响场**——部队在城区里就吃到一组修饰，没有格子、没有占领状态、
没有几何数据。世界地图上不画任何格线。

### 1. 影响场

| 项 | 取值 |
| --- | --- |
| 数据 | `data/cities.json`（全世界 5,615 城 / 145 KB 含名）+ `cities_<区域>.json`（区域居民点） |
| 半径 | `r = clamp(8·√pop, 400 m, 40 km)`；无人口记录的居民点按类型给 1.2 / 2.5 km |
| 强度 | `t = clamp(1 − d / (1.25·r), 0, 1)`：城心 1，1.25r 处归零，连续衰减，没有台阶 |
| 规模 | `k = clamp(0.55 + r/16000, 0.55, 1.35)`：大城更狠，小镇更轻 |
| 生效值 | 表值 × t × k |

乡村不需要任何处理：`t = 0`，自然没有修饰。

### 2. 修饰表（城心、k = 1 的满值）

| 项 | 值 | 理由 |
| --- | --- | --- |
| 机动 | **−30%** | 街巷、拥堵、废墟、桥梁与路口瓶颈 |
| 防御 | **+25%** | 掩蔽、工事、制高点，交战距离短 |
| 侦察 | **−25%** | 遮蔽多、视界受限 |
| 炮兵 | **−35%** | 城市化目标、附带损伤顾虑、射界受限 |
| 补给 | **+20%** | 兵站、仓库、铁路枢纽 |

富尔达（r≈3.0 km、城心 t≈0.97）实测：机动 −22% / 防御 +18% / 侦察 −18% / 炮兵 −25% / 补给 +14%。

### 3. 与"占领"的关系

不做占领、不做控制度累积：**单位在哪，影响就在哪生效**。离开城区即恢复，
不需要格号、不需要存档里的归属表。

### 4. 城区渲染（纯灰块）

城区不画纹理、不描边，**一块纯灰**就是"这里有城市"：

| 层 | 颜色 | 说明 |
| --- | --- | --- |
| `landcover urban_area` | `#b9b3a7` | 低倍建成区（软色块） |
| `landuse residential` | `#c2bcb1` | 居住区 |
| `landuse commercial / industrial / retail` | `#b9b3a8` / `#b0aaa0` / `#bdb7ac` | 商业、工业、零售 |
| `landuse` 学校 / 医院 / 铁路 | 同灰系 | 也算城区 |
| `buildings` | `#9f998f` | 建筑，比底灰再深一档；z14+ 另加 2–3.2 px 同灰描边把街区连成一片 |
| 城区描边 | `#b9b3a7` | 给 `landuse` 城区多边形加 4–16 px 同色描边（膨胀），糊住 OSM 数据缺口 |
| 公园 / 林地 / 农田 | 保持绿与米色 | 不做灰，用来区分"城里也有绿地" |

灰度是刻意的：绿=植被、米=农田、**灰=城区**，一眼能分。

**灰块的数据分层（v1.82 校准）**：瓦片里只有 `world`（z0–6）带 `landcover`，`world8` / `world9` / 区域包都只有 `landuse`。
所以灰块实际是两段：z3–6 靠 `landcover urban_area`，**z7 起靠 `landuse` 的居住/商业/零售/铁路面**（`minzoom` 从 8 降到 7，
补上此前整档为空的 z7）。这些自定义填充层原来只写 `maxzoom: tier.styleMax`、`minzoom` 保留原值，于是
低倍会同时请求细包、z8–9 两层 residential 叠画——现在统一按 tier 的 `[styleMin, styleMax]` 裁剪，
每个缩放只有一层在画。建筑轮廓（`buildings`）只有区域包有数据（德国 z13 / 富尔达 z14–15），
其余地区只有灰块面，这是数据边界，不是样式问题。

### 4.1 建筑从哪来

区域包 maxzoom 13：**z13 单瓦片只有约 10 栋建筑**（只放大的），所以高倍其实没有房子。
补一个 **城区核心包** `fulda_core.pmtiles`（bbox 0.12°×0.12°、z14–15、**3.2 MB**）：
z15 单瓦片 **1,807 栋建筑**，tier 系统自动在 z14+ 接管，前端不改一行。
按城市批量产出这种小包（每城 3 MB 级）比整区域上 z15 便宜得多。

v1.89 起已批量化：`Tools/add_core.mjs` 一步完成「切 z14–15 → 建筑密度 → 设施气泡 → 登记索引」，
现有 **13 个 core 包**（富尔达 3.2 MB + 柏林 12.2 / 慕尼黑 9.3 / 汉堡 7.9 / 科隆 8.3 /
法兰克福 7.0 / 卡塞尔 5.3 + 维也纳 11.6 / 布拉格 10.3 / 华沙 11.6 / 布达佩斯 7.5 /
阿姆斯特丹 14.4 / 苏黎世 8.0，合计 118 MB），全部来自本地母包、烘焙期不联网。

### 5. 城区战损

城市可以被打坏。每城存一个等级 1–3（`localStorage['city.damage.v1']`），
渲染时取该城半径内的城区地块（`landuse` 的居住/商业/工业/铁路/医院/学校等），
**按地块质心哈希挑一部分受损**——不是整城糊一层，而是"这一片街区没了、隔壁还在"：

| 等级 | 受损地块比例 | 表现 |
| --- | --- | --- |
| 1 | 34% | 稀斜纹 rubble（12 px canvas 图案，alpha 120） |
| 2 | 62% | 同图案，alpha 0.6 |
| 3 | 92% | 密斜纹 rubble-heavy，alpha 0.8 |

受损地块叠 `fill-pattern` 斜纹 + 红色虚线描边（`#8a3a2b`，`[2,2]`）。图案在运行时用 canvas 生成，
不带任何图片资源。

操作：顶部「战损」开关 → 单击城区 +1 级、Shift+单击清零。目前是**手动标记**，
等战斗解算落地后由战果驱动。

### 5.1 图层树

界面上每个要素都能单独开关，按一级标题分组（组开关 = 全选子项）：

| 组 | 子项 |
| --- | --- |
| 地形 | 晕渲 / 等高线 / 坡度通行 |
| 水系 | 水域 · 河流 |
| 交通 | 铁路 / 主干公路 / 次要道路 / 机场 · 跑道 |
| 居民地 | 城区灰块 / 建筑物 / 地名标注 |
| 行政 | 行政边界 |
| 地表 | 林地 · 农田 · 绿地 |
| 军事 | 军事用地 / 城区战损 |
| 判读 | 军用格网 / 射程圈 / 设施气泡 |

树定义在 `store.ts` 的 `LAYER_TREE`；`groupOf()` 把 style 图层映射到叶子，运行时图层（战损、射程圈）走各自的可见性接口。
v1.67 起树折叠进「高级图层」面板（默认收起），日常切换用图种（§十二）。

### 6. 界面

光标进入城区 → 右下角面板显示：

```
城区影响 · Fulda
强度 97% · 半径 3.0 km
机动 −22%  防御 +18%  侦察 −18%
炮兵 −25%  补给 +14%
```

增益用暖绿、减益用砖红，只在有影响时出现，不占常驻版面。

### 7. 待接线

修饰目前只是读数，还没有接进移动/交战解算（单位尚无数值模型）。下一步：
单位落入城区 → 移动力与交战表引用这五个系数；城市规模直接决定巷战强度。

### 8. 明确不做

- 不做地块 / 格子 / 单元格（v1.28 的实验已删除，勿复辟）；
- 不做控制度累积、士气、补给线网络；
- 不做"按轮廓切多边形"（数据依赖 + 体积 + 不可复现，三样都不划算）。

## 十二、图种（v1.67）

地图按判读目的分两种图种，切换走**差量更新**（可见性 + setPaintProperty 强度），不重建样式、无跨档停顿：

| | 地势·交通图（默认） | 用地·政区图 |
| --- | --- | --- |
| 对应传统 | 1:50k 军用地形图：地形与机动判读 | 政区/城市图：居民地、设施、行政 |
| 底 | **高程分层设色**（`color-relief` 16 级色阶：绿→黄→橙→褐→雪线白，按档等高距对齐，0.88）+ 晕渲加强 + 等高线加强 | 地表全量 + 城区灰块 + 建筑/密度瓦片 |
| 水系 | 河流线宽 ×1.3 | 基线 |
| 交通 | 铁路 + 主干公路 + 跑道；次级隐藏 | 铁路 + 全级公路 |
| 行政 | 国界 0.55，州县乡 0.12 | 四级全开 0.8 |
| 居民地 | 只留地名：灰块 / 建筑 / 设施面 / 气泡全不画（图册式） | 灰块 + 建筑 + 站场/医院/厂区/机场/港口面 + 气泡 |
| 判读 | 格网 / 读数 / 射程圈常驻（红线，两档一致） | 同左 |

实现规则：

- 图种 = {可见性表, 强度规则表}，定义在 store.ts 的 PERSONAS；规则按图层 base id 前缀匹配
  （ruleHits）+ 属性族过滤（propFits：line-*/fill-*/hillshade-*/text-*/circle-*），* 通配晕渲 exaggeration；
- 基线表达式是唯一样式事实源：tokens/contour/widths 导出基线（CONTOUR_* WATER_WIDTH
  LANDCOVER_FILL_OPACITY LANDUSE_FILL_OPACITY BOUNDARY_OPACITY HILLSHADE_EXAGGERATION），
  样式装配与用地图规则引用同一常量——用地图规则 = 基线回填，地势图规则 = 强化值；
- 强度随 paintSig(key|epoch) 差量应用：跨档重建样式后自动重放；custom 模式强度沿用上一个图种；
- 分层设色层 id 为 `relief-tint__<dem>`（`color-relief`），归到「晕渲」叶（`groupOf` 认识 `relief-tint`），用地图关晕渲后它一起关；强度规则按 base id `relief-tint` 命中，只改 `color-relief-opacity`；
- z8 以下用地档自动退化（landuse/建筑本就按 minzoom 出现），两档在小尺度收敛为地势图。
