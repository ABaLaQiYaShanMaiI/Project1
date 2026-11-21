# 战术地图军棋 · 世界军事地形图

离线冷战世界地图。全球矢量底图 + 区域高精度细节 + 军事地形叠加（晕渲 / 等高线 / 交通线分级 /
铁路 / UTM 军用格网 / 射程圈）。**运行时零联网**，全部数据在本地。

---

## 方针（v1.0 起生效）

1. **只做世界地图。** 战场视图（区域沙盘、城镇地块、巷战解算）已于 v1.24 整体删除，
   代码不再保留；历史实现见 `DEVLOG.md` v1.24 与 git 提交 v1.22。
2. **分层采纳，永不追求全球高精度。** 全世界用低倍矢量包铺满，细节按区域逐个叠加：

   | 层 | 范围 | 缩放 | 体积 | 作用 |
   | --- | --- | --- | --- | --- |
   | L0 全球 | 全世界 | z0–z6 | 42 MB | 大洲、国界、主要道路与铁路、城市 |
   | L1 全球 | 全世界 | z7–z8 | 476 MB | 村镇级标注与路网 |
   | L1b 全球 | 全世界 | z9–z10 | 2.99 GB | 街区级路网与更密地名 |
   | L2 国家 | 13 国（上述九国 + 法/西/葡/意） | z11–z12 | 3.03 GB | 街区级路网、用地、行政界 |
   | L2b 热点 | 德国（含 z13） | z11–z13 | 1.60 GB | 街区与 z13 建筑 |
   | L3 城区核心 | 13 城 | z14–z15 | 118 MB | 真实建筑与街道 |

   层级由 `zonesInBounds()` + `tierBands()` 自动装配：**后一层从上一层的 maxzoom+1 接管**，
   加一个区域包就多一层细节，前端不用改。区域包同时在场最多 5 个（`MAX_REGION_TIERS`），
   超出按 maxzoom 丢弃最低倍包。
3. **离线优先。** 底图、高程、字体、等高线一律本地文件；不请求任何第三方服务。
4. **军事判读优先于装饰。** 只强调主干交通与铁路；次要道路淡化并在 `minzoom 13` 后才出现，
   避免干扰读图。常驻 UTM 格网、高程/坡度/坡向读数、射程圈。
5. **代码无注释、单一事实源。** 说明文字只写进文档（`CONSTRAINTS.md` §1）。

## 环境

| 依赖 | 版本 | 位置（本机） |
| --- | --- | --- |
| Node.js | ≥ 18（当前 v26.13.1 LTS） | `D:\Tools\node`（便携版，已进用户 PATH） |
| pnpm | 11.8.0 | `D:\Tools\npm-global`（npm 全局装） |
| Python | 3.13 + numpy / Pillow / requests / openpyxl | `D:\Python313` |
| pmtiles CLI | 随仓库 | `Tools\bin\pmtiles.exe` |

npm 缓存与 pnpm store 都不在 C 盘：`npm config get cache` → `D:\Tools\npm-cache`，
`pnpm store path` → `G:\.pnpm-store`。装完 Node 后需要**新开一个终端**才生效。

## 启动

```bash
# 双击 启动游戏.bat，或
cd app && pnpm install && pnpm dev
```

打开 <http://127.0.0.1:5183/>。**不要直接双击 `app/index.html`**：`file://` 下模块与 `fetch`
会被拦，必然白屏。

## 现在有什么

