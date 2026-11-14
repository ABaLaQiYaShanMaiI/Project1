# 战术地图军棋 · Tactical Map Wargame

冷战作战级兵棋：真实世界地图 + 自然时间流逝 + 暂停/倍速；玩家只操作北约兵牌；
结束生成史料风格战报。

**当前进度 v0.7：世界视图 + 无网格战场 + 城镇形态 + 实控范围；编制与行军未接入。**

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
| 世界 | Web Mercator 瓦片金字塔（z0–z6，当前数据到 z3），自由平移缩放；黄框当前战场、绿框已记录战场；框选后一键烘焙 |
| 战场 | 当前区域（默认富尔达缺口 111×72 km）：地形、等高线、路网、城镇分区、实控范围 |
| 层级 | L0 战略（全局路网 + 主城）/ L1 战役（二级路网 + 乡镇）/ L2 战术（村名 + 25m 等高线） |

## 世界底图（瓦片金字塔）

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
| `app/public/data/` | 烘焙数据（战场 1.9MB + 世界底图 0.7MB），全程离线 |
| `Tools/bake_map.py` | 区域烘焙（`--center / --span-km / --name / --title`） |
| `Tools/bake_service.mjs` | 本地烘焙服务与地图库接口（`/api/bake`、`/api/zones`） |
| `Tools/make_preview.py` | 战场预览图（`preview_<区域>.jpg`，loading 背景用） |
| `Tools/bake_world.py` | 世界底图瓦片金字塔（`--download` / `--from-cache` / `--from-image`） |
| `Tools/bake_world_vectors.py` | 世界层矢量（Natural Earth 城市 + 主干道 → `world/vectors.json`） |
| `Tools/serve.mjs` | 零依赖静态服务器（启动器用） |
| `Tools/strip_comments.mjs` `tools/strip_comments.py` | 去注释 / 自检（代码不允许注释） |

## 性能（实测）

战场：22,085 条路段、97 座城镇，60 FPS，每帧绘制 0.1ms，静态层重建 13–33ms。

## 待办

1. 世界视图分块加载（当前单张 2048² 底图，放大糊）。
2. 编制数据与行军 —— 兵牌上地图。
3. 单位接入后控制场改为动态生成（占领点 + 半径）。
4. 需求台账按无网格重写 §3/§7/§16。
