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
   | L0 全球 | 全世界 | z0–z6 | ≈ 44 MB | 大洲、国界、主要道路与铁路、城市 |
   | L1 大区 | 按需（欧洲等） | z6–z8 | ≈ 30–60 MB | 战役尺度路网与中小城市 |
   | L2 热点 | 按需（富尔达） | z9–z13 | 42 MB | 二级路、街区、建筑 |

   层级由 `zonesAt()` + `tierBands()` 自动装配：**后一层从上一层的 maxzoom+1 接管**，
   加一个区域包就多一层细节，前端不用改。
3. **离线优先。** 底图、高程、字体、等高线一律本地文件；不请求任何第三方服务。
4. **军事判读优先于装饰。** 只强调主干交通与铁路；次要道路淡化并在 `minzoom 13` 后才出现，
   避免干扰读图。常驻 UTM 格网、高程/坡度/坡向读数、射程圈。
5. **代码无注释、单一事实源。** 说明文字只写进文档（`CONSTRAINTS.md` §1）。

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
| 区域矢量 | `tiles/fulda.pmtiles` | 富尔达 bbox 内的 OSM 细节，z9–13 接管 |
| 城区核心 | `tiles/fulda_core.pmtiles` | 富尔达镇区 0.12°×0.12°、z14–15（3.2 MB），高倍的真实建筑与街道 |
| 全球晕渲 | `dem/world` z0–z5（86 MB） | 世界任何位置都有地形起伏 |
| 区域晕渲 | `dem/fulda` z9–z11 | 富尔达精细晕渲 |
| 等高线 | `contours_fulda.json` | 50 m 等高距 / 250 m 计曲线 + 高程标注 |
| 交通线 | 底图 `roads` | 高速/干线/主干**同级不同色**（1.2 px），z11 起出现；次级 z12（城区大路）；支路 z13 |
| 铁路 | `rails_fulda.json` + 底图 `roads:kind=rail` | **陆路交通核心**：墨色实线 + 白色枕木，最粗、压最上层；z5–11 用烘焙层（底图 z10 以下没有 rail），z11 起用瓦片 |
| 军用格网 | 运行时 UTM | 随缩放切 1/2/5/10/25/50 km |
| 射程圈 | 运行时 | 单击放中心，5 级同心圆 |
| 城区灰块 | 底图 `landcover` / `landuse` | 城区纯灰色块（居住/商业/零售/铁路/工业等合并），绿=植被、米=农田、灰=城区 |
| 行政边界 | 底图 `boundaries` | 国界/州/县/乡镇四级，冷灰虚线，按 `kind_detail` 分级 |
| 城区战损 | 运行时图案 | 1–3 级战损：按街区哈希挑一部分地块叠 rubble 斜纹 + 红虚线；顶部「战损」开关单击标记 |
| 城区影响 | `data/cities.json` | 光标进城区显示机动/防御/侦察/炮兵/补给修饰，按距离连续衰减，无格子 |

> 若 `tiles/world.pmtiles` 尚未烘焙，世界视图只在富尔达 bbox 内有图，其余靠 DEM 晕渲；
> 左栏「底图」面板会显示当前装载了哪些层。

## 操作

- 拖动平移 / 滚轮缩放 / 双击放大；
- 顶部工具条：**格网**、**射程圈**（选中后单击放中心，左下滑块调圈距）、当前 FPS；
- **城区影响**：光标进入城区，右下角出现面板（城名 / 强度 / 半径 / 五项修饰 / 战损级别）；离开即消失；
- **战损**：顶部「战损」开关，单击城区 +1 级（最高 3 级），Shift+单击清零；存 localStorage；
- 左下读数：**DD 经纬 / UTM（带号 + 东向 + 北向）/ 高程 / 坡度 / 坡向**；
- 左侧「图层」逐项开关；「兵牌」可在地图放标记（拖动移动、右键删除）。

## 数据管线

```bash
# 1) 全球矢量包（z0–z6，约 44 MB）
#    有本地母包时用 --source，全程离线、约 2 秒：
node Tools/fetch_basemap.mjs --key=world --world --source="E:\PersonalGame\v4.pmtiles"

# 2) 区域矢量包（示例：富尔达，z0–z13，约 42 MB）
node Tools/fetch_basemap.mjs --key=fulda --bbox=8.849,50.240,10.591,51.000 --name=富尔达缺口

# 3) 全球晕渲（z0–z5，约 86 MB）
python Tools/bake_dem.py --bbox=-180,-85,180,85 --key=world --zmin=0 --zmax=5

# 4) 区域晕渲（z9–z11，约 15 MB）
python Tools/bake_dem.py --bbox=8.849,50.240,10.591,51.000 --key=fulda --zmin=9 --zmax=11

# 5) 等高线矢量（需要该区域 DEM 已烘好）
python Tools/bake_contours.py --key=fulda --bbox=8.849,50.240,10.591,51.000

# 6) 坡度通行瓦片（需要对应 DEM 已烘好；产物按分类着色，不是高程）
python Tools/bake_slope.py --key=world
python Tools/bake_slope.py --key=fulda

# 7) 低倍铁路层（底图 z10 以下没有 rail，必须单独烘）
node Tools/bake_rail.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=11 --out=app/public/data/rails_fulda.json

# 8) 城区核心包（z14–15，高倍真实建筑；每城 3 MB 级）
Tools\bin\pmtiles.exe extract "E:\PersonalGame\v4.pmtiles" "app\public\data\tiles\fulda_core.pmtiles" --bbox=9.615,50.492,9.735,50.612 --minzoom=14 --maxzoom=15

# 9) 城镇索引（城区影响场的唯一数据：全世界 5,615 座城 / 145 KB）
node Tools/bake_cities.mjs
node Tools/bake_cities.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=13 --kinds=city,town,village --out=app/public/data/cities_fulda.json
```

