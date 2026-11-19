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