| 图层 | 数据 | 说明 |
| --- | --- | --- |
| 全球矢量 | `tiles/world.pmtiles` | z0–z6，全世界都有图 |
| 全球 z7–8 | `tiles/world8.pmtiles` | z7–z8 全世界（476 MB），村镇级标注与路网 |
| 全球 z9–10 | `tiles/world9.pmtiles` | z9–z10 全世界（3.0 GB），街区级路网与更密地名 |
| 区域矢量（德） | `tiles/germany.pmtiles` | 德国 z11–12（689 MB），街区级路网与地名 |
| 区域矢量（德 z13） | `tiles/germany13.pmtiles` | 德国 z13（879 MB），与富尔达同源细节 |
| 区域矢量 | `tiles/fulda.pmtiles` | 富尔达 bbox 内的 OSM 细节，z9–13 接管 |
| 国家矢量（13 国） | `tiles/<country>.pmtiles` | **奥地利 / 捷克 / 瑞士 / 荷兰 / 比利时 / 丹麦 / 斯洛伐克 / 匈牙利 / 波兰 / 法国 / 西班牙 / 葡萄牙 / 意大利** z11–12（合计 **3.03 GB**），街区级路网与用地；各带 `rails_` / `poi_` / `cities_` |
| 城区核心 | `tiles/fulda_core.pmtiles` + 12 个城市核心包 | 富尔达镇区 0.12°×0.12°、z14–15（3.2 MB）；另有**柏林 / 慕尼黑 / 汉堡 / 科隆 / 法兰克福 / 卡塞尔 / 维也纳 / 布拉格 / 华沙 / 布达佩斯 / 阿姆斯特丹 / 苏黎世**（合计 118 MB），高倍真实建筑 + 密度 + 气泡 |
| 全球晕渲 | `dem/world` z0–z5（86 MB） | 世界任何位置都有地形起伏 |
| 全球 z6 晕渲 | `dem/world6` z6（203 MB） | z6 起全球 2.4 km 级高程；此前跳出中欧就是 z5 的 16–32 倍 overzoom（v1.75 补烘） |
| 大区晕渲 | dem/europe z6–z9（151 MB） | 中欧 0–24.5°E / 44–58°N，由 dem/world8 清单别名复用；**europe 档从 z7 接管**，z6 交给 world6；z9 中欧（德国之外）用原生 z9，不再是 z8 overzoom |
| 区域晕渲 | `dem/germany` z9–z11（520 MB） | 德国全域；z9–10 此前是 z5 的 16–32 倍 overzoom（v1.70 补烘） |
| 富尔达晕渲 | `dem/fulda` z9–z11 | 富尔达精细晕渲（现由 germany 档覆盖，保留作回退） |
| 坡度通行 | `slope/world` z0–z5、`slope/world6` z6、`slope/europe` z6–z9、`slope/germany` z9–z11、`slope/fulda` z9–z11 | DEM 差分 → 6 级着色（<3 / 3–8 / 8–15 / 15–25 / 25–35 / >35%），档间互斥（0/6/7/9）；**地势图默认开启** |
| 等高线 | `contours_*` | **五级阶梯**：1000 m（z4–7 全球）/ 1000 m（z7–10 全球，挖掉 20 个 500 m 区）/ 500 m（z7–10，共 19 区：中欧 · 喜马拉雅 · 扎格罗斯 · 安第斯 · 落基山 · 东非裂谷 · 喀尔巴阡 · 斯堪的纳维亚 · 乌拉尔 · 高加索 · 阿尔泰 · 阿特拉斯 · 德拉肯斯堡 · 日本阿尔卑斯 · 中美洲 · 比利牛斯 · 新几内亚 · 马达加斯加 · 新西兰 · 婆罗洲）/ 200 m（z10–13 德国）/ 25 m（z13+ 富尔达）；计曲线 2–3× 粗 + 沿线上字；一档只画一套；平移换山系时 `moveend` 增量补载；烘焙按 `asinh(tan(lat))` 重采样成线性纬度网格 |
| 分层设色 | `dem/*`（terrarium） | `color-relief` **彩色色阶**：绿（低地）→ 黄 → 橙 → 褐 → 雪线白，共 16 级；各档按自己的等高距取步长（world / world6 200/500/1000、europe 250/500/750、germany 100/200/300），地势图 0.88 不透明；水系面在设色之上 |
| 交通线 | 底图 `roads` | 高速/干线/主干**同级不同色**（1.2 px），**z7 起全球出现**（z7 0.45 透明细线 → z10 满强度 0.9）；次级 z12（城区大路）；生活道路 z11；支路 z12；跳出区域包后由世界瓦片层 overzoom 撑到 z22（v1.74 修掉跨档被压回 z11 的回写缺陷）；**z4–6 由 NE 1:10m 主干骨架补位**（`roads_world.json`，18,806 段 / 3.4 MB，z7 交瓦片） |
| 河流（低倍） | `rivers_world.json` | NE 1:10m 河网（River + Lake Centerline，2,252 段 / 3.05 MB），**z3–8 补位**（底图河流 z9 才出现）；按 scalerank 分三档线宽，z9 交瓦片 |