产物、生成命令与入库策略对账表：

| 产物 | 生成命令 | 入库 |
| --- | --- | --- |
| `tiles/*.pmtiles`、`tiles/index.json`、`base.style.json`、`glyphs/` | `node Tools/fetch_basemap.mjs`、`Tools\bin\pmtiles.exe extract` | 否（体积大） |
| `dem/<key>/{z}/{x}/{y}.png` + `index.json` | `python Tools/bake_dem.py` | 否（体积大） |
| `slope/<key>/{z}/{x}/{y}.png` + `index.json` | `python Tools/bake_slope.py` | 是（5.9 MB，缺则「坡度通行」静默不出图） |
| `contours_<key>.json` | `python Tools/bake_contours.py` | 是 |
| `rails_<key>.json` | `node Tools/bake_rail.mjs` | 是 |
| `cities.json`、`cities_<key>.json` | `node Tools/bake_cities.mjs` | 是 |

`tiles/` 与 `dem/` 不入库（体积大），换机器重跑对应命令即可；其余产物体积小且入库，
其中 `slope/` 仍建议换机器后重跑一遍 `bake_slope.py`，以对齐该机的 DEM 版本。

烘焙完数据后要 `cd app && pnpm build`（服务读的是 `app/dist`），再刷新页面。

## 目录

| 路径 | 说明 |
| --- | --- |
| `app/src/WorldMapLibre.tsx` | 世界地图主体：tier 装配、图层开关、格网、射程圈、读数 |
| `app/src/data/militaryStyle.ts` | 军事地形样式装配：源与图层的先后顺序、去重 |
| `app/src/data/style/` | 样式分件：`tokens` 共用色值 / `restyle` 底图改写 / `tier` 分层复制 / `rail` `boundary` `contour` `overlay` / `widths` 线宽插值 |
| `app/src/data/pmtilesBasemap.ts` | Pmtiles 协议、`index.json`、`zonesAt()` / `tierBands()` |
| `app/src/data/terrain.ts` | DEM 采样（高程 / 坡度 / 坡向） |
| `app/src/core/geo.ts` | UTM 正算、格网生成、射程圈 |
| `app/src/core/cityEffects.ts` | 城区影响：半径、衰减、规模系数、五项修饰 |
| `app/src/map/measureTool.ts` | 测距：距离 / 方位 / 高差 / 地形剖面 |
| `app/src/map/cityDamage.ts` | 城区战损：canvas 斜纹图案、按街区哈希、idle 刷新 |
| `app/src/data/damageStore.ts` | 战损等级存档（`city.damage.v1`） |
| `app/src/data/cities.ts` | 城镇索引（base64 二进制 + 0.5° 桶索引，含名字） |
| `Tools/bake_cities.mjs` | 从 PMTiles 的 `places` 点烘城镇索引 |
| `Tools/mvt.mjs` | 零依赖 MVT 解码（烘焙期用，zigzag 几何） |
| `Tools/bake_rail.mjs` | 从区域包抽低倍铁路线（RDP 简化 + 去重） |
| `Tools/fetch_basemap.mjs` | 取 CLI → 裁 bbox 或全球 → 出 style / 字形 / index |
| `Tools/bake_dem.py` | DEM 瓦片（terrarium） |
| `Tools/bake_slope.py` | 坡度通行瓦片（DEM 差分 → 分级着色） |
| `Tools/bake_contours.py` | 等高线矢量（marching squares + 折线缝合 + 标注锚点） |
| `Tools/serve.mjs` | 零依赖静态服务器（含 `.pmtiles` 的 HTTP Range） |
| `Tools/check_all.mjs` | 一键自检：无注释 / 行数 / 类型 / 构建 / 首屏 gzip 预算 |
| `Tools/dev_cdp.mjs` | 三个 dev 脚本共用的 CDP 连接与截图封装 |
| `Tools/dev_mapshot.mjs` | 取 MapLibre 画布真实帧（headless 截图对 WebGL 不可靠） |

## 数据来源与许可

| 数据 | 来源 | 许可 |
| --- | --- | --- |
| 矢量底图 | Protomaps（OpenStreetMap 派生） | ODbL，需署名 |
| 高程 | AWS Terrain Tiles（SRTM 派生） | 开放数据 |

页面右下角常驻署名。

## 下一步

1. **全球低倍铁路层**（z3–z10）：底图 z10 以下没有 rail 几何，需单独一层（Natural Earth 或母包 z12 抽取）。
2. 城区影响接进移动/交战解算（单位数值模型一旦落地）。
3. 补齐 L1 大区包（欧洲各走廊），验证多层叠加的实际观感。
4. 国名 / 海洋名标签（`places` 的 country / region 档位）。
5. 全球晕渲只到 z5，z8 以上偏糊；按区域补 z9–z11。
