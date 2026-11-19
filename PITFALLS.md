# 踩坑索引（PITFALLS）

只收录「再次遇到会浪费超过 30 分钟」的坑，按严重度排序。会话开头先扫这份文件；
完整决策与版本历史见 `DEVLOG.md` / `CHANGELOG.md`。

## A · 白屏 / 全灭级

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
