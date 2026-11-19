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
