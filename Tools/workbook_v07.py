import shutil
import sys
from copy import copy

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

sys.stdout.reconfigure(encoding="utf-8")

SRC = r"G:\PersonalGame\Project1\Docx\战术地图军棋_需求规格总表_v0.6.xlsx"
DST = r"G:\PersonalGame\Project1\Docx\战术地图军棋_需求规格总表_v0.7.xlsx"

shutil.copyfile(SRC, DST)
wb = load_workbook(DST)

HEAD = PatternFill("solid", fgColor="DCE6F1")

ws = wb["19 世界地图现状"]
ws.delete_rows(1, ws.max_row)
rows = [
    ["19 世界地图现状（v1.64 实测）", "", ""],
    ["口径：本表记录代码与磁盘数据的实际状态，不是计划。体积取自 app/public/data。", "", ""],
    ["", "", ""],
    ["一、矢量底图（tiles/index.json）", "", ""],
    ["world.pmtiles", "z0–6 · 42 MB", "全球铺满：大洲/国界/主要路网/城市点"],
    ["world8.pmtiles", "z7–8 · 476 MB", "全球村镇级路网与地名"],
    ["world9.pmtiles", "z9–10 · 2985 MB", "全球街区级路网；单文件最大，约占总量 56%"],
    ["germany.pmtiles", "z11–12 · 689 MB", "德国全区"],
    ["germany13.pmtiles", "z13 · 879 MB", "德国全区，与富尔达同级细节"],
    ["fulda.pmtiles", "z0–13 · 42 MB", "富尔达缺口，z13 由 germany13 覆盖"],
    ["fulda_core.pmtiles", "z14–15 · 3.2 MB", "城区核心 0.12° × 0.12°"],
    ["", "", ""],
    ["二、旁挂数据", "", ""],
    ["dem/<key>", "z0–5 全球 + z6–8 中欧 + z9–11 德国（520 MB）/ 富尔达 · 约 642 MB", "Terrarium PNG；档间互斥（world 0 / europe 6 / germany 9），同一处只叠一层晕渲与分层设色"],
    ["dem/germany z9–10", "v1.70 补烘", "此前 z9–10 用全球 z5（16–32 倍 overzoom），地形糊"],
    ["slope/<key>", "39.4 MB（germany z9–11 33.6 MB）", "调色板索引 PNG，6 级坡色（仅 nodata 透明），比 RGBA 省 45%；地势图默认开启"],
    ["density/fulda", "0.14 MB / 156 张", "建筑密度镜像瓦片（z15），替代独栋建筑轮廓"],
    ["rails_world_fine.json", "2.21 MB / 15738 段", "Natural Earth 1:10m/1:5m/1:3m，z3–12，米制 300 m 容差"],
    ["rails_world_coarse.json", "1.71 MB / 8100 段", "NE 1:20m–1:80m 骨架线，z1–3（无光晕、不裁剪）；轮渡与北美副本已剔除"],
    ["poi_world.json", "0.07 MB", "全球机场 893 + 港口 1081"],
    ["poi_<区域>.json", "德国 702 KB / 富尔达 11 KB", "机场、港口、桥隧、车站"],
    ["urban_world.json", "1.8 MB", "NE 1:10m 建成区面，z4–9"],
    ["contours_fulda.json", "1.37 MB", "25 m / 125 m 两级等高线，z13+（富尔达）"],
    ["contours_germany.json", "3.45 MB / 242823 顶点", "200 m / 400 m 计曲线，z10–13（德国 bbox，DEM z11）"],
    ["contours_europe.json", "1.27 MB / 88456 顶点", "500 m / 1500 m，z7–10（中欧 0–20°E / 44–56°N）"],
    ["", "", ""],
    ["三、符号与地块（v1.64 定稿）", "", ""],
    ["站场地块", "landuse railway / platform", "砖红 0.26 + 深红描边，z10+"],
    ["医院地块", "landuse hospital", "朱红 0.30，z13+"],
    ["机场地块", "landuse aerodrome / airfield", "蓝灰 0.26，z9+"],
    ["港口地块", "landuse harbour / port", "青蓝 0.28，z9+"],
    ["厂区地块", "landuse industrial", "石板灰 0.22，z11+"],
    ["定位气泡", "poi：airport / port / station", "机场 z5、港口 z4、车站 z9；其余气泡不保留"],
    ["不做的", "电厂 / 水厂", "瓦片 landuse 无 power_plant / water_works 字段，放弃"],
    ["", "", ""],
    ["四、已验证的关键指标", "", ""],
    ["首屏可交互", "1.2–2.1 s", "headless + D3D11，5 个包"],
    ["首屏 JS", "48.9 KB gzip", "check_all 第 7 项"],
    ["点击到首帧", "24–26 ms", "z13 视角，差量可见性 + 单档铁路"],
    ["构建产物", "1.8 MB", "publicDir:false，数据不进 dist"],
]
for r in rows:
    ws.append(r)
    ws.cell(ws.max_row, 1).alignment = Alignment(vertical="top", wrap_text=True)
    ws.cell(ws.max_row, 2).alignment = Alignment(vertical="top", wrap_text=True)
    ws.cell(ws.max_row, 3).alignment = Alignment(vertical="top", wrap_text=True)
for cell in ws[1]:
    cell.font = Font(bold=True, size=12)
