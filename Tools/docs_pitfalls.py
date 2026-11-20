import io

ROOT = r"G:\PersonalGame\Project1"
path = ROOT + r"\PITFALLS.md"
text = io.open(path, encoding="utf-8").read()

marker = "## A · 白屏 / 全灭级\n"
add = """## A · 白屏 / 全灭级

6. **调色板 PNG 的 `tRNS` 写错会让整张样式被拒**：PIL 对 P 模式若把 `info['transparency']` 设成 bytes 列表，写出的 tRNS 规范，浏览器报 `InvalidStateError: The source image could not be decoded`，MapLibre 直接放弃整张样式（只剩 4 个图层），看起来像「所有图层都没了」。正确写法是**单索引整数**（`info['transparency'] = 索引号`），且所有透明像素必须落在同一个索引上。
7. **样式表达式里 `zoom` 只能出现在顶层 `interpolate`/`step`**：嵌进 `case` 或乘法里会抛 `"zoom" expression may only be used as input to a top-level ...`，同样整图不渲染，而 `tsc`/`vite build` 全绿。已加第 8 道闸 `Tools/style_lint.mjs` 拦截。
8. **同一个已加载样式里，各 tier 的图层区间会重叠**：MapLibre 的 `maxzoom` 在这里是包含式，`germany(11–12)` 与 `germany13(13)` 会在 z13 同时可见，于是铁路/道路叠画成黑块。跨档时重建样式（当前做法）比动态调区间可靠。
9. **`buildings` 层删掉后城区会露白**：没有 landuse 覆盖的地方直接显示纸底；删层同时要保留一层浅建筑填充或密度瓦片，否则「灰块没盖住」会被当成 bug。
10. **DEM 批量转 WebP 中途被打断会留下 0 字节瓦片**：这些空文件同样触发 `source image could not be decoded`。转换脚本必须幂等、可续跑，转换失败要回滚（`Tools/dem_restore_png.py`）。
11. **烘焙铁路的链式拼接极易错接**：端点按网格吸附后若「头/尾扩展」共用一个分支判断，会把不相连的两段接成几十公里的直线，看起来像「曲线变直、断链、跨海」。修好的版本在 `Tools/bake_rail.mjs`，改动前先看 `rails_new_plot` 式的可视化验证。

"""
if marker not in text:
    raise SystemExit("pitfalls anchor missing")
text = text.replace(marker, add, 1)
io.open(path, "w", encoding="utf-8", newline="").write(text)
print("pitfalls ok")
