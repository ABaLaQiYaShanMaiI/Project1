# 开发日志（DEVLOG）

大方向改动与决策原因记在这里；完整版本历史在 `CHANGELOG.md`，踩坑索引在 `PITFALLS.md`。代码里不写注释。

---

**阅读顺序**：会话开头先扫 `PITFALLS.md` 与下节「当前架构」；查历史改动用 `CHANGELOG.md`；本文只留近期版本、当前状态与决策。

**文档分工**（六份，不重叠）：

| 文件 | 管什么 |
| --- | --- |
| `Readme.md` | 门面：方针、怎么跑、有什么、数据管线 |
| `CONSTRAINTS.md` | 硬约束：注释禁令、体量预算、架构边界、数据规则、产品红线 |
| `MAPDESIGN.md` | 地图设计：分层、取景、交通线分级、等高线、格网、视觉基调 |
| `DEVLOG.md` | 决策原因、当前状态、近期版本（本文件） |
| `CHANGELOG.md` | 完整版本沿革（v0.1 起全部条目） |
| `PITFALLS.md` | 踩坑索引：按严重度排序，会话开头必读 |


## 当前架构（v1.24 起）

```
App.tsx ── TopBar / SidePanel
        └─ WorldMapLibre（懒加载，含 maplibre-gl + pmtiles）
              ├─ data/pmtilesBasemap.ts   index.json → zonesAt → tierBands
              ├─ data/style/*             样式分件（tokens / restyle / tier / rail / boundary / contour / overlay）
              ├─ data/militaryStyle.ts    按 tier 装配整套图层（只管顺序与去重）
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

完整版本历史（v0.1 起）已迁往 `CHANGELOG.md`；此处只保留最近三个版本，更早条目去 CHANGELOG 查。

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

### v1.56 文档分层、区域管线 manifest 与样式 token 外置

#### 一、DEVLOG 分层
- `DEVLOG.md` 1792 → 135 行：完整版本沿革 verbatim 迁往 `CHANGELOG.md`（1689 行，未改写），
  踩坑集中为 `PITFALLS.md`（17 条，按严重度 A/B/C 排序，会话开头必读）。DEVLOG 只留近期三版；
  CONSTRAINTS §1 改为文档三件套（DEVLOG / CHANGELOG / PITFALLS）。迁移遵守 v1.22 教训：
  切片重组不整文件重写，全程 git 留底。

#### 二、端到端区域管线与 manifest（方案一 + 四）
- 新增 `Tools/add_region.mjs`：`--name --bbox` 一条命令串起 fetch_basemap（裁剪 + index.json 登记）
  与 bake_region（7 步）。zoom 自动推导：bbox <500 km² → 核心包 z14-15，否则区域包 z11-12；
  `--zmin/--zmax`（矢量）与 `--dem-zmin/--dem-zmax`（DEM 默认 9-11）可覆盖，0 是合法值，
  以「参数是否出现」判断而非真值。`--dry-run` 只打印推导与命令链；`--register-only` 为存量区域补登记。
- 失败回滚：起跑前快照 `tiles/index.json` 与已存在产物集合，任一步失败即删本次新建产物并恢复
  index.json（`--keep` 保留现场排查）。
- 成功后写 `Tools/data_manifest.json`：文件产物记 sha256+bytes，目录产物（dem/slope）记文件数+总字节
  （目录逐文件 hash 太贵，规模校验足以发现缺失与损坏）。
- 新增 `Tools/restore.mjs`：按 manifest 逐条校验（默认只报告，`--fix` 重跑重建命令并带 --force 重新裁剪）。
  验证：germany/fulda 登记后全 ok；注入坏记录能检出并给出重建命令。

#### 三、样式值外置（方案二）
- `tokens.ts` 扩为唯一色值事实源（约 70 个 token：路级配色、LANDCOVER/LANDUSE、等高线、晕渲、
  格网 / POI / 射程 / 边界 / 城区补层）；restyle/boundary/contour/rail/tier/overlay/militaryStyle 
  全部改为引用，`app/src/data` 除 tokens 外不再有 hex 字面量。tier 的 landuse_residential 补层 
  match 表改为引用 LANDUSE，与 restyle 同源，改色一处生效。
- 护栏 `Tools/style_snapshot.mjs`：tsc 编译 militaryStyle 依赖链 → 固定输入 → 输出 JSON sha256；
  重构前后快照一致（sha256:c6b92db4…，166 layers），渲染输出逐字节相同；tsc --noEmit 通过。
- 顺带把样式分件换行统一为 LF。

#### 四、CONSTRAINTS §2 校准与方案五前置
- 底图单包 ≤ 6 GB 且总量 ≤ 12 GB、DEM 总量 ≤ 1 GB（实测 tiles 4.14 GB / dem 0.49 GB）；
  旧 64 MB / 200 MB 限额早已被 world9（2.99 GB）突破，此次对齐现实。
- 全球 z11-12 未实测：母包实际在 `G:\PersonalGame\v4.pmtiles`（125.6 GB；index.json 里的 E 盘路径是旧值）。
  按 z9-10 = 3 GB 外推 z11-12 约 10-14 GB，可能超单包 6 GB 限额。实测命令：
  `node Tools/fetch_basemap.mjs --world --key=world11 --minzoom=11 --maxzoom=12 --name=全球 z11-12`；
  超限则改分大洲 / 分国家包，或单独校准限额。落地本身零代码（v1.52 同款，index.json 驱动）。

#### 五、方案三（__group 就近标注）暂缓
- 评审结论：类型退化（LayerKey | null → string）、basemap 兜底会吞掉漏标（earth 教训）、
  __group 会泄入 style JSON；收益仅约 24 行 if-else（大头靠前缀规则自动归类）。
  暂缓，图层分组继续维护 layerGroups.ts。

### v1.57 富尔达美术对齐 MAPDESIGN（zoom 档图例修正）

以富尔达为例，逐条对照 MAPDESIGN §四 / §五 / §七，修掉放大与缩放切换时「图例」（各要素出现时机与配色）的偏差：

- **水色**：`WATER_FILL` #9cc0d2 → **#a3bccb**（§七 视觉基调）。
- **等高线色**：`CONTOUR_FINE` #b0916c → **#9a6b3c**（§七）；计曲线保持深一档 #7a5427，层级靠宽度与透明度区分。
- **低倍铁路区间**：`RAIL_LOW_MAXZOOM` 12 → **11**。此前 z11–12 里富尔达低倍烘焙层与 germany 瓦片铁路双重绘制，
  铁路显粗、光晕叠光晕；现在 z11 起只有瓦片铁路（§四），z10→z11 衔接处宽度一致。
- **瓦片铁路三层宽度对齐设计**：光晕 4.9 → **5.2**、枕木 1.0 → **1.05**（§四“光晕 5.2 / 墨线 3.4 / 枕木 1.05”）。
- **次级公路出现时机**：§四要求“次级公路 z12+”，此前与主干同在 z10 出现。protomaps 把 primary 与 secondary
  混在同一 roads 图层，minzoom 无法按要素拆分，改为**透明度渐显**：`arterialFade` z10 0 → z12 1，
  fill / casing 的 isArterial 分支乘 fade，z12 后回到满值 0.8 / 0.5（新增 `ARTERIAL_MINZOOM = 12`）。
- **等高线全等级标注**：`contour-label-all` minzoom 11.5 → **13**（§五“计曲线 z≥11、全部等级 z≥13”），
  symbol-spacing 起点同步 13；z11–13 之间只标计曲线。
- 文档同步：MAPDESIGN §四低倍铁路行改 z9–11（z3–10 由全球 NE 层补齐，v1.50）、§5.1 判读组补设施气泡。

#### 验证

`Tools/style_snapshot.mjs`：基线 sha256:c6b92db4… → **sha256:973da106…**（166 layers，两次运行一致，
变更范围即上述美术决策）；`tsc --noEmit` 0 error；`check_all` 7 项全绿。

### v1.55 样式表达式把整张图拖垮（铁路/灰块现象的真因）

v1.0.19 的配色 token 化重构里，`restyle.ts` 的两处 `line-opacity` 写成了

```
['case', isMain, 0.9, isArterial, ['*', 0.5, ['interpolate', ['linear'], ['zoom'], ...]], 0.38]
```

MapLibre 只允许 `zoom` 出现在 **顶层** `interpolate` / `step` 的输入位，
嵌套在 `case` 或乘法里会让**整张样式校验失败**——浏览器只留下
`layers[268].paint.line-opacity: "zoom" expression may only be used as input to a top-level ...`，
其余全部图层不渲染（实测只剩 6 层：measure-line、damage 等）。

于是用户看到的现象——「富尔达铁路能显示、别处不行」「灰色块乱盖」——其实不是铁路或城区数据的问题，
而是绝大多数底图图层当时根本没有加载；缩小时能看到连线是 NE 全球层（那几层恰好排在报错图层之后）。

修法：把 arterial 的淡入提到顶层：

```
['interpolate', ['linear'], ['zoom'],
  MAIN_MINZOOM, ['case', isMain, 0.9, isArterial, 0, 0.38],
  ARTERIAL_MINZOOM, ['case', isMain, 0.9, isArterial, 0.5, 0.38]]