| 铁路 | `rails_fulda.json` + `rails_germany.json` + 底图 `roads:kind=rail` | **陆路交通核心**：墨色实线 + 白色枕木，压所有公路之上；z3–11 用烘焙层（germany 全境 + fulda 细档，合并时细包让位），z11 起用瓦片；NE 全球层分两档（`rails_world_coarse` z1–3 无光晕 / `rails_world_fine` **z3–17 满不透明**，与瓦片铁路同三层同宽度），**z1 起一路有铁路、缩小不会成片消失、放大到 z17 也不变淡**；NE 细档按端点串联 + 400 m 桥接重烘（8,411 段 / 平均 21 点），并画在等高线之上；NE 裁剪只按真有 `rails_<key>.json` 的区域包 |
| 军用格网 | 运行时 UTM / 经纬网 | **z≥7** 单带 UTM（1/2/5/10/25/50/100/200/500/1000 km 自适应），线端标注里程 km、左上注带号（如 `32U`）；**z<7** 切经纬网（1/2/5/10/15/30°），边注 `45°N` / `15°E`；归「格网」叶 |
| 射程圈 | 运行时 | 单击放中心，5 级同心圆 |
| 设施气泡 | `poi_fulda.json` + `poi_world.json` | 机场 z5+ / 港口 z4+（全球 Natural Earth）/ 桥隧 z11+（仅富尔达） |
| 海域名 | `seas_world.json` | 5 大洋 + 32 海 + 21 湾/海峡（人工整理中心点，第 5 项为中文名），z3–8 大写 + 字距，随「地名标注」开关；中文档显示中文名 |
| 地名语言 | 瓦片 `name:zh-Hans` + `names_zh.json` | 顶部三档（**中文**（默认）/ EN / 本地名）：`name:zh-Hans → name:zh-Hant → 人工/ Wikidata 词表 → name:en → 本地名`；词表 **1,371 条居民地 + 33 条河流**（人工 150 + Wikidata 烘焙 1,221），覆盖富尔达热点与全球低倍地名；河流由 `water_label` 层在 z10+ 沿线上字；切换只改 `text-field`，不重建样式 |
| 字形 | `tiles/glyphs/{fontstack}/{range}.pbf` | `Noto Sans Regular` + `Noto Sans Devanagari Regular v1` 各 256 片（0–65535，共 12.3 MB），西里尔/希腊/阿拉伯/天城文地名可画；**CJK 区间是空片，中日韩地名仍缺字** |
| 全球城区面 | `urban_world.json` | NE 1:10m 建成区面，z4–14 铺在底图上 |
| 城区灰块 | 底图 `landcover` / `landuse` | 城区纯灰色块（居住/商业/零售/铁路/工业等合并），绿=植被、米=农田、灰=城区；**z3–6 用 `landcover urban_area`，z7 起由 `landuse` 居住/商业面接管**（v1.82 起按 tier 裁剪、不再叠画）；建筑轮廓只有区域包有（德国 z13 / 富尔达 z14–15），其余地区是灰块面 |
| 行政边界 | 底图 `boundaries` | 国界/州/县/乡镇四级，冷灰虚线，按 `kind_detail` 分级 |
| 城区战损 | 运行时图案 | 1–3 级战损：按街区哈希挑一部分地块叠 rubble 斜纹 + 红虚线；顶部「战损」开关单击标记 |
| 城区影响 | `data/cities.json` | 光标进城区显示机动/防御/侦察/炮兵/补给修饰，按距离连续衰减，无格子 |