for row in ws.iter_rows(min_row=4, max_row=ws.max_row, min_col=1, max_col=1):
    c = row[0]
    if c.value and str(c.value).startswith(("一、", "二、", "三、", "四、")):
        c.font = Font(bold=True)
        for cell in ws[c.row]:
            cell.fill = HEAD
ws.column_dimensions["A"].width = 24
ws.column_dimensions["B"].width = 34
ws.column_dimensions["C"].width = 62

cl = wb["16 变更记录"]
add = [
    ["v0.7", "2026-11-20", "地图符号收敛：车站不建模备用车道，改「站区面 + 站点」；焦点地块（车站/医院/机场/港口/厂区）改为专属色块并按重要度分层；电厂水厂放弃；气泡仅保留机场/港口/车站。", "本轮讨论 · 见 DEVLOG v1.60–v1.63"],
    ["v0.7", "2026-11-20", "底图分层由「world+europe+fulda」改为「world+world8+world9+germany+germany13+fulda+core」，欧洲包退役。", "DEVLOG v1.52–v1.53"],
    ["v0.7", "2026-11-20", "NE 铁路重烘：只收 Railroad、剔除轮渡与北美副本、米制 300 m 容差、取消长度门槛，按尺度分 fine(z5–12)/coarse(z3–5) 两档。", "DEVLOG v1.68 · PITFALLS A13"],
    ["v0.7", "2026-11-20", "地势·交通图改为图册式：新增高程分层设色（绿→黄→褐），城区灰块/建筑/设施面/气泡不再绘制。", "DEVLOG v1.68"],
    ["v0.7", "2026-11-20", "等高线三档阶梯：中欧 500 m（z7–10）/ 德国 200 m（z10–13）/ 富尔达 25 m（z13+），一档只画一套。", "DEVLOG v1.69 · MAPDESIGN §五"],
    ["v0.7", "2026-11-20", "地形档互斥（world/europe/germany）+ 德国 z9–10 补烘 DEM + 分层设色改色阶；铁路补 z10–11 断档；修复每次平移都重建样式。", "DEVLOG v1.70 · PITFALLS A15"],
    ["v0.7", "2026-11-20", "地势图改彩色分层设色：16 级色阶、三档各按等高距取步长、0.88 不透明（图册风）。", "DEVLOG v1.71"],
    ["v0.7", "2026-11-20", "坡度通行默认开启（配色不变，仅开关）；坡度档与 DEM 同表互斥，德国坡度补到 z9–10；透明方案已回滚。", "DEVLOG v1.72"],
    ["v0.7", "2026-11-20", "新增「跨级显示细节」开关：道路/跑道/设施气泡可跨比例尺保留（setLayerZoomRange，可还原）。", "DEVLOG v1.73"],
]
for row in add:
    cl.append(row)
    for i in range(1, 5):
        cl.cell(cl.max_row, i).alignment = Alignment(vertical="top", wrap_text=True)

spec = wb.create_sheet("20 地图符号规范")
spec.append(["20 地图符号与地块规范（v0.7）", "", "", "", ""])
spec.append(["原则：地块用面表达，定位用点表达；面在下、注记在上；同类地块不叠加气泡。", "", "", "", ""])
spec.append(["类别", "数据来源", "表达", "起始缩放", "备注"])
spec_rows = [
    ["站场", "landuse railway / platform", "砖红面 0.26 + 深红描边", "10", "不建模备用车道"],
    ["车站", "pois kind=railway", "墨色圆点 1.8–4 px", "9", "与机场同构"],
    ["医院", "landuse hospital", "朱红面 0.30", "13", "只保留街区级可见"],
    ["机场", "landuse aerodrome / airfield", "蓝灰面 0.26 + 深蓝点", "9 / 5", "点用于远距离定位"],
    ["港口", "landuse harbour / port", "青蓝面 0.28 + 青点", "9 / 4", "内陆无面时只出点"],
    ["厂区", "landuse industrial", "石板灰面 0.22", "11", "成片厂区整片着色"],
    ["军事用地", "landuse military", "既有褐棕面", "8", "保持不变"],
    ["电厂/水厂", "（无数据）", "不表达", "—", "瓦片缺字段，放弃"],
    ["地形晕渲/坡度", "dem / slope/<key>", "栅格，面层最底", "3 / 6", "坡度调色板 PNG"],
    ["分层设色", "dem/<key>", "color-relief 16 级彩色阶：绿→黄→橙→褐→雪线白", "3", "按档等高距对齐，地势图 0.88 不透明"],
    ["建筑密度", "density/<key>", "栅格，铺在城区面之上", "14", "替代独栋建筑轮廓"],
]
for row in spec_rows:
    spec.append(row)
spec.append([])
spec.append(["图层顺序（自下而上）", "背景 → 面（填充/栅格/晕渲）→ 行政界 → 道路 → 铁路 → 等高线 → 注记 → 格网 → 射程圈 → 点位", "", "", ""])
for cell in spec[1]:
    cell.font = Font(bold=True, size=12)
for cell in spec[3]:
    cell.font = Font(bold=True)
    cell.fill = HEAD
spec.column_dimensions["A"].width = 18
spec.column_dimensions["B"].width = 34
spec.column_dimensions["C"].width = 30
spec.column_dimensions["D"].width = 10
spec.column_dimensions["E"].width = 30
for row in spec.iter_rows(min_row=1, max_row=spec.max_row, max_col=5):
    for cell in row:
        cell.alignment = Alignment(vertical="top", wrap_text=True)

wb.save(DST)
print("saved", DST)
print("sheets", [ws.title for ws in wb.worksheets])
