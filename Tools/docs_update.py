import io
import re

ROOT = r"G:\PersonalGame\Project1"


def read(path):
    return io.open(path, encoding="utf-8").read()


def write(path, text):
    io.open(path, "w", encoding="utf-8", newline="").write(text)


devlog = read(ROOT + r"\DEVLOG.md")
anchor = "## 技术决策与原因"
entry = """### v1.64 阶段性收尾（本轮会话总览）

#### 本轮做完的事

| 方向 | 结果 |
| --- | --- |
| 全球铺开 | world8（z7–8）/ world9（z9–10）/ 德国（z11–12）/ 德国 z13 四个包落地，europe 包退役 |
| 全球旁挂 | NE 铁路（11261 线 / 3.3 MB）、机场 893、港口 1081、建成区面 1.8 MB |
| 建筑表达 | 建筑密度镜像瓦片替代独栋轮廓（富尔达核心 156 张 / 0.14 MB，对比矢量 3 MB） |
| 符号简化 | 车站不建模备用车道；焦点地块改为专属色块 + 少量定位点 |
| 体积 | 坡度改调色板 PNG（56.6→31.1 MB）；构建产物 3.9 GB → 1.8 MB |
| 质量闸 | 新增第 8 道「样式表达式合法」，能抓出嵌套 zoom 导致的整图不渲染 |
| 观感修复 | 图层语义排序（面→线→注记）、铁路容差收紧、铁路分层单档、城区不压注记 |
| 交互 | 差量可见性更新；点击到首帧 74–84 ms → 24–26 ms |

#### 当前状态（可直接接手）

```
矢量：world z0–6 → world8 z7–8 → world9 z9–10 → germany z11–12 → germany13 z13 → fulda → core z14–15
地形：dem/world z0–5 · dem/europe z6–8 · dem/fulda z9–11 · dem/germany z11；slope 四套调色板 PNG
符号：站场/医院/机场/港口/厂区五种地块色块；机场/港口/车站三个定位点
校验：node Tools/check_all.mjs → 8 项（注释/行数/数据体量/tsc/vite/首屏 JS/样式表达式）
```

#### 已知缺口

1. z11–13 之外的全球铁路仍是 NE 1:10m 骨架，城际走向近似直线。
2. 跨缩放档（z7/9/11/13/14）仍会重建样式，有 1–4 s 停顿；动态 zoom-range 试过但档位区间重叠，已回退。
3. 等高线只有富尔达；全球 DEM 只到 z5。
4. 建筑密度瓦片只烘了富尔达核心 z15，z14 与德国都没有。
5. `world9` 占总量 56%（2985 MB），是体积上的主要负担。

#### 下一步优先级建议

1. 跨档重建改「互斥档位 + 动态区间」，消掉 1–4 s 停顿
2. 建筑密度瓦片铺到德国 z13–14
3. 全球铁路若要更准，按国家切 z9–10 包（每国几百 MB）

## 技术决策与原因"""
if anchor not in devlog:
    raise SystemExit("devlog anchor missing")
devlog = devlog.replace(anchor, entry, 1)
write(ROOT + r"\DEVLOG.md", devlog)

changelog = read(ROOT + r"\CHANGELOG.md")
changelog = changelog.rstrip() + """

### v1.0.20 全球铺开与战役焦点符号

- 新增 world8（z7–8）/ world9（z9–10）/ 德国（z11–12）/ 德国 z13 四个矢量包，欧洲包退役
- 全球铁路、机场、港口、建成区面接入 Natural Earth；铁路容差由 1.1 km 收紧到 390 m
- 建筑改「密度镜像瓦片 + 城区面」，不再画独栋轮廓；富尔达核心试点 0.14 MB
- 车站不建模备用车道，改「站区面 + 站点」；地块符号收敛为站场/医院/机场/港口/厂区五类
- 图层改为语义排序（面→界→道路→铁路→等高线→注记→格网→点位），灰块不再压地名
- 坡度瓦片改调色板 PNG（省 45%）；构建产物由 3.9 GB 降到 1.8 MB
- 新增第 8 道质量闸「样式表达式合法」，防止嵌套 zoom 导致整图不渲染
- 交互：图层可见性改差量更新，点击到首帧 74–84 ms → 24–26 ms
"""
write(ROOT + r"\CHANGELOG.md", changelog)
print("devlog/changelog ok")