> 若 `tiles/world.pmtiles` 尚未烘焙，世界视图只在富尔达 bbox 内有图，其余靠 DEM 晕渲；
> 左栏「底图」面板会显示当前装载了哪些层。

## 操作

- 拖动平移 / 滚轮缩放 / 双击放大；
- 顶部工具条：**格网**、**射程圈**（选中后单击放中心，左下滑块调圈距）、当前 FPS；
- **地名语言**：顶部三档「中文 / EN / 本地名」，默认中文并记 `localStorage`；
  中文档优先瓦片自带 `name:zh-Hans`，缺了查 `names_zh.json`，再退英文与本地名（海名同步切中文）；
- **界面语言**：同一档位驱动 UI 文案（`app/src/i18n.ts`，中/英）；`本地名` 档界面仍为中文；
- **城区影响**：光标进入城区，右下角出现面板（城名 / 强度 / 半径 / 五项修饰 / 战损级别）；离开即消失；
- **战损**：顶部「战损」开关，单击城区 +1 级（最高 3 级），Shift+单击清零；存 localStorage；
- 左下读数：**DD 经纬 / UTM（带号 + 东向 + 北向）/ 高程 / 坡度 / 坡向**；
- 左侧顶部「图种」两档（**地势·交通图**（默认）/ **用地·政区图**），切换走差量更新
  （可见性 + 强度参数，几十毫秒、不重建样式）；地势档走图册式：**高程分层设色（绿→黄→橙→褐→雪线白）**
  + **坡度通行** + 晕渲加强 + 等高线加强 + 河流加粗 + 铁路/主干公路，
  **城区灰块、建筑、设施面与气泡全部不画**，次级道路隐藏，国界弱化；
  用地档：地表全量 + 灰块建筑 + 全级路网 + 四级行政界 + 设施气泡，等高线默认关；
- 「高级图层」折叠面板逐项开关（18 叶，默认收起），手动改会退出当前图种；
  「兵牌」可在地图放标记（拖动移动、右键删除）。
- 「图种」面板里的 **跨级显示细节**：开启后主干/次级道路、跑道与设施气泡不受各自起始缩放限制，
  缩到任意比例尺都保留（默认关；关闭即按原区间还原）。

## 数据管线

新区域一把跑完（dem → contours → rail → poi → slope → cities）：

```bash
node Tools/bake_region.mjs --key=fulda --bbox=8.849,50.240,10.591,51.000 --zmin=9 --zmax=11
```

一条命令替代 #2 与 #4–#8（zoom 自动推导、失败回滚、manifest 登记）：

```
node Tools/add_region.mjs --name=berlin --bbox=13.0,52.3,13.8,52.7 --label=柏林
```

单个城区核心包（z14–15 建筑 + 密度 + 气泡，从本地母包离线切，不联网）：

```
node Tools/add_core.mjs --key=berlin_core --label=柏林 --bbox=13.345,52.46,13.465,52.58
```

按 `Tools/data_manifest.json` 校验产物，`--fix` 重跑重建：

```
node Tools/restore.mjs [--name=...] [--fix]
```

# 1) 全球矢量包（z0–z6，约 44 MB）
#    有本地母包时用 --source，全程离线、约 2 秒：
node Tools/fetch_basemap.mjs --key=world --world --source="E:\PersonalGame\v4.pmtiles"

# 2a) 全球 z7–8（476 MB，从母包离线切，约 20 秒）
Tools\bin\pmtiles.exe extract "G:\PersonalGame\v4.pmtiles" "app\public\data\tiles\world8.pmtiles" --bbox=-180,-85,180,85 --minzoom=7 --maxzoom=8
Tools\bin\pmtiles.exe extract "G:\PersonalGame\v4.pmtiles" "app\public\data\tiles\world9.pmtiles" --bbox=-180,-85,180,85 --minzoom=9 --maxzoom=10

# 2) 区域矢量包（示例：富尔达，z0–z13，约 42 MB）
node Tools/fetch_basemap.mjs --key=fulda --bbox=8.849,50.240,10.591,51.000 --name=富尔达缺口

