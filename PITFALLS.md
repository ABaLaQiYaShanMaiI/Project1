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

A12. **CSS 规则体丢失会吞掉文件后半的规则（整页黑屏）**：合并选择器时把某条规则体删丢只剩 `.x {` 开头，浏览器从未闭合块起吞掉后续约一半规则——`.ml-wrap`/`.main` 的布局与背景全部失效，页面只剩深色壳。行数闸不查 CSS 结构（v1.67 实际发生，用户先撞见）；v1.67 起 check_all 第 9 道闸「CSS 结构」拦花括号配平与声明分号。

A13. **NE 铁路烘焙的三个静默过滤器一起毁线网**：① 按长度 `MINLEN 18 km` 丢短段——俄罗斯一屏（49–60°E / 55–61°N）源数据 647 段里删掉 494 段（76%），画面碎成断枝；② RDP 容差用「度」`0.0035°`，58°N 上东西向只有 206 m、南北向 389 m，斜线被拉歪；③ 不读属性表，`featurecla = Railroad ferry`（波罗的海/英吉利/日本/库克海峡的轮渡）画成海上铁路，`part = ne_1d4_north_america_dup` 的 1508 条副本让北美双线。v1.68 起 `bake_ne_rails.py`：属性筛选 + 米制 300 m 容差 + 不设长度门槛 + 按 `disp_scale` 分 fine/coarse。

A14. **图层 `minzoom` 高于相机 `minZoom`，缩小到该值以下整层消失**：铁路全球层原从 z3 起，而相机 `minZoom` 是 1，缩到 z1–2 时一条都没有（看图会以为「铁路数据没加载」）。改分层区间时先把所有相关图层的 min/maxzoom 与相机 `minZoom`/`maxZoom` 对齐，并保证相邻档**首尾相接**；v1.70 起铁路为 z1–3 粗档（全球骨架）/ z3–12 精细档 / z3–11 区域烘焙层 / z11+ 瓦片，且粗档不做区域裁剪（否则 z1–2 在区域包 bbox 内出现空洞）。

A15. **「要不要重建」的签名与比较字符串不一致 → 每次 moveend 都重建整张样式**：`mountedRef` 里存的是 `zones|bandFrom`，而 moveend 回调先拿 `zones` 去比对（永远不等），于是**每次平移结束都全量重建样式**（1–4 s 停顿、图层闪一下），「跨档停顿」只是其中一个表象。v1.70 起两处共用 `viewSig()`（zones|bandFrom|demBand），DEM 换档也纳入签名。


1. **`file://` 打开必白屏**：`/src/main.tsx` 绝对路径 + `fetch('/data/...')` 被 CORS 拦。必须走 HTTP（`启动游戏.bat` 或 `npm run dev`）。
2. **`.mjs` MIME 不对整图不渲染**：模块 worker 依赖正确 MIME，由 `Tools/serve.mjs` 保证；换静态服务器先查这个。
3. **PowerShell 写文件会加 BOM**：JSON/TS/Python 带 BOM 直接解析失败（`Unexpected token '﻿'`）。写文件一律 UTF-8 无 BOM（.NET `UTF8Encoding($false)` / Python `io.open(..., 'utf-8')`）。
4. **换盘符后 `node_modules` 全废**：pnpm junction 记绝对路径，项目挪盘后 `tsc` 报 `Cannot find module`，看起来像「Node 没装」。重跑 `pnpm install` 即可，别先怀疑环境。
5. **底图 `earth` 没映射进 `groupOf()` 会盖住坡度**：earth 在每个 tier 都存在、不在任何开关组里，静默盖住坡度层，看起来像「坡度没生效」。新增底图层必须补映射；v1.67 起同时检查 `store.ts` 图种强度规则是否需要覆盖新图层。
6. **dev 下 Maplibre worker 被 Vite 注入 `/@vite/client`，整张图只剩栅格**：`import 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'` 在 dev 拿到的是 `/node_modules/.../maplibre-gl-worker.mjs`，浏览器再请求它时 Vite 会当源码 transform 并插入 HMR 客户端；worker 里没有 `document`，启动即抛，控制台只有一句 `Worker failed to load`，矢量/晕渲全空、坡度 PNG 还在。dev 改走 `/ml-worker.mjs`（`Tools/dev_static.mjs` 原样吐字节），生产仍用 `?url` 资产（v1.76）。

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
