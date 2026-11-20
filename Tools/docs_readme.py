import io

ROOT = r"G:\PersonalGame\Project1"
path = ROOT + r"\Readme.md"
text = io.open(path, encoding="utf-8").read()

packs_old = "| 全球 z7–8 | `tiles/world8.pmtiles` | z7–z8 全世界（476 MB），村镇级标注与路网 |"
packs_new = """| 全球 z7–8 | `tiles/world8.pmtiles` | z7–z8 全世界（476 MB），村镇级标注与路网 |"""
text = text.replace(packs_old, packs_new)

germany_row = "| 区域矢量（德） | `tiles/germany.pmtiles` | 德国 z11–12（689 MB），街区级路网与地名 |"
if germany_row not in text:
    text = text.replace(
        "| 全球 z9–10 | `tiles/world9.pmtiles` | z9–z10 全世界（3.0 GB），街区级路网与更密地名 |",
        "| 全球 z9–10 | `tiles/world9.pmtiles` | z9–z10 全世界（3.0 GB），街区级路网与更密地名 |\n"
        "| 区域矢量（德 z11–12） | `tiles/germany.pmtiles` | 德国全区（689 MB） |\n"
        "| 区域矢量（德 z13） | `tiles/germany13.pmtiles` | 德国全区（879 MB），与富尔达同级 |",
        1,
    )

old_next = text[text.index("## 下一步"):] if "## 下一步" in text else ""
new_next = """## 下一步

1. **跨档停顿**：z7/9/11/13/14 跨档会重建样式，1–4 s；需改成「档位互斥 + 动态 zoom-range」。
2. **建筑密度瓦片**：目前只烘富尔达核心 z15，铺到德国 z13–14 收益明确。
3. **全球铁路精度**：NE 1:10m 仍是骨架；若要城际弯曲准确，按国家切 z9–10 包（每国几百 MB）。
4. **等高线**：只有富尔达；全球 DEM 到 z5，z8+ 需补区域 DEM。
5. 城区影响接进移动/交战解算（单位数值模型落地后）。

## 接手速览（v1.64）

```
读 PITFALLS.md（坑）→ DEVLOG 顶部 v1.64（状态快照）→ 本文「现在有什么」→ MAPDESIGN（设计）
跑 node Tools/check_all.mjs（8 道闸，全绿才算完）
需求台账：Docx/战术地图军棋_需求规格总表_v0.7.xlsx（20 张表，含「20 地图符号规范」）
```

- 图层顺序固定为：面 → 行政界 → 道路 → 铁路 → 等高线 → 注记 → 格网 → 射程圈 → 点位
- 车站不建模备用车道；焦点地块用色块（站场/医院/机场/港口/厂区），定位只用三种气泡
- 电厂/水厂数据缺失，已放弃，不要重复尝试
"""
if old_next:
    text = text.replace(old_next, new_next)
io.open(path, "w", encoding="utf-8", newline="").write(text)
print("readme ok", "接手速览" in text)