# 3) 全球晕渲（z0–z5，约 86 MB）
python Tools/bake_dem.py --bbox=-180,-85,180,85 --key=world --zmin=0 --zmax=5

# 3b) 全球 z6 晕渲（z6 单档；z6 以上全球地形不再用 z5 overzoom）
python Tools/bake_dem.py --bbox=-180,-85,180,85 --key=world6 --zmin=6 --zmax=6

# 4) 区域晕渲（z9–z11，约 15 MB）
python Tools/bake_dem.py --bbox=8.849,50.240,10.591,51.000 --key=fulda --zmin=9 --zmax=11

# 5) 等高线矢量（需要该区域 DEM 已烘好；等高距按缩放的阶梯见 MAPDESIGN §五）
python Tools/bake_contours.py --key=fulda --bbox=8.849,50.240,10.591,51.000
python Tools/bake_contours.py --key=germany --bbox=5.8,47.2,15.1,55.1 --interval=200 --bold=400 --tol=120 --min-km=2 --grid=3000
python Tools/bake_contours.py --key=europe --bbox=0,44,20,56 --interval=500 --bold=1500 --tol=400 --min-km=6 --grid=2400
python Tools/bake_contours.py --key=world --dem=world --bbox=-180,-85,180,85 --interval=1000 --bold=2000 --tol=1500 --min-km=20 --grid=3600
python Tools/bake_contours.py --key=world_mid --dem=world --bbox=-180,-85,180,85 --exclude=0,44,20,56;65,20,105,45;35,25,62,42;-80,-55,-58,12;-130,25,-100,55;28,-15,46,15 --interval=1000 --bold=2000 --tol=1500 --min-km=20 --grid=3600
python Tools/bake_contours.py --key=asia_himal --dem=world6 --bbox=65,20,105,45 --interval=500 --bold=1000 --tol=700 --min-km=6 --grid=2600
python Tools/bake_contours.py --key=zagros --dem=world6 --bbox=35,25,62,42 --interval=500 --bold=1000 --tol=700 --min-km=6 --grid=2400
python Tools/bake_contours.py --key=andes --dem=world6 --bbox=-80,-55,-58,12 --interval=500 --bold=1000 --tol=700 --min-km=6 --grid=2600
python Tools/bake_contours.py --key=rockies --dem=world6 --bbox=-130,25,-100,55 --interval=500 --bold=1000 --tol=700 --min-km=6 --grid=2400
python Tools/bake_contours.py --key=africa_rift --dem=world6 --bbox=28,-15,46,15 --interval=500 --bold=1000 --tol=700 --min-km=6 --grid=2000

# 6) 坡度通行瓦片（需要对应 DEM 已烘好；产物按分类着色，不是高程）
python Tools/bake_slope.py --key=world
python Tools/bake_slope.py --key=world6
python Tools/bake_slope.py --key=fulda

# 7) 低倍铁路层（底图 z10 以下没有 rail，必须单独烘）
node Tools/bake_rail.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=11 --out=app/public/data/rails_fulda.json

# 8) 城区核心包（z14–15，高倍真实建筑；每城 3 MB 级）
Tools\bin\pmtiles.exe extract "E:\PersonalGame\v4.pmtiles" "app\public\data\tiles\fulda_core.pmtiles" --bbox=9.615,50.492,9.735,50.612 --minzoom=14 --maxzoom=15

# 9) 城镇索引（城区影响场的唯一数据：全世界 5,615 座城 / 145 KB）
node Tools/bake_cities.mjs
node Tools/bake_cities.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=13 --kinds=city,town,village --out=app/public/data/cities_fulda.json

# 10) 设施气泡（机场 / 桥隧点位，判读组可开关）
node Tools/bake_poi.mjs --zoom=12

