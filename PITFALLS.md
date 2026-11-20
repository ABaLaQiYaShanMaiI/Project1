# 踩坑索引（PITFALLS）

只收录「再次遇到会浪费超过 30 分钟」的坑，按严重度排序。会话开头先扫这份文件；
完整决策与版本历史见 `DEVLOG.md` / `CHANGELOG.md`。

## A · 白屏 / 全灭级

A6. **调色板 PNG 的 `tRNS` 写错会让整张样式被拒**：PIL 对 P 模式若把 `info['transparency']` 设成 bytes 列表，写出的 tRNS 规范，浏览器报 `InvalidStateError: The source image could not be decoded`，MapLibre 直接放弃整张样式（只剩 4 个图层），看起来像「所有图层都没了」。正确写法是**单索引整数**（`info['transparency'] = 索引号`），且所有透明像素必须落在同一个索引上。
A7. **样式表达式里 `zoom` 只能出现在顶层 `interpolate`/`step`**：嵌进 `case` 或乘法里会抛 `"zoom" expression may only be used as input to a top-level ...`，同样整图不渲染，而 `tsc`/`vite build` 全绿。已加第 8 道闸 `Tools/style_lint.mjs` 拦截。
A8. **同一个已加载样式里，各 tier 的图层区间会重叠**：MapLibre 的 `maxzoom` 在这里是包含式，`germany(11–12)` 与 `germany13(13)` 会在 z13 同时可见，于是铁路/道路叠画成黑块。跨档时重建样式（当前做法）比动态调区间可靠。
A9. **`buildings` 层删掉后城区会露白**：没有 landuse 覆盖的地方直接显示纸底；删层同时要保留一层浅建筑填充或密度瓦片，否则「灰块没盖住」会被当成 bug。
A10. **DEM 批量转 WebP 中途被打断会留下 0 字节瓦片**：这些空文件同样触发 `source image could not be decoded`。转换脚本必须幂等、可续跑，转换失败要回滚（`Tools/dem_restore_png.py`）。
A11. **烘焙铁路的链式拼接极易错接**：端点按网格吸附后若「头/尾扩展」共用一个分支判断，会把不相连的两段接成几十公里的直线，看起来像「曲线变直、断链、跨海」。修好的版本在 `Tools/bake_rail.mjs`，改动前先看 `rails_new_plot` 式的可视化验证。


1. **`file://` 打开必白屏**：`/src/main.tsx` 绝对路径 + `fetch('/data/...')` 被 CORS 拦。必须走 HTTP（`启动游戏.bat` 或 `npm run dev`）。
2. **`.mjs` MIME 不对整图不渲染**：模块 worker 依赖正确 MIME，由 `Tools/serve.mjs` 保证；换静态服务器先查这个。
3. **PowerShell 写文件会加 BOM**：JSON/TS/Python 带 BOM 直接解析失败（`Unexpected token '﻿'`）。写文件一律 UTF-8 无 BOM（.NET `UTF8Encoding($false)` / Python `io.open(..., 'utf-8')`）。
4. **换盘符后 `node_modules` 全废**：pnpm junction 记绝对路径，项目挪盘后 `tsc` 报 `Cannot find module`，看起来像「Node 没装」。重跑 `pnpm install` 即可，别先怀疑环境。
5. **底图 `earth` 没映射进 `groupOf()` 会盖住坡度**：earth 在每个 tier 都存在、不在任何开关组里，静默盖住坡度层，看起来像「坡度没生效」。新增底图层必须补映射。

## B · 浪费半天级

6. **`restyle()` 用带后缀的 layer id 判断**：第二层起 id 是 `buildings__detail_europe` 这类，`id === 'buildings'` 全不成立，整层走错分支（铁路画成路面）。判断前先剥 `__` 后缀。
7. **同一要素多层 minzoom 不一致**：铁路 ink/光晕/枕木三层 minzoom 不同，中间缩放段会「断线」。改一处时三层一起核对（`RAIL_MINZOOM`）。
8. **AWS 高程瓦片单连 ~20 KB/s**：烘焙必须并发（10 线程）+ 磁盘缓存 `Tools/.tile-cache/`。
9. **Overpass 大查询 502**：整块 bbox 查询被拒。合并成 union 查询 + 按面积分块 + 3/6/9 s 重试，缓存键带查询哈希。
10. **naciscdn.org 对 >15 MB 文件返回 403**：Natural Earth 底料改走 jsdelivr。
11. **Vite `fs.watch` 在 Windows EBUSY**：文件刚写入时 watch 报错退出，改 `usePolling: true`。
12. **`pnpm dev` 触发 minimumReleaseAge 校验失败**：直接 `node node_modules/vite/bin/vite.js`。
13. **OSM 道路被切成短 way**：按长度过滤会断网。不丢短段、简化容差 20–35 m。
14. **城镇形态两个失真源**：① 连通性判定城区——住宅路串网，整县连成一块（富尔达曾算出 24 km / 214 km²），必须用密度阈值 + 距离上限；② 外缘按正圆 / 同心圆建模——带状郊区拉到 12 km、同心圆装不下房子，改为从建成区顶点量真实伸出距离、半径取「容纳 80% 面积」并限幅。
15. **整文件重写长文档会丢记录**：曾覆盖 DEVLOG 丢掉两条版本记录。整理长文档只能插入/替换片段，动手前先 git 留底。

## C · 环境备忘

16. **本机 Node 在 `D:\Tools\node`**（便携 zip，无注册表），npm prefix/cache 与 pnpm store 都迁出 C 盘；PATH 备份在 `D:\Tools\env-backup\`。
17. **六角格时期数据全部作废**：`map_test.json`、hex 模块已删除，勿复辟。