```

#### 新增第 8 道闸：样式表达式校验

这类错误 `tsc` 查不出来、`vite build` 也过，只有浏览器控制台会报。补两个工具：

- `Tools/style_lint.mjs`：在 Node 里用 `style_snapshot` 的合成输入构建整张样式，扫描所有
  paint/layout，凡 `zoom` 不在顶层 `interpolate`/`step` 输入位就报错
- `Tools/check_all.mjs` 第 8 项「样式表达式合法」，实测能抓出 24 处旧写法

#### 对 v1.0.19 优化的评估

可保留、方向正确：
- 颜色全部收进 `tokens.ts`（`GRID_*` `POI_*` `HILLSHADE_*` `MILITARY_*` `RAIL_TICK`），符合「美术=常量」原则
- `railsOf(tier, suffix)` 给每层 rail 加 tier 后缀，修掉跨 tier 的 id 冲突
- `Tools/add_region.mjs`（区域一键接入）、`restore.mjs`（产物一致性检查）、`style_snapshot.mjs`（样式哈希基线）都实测可用

需要留意：
- `style_snapshot` 的哈希适合做美术回归基线，但要先确定基线值，否则每次都「不一致」
- `tierLayers` 里 landuse 的 match 兜底用了 `LANDUSE.railway`，语义上更像「其他」兜底，建议改名或单列

### v1.56 德国 z13 补齐 + 交互跟手度

#### 一、德国 z13（消除富尔达/德国观感差异）

`--minzoom=13 --maxzoom=13` 德国全区：**879 MB / 1 分 39 秒**，作为独立包 `germany13` 接入。
分档变成 world 0–6 → world8 7–8 → world9 9–10 → 德国 11–12 → 德国 z13 → core 14–15。
富尔达的 z13 由 `germany13` 覆盖（同一母包同一级），铁路几何与富尔达同源，粗细不再有差别。

#### 二、不跟手：三个原因

1. **样式里存在大量「区间已死」的图层**：`railsOf()` 里 `clampZoom()` 返回 false（min≥max）时
   仍然把图层 push 进去。结果 world / world8 / world9 三个全球 tier 的 `roads_rail`
   在 z13 仍然 active（min 11、无 max），三层铁路同时叠画——既粗又慢。
   改：`clampZoom` 失败直接返回空数组。
2. **下级 tier 不封顶**：world9 的 `styleMax` 一直是 22，在德国、富尔达 z11+ 仍以 z10 overzoom 渲染，
   多出约 77 个图层。改：任何 tier 若下一个 band 的包**完全覆盖当前视口**，就把 `styleMax` 截到下一档起点。
3. **可见性更新全量刷**：每次 `store.emit()`（含平移时的 cityZone 变化）都对 400 多个图层调
   `setLayoutProperty`。改成按「上次已应用状态」做差量，并记录 viewEpoch，样式重建后才重置。

另外给铁路 hatch 的上限从 13 提到 16：z13 及以上编组站的黑块被白色刻线打散，观感接近富尔达。

实测（同一 z13 视角）：

| 指标 | 修前 | 修后 |
| --- | --- | --- |
| 点击到首帧 | 74–84 ms | **24–26 ms** |
| 点击到全部瓦片 idle | ~2.0 s | **1.1 s** |
| z13 active 铁路图层 | 5 层（3 个 tier 叠画） | **2 层** |
| 富尔达 z13 图层总数 | 447 | 390 |

#### 三、关于美术移植性的结论

`斜度/晕渲/纸底/水系/林地/城区/边界/道路分级/铁路/等高线` 全部由 `tokens.ts` 常量驱动，
换区域只换数据不改样式——目前德国、富尔达、全球三档的同一份样式表现一致，满足你定的判据。

### v1.57 铁路线宽统一 + 城区面下沉到道路之下

两个观感问题，来源不同：

#### 一、富尔达的铁路比全球的更深

铁路一共四套图层，base 宽度不一致：

| 图层 | 场景 | 旧 ink 宽度 |
| --- | --- | --- |
| `roads_rail*` | 瓦片铁路 z11+ | 3.4 |
| `rail-low` | 区域烘焙 z9–11 | 3.4 |
| `rail-low2` | 区域粗线 z4–9 | **1.9** |
| `rail-world` | NE 全球 z3–10 | **1.5** |

同一缩放下富尔达（3.4）比全球（1.5）粗一倍多，看起来「更黑」。全部统一到
`railWidth(3.4)` ink + `railWidth(5.2)` halo，并把 `rail-cloud` 的 `line-opacity 0.9` 去掉。
现在 z10 富尔达与法兰克福的线宽完全一致。

#### 二、灰色块盖住铁路和道路

两处层级错位：

1. `urbanWorldLayers()`（NE 全球城区面）原来在 `militaryStyle()` 末尾 push，
   等于压在**所有 tier 的道路/铁路之上**。改成在第一个 tier 的 `landcover` 之后插入，
   与坡度、晕渲同一层位。
2. `landuse_urban_glow` / `buildings_glow` 原来在 `tierLayers()` 末尾 push，
   也在道路之上（5 px 宽的灰描边会糊住细线）。改成和城区填充一起 splice 到
   `landcover/landuse` 之后。

现在城区（面 + 描边）统一在「地表之上、水系道路之下」，铁路与道路永远压在最上面。

### v1.58 铁路分层校验：同一缩放只保留一套铁路

验收时发现 z13–z15 在富尔达会**同时**激活两套铁路（`germany` 与 `fulda`、`germany13`），
叠画导致线更黑、也浪费图层。根因：`styleMax` 的封顶依赖「下一档包是否覆盖视口」，
而样式只在**包集合**变化时重建，缩放跨档时不会重建，封顶值就停在进入该区域时的旧值。

改法：把「band 阶梯签名」并入重建判据——`zonesInBounds` 的结果加上 `tierBands().from` 序列，
任一变化即重建样式。样式重建时按当前视口重新计算封顶，跨档后自然只剩一套铁路。

校验结果（rail 专用图层，括号内为当前 zoom 下 active 的铁路 tier）：

| 视角 | z11 | z12 | z13 | z14 | z15 |
| --- | --- | --- | --- | --- | --- |
| 富尔达 | germany | germany | fulda | germany13 | germany13 |
| 慕尼黑 | — | germany | germany13 | germany13 | — |

每个缩放级别都只有一套，且层宽统一为 `railWidth(3.4)`；截图核对 z13/z14 慕尼黑、
z13 富尔达的线路连续、无断口、无折返形变，编组站黑块由白色刻线劈开。

代价：跨档（z7/9/11/13/14）时会重建一次样式，有短暂重载。

### v1.59 波罗的海「纵向铁路」与放大后断联

#### 一、海上那条线是什么

排查 `rails_world.json`：最长直线段 207 km，坐标 (18.0, 56.22) → (20.0, 57.71)，
正好横穿波罗的海；再查 Natural Earth 源要素，是一条 29 个点的线，从赫尔辛基
(22.96, 59.82) 连到瑞典外海——**是轮渡航线被 NE 收进了 railroads 数据集**，
不是我们的坐标算错。

处理：烘焙时丢弃「任一单段长度 > 80 km」的线（轮渡、异常直连都符合这个特征）。
重烘后全球铁路最长单段降到 79 km，波罗的海纵向线消失。

#### 二、放大后铁路断联

`rail-world`（NE 全球）原本 maxzoom 10，而瓦片铁路从 z11 才有——于是 z10→z11 之间
在没有区域包的地区（波兰、法国等）铁路整段消失，看起来像「断联」。

处理：`rail-world` 延到 **z12**，并用 `line-opacity` 从 z10 的 1 淡到 z12 的 0.35。
有区域瓦片的地区（德国、富尔达）由瓦片铁路压在上面，NE 只作淡底；
没有区域瓦片的地区仍有连续但较淡的铁路。

实测：华沙 z11 铁路连续可见（淡线）；慕尼黑 z11 瓦片铁路为主；波罗的海 z5 无海上线。

### v1.60 车站简化：不建模备用车道，改「站区面 + 站点标记」

按讨论结论：编组站、侧线、停车线一律不单独建模，改用两种符号表达：

| 符号 | 数据来源 | 样式 |
| --- | --- | --- |
| 站区面 | 瓦片 `landuse` 的 `kind=railway/platform` | 砖红填充 0.26 + 深红描边，z10 起 |
| 站点 | 瓦片 `pois` 的 `kind=railway` | 墨色圆点 + 浅描边，z9 起（与机场同构） |

这样做的收益：
- 取消原计划的「全球铁路几何去重」这个不可靠、耗时的大工程
- 铁路继续用瓦片原生几何，走向准确、不断链
- 站区一眼可辨（红色区块），又不被多股道的黑块糊住

数据侧：`bake_poi.mjs` 增加站点抽取（德国 607 站 / 富尔达 11 站 / 富尔达核心 1 站），
POI 加载从「只取第一个区域」改为**合并所有可见区域**（德国视角共 19758 点位）。

富尔达同步：`poi_fulda.json`、`poi_fulda_core.json` 一并重烘，站区面与站点样式和其它区域完全一致，
不再有地区特例。

### v1.61 争夺焦点标注：市政 / 医疗 / 民生 / 地标 / 厂区

在车站之后，把「争夺控制焦点」再扩成六类符号，全部从瓦片自带属性抽取，不新增数据源：

| 类别 | 瓦片 kind | 颜色 | 起始缩放 |
| --- | --- | --- | --- |
| 行政治安 `civil` | townhall / courthouse / police / prison / fire_station | 靛紫 | 9 |
| 医疗 `medical` | hospital / clinic / nursing_home / social_facility | 朱红 | 9 |
| 民生 `vital` | school / university / library / marketplace / community_centre | 橄榄绿 | 10 |
| 地标 `landmark` | museum / attraction / castle / monument / theatre / stadium | 赭黄 | 10 |
| 厂区点 `industry` | industrial / factory / works / mine / quarry / depot | 石板灰 | 9 |
| 车站 `station` | railway | 墨色 + 砖红站区面 | 9 / 10 |

大型厂区（如武钢那种）：除了点，还加了 `landuse kind=industrial` 的**灰色面填充**（0.2，z10+），
所以成片厂区会呈现为整片灰区 + 多个厂区点，而不是只靠点猜范围。

数据：德国 62742 点位 / 2.5 MB（仍低于单文件 4 MB 上限），富尔达 1021 点 / 41 KB，
富尔达核心 319 点 / 13 KB——三处同一套规则，没有再出现地区特例。

### v1.62 图层排序与全球铁路曲率

#### 一、图层排序（灰块盖住地名/道路）

样式是「按 tier 依次 push」的，于是高倍档的 `landcover_urban` 填充会盖在低倍档的地名之上，
低倍档的道路也会被高倍档的填充压住。结果是缩小之后地名、道路被灰块吃掉。

修法：装配完成后按**语义层级**稳定排序，而不是按 tier：

```
0 背景 → 1 面（填充/栅格/晕渲）→ 3 行政界 → 4 道路 → 6 铁路
→ 7 等高线 → 5 注记符号 → 8 格网 → 9 射程圈 → 10 点位
```

同层级内保持原有相对顺序（稳定排序），所以每个 tier 内部的次序不受影响。
实测德国 z7：地名、道路、铁路都不再被灰块压住。

#### 二、铁路变直线

`rails-world`（Natural Earth 1:10m）的简化容差原来是 **0.01°（≈1.1 km）**——弯道在这一步就被拉直了。
改成 **0.0035°（≈390 m）**，最小长度 18 km：

| 参数 | 旧 | 新 |
| --- | --- | --- |
| TOL | 0.01° | 0.0035° |
| MINLEN | 25 km | 18 km |
| 线数 | 8982 | 11261 |
| 体积 | 1.58 MB | 3.30 MB |

实测德国 z7：铁路沿真实走廊弯曲，不再是一条条直穿全国的线。

### v1.63 焦点地块按重要度分层

按讨论收敛到「少而重」，不做全量标注：

| 地块 | 出现缩放 | 说明 |
| --- | --- | --- |
| 机场 | 9 | 大片用地，早期就要可见 |
| 港口 | 9 | 同上 |
| 车站/站场 | 10 | 城市级焦点 |
| 厂区 | 11 | 大片工业用地先出，小区块随细节出现 |
| 医院 | 13 | 只保留街区级可见，避免小诊所铺满 |

- 电厂/水厂：瓦片 `landuse` 没有 `power_plant` / `water_works` 字段（抽样 300 张德国瓦片为 0），
  这类地块**放弃**，不引入额外数据源。
- 气泡只保留机场、港口、车站三个定位点，行政/医疗/民生/地标气泡全部删除。
- 配色本轮保持不动（站红 / 医院朱红 / 机场蓝灰 / 港口青 / 厂区灰），先看整体效果再调。

### v1.64 阶段性收尾（本轮会话总览）

#### 本轮做完的事

| 方向 | 结果 |
| --- | --- |
| 全球铺开 | world8（z7–8）/ world9（z9–10）/ 德国（z11–12）/ 德国 z13 四个包落地，europe 包退役 |
| 全球旁挂 | NE 铁路（11261 线 / 3.3 MB）、机场 893、港口 1081、建成区面 1.8 MB |
| 建筑表达 | 建筑密度镜像瓦片替代独栋轮廓（富尔达核心 156 张 / 0.14 MB，对比矢量 3 MB） |
| 符号简化 | 车站不建模备用车道；焦点地块改为专属色块 + 少量定位点 |
| 体积 | 坡度改调色板 PNG（56.6→31.1 MB）；构建产物 3.9 GB → 1.8 MB |
| 质量闸 | 新增第 8 道「样式表达式合法」，能抓出嵌套 zoom 导致的整图不渲染 |
| 观感修复 | 图层语义排序（面→线→注记）、铁路容差收紧、铁路分层单档、城区不压注记 |
| 交互 | 差量可见性更新；点击到首帧 74–84 ms → 24–26 ms |

#### 当前状态（可直接接手）

```
矢量：world z0–6 → world8 z7–8 → world9 z9–10 → germany z11–12 → germany13 z13 → fulda → core z14–15
地形：dem/world z0–5 · dem/europe z6–8 · dem/fulda z9–11 · dem/germany z11；slope 四套调色板 PNG
符号：站场/医院/机场/港口/厂区五种地块色块；机场/港口/车站三个定位点
校验：node Tools/check_all.mjs → 8 项（注释/行数/数据体量/tsc/vite/首屏 JS/样式表达式）
```

#### 已知缺口

1. z11–13 之外的全球铁路仍是 NE 1:10m 骨架，城际走向近似直线。
2. 跨缩放档（z7/9/11/13/14）仍会重建样式，有 1–4 s 停顿；动态 zoom-range 试过但档位区间重叠，已回退。
3. 等高线只有富尔达；全球 DEM 只到 z5。
4. 建筑密度瓦片只烘了富尔达核心 z15，z14 与德国都没有。
5. `world9` 占总量 56%（2985 MB），是体积上的主要负担。

#### 下一步优先级建议

1. 跨档重建改「互斥档位 + 动态区间」，消掉 1–4 s 停顿
2. 建筑密度瓦片铺到德国 z13–14
3. 全球铁路若要更准，按国家切 z9–10 包（每国几百 MB）

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

### v1.65 UI 重设计 + 图层顺序与缩放档修正

本轮按需求规格总表 §20 把地图符号与图层顺序逐项对账，同时重做 UI。

- 注记层级修正（symbol rank 5 → 7.5 / 射程圈标注 9.5）：v1.62 的语义排序意图是「等高线→注记」，
  实现漏了 symbol 桶，等高线标注一直被压在等高线与铁路之下。
- density 插入位置修正：规格要求「铺在城区面之上」，原插在首个 tier 的 landcover 后，
  多 tier 稳定排序后被后装城区灰块（0.92 不透明）盖住——z15 密度瓦片实际从没显示过。
- tierBands tie-break（maxzoom 并列时 minzoom 大者在前）：germany13 与富尔达并列 13，
  原顺序把 fulda_core 顶到 z15 才接管，z14 一直显示 germany13 的过缩放。现在 germany13 管 z13、
  fulda_core 从 z14 接管原生建筑；富尔达包在富尔达视图内让出 z13（同源数据），z14+ 留作
  overzoom 兜底。没有选择「丢弃死档」：fulda_core bbox 之外的 z14+ 仍靠它覆盖。
- groupOf 补映射：urban-world → 城区灰块、density-* → 建筑物、landuse_station/landuse_port →
  城区灰块（PITFALLS §5 的教训重犯了一次）。
- 符号对齐 §20：厂区面 0.22、车站点墨色圆点（原朱红）。
- UI：styles.css 全量重写（699 行），组件只改类名与浮层结构、逻辑零改动；地图左上工具条
  去掉与顶栏/侧栏重复的底图信息，只留战损开关与 FPS。坚持无新依赖、无注释、行数预算。
- 基线：style_snapshot sha256:b102a289…（170 layers）；check_all 8 项全绿；
  z6/z9/z12/z14/z15 五档截图复核注记、密度接管与 UI。

### v1.66 铁路低倍档重排（烘焙层复活 + NE 裁剪）

用户反馈铁路在缩放中偏移、曲线变直线。根因有两层：

- `rail-low` 三层样式里 13/13，被 `min < max` 过滤器删除，运行时 setLayerZoomRange 找不到层——
  烘焙铁路层从来没渲染过。z5–10 一直是 NE 概化线（偏差数百米），z11–12 NE 淡出与瓦片双线并存。
- 多套几何在同一缩放并存：NE(z3–12) + rail-low2(z4–9) + rail-low(死层) + 瓦片(z11+)。

改法（细节见 CHANGELOG v1.66）：样式层声明 z3–10、德国低倍铁路入库（3.6 MB）、mergeRails 细包让位、
NE 按区域 bbox 裁剪（新 `data/railsWorld.ts`，Liang-Barsky 分段裁剪 + 区间并集）、删 rail-low2。
原则：**每一档缩放只允许一套铁路几何**；交接放在瓦片起始缩放 z11；NE 永不与烘焙线同框。

### v1.67 图种制（地势·交通 / 用地·政区）

原「城区图/地形图」只切可见性，地势/人文/交通三类信息在任何缩放全量叠加，z9–12 视觉最挤。
按军用地形图/政区图体系分成两个图种：

- 图种 = {可见性表, 强度规则表}，PERSONAS 定义在 store.ts；强度规则按 base id 前缀匹配 +
  属性族过滤，`*` 通配；运行时 setPaintProperty 差量应用，不重建样式（避开 1–4s 跨档停顿），
  跨档重建后 paintSig(key|epoch) 变化自动重放。
- 基线表达式从样式分件导出（tokens/contour/widths），城图规则 = 基线回填——避免两处漂移；
  style_snapshot 哈希不变（sha256:989356b4…，171 层）证明样式装配零改动。
- custom 模式强度沿用上一个图种（personaRef 保持）；LITE 模式在图种之上继续压掉晕渲/等高线。
- 图层树折叠为「高级图层」，默认收起；默认图种 = 地势·交通图（约束 §4 军事判读优先）。

## 踩坑记录

### v1.78 海名注记：把「图册感」做成数据而不是形状

全球视图 z3–6 只有陆上地名，海洋是空白——不是缺图层，而是缺**名字**。做法不是画字，
是把 58 个海域名与手选中心点写成一个 3 KB 的 JSON，交给 symbol 层：

- 名称用英文大写：底图 `places` 本身就是英文（NEPAL / Paris），混中文会突兀；
  字距 0.14–0.24 让海名看起来像「面」而不是「点」，这是图册的排版习惯。
- `symbol-sort-key` 用等级（洋 1 / 海 2 / 湾 3），大洋先排；其余交给碰撞检测，宁可少放也不叠。
- 只在 z3–8 出现：z9 以上海名会跟岸线细节抢地方，退场更干净。
- 归属「地名标注」叶，跟地名一起开关；两个图种都可见。

两个小坑：`text-max-width` 的单位是 em（不是像素），8 会把 `MEDITERRANEAN SEA` 折成两三行，
长海名要按等级给到 6–10 并接受自然折行；`text-transform` 只接受 `uppercase / lowercase / none`，
拼错不会让表达式校验报错，而是整层安静地不画——**海名这种纯符号层必须实拍确认**。

### v1.77 把「德国的做法」推广到全球：等高线按山系分区

德国有 200 m、富尔达有 25 m，全球却只有 1000 m 一套——同一张图在不同地区的地形读法不一样。
做法不是把全球都烘 200 m（体积/预算都不可能），而是照已有的「区域包」思路：
**粗档铺底 + 细档按地形区叠加，细档出现前把粗档挖空**。

- 五个细档的 bbox 按「有军事意义的山系」选：喜马拉雅—青藏、扎格罗斯—厄尔布尔士、安第斯、落基山、东非裂谷。
  它们和欧洲一起写进 `world_mid` 的 `--exclude`（`;` 分隔多个矩形），z7–10 不会出现「1000 m 与 500 m 双线错位」。
- 细档数据来自 z6 DEM（2.4 km/px）。500 m 等高距在这个分辨率下已接近极限：再细就是「插值画出来的假线」，
  所以没有硬上 200 m。
- 预算：五档合计 9.15 MB，单档最大 3.57 MB（4 MB 闸内）；`world_mid` 反而瘦了 0.83 MB。
- 装载仍只看 bbox：视口进山系才下载对应档，平原与海洋不受影响。

教训：**「一档只画一套」不靠图层开关实现，而靠数据挖空**。两个档的 bbox 只要交叠，就必须在烘焙端挖掉一个，
否则两套不同 DEM 的同值等高线会并排出现（看起来像重影）。

### v1.76 dev 下 worker 被 Vite 注入 HMR：整图只剩栅格

现象只在 `pnpm dev`（或 `node node_modules/vite/bin/vite.js`）出现：控制台一句
`Worker failed to load. Check that the worker URL is correct.`，画面上**只剩坡度 PNG 与纸底**，
矢量、晕渲、分层设色、等高线全部消失；`vite build` + `Tools/serve.mjs` 完全正常。

根因不在 MapLibre，也不在 worker 路径：`import workerUrl from '.../maplibre-gl-worker.mjs?url'` 在 dev 返回
`/node_modules/.pnpm/.../maplibre-gl-worker.mjs`，浏览器再请求这个地址时 Vite 把它当**源码模块** transform，
在文件开头插入 `import { injectQuery } from "/@vite/client"`。worker 里没有 `document`，Vite 客户端初始化即抛，
worker 直接死掉 —— MapLibre 的 `actor` 只把 worker 的 `error` 事件翻译成那句「URL 不对」，所以看起来像路径问题。

修法（两条路都留着）：
- dev：`vite.config.ts` 里加 `/ml-worker.mjs` 路由，由 `Tools/dev_static.mjs`（新导出 `serveMlWorker`）
  **原样吐字节**，不经过 transform；`setWorkerUrl(import.meta.env.DEV ? '/ml-worker.mjs' : mapWorkerUrl)`。
- 生产：保持 `?url` 资产（`assets/maplibre-gl-worker-<hash>.mjs`），`serve.mjs` 的 `.mjs` MIME 已正确，
  实测 206 个 pmtiles Range 请求正常、无 worker 报错。

判定顺序：先看控制台有没有 worker 错误，再看 `pmtiles` 有没有 206 —— 有 206 说明 worker 活着，
没有 206 而坡度还在，就是 worker 死了（栅格是主线程直接画的）。

### v1.75 全球 z6 DEM：先算预算，再动档位表

AWS 恢复后第一件事是把全球高程从 z5 补到 z6（4096 瓦片 / 203 MB）。三个约束先摆出来：

1. **预算**：CONSTRAINTS §2 的 DEM 总量 1 GB。补前 641 MB（world 86 + europe 21 + germany 520 + fulda 16），
   补后 **844 MB**，还剩 ~155 MB——够再补一个中欧级区域，不够补全球 z7（z7 单档 ~800 MB）。
2. **档位互斥**：`DEM_BANDS` 的 `bestFrom` + `styleMax` 公式要求每档 `from` 唯一。world 与新增 world6 若都从 6 起，
   两档都会被放开到 22，浅色晕渲叠两层又是 v1.70 的灰底。做法：world6 从 6，**europe 从 7**（europe 原生 z6–8，
   从 7 起不损失分辨率）。
3. **采样器不用改**：`DemSampler.pick()` 按 `maxzoom` 降序取第一个 bbox 命中，world6（z6）自然排在 world（z5）之前，
   左下读数与剖面一并升级。

补完的观感收益在「跳出中欧」的 z6–10：此前 z10 用的是 z5 的 4.8 km/px 高程（32 倍 overzoom），
山脊被糊成一团；z6 原生瓦片把 overzoom 砍半，晕渲、分层设色、坡度三层的细节同时回来。

另外补台账：v1.0.27 换过 `poi_fulda.json`、`dem/fulda` 也有 7 KB 漂移，`data_manifest.json` 没跟，
`restore.mjs` 报两条 bad。台账按实际产物更新后复核 2/2 ok——**换数据产物必须同步台账**，否则下次接手先看到的是报错。

### v1.74 全球等高线：Mercator 栅格不能当线性纬度网格用

到 v1.73 为止地形细节都只在中欧：等高线三档（欧洲 500 m / 德国 200 m / 富尔达 25 m）。v1.0.27 补了全球档
（`contours_world.json`，1000 m），但一眼看过去 Himalaya/Andes 是空的——4000 m 以上的线簇全跑到 16°N。

原因不在样式，在烘焙端：`crop_bbox()` 用 `asinh(tan(lat))` 正确裁出 Mercator 窗口，之后却把栅格行**当线性纬度**
用（`lat = lat0 + y / mPerDegLat`）。欧洲档只有 12° 高，误差几百米看不出来；全球档 170° 高，
纬度映射整段错位：28°N 的喜马拉雅被写到 13.7°N、安第斯 −30° 写到 −15°。

改法：新增 `crop_linear()`——横向 LANCZOS 重采样后，按 `asinh(tan(lat))` 反查每一输出行在 mosaic 中的源行，
做垂直线性插值，得到**线性纬度网格**，与前端 `contourGeoJson()` 的换算一致。`--warp=merc` 保留旧行为。

同一轮把「只在德国有美术」的三类资源推到全球：

1. **主干公路**：瓦片 z7–10 本来就有 motorway/trunk/primary，被 `MAIN_MINZOOM=10` 挡掉；改成出现 7 / 满强度 10 两档。
   z6 抽检每瓦片只有 4 段（Protomaps 在 z6 抽样很凶），z7 起才是真网络，所以起点定在 7 而不是 6。
2. **铁路**：NE 细档 z3–12 延长到 z16 并降不透明；z13+ 德国之外终于有线。裁剪范围改成「真的有
   `rails_<key>.json` 的区域包」，否则将来加区域包没烘铁路会在 NE 上挖洞。
3. **等高线**：新增 world_mid 档（z7–10），烘焙时把欧洲 bbox 挖空（`mask_box` 置 NaN + `--exclude`），
   保证与 europe 档一档一套、零重叠；装配端用 `ContourBand.exclude` 在视口全在欧洲时直接不下载。

代价：全球两档各 ~2.8 MB。world_mid 只在视口触及欧洲以外时下载，德国/富尔达视图仍是四档而不是五档。

顺带挖出一个更严重的既有缺陷：`applyForceDetail`（跨级显示细节）在样式重建的换档窗口里，会先按**旧样式**记下
`[min,max]`，再回写到**新图层**。于是每次跳出德国，world9 瓦片层的上限就被压回旧值 11——
z11 以上德国以外道路、跑道、设施气泡全灭，而且肉眼像「数据没有」。这次改成：样式未 `isStyleLoaded()` 不写、
开关关闭（默认）时根本不写，只有用户开启后才记录并恢复。用 CDP 读 `getStyle()` 复核：`roads_highway__detail_world9`
从 9–11 回到 9–22，巴黎 z14 主路回来了。教训：**任何「读当前样式的 zoom range 再写回」的运行时补丁，
都必须绑定到样式世代**，否则一定会在跨档窗口里写回旧值。

### v1.73 跨级显示细节：改 zoom range 要能还原

需求来自「缩到 z9 以下主干道路就消失，看走廊不方便」。做法是给四组图层（road / minor / airport / poi）
在运行时 `setLayerZoomRange(id, 0, maxzoom)`，但有两个坑：

1. **原文区间必须自己记**：MapLibre 的 `getStyle()` 返回的是**当前**值，改完再读就是 0 了。
   所以在每次样式重建（epoch 变化）后首次采样并把 `[min, max]` 存进 ref，关闭开关时按它还原。
2. **不能整组照搬**：铁路与等高线虽然在 `groupOf` 里是独立组，但它们本来就是分档连续的多层，
   强开会让多档几何同时出现（等高线尤其明显：25 m 与 500 m 叠在一起）。所以只放行道路/跑道/气泡。

顺带把这段从 `WorldMapLibre.tsx` 抽到 `map/forceDetail.ts`——行数闸 700 卡得很紧，抽完 714 → 693。


### v1.72 坡度默认开启（透明方案回滚）

用户的诉求只有一句「开关默认打开」。第一次实现顺手把 `坡度 < 8%` 烘成透明（想让缓坡保留分层设色），
观感过于极端——大片地形没有坡度色，整张图的读法都变了。已整体回滚：调色板与 `bake_slope.py` 恢复原状，
四套 slope 重烘成不透明，不透明度回到 0.85，叠加位置不变。

保留下来的是两处不改观感的修正：坡度档改成跟 `DEM_BANDS` 同表互斥（此前 z9–10 用 world z5 的坡度
overzoom 25 倍，且 world 档开到 z22 与区域档叠画），以及德国坡度补到 z9–10（5208 张 / 33.6 MB）。

教训：用户说「默认打开」就只打开开关，配色别顺手改——阈值一改，整张图的读法都变了。


### v1.71 彩色分层设色：色阶要跟等高距同梯

「地形图不彩色」不是缺色，是两件事：① 色阶是灰调粉彩、又只压 0.45–0.62 不透明度，被纸底色洗平；
② 只有一套色阶，world / europe / germany 三档地形用同一条色带，低倍档色带过密、高倍档又跟 200 m 等高线错位。

改法：`HYPSO_LADDER` 16 级色阶（绿→黄→橙→褐→雪线白），三个档各自按自己的等高距取步长
（world 200/500/1000、europe 250/500/750、germany 100/200/300），`DemTier.ramp` 传下去；
不透明度提到 0.8（地势档 0.88）。色带边界与等高线重合，读图时两者互相印证——这是地图册的做法。

注意：`color-relief` 在 rank 1，水系面（fill，rank 1、后 push）仍在它之上，所以提高不透明度不会把湖染成陆地色。


### v1.70 地形糊的三个原因（DEM 叠层 / 欧洲档没挂 / z9–10 无高程）

「地形不够精致」不是配色问题，是三处结构问题叠出来的：

1. **DEM 档不互斥**：world（z0–5）与区域 DEM 的晕渲和分层设色都开到 z22，于是德国 z11+ 上是
   「粗晕渲 + 细晕渲」「粗设色 + 细设色」各叠两层——看起来糊、发灰，细节被粗层盖住一半。
   修法：`DEM_BANDS` 表 + 按视口中心/缩放只选一档，粗档在细档起点封顶。
2. **`dem/europe` 从来没挂上**：z6–8 一直用 world z5（2–8 倍 overzoom）。
3. **德国 z9–10 没有原生高程**：16–32 倍 overzoom，任何配色的地形都会糊。补烘 z9–10 后才谈得上「精致」。

顺带把分层设色从连续渐变改成 `step` 色阶，贴合图册的分层设色读法。

另一个真 bug：样式重建判据里存的签名与比较用的字符串不是同一个（`key` vs `key|bandFrom`），
**每次平移结束都会重建整张样式**。判断「要不要重建」时，写签名和比签名必须走同一个函数。


### v1.69 等高线阶梯与 `CONTOUR_BANDS`

地势图缺细节不是样式问题而是数据问题：只有富尔达烘过等高线（25 m / 1.37 MB），而样式层又把细线卡在
z12、计曲线卡在 z10.5——低倍一片空白，德国与中欧的 DEM 从未用上。

做法：等高距按缩放分档，档表放 `style/contour.ts` 的 `CONTOUR_BANDS`（bbox + 缩放段 + 是否全部标注），
样式与装载共用同一张表。烘焙端新增两件事：`--min-elev 0` 丢掉海平面以下的 DEM 噪声（欧洲档曾出现
-1990 m 的假层），以及按 `--bbox` 只读相交瓦片（德国 z11 mosaic 是 54×73 张 ≈ 625 MB，全读慢且吃内存）。

实测：europe 500 m / 1.27 MB（z7–10）、germany 200 m / 3.45 MB（z10–13）、fulda 25 m / 1.37 MB（z13+），
单文件都在 4 MB 闸内，顶点合计 445k，只在视口相交时装载。

要点：`band` 属性必须由装配端写进 feature（`contourGeoJson(doc, band)`），否则三档 filter 全落空；
档区间必须首尾相接且不重叠，重叠会让同一块地形画两条不同精度的线。


### v1.68 NE 铁路重烘与地势图图册化

铁路在 z9–10 出现「碎、歪、海上跑线」，追查全部指向烘焙脚本的三个静默过滤器（详见 PITFALLS A13）：
`MINLEN 18 km` 在俄罗斯一屏删掉 647 段里的 494 段、RDP 容差写成度导致高纬各向异性、
不读属性表于是 `Railroad ferry` 轮渡和 `ne_1d4_north_america_dup` 副本一起进了产物。

重烘后按 `disp_scale` 分两档：`rails_world_fine`（1:10m/1:5m/1:3m，15738 段 / 2.21 MB，z3–12）、
`rails_world_coarse`（1:20m–1:80m，8100 段 / 1.71 MB，z1–3）。体积 3.30 → 3.92 MB，段数 2.1 倍，
同一视野（49–60°E / 55–61°N）可见段数 153 → 647。样式侧改成 `railWorldLayers({…haloMin, opacity, hatch})`，
global 层补上枕木（z9+），观感与本地烘焙层对齐。

低倍连续性另修两处：① 相机 `minZoom` 是 1，铁路层原从 z3 起，缩到 z1–2 整层消失；② 粗档只有 8100 段，
若让它铺 z4–5，从 z5 缩到 z4 时俄罗斯一屏会从 566 段掉到 81 段，看起来像「一片线路消失」。现在精细档
一路铺 **z3–12**，粗档只负责 **z1–3** 的全球骨架（无光晕、只开墨线、opacity 0.6→1），`railWidth` 加
z1 = ×0.22 / z3 = ×0.32 两档；粗档不裁剪，否则 z1–2 会在德国/富尔达 bbox 内出现空洞。

地势图同期改成图册式：新增 `color-relief` 分层设色层（`relief-tint__<dem>`，绿→黄→褐，地势档
opacity 0.62），城区灰块 / 建筑 / 设施面 / 气泡全部不画，只留地形、等高线、水系、铁路与主干公路、
地名。分层设色归「晕渲」叶，用地图（relief=false）自动隐藏；样式快照 171 → 175 层。


全部踩坑已迁往 `PITFALLS.md`（按严重度排序，会话开头必读）。

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