# 11) 全球铁路 / 主干道路 / 河网 / 机场 / 港口 / 城区面（Natural Earth 1:10m，一次性）
python Tools/bake_ne_rails.py
python Tools/bake_ne_roads.py
python Tools/bake_ne_rivers.py
python Tools/bake_ne_urban.py
```

产物、生成命令与入库策略对账表：

| 产物 | 生成命令 | 入库 |
| --- | --- | --- |
| `tiles/*.pmtiles`、`tiles/index.json`、`base.style.json`、`glyphs/` | `node Tools/fetch_basemap.mjs`、`Tools\bin\pmtiles.exe extract`；只补字形用 `node Tools/fetch_basemap.mjs --glyphs-only=1` | 否（体积大） |
| `dem/<key>/{z}/{x}/{y}.png` + `index.json` | `python Tools/bake_dem.py` | 否（体积大） |
| `slope/<key>/{z}/{x}/{y}.png` + `index.json` | `python Tools/bake_slope.py` | 全部入库（含 germany 区域包，约 46 MB；v1.55 起不再忽略） |
| `contours_<key>.json` | `python Tools/bake_contours.py` | 是 |
| `rails_<key>.json` | `node Tools/bake_rail.mjs` | 是 |
| `poi_<key>.json` | `node Tools/bake_poi.mjs` | 是 |
| `cities.json`、`cities_<key>.json` | `node Tools/bake_cities.mjs` | 是 |
| `names_zh.json`（中文地名词表） | 手工维护 + `node Tools/bake_names_zh.mjs`（Wikidata CC0） | 是（1,371 居民地 + 33 河流） |

`tiles/` 与 `dem/` 不入库（体积大），换机器重跑对应命令即可；其余产物（含 `slope/`）全部入库，
换机器直接 checkout 即可，无需重烘。

烘焙完数据后要 `cd app && pnpm build`（服务读的是 `app/dist`），再刷新页面。

## 目录

| 路径 | 说明 |
| --- | --- |
| `app/src/WorldMapLibre.tsx` | 世界地图主体：tier 装配、图层开关、格网、射程圈、读数 |
| `app/src/data/militaryStyle.ts` | 军事地形样式装配：源与图层的先后顺序、去重 |
| `app/src/data/style/` | 样式分件：`tokens` 全部色值唯一事实源 / `restyle` 底图改写 / `tier` 分层复制 / `rail` `boundary` `contour` `overlay` / `widths` 线宽插值 |
| `app/src/data/railsWorld.ts` | NE 全球铁路装载时按「有烘焙铁路的区域包」bbox 做分段裁剪（区域外才显示概化线） |
| `app/src/data/pmtilesBasemap.ts` | Pmtiles 协议、`index.json`、`zonesAt()` / `tierBands()` |
| `app/src/data/terrain.ts` | DEM 采样（高程 / 坡度 / 坡向） |
| `app/src/core/geo.ts` | UTM 正算、格网生成、射程圈 |
| `app/src/core/cityEffects.ts` | 城区影响：半径、衰减、规模系数、五项修饰 |
| `app/src/map/measure.ts` | 测距纯函数：距离 / 方位 / 密位 / 高差 / 剖面 + 线图层 |
| `app/src/ui/MeasurePanel.tsx` | 测距面板（React）：按钮、两点状态、统计与剖面渲染 |
| `app/src/map/cityDamage.ts` | 城区战损：canvas 斜纹图案、按街区哈希、idle 刷新 |
| `app/src/data/damageStore.ts` | 战损等级存档（`city.damage.v1`） |
| `app/src/data/cities.ts` | 城镇索引（base64 二进制 + 0.5° 桶索引，含名字） |
| `Tools/bake_cities.mjs` | 从 PMTiles 的 `places` 点烘城镇索引 |
| `Tools/mvt.mjs` | 零依赖 MVT 解码（烘焙期用，zigzag 几何） |
| `Tools/bake_rail.mjs` | 从区域包抽低倍铁路线（RDP 简化 + 去重） |
| `Tools/bake_ne_roads.py` | 从 Natural Earth 1:10m 道路抽全球主干骨架（Major/Secondary，米制 300 m 容差） |
| `Tools/bake_ne_rivers.py` | 从 Natural Earth 1:10m 河网抽低倍河流（River + Lake Centerline，按 scalerank 分档） |
| `Tools/bake_poi.mjs` | 从区域包抽机场/桥隧点位（设施气泡） |
| `Tools/fetch_basemap.mjs` | 取 CLI → 裁 bbox 或全球 → 出 style / 字形 / index |
| `Tools/add_region.mjs` | 一条命令新增区域：矢量裁剪 + 7 步烘焙 + 失败回滚 + manifest 登记 |
| `Tools/restore.mjs` | 按 manifest 校验产物，`--fix` 重跑重建 |
| `Tools/data_manifest.json` | 区域产物台账（sha256 / 目录规模），restore.mjs 的输入 |
| `Tools/style_snapshot.mjs` | 样式输出快照（tsc 编译 militaryStyle → 固定输入 → sha256），样式重构护栏 |
| `Tools/bake_dem.py` | DEM 瓦片（terrarium） |
| `Tools/bake_slope.py` | 坡度通行瓦片（DEM 差分 → 按 `Tools/slope_palette.json` 着色） |
| `Tools/bake_region.mjs` | 一键区域管线：dem → contours → rail → poi → slope → cities |
| `Tools/bake_contours.py` | 等高线矢量（marching squares + 折线缝合 + 标注锚点） |
| `Tools/serve.mjs` | 零依赖静态服务器（含 `.pmtiles` 的 HTTP Range） |
| `Tools/dev_static.mjs` | dev 静态旁路：`/data/` 与 `/ml-worker.mjs`（worker 原样字节，避免 Vite 注入 HMR） |
| `Tools/perf_probe.mjs` | 帧率与静态重绘实测（CDP 拖动 + render 间隔统计；`--strict` 可当闸门） |
| `Tools/check_all.mjs` | 一键自检：无注释 / 行数 / 类型 / 构建 / 首屏 gzip 预算 |
| `Tools/dev_cdp.mjs` | 三个 dev 脚本共用的 CDP 连接与截图封装 |
| `Tools/dev_mapshot.mjs` | 取 MapLibre 画布真实帧（headless 截图对 WebGL 不可靠）；需对着 `pnpm dev` 跑，生产构建不再暴露 `window.__ml` |

## 数据来源与许可

| 数据 | 来源 | 许可 |
| --- | --- | --- |
| 矢量底图 | Protomaps（OpenStreetMap 派生） | ODbL，需署名 |
| 高程 | AWS Terrain Tiles（SRTM 派生） | 开放数据 |

页面右下角常驻署名。

## 下一步

1. **跨档停顿**：z7/9/11/13/14 跨档会重建样式，1–4 s；需改成「档位互斥 + 动态 zoom-range」。
2. **建筑密度瓦片**：目前只烘富尔达核心 z15，铺到德国 z13–14 收益明确。
3. **全球铁路精度**：NE 1:10m 仍是骨架；若要城际弯曲准确，按国家切 z9–10 包（每国几百 MB）。
4. **等高线**：四档已覆盖全球（1000 m，z4–10）/ 中欧（500 m）/ 德国（200 m）/ 富尔达（25 m）；再往上铺 500 m / 200 m 要先补 z8+ 区域 DEM。
5. 城区影响接进移动/交战解算（单位数值模型落地后）。

## 接手速览（v1.67）

```
读 PITFALLS.md（坑）→ DEVLOG 顶部 v1.64（状态快照）→ 本文「现在有什么」→ MAPDESIGN（设计）
跑 node Tools/check_all.mjs（8 道闸，全绿才算完）
需求台账：Docx/战术地图军棋_需求规格总表_v0.7.xlsx（20 张表，含「20 地图符号规范」）
```

- 图层顺序固定为：面 → 行政界 → 道路 → 铁路 → 等高线 → 注记 → 格网 → 射程圈 → 点位
- 车站不建模备用车道；焦点地块用色块（站场/医院/机场/港口/厂区），定位只用三种气泡
- 电厂/水厂数据缺失，已放弃，不要重复尝试
