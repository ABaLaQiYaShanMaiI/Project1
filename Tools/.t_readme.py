import io
p = r'E:\PersonalGame\Project1\Readme.md'
s = io.open(p, encoding='utf-8').read()

old_row = "| 射程圈 | 运行时 | 单击放中心，5 级同心圆 |"
new_row = old_row + "\n| 地块 | `data/cities.json` + 运行时方格 | UTM 公里方格：乡村一格 8 km，城市按规模裂成 1–4 km；单击染成阵营色 |"
assert old_row in s
s = s.replace(old_row, new_row)

old_op = "- 顶部工具条：**格网**、**射程圈**（选中后单击放中心，左下滑块调圈距）、当前 FPS；"
new_op = "- 顶部工具条：**格网**、**射程圈**（选中后单击放中心，左下滑块调圈距）、**地块**、当前 FPS；\n- **地块**：z12 以上显示，单击 = 用兵牌面板选的阵营占领，再点取消，Shift+单击清除；左上角面板显示格数 / 最细边长 / 生成耗时；"
assert old_op in s
s = s.replace(old_op, new_op)

old_pipe = """# 5) 等高线矢量（需要该区域 DEM 已烘好）
python Tools/bake_contours.py --key=fulda --bbox=8.849,50.240,10.591,51.000
```"""
new_pipe = """# 5) 等高线矢量（需要该区域 DEM 已烘好）
python Tools/bake_contours.py --key=fulda --bbox=8.849,50.240,10.591,51.000

# 6) 城镇索引（地块系统的唯一数据：全世界 5,615 座城 / 73 KB）
node Tools/bake_cities.mjs
node Tools/bake_cities.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=13 ^
  --kinds=city,town,village --out=app/public/data/cities_fulda.json
```"""
assert old_pipe in s
s = s.replace(old_pipe, new_pipe)

old_dir = "| `app/src/core/geo.ts` | UTM 正算、格网生成、射程圈 |"
new_dir = old_dir + """
| `app/src/core/cells.ts` | 地块规则：UTM 方格四叉、城市覆盖率、420 格预算 |
| `app/src/data/cities.ts` | 城镇索引（base64 二进制 + 0.5° 桶索引） |
| `app/src/map/cellLayer.ts` | 地块图层：GeoJSON source、feature-state 归属、拾取与悬停 |
| `Tools/bake_cities.mjs` | 从 PMTiles 的 `places` 点烘城镇索引 |
| `Tools/mvt.mjs` | 零依赖 MVT 解码（烘焙期用，zigzag 几何） |"""
assert old_dir in s
s = s.replace(old_dir, new_dir)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('readme ok')
