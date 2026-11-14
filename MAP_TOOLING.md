# 地图数据与工具选型（MAP TOOLING）

结论先说：**地图底子全部用现成的开放数据与工具，我们只做"兵棋语义"那一层**
（城区分区、战斗宽度、控制区、单位）。尤其是城区掩膜，不该再用 OSM `landuse` 或街道密度自己推。

---

## 一、可用的现成数据 / 工具

| 类别 | 名称 | 许可 | 用途 | 规模 |
| --- | --- | --- | --- | --- |
| 底图瓦片 | [Protomaps Basemap](https://docs.protomaps.com/basemaps/downloads) | ODbL（需署名） | 现成的全球矢量底图，单文件 PMTiles，z0–15 | 全球约 **120 GB**，可按区域裁剪 |
| 瓦片格式 | [PMTiles](https://docs.protomaps.com/pmtiles/) | BSD | 单文件瓦片包，支持 HTTP Range 按需读取，**天然适合单机离线** | — |
| 地形 | [Mapterhorn](http://mapterhorn.com) / AWS Terrain Tiles | 开放 | 全球高程（Terrarium RGB），我们已在用后者 | 全球 |
| 建筑 | [Microsoft Building Footprints](https://github.com/microsoft/GlobalMLBuildingFootprints) | ODbL | 卫星影像提取的全球建筑轮廓，覆盖远超 OSM | 十亿级 |
| 建筑/地点 | [Overture Maps](https://overturemaps.org) | CDLA-Permissive 2.0（部分层含 ODbL 来源） | OSM + 微软 + 其他融合，建筑/道路/地名 | 十亿级 |
| 土地覆盖 | [ESA WorldCover](https://docs.planet.com/data/public-data/other-datasets/esa-worldcover/) | CC BY 4.0 | **10m** 全球地表分类，含 built-up / 林地 / 水体 | 全球，264 个 3°×3° 瓦片 |
| 水体 | JRC Global Surface Water | 开放 | 全球地表水 | 30m |
| 国界/城市点位 | Natural Earth | 公有领域 | 世界视图的低分辨率基底 | 小 |
| 工具链 | osmium / planetiler / tippecanoe / pmtiles CLI | 开源 | 抽取、切片、裁剪区域 | — |
| 渲染 | MapLibre GL JS / OpenLayers / Leaflet | BSD | 若有需要，直接接入矢量瓦片底图 | — |

> 我们的地图已经全程离线、自绘 Canvas，**不需要为了"用工具"而换渲染器**；
> 需要换的是**数据来源**：城区、建筑、土地覆盖都用上面这些成熟数据集。

---

## 二、和当前实现的对照

| 项 | 现在的做法 | 应该换成 | 收益 |
| --- | --- | --- | --- |
| 城区掩膜 | OSM 街道密度 + 形态学闭运算（80m） | **ESA WorldCover built-up 类（10m）** | 全球一致、真实边界、不再靠阈值调参 |
| 建筑 | OSM `building=*`（单城 0.3–1.6 MB） | **Overture / Microsoft footprints** | 小城镇覆盖率显著提升 |
| 道路 | OSM 分级路网（22k 条） | 保持 | 已经够用 |
| 高程 | AWS Terrarium 瓦片 | 保持（或 Mapterhorn PMTiles） | 已够用 |
| 全球缩放 | 单张 2048² 晕渲图 | **Protomaps PMTiles 裁区域** | 真能放大而不糊 |

---

## 三、"自己把全世界地图做出来"可行吗

**不可行，也不需要。**

- OSM 全球 PBF 约 80 GB；Protomaps 全球底图 120 GB；全球建筑十亿级（矢量化后 TB 级）。
- 即使只做地形 + 路网，全世界烘焙一次也是 TB 级、数周机时。
- 但**游戏从不需要同时加载全世界**：一局战场 100×70 km、城市细节几公里，
  按需烘焙完全够用（我们现在的做法就是对的）。

正确的架构是两层：

```
全球层（轻）   世界视图用低分辨率底图 + 城市点位，几 MB
区域层（按需） 玩家选一个区域 → 烘焙 → 1.7 MB 战场 + 0.3–1.6 MB/城细节
```

这正是 Protomaps 的 `pmtiles extract` 在做的事：从 120 GB 全球包里裁出你需要的区域。

---

## 四、建议的落地顺序

1. **城区掩膜换成 ESA WorldCover（10m built-up）** —— 单一改动，直接解决"城镇形态不贴合"。
   - 取覆盖战场的 3°×3° 瓦片；读 GeoTIFF 的 class=50（Built-up）；
   - 阈值化 + 连通分量 → 城区掩膜；同时用它替换 `urban_mask.png`。
   - 依赖：需要能读 GeoTIFF（`rasterio`，或 `Pillow` 的 TIFF 支持）。这要改 `CONSTRAINTS.md` 的依赖白名单。
2. **建筑改 Overture / Microsoft** —— 覆盖更全，格式为 GeoParquet，用 `duckdb`/`geopandas` 抽区域。
3. **世界层换 PMTiles** —— 为"全球任意缩放"做准备；`pmtiles extract --bbox` 裁区域。

---

## 五、许可注意

- **ODbL（OSM / Protomaps / Microsoft footprints）**：署名 + 若分发衍生数据库需同样开放。
  游戏内已有署名位，发布时需保留，并考虑公开我们烘焙出的衍生数据。
- **CC BY 4.0（WorldCover）**：署名即可。
- **CDLA-Permissive 2.0（Overture 部分层）**：最宽松，但融合层可能含 ODbL 来源，按 ODbL 处理更稳妥。
- 现有署名文案需按最终使用的数据源更新（目前在页面右下角）。

---

## 六、"实时全球地图"评估（实测，2026-11-14）

结论：**不做运行时在线地图；做"按需烘焙 + 永久落盘"的地图库。**

| 方案 | 可行性 | 结论 |
| --- | --- | --- |
| 运行时直连 `tile.openstreetmap.org` | 政策明确禁止 bulk / prefetch / 离线打包，无预警封禁 | 否决 |
| 运行时直连公共 Overpass | 实测 `overpass-api.de` 502、`overpass.kumi.systems` 30 s 超时 | 否决为运行时依赖 |
| 浏览器直读 DEM（AWS Terrarium） | 实测响应无 `Access-Control-Allow-Origin`，canvas 会被污染 | 不可行 |
| 第三方托管（MapTiler / Mapbox / Protomaps Hosted） | 需 key 与配额，条款限制离线缓存，且引入联网依赖 | 仅作备选 |
| **本机服务按需烘焙（现在的做法）** | Overpass + DEM 一次拉取，写盘后永久离线 | **采用** |

实现：`Tools/bake_service.mjs` 提供 `/api/bake`、`/api/zones`，前端在世界视图框选后一键生成。
烘焙耗时由 DEM 缓存命中率决定，界面给出真实阶段与进度；失败（如 Overpass 502）可见日志与重试入口。

后续若要做"全球不糊"，正确方向是**本地瓦片金字塔 + Natural Earth 矢量叠加**（见第二节表格），
而不是接在线瓦片。
