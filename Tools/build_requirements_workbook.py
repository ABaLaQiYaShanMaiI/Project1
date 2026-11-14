import math
import datetime

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule

FONT = "Microsoft YaHei"
NAVY = "1F3864"
BLUE = "2E5B9A"
PALE = "DCE6F1"
BAND = "F5F8FC"
GREY = "7F7F7F"
ORANGE = "FCE4D6"
YELLOW = "FFF2CC"

TITLE_FILL = PatternFill("solid", fgColor=NAVY)
SEC_FILL = PatternFill("solid", fgColor=BLUE)
HEAD_FILL = PatternFill("solid", fgColor=PALE)
BAND_FILL = PatternFill("solid", fgColor=BAND)

thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

TODAY = datetime.date.today().strftime("%Y-%m-%d")

def vw(text):
    s = "" if text is None else str(text)
    return sum(2 if ord(c) > 127 else 1 for c in s)

CJK_W = 1.9

def _is_wide(ch):
    cp = ord(ch)
    return (
        0x2E80 <= cp <= 0x9FFF
        or 0x3000 <= cp <= 0x303F
        or 0xFF00 <= cp <= 0xFFEF
        or 0xF900 <= cp <= 0xFAFF
    )

def _tokens(text, cjk_w=CJK_W):
    out = []
    buf = ""
    for ch in text:
        if ch == "\n":
            out.append(("nl", 0.0))
        elif ch == " ":
            if buf:
                out.append(("w", float(len(buf))))
                buf = ""
            out.append(("sp", 1.0))
        elif ord(ch) > 127:
            if buf:
                out.append(("w", float(len(buf))))
                buf = ""
            out.append(("c", cjk_w) if _is_wide(ch) else ("w", 1.0))
        else:
            buf += ch
    if buf:
        out.append(("w", float(len(buf))))
    return out

def wrap_lines(text, usable, cjk_w=CJK_W):
    if text is None:
        return 1
    text = str(text)
    if text.startswith("="):
        return 1
    lines, cur = 1, 0.0
    for kind, w in _tokens(text, cjk_w):
        if kind == "nl":
            lines += 1
            cur = 0.0
            continue
        if w > usable:
            lines += math.ceil(w / usable) - 1
            cur = w % usable if w % usable else 0.0
            continue
        if cur + w > usable + 1e-9:
            lines += 1
            cur = 0.0 if kind == "sp" else w
        else:
            cur += w
    return max(1, lines)

def est_height(texts, widths, base=15.0, pad=3.0, lo=18.0, hi=210.0):
    lines = 1
    for t, wd in zip(texts, widths):
        if t is None:
            continue
        lines = max(lines, wrap_lines(t, max(wd - 0.4, 4.0)))
    return min(max(lo, lines * base + pad), hi)

def build(ws, title, note, headers, rows, widths, tab, freeze="A4", band=True):
    n = len(headers)
    last = get_column_letter(n)

    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = tab

    for i, wd in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = wd

    ws.merge_cells(f"A1:{last}1")
    c = ws["A1"]
    c.value = title
    c.font = Font(name=FONT, size=14, bold=True, color="FFFFFF")
    c.fill = TITLE_FILL
    c.alignment = Alignment(vertical="center", horizontal="left", indent=1)
    ws.row_dimensions[1].height = 30

    ws.merge_cells(f"A2:{last}2")
    c = ws["A2"]
    c.value = note
    c.font = Font(name=FONT, size=9, italic=True, color="44546A")
    c.fill = PatternFill("solid", fgColor="F2F2F2")
    c.alignment = Alignment(vertical="center", horizontal="left", indent=1, wrap_text=True)
    ws.row_dimensions[2].height = max(20, est_height([note], [sum(widths)], 13, 5))

    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=3, column=j, value=h)
        c.font = Font(name=FONT, size=10, bold=True, color=NAVY)
        c.fill = HEAD_FILL
        c.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)
        c.border = BORDER
    ws.row_dimensions[3].height = max(24, est_height(headers, widths, 13.5, 6, 24))

    for ri, row in enumerate(rows, start=4):
        for j, val in enumerate(row, start=1):
            c = ws.cell(row=ri, column=j, value=val)
            c.font = Font(name=FONT, size=10, color="262626")
            c.alignment = Alignment(
                vertical="top", horizontal="left", wrap_text=True, indent=0
            )
            c.border = BORDER
            if band and (ri % 2 == 0):
                c.fill = BAND_FILL
        ws.row_dimensions[ri].height = est_height(row, widths)

    end = 3 + len(rows)
    if rows:
        ws.auto_filter.ref = f"A3:{last}{end}"

    if freeze:
        ws.freeze_panes = freeze

    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "1:3"
    return end

MOD_GEN = "项目概述"
MOD_TM = "时间系统"
MOD_MAP = "地图六角格"
MOD_ZOOM = "缩放层级"
MOD_UNIT = "兵牌单位"
MOD_FIRE = "交火系统"
MOD_CMD = "指挥链路"
MOD_BUILD = "战前构筑"
MOD_RPT = "战报史料"
MOD_UI = "界面交互"
MOD_DATA = "数据内容"
MOD_NFR = "非功能"
MOD_V1 = "首版切片"
MOD_TOWN = "城镇分区"
MOD_CTRL = "实控态势"

REQ = [

    ("GEN-01", MOD_GEN, "一句话定义",
     "六角格战术—战役级兵棋：融合「交火」的摇骰火力结算与「战争六角」的编制层级/指挥链路；自然时间流逝 + 倍速暂停的实时推进；玩家仅操作北约兵牌；结束自动生成史料风格战报。",
     "两期", "P0", "已确定", "人工评审", "§1.1", ""),
    ("GEN-02", MOD_GEN, "支柱① 时间即压力",
     "移动、展开、收缩都消耗游戏内时间；玩家在「暂停思考」与「实时推进」之间持续做决策。",
     "两期", "P0", "已确定", "A-02 / A-03", "§1.2", ""),
    ("GEN-03", MOD_GEN, "支柱② 尺度即信息",
     "缩放改变编制粒度与可操作集合；不重置时间状态，不免费获得信息。",
     "两期", "P0", "已确定", "A-04 / A-06", "§1.2", ""),
    ("GEN-04", MOD_GEN, "支柱③ 编制即战力",
     "父子层级聚合/展开；指挥链路决定加成与合法性。",
     "两期", "P0", "已确定", "A-04 / A-09", "§1.2", ""),
    ("GEN-05", MOD_GEN, "支柱④ 交火有代价",
     "接触/远程交火摇骰，地形、数值、指令共同修正；交火消耗游戏时间与行动资源。",
     "长期", "P2", "已确定", "后续版本设计评审", "§1.2", "首版不做"),
    ("GEN-06", MOD_GEN, "支柱⑤ 战报即奖励",
     "游戏结束生成史料风格报告，把玩家行动转写为可阅读、可收藏的战史文本。",
     "两期", "P1", "已确定", "A-10", "§1.2", ""),
    ("GEN-07", MOD_GEN, "目标平台",
     "PC 单机（Windows）；数据与规则层保持平台无关，规则库不依赖渲染/引擎 API。",
     "两期", "P1", "已确定", "架构评审", "§1.3", "技术栈待定 Q-02"),
    ("GEN-08", MOD_GEN, "阵营范围",
     "玩家方仅北约；首版不做华约/轴心兵牌与 AI；后续若加入仅作靶子或脚本敌人，不扩展为完整可操作阵营。",
     "首版", "P0", "已确定", "A-12", "§1.4 / §5.3", ""),
    ("GEN-09", MOD_GEN, "背景设定（待决策）",
     "冷战 或 二战 二选一；决定番号命名、年代、单位数据库与战报日期口径。",
     "两期", "P0", "待确认", "决策评审", "§1.1", "见 Q-01"),

    ("TM-01", MOD_TM, "时间粒度与显示",
     "以游戏分钟为最小模拟单位；UI 显示为「日 时:分」。",
     "两期", "P0", "已确定", "A-01 / A-02", "§2.1 / §15", ""),
    ("TM-02", MOD_TM, "默认速度",
     "1x：1 现实秒 = 1 游戏分钟（可配置，写入 time_config）。",
     "首版", "P0", "已确定", "A-02", "§2.1 / §15", ""),
    ("TM-03", MOD_TM, "倍速档位",
     "暂停 / 1x / 2x / 4x 四档；倍速仅改变时间倍率（2x = 2 游戏分钟/现实秒）。",
     "首版", "P0", "已确定", "A-02", "§2.1 / §15", ""),
    ("TM-04", MOD_TM, "时间快捷键",
     "空格 暂停/继续；数字键 1/2/3 切换 1x/2x/4x。",
     "首版", "P1", "已确定", "A-02", "§2.1 / §15", ""),
    ("TM-05", MOD_TM, "暂停语义",
     "时间不推进；UI 操作（选中、开面板、下达命令、规划路径）在暂停时仍可用。",
     "首版", "P0", "已确定", "A-03", "§2.1", ""),
    ("TM-06", MOD_TM, "移动的时间消耗",
     "单位按 move_speed 沿路径连续推进、逐格移动；暂停时冻结在当前格进度（保留 move_progress）。",
     "首版", "P0", "已确定", "A-03", "§2.2 / §17", ""),
    ("TM-07", MOD_TM, "展开/收缩的时间消耗",
     "固定 30 游戏分钟；进入 expanding / contracting 后不可移动、不可再次下令。",
     "首版", "P0", "已确定", "A-08", "§2.2 / §15", ""),
    ("TM-08", MOD_TM, "指挥链路判定频率",
     "每游戏分钟更新一次；移动中的距离变化即时反映链路状态。",
     "首版", "P0", "已确定", "A-09", "§2.2 / §15", ""),
    ("TM-09", MOD_TM, "交火的时间消耗",
     "一次交火结算消耗约 10 游戏分钟与行动资源。",
     "长期", "P2", "待细化", "后续版本设计评审", "§2.2 / §6", "数值待定"),
    ("TM-10", MOD_TM, "缩放与时间一致",
     "缩放不暂停时间（除玩家主动暂停）；不重置移动进度、展开进度、链路状态。",
     "首版", "P0", "已确定", "A-04 / A-06", "§2.3 / §4.2", ""),
    ("TM-11", MOD_TM, "进行中状态全局可见",
     "expanding / contracting / moving 在任意缩放层级均可见（进度条或状态图标 + 剩余游戏分钟）。",
     "首版", "P1", "已确定", "A-08", "§2.3 / §21", ""),

    ("MAP-01", MOD_MAP, "六角格基础数据",
     "每格存储：地形、高程、控制方、堆叠。",
     "长期", "P2", "已确定", "单元测试", "§3", "字段先建表"),
    ("MAP-02", MOD_MAP, "格边数据",
     "格边存储河流、桥梁、道路（影响移动/防御，长期生效）。",
     "长期", "P2", "已确定", "单元测试", "§3", ""),
    ("MAP-03", MOD_MAP, "地形效果数据驱动",
     "terrain_effects 表定义移动速度倍率、防御修正、攻击修正；规则层不得硬编码地形数值。",
     "长期", "P2", "已确定", "单元测试", "§3 / §11", ""),
    ("MAP-04", MOD_MAP, "ZOC 接口保留",
     "ZOC 规则仅保留接口与字段，首版不启用、不结算。",
     "长期", "P2", "已确定", "代码评审", "§3 / §14", ""),
    ("MAP-05", MOD_MAP, "分块与 LOD 渲染",
     "地图分块加载与 LOD 渲染（远景粗、近景细）。",
     "长期", "P2", "待细化", "性能测试", "§3", "首版地图小，可不做"),
    ("MAP-06", MOD_MAP, "首版地图规格",
     "20×15 六角格，无地形；保留地形字段以便后续填充。",
     "首版", "P0", "已确定", "A-01", "§21", ""),
    ("MAP-07", MOD_MAP, "坐标体系（待决策）",
     "六角格布局（尖顶/平顶）与坐标表示（轴向 q,r / 偏移 odd-r）需统一，路径与距离计算共用。",
     "首版", "P0", "待确认", "单元测试", "§3", "见 Q-03"),

    ("ZOOM-01", MOD_ZOOM, "L0 战役/战术视图",
     "显示旅/团级 + 师/旅 HQ；可操作集合为旅/团级与 HQ。",
     "首版", "P0", "已确定", "A-01 / A-04", "§4.1", ""),
    ("ZOOM-02", MOD_ZOOM, "L1 中间视图",
     "显示营/连级 + 其 HQ；可操作营/连级与 HQ。",
     "首版", "P0", "已确定", "A-06", "§4.1", ""),
    ("ZOOM-03", MOD_ZOOM, "L2 微操视图",
     "显示排级 + 武器组；可操作排级与武器组。",
     "首版", "P0", "已确定", "A-06", "§4.1", ""),
    ("ZOOM-04", MOD_ZOOM, "展开布局",
     "子单位放在父格及相邻合法格，按 relative_offset 排布；继承父状态与时间进度。",
     "首版", "P0", "已确定", "A-04 / A-05", "§4.2 / §16", ""),
    ("ZOOM-05", MOD_ZOOM, "收缩规则",
     "子单位须在集群范围（与基准子单位距离 ≤2）；父位置取基准子单位位置；状态取最差。",
     "首版", "P0", "已确定", "A-06", "§4.2 / §18", "「最差」定义待细化 Q-06"),
    ("ZOOM-06", MOD_ZOOM, "缩放不重置进度",
     "移动进度、展开进度、指挥链路状态在缩放前后完全一致。",
     "首版", "P0", "已确定", "A-04", "§4.2", ""),
    ("ZOOM-07", MOD_ZOOM, "不做连续平滑缩放",
     "首版为 L0/L1/L2 三档切换。",
     "首版", "P1", "已确定", "A-01", "§14", ""),

    ("UNIT-01", MOD_UNIT, "单位字段集",
     "含层级、父子关系、锚点、位置、指挥范围、展开态、链路、速度、路径、进度、状态、状态计时、最近事件时间（见 04 字段字典）。",
     "两期", "P0", "已确定", "A-11 / 单元测试", "§5.1 / §16", ""),
    ("UNIT-02", MOD_UNIT, "编制状态与翻面",
     "满员/减员/缺编；步骤损失翻面；兵种交互修正数据驱动。",
     "长期", "P2", "待细化", "后续版本设计评审", "§5.2", "首版字段可先留空"),
    ("UNIT-03", MOD_UNIT, "玩家阵营限定",
     "仅北约单位进入玩家编制与数据库；敌方单位仅作测试靶子，不纳入可操作编制。",
     "首版", "P0", "已确定", "A-12", "§5.3", ""),
    ("UNIT-04", MOD_UNIT, "上级位置约定",
     "上级位置 = 基准子单位（anchor_child_id）的位置。",
     "首版", "P0", "已确定", "A-07", "§16", ""),
    ("UNIT-05", MOD_UNIT, "相对偏移存储",
     "子单位相对父锚点保存 relative_offset（六角轴向偏移）。",
     "首版", "P0", "已确定", "A-04 / A-07", "§16", ""),
    ("UNIT-06", MOD_UNIT, "展开合法化",
     "按偏移放置；非法格就近合法化；空间不足禁止展开。",
     "首版", "P0", "已确定", "A-05", "§16", ""),
    ("UNIT-07", MOD_UNIT, "微操基准规则",
     "微操基准子单位 → 父锚点跟随；微操非基准子单位 → 仅改自身偏移，父位置不变。",
     "首版", "P0", "已确定", "A-07", "§16 / §18", ""),
    ("UNIT-08", MOD_UNIT, "收缩距离约束",
     "收缩要求所有子单位与基准子单位距离 ≤2；父落基准子单位格。",
     "首版", "P0", "已确定", "A-06", "§16 / §18", ""),
    ("UNIT-09", MOD_UNIT, "堆叠上限",
     "每格最多 1 个兵牌；预设单个上级的子单位数 ≤7。",
     "首版", "P0", "已确定", "A-05", "§16", ""),
    ("UNIT-10", MOD_UNIT, "统一移动速度",
     "首版所有单位 move_speed = 1 格/游戏小时，无行动力差异。",
     "首版", "P0", "已确定", "A-03", "§15 / §17", ""),

    ("FIRE-01", MOD_FIRE, "交火类型",
     "接触交火 + 远程交火两类。",
     "长期", "P2", "已确定", "后续版本设计评审", "§6", "首版不做"),
    ("FIRE-02", MOD_FIRE, "结算公式",
     "攻击修正 − 防御修正 = 差值；掷 2D6 查表，结果 D / S / R / E。",
     "长期", "P2", "待细化", "数值表评审", "§6", "D/S/R/E 含义待定 Q-12"),
    ("FIRE-03", MOD_FIRE, "修正可追溯",
     "地形、自身数值、指令加成逐项列出，UI 可展开追溯。",
     "长期", "P2", "已确定", "后续版本设计评审", "§6", ""),
    ("FIRE-04", MOD_FIRE, "资源与时间成本",
     "交火消耗游戏时间（约 10 分钟）与行动资源。",
     "长期", "P2", "已确定", "后续版本设计评审", "§6", ""),

    ("CMD-01", MOD_CMD, "指挥层级",
     "师 HQ → 旅/团 HQ → 营 HQ → 连 HQ → 排。",
     "两期", "P0", "已确定", "A-09", "§7", ""),
    ("CMD-02", MOD_CMD, "HQ 字段",
     "command_range、command_points、parent_hq_id、link_status。",
     "两期", "P0", "已确定", "A-09 / 字段字典", "§7", "command_points 首版不用"),
    ("CMD-03", MOD_CMD, "链路判定",
     "六角距离(单位, 直属 HQ) ≤ command_range 且上级链路畅通 → 畅通，否则中断。",
     "首版", "P0", "已确定", "A-09", "§7 / §19", ""),
    ("CMD-04", MOD_CMD, "实时更新",
     "实时判定（首版每游戏分钟一次）；移动中的距离变化即时反映。",
     "首版", "P0", "已确定", "A-09", "§7 / §19", ""),
    ("CMD-05", MOD_CMD, "根节点默认畅通",
     "师 HQ 为根节点，link_status 默认「畅通」。",
     "首版", "P0", "已确定", "A-09", "§19", ""),
    ("CMD-06", MOD_CMD, "首版不干预行动",
     "链路状态只显示与记录，不影响移动/展开；长期才作为加成与合法性条件。",
     "首版", "P0", "已确定", "A-09 / A-12", "§19 / §14", ""),
    ("CMD-07", MOD_CMD, "指令系统",
     "进攻/防御/集中火力/机动/恢复；消耗指令点，有持续时间（游戏时间）。",
     "长期", "P2", "待细化", "后续版本设计评审", "§7", "首版不做"),
    ("CMD-08", MOD_CMD, "指挥半径覆盖显示",
     "可切换显示指挥半径覆盖，默认关闭。",
     "首版", "P1", "已确定", "目视检查", "§19 / §21", ""),

    ("BUILD-01", MOD_BUILD, "难度与点数池",
     "难度 → 点数池 → 购买北约兵牌、支援、工事。",
     "长期", "P2", "已确定", "后续版本设计评审", "§8", ""),
    ("BUILD-02", MOD_BUILD, "编制完整性约束",
     "编制完整性约束与历史编制模板。",
     "长期", "P2", "已确定", "后续版本设计评审", "§8", ""),
    ("BUILD-03", MOD_BUILD, "战前预设部署",
     "战前拖放部署、保存部署方案、不可在敌方 ZOC 内部署。",
     "长期", "P2", "待细化", "后续版本设计评审", "§8", ""),
    ("BUILD-04", MOD_BUILD, "首版仅预设编制",
     "首版不做自由构筑，只载入 units_preset_nato.json 预设编制。",
     "首版", "P0", "已确定", "A-01", "§8 / §15", ""),

    ("RPT-01", MOD_RPT, "事件日志结构",
     "结构化记录：event_id、game_time、event_type、unit_id/unit_name、from_hex/to_hex、detail。",
     "首版", "P0", "已确定", "A-10 / 单元测试", "§9.1 / §20.1", ""),
    ("RPT-02", MOD_RPT, "事件类型覆盖",
     "至少：开始/结束、移动开始/结束、展开开始/完成、收缩开始/完成、链路中断/恢复、手动结束。",
     "首版", "P0", "已确定", "A-10", "§20.1", "见 05 事件表"),
    ("RPT-03", MOD_RPT, "游戏结束触发",
     "玩家手动结束；达到剧本时间上限；后续版本可加胜负条件。",
     "首版", "P0", "已确定", "A-10", "§9.2 / §20.3", "上限默认值 Q-15"),
    ("RPT-04", MOD_RPT, "封面",
     "剧本名、日期时间范围、参战方（北约）、生成时间。",
     "首版", "P1", "已确定", "A-10", "§9.3 / §20.2", ""),
    ("RPT-05", MOD_RPT, "编制序列表",
     "玩家方各层级单位、番号、指挥官（HQ）、初始位置。",
     "首版", "P0", "已确定", "A-10", "§9.3 / §20.2", ""),
    ("RPT-06", MOD_RPT, "行动纪要",
     "按时间线以战史笔法叙述移动、展开、收缩、链路变化，含起点/终点/耗时/距离。",
     "首版", "P0", "已确定", "A-10", "§9.3 / §20.2", "笔法示例见 09 表"),
    ("RPT-07", MOD_RPT, "指挥链路摘要",
     "各时段链路中断/恢复记录汇总（单位、HQ、距离、时间）。",
     "首版", "P1", "已确定", "A-10", "§9.3 / §20.2", ""),
    ("RPT-08", MOD_RPT, "结束态势",
     "结束时刻各单位最终位置表；地图态势图快照（可导出图片，长期）。",
     "首版", "P1", "已确定", "A-10", "§9.3 / §20.2", "首版可仅表格"),
    ("RPT-09", MOD_RPT, "统计附录",
     "总行军距离、展开次数、收缩次数、链路中断次数等。",
     "首版", "P1", "已确定", "A-10", "§9.3 / §20.2", ""),
    ("RPT-10", MOD_RPT, "输出格式",
     "首版输出 Markdown（或 HTML）文本并保存本地（.md）；后续可加 PDF 与配图。",
     "首版", "P1", "已确定", "A-10", "§9.4 / §20.3", ""),
    ("RPT-11", MOD_RPT, "脱离 UI 可生成",
     "报告生成不依赖 UI，由规则函数库根据事件日志独立生成，便于测试与批量出报。",
     "首版", "P0", "已确定", "单元测试 / A-10", "§20.3 / §12", ""),
    ("RPT-12", MOD_RPT, "结束即暂停",
     "点击「结束游戏」→ 立即暂停时间 → 生成报告 → 可保存为 .md。",
     "首版", "P0", "已确定", "A-10", "§20.3", ""),

    ("UI-01", MOD_UI, "时间控制条",
     "暂停/1x/2x/4x 按钮 + 当前游戏时间（日 时:分）显示。",
     "首版", "P0", "已确定", "A-02", "§10 / §21", ""),
    ("UI-02", MOD_UI, "缩放控制",
     "L0/L1/L2 切换控件，显示当前层级。",
     "首版", "P0", "已确定", "A-04", "§10 / §21", ""),
    ("UI-03", MOD_UI, "选中面板",
     "单位信息、状态(idle/moving/expanding/contracting)、移动速度、距直属 HQ 距离、链路状态、当前命令/路径。",
     "首版", "P0", "已确定", "A-09", "§10 / §21", ""),
    ("UI-04", MOD_UI, "移动指令交互",
     "右键目标格下达移动（生成路径）；拖动兵牌下达；暂停时可规划路径。",
     "首版", "P0", "已确定", "A-03", "§10 / §17", ""),
    ("UI-05", MOD_UI, "展开/收缩按钮",
     "按上下文可用；显示进行中进度与剩余游戏分钟。",
     "首版", "P0", "已确定", "A-08", "§10 / §18", ""),
    ("UI-06", MOD_UI, "指挥链路覆盖",
     "开关切换显示指挥半径覆盖。",
     "首版", "P1", "已确定", "目视检查", "§10 / §19", ""),
    ("UI-07", MOD_UI, "结束游戏入口",
     "结束游戏按钮 → 生成战报 → 保存。",
     "首版", "P1", "已确定", "A-10", "§10 / §20.3", ""),
    ("UI-08", MOD_UI, "存档/载入",
     "保存与载入：游戏时间、单位状态、路径、事件日志。",
     "首版", "P0", "已确定", "A-11", "§10 / §21", "格式 Q-11"),
    ("UI-09", MOD_UI, "路径可视化",
     "显示当前路径、行进方向与剩余格数。",
     "首版", "P1", "已确定", "A-03", "§10", ""),

    ("DATA-01", MOD_DATA, "北约单位数据库",
     "步兵、坦克、反坦克、炮兵、HQ 等；覆盖排/连/营/团/旅层级。",
     "两期", "P0", "已确定", "A-01", "§11", ""),
    ("DATA-02", MOD_DATA, "units_preset_nato.json",
     "北约预设编制文件（层级树、初始位置、command_range）。",
     "首版", "P0", "已确定", "A-01", "§11 / §23", ""),
    ("DATA-03", MOD_DATA, "map_empty.json",
     "首版空旷地图（20×15，含地形字段占位）。",
     "首版", "P0", "已确定", "A-01", "§11 / §23", ""),
    ("DATA-04", MOD_DATA, "time_config.json",
     "时间配置：最小单位、1x 兑换率、倍速档、展开/收缩耗时。",
     "首版", "P0", "已确定", "A-02", "§11 / §23", ""),
    ("DATA-05", MOD_DATA, "report_template.md",
     "史料格式战报模板。",
     "首版", "P1", "已确定", "A-10", "§11 / §23", ""),
    ("DATA-06", MOD_DATA, "terrain_effects 表",
     "地形效果（移动倍率、防御修正、攻击修正）；首版保留空表/默认值。",
     "长期", "P2", "已确定", "单元测试", "§3 / §11", ""),
    ("DATA-07", MOD_DATA, "report_templates 表",
     "战报模板数据表（多剧本/多风格）。",
     "长期", "P2", "待细化", "后续版本设计评审", "§11", ""),

    ("NFR-01", MOD_NFR, "渲染与插值流畅",
     "时间推进与移动插值流畅；4x 倍速下不跳帧（目标 60 FPS，移动仍连续）。",
     "首版", "P1", "已确定", "性能测试", "§12", ""),
    ("NFR-02", MOD_NFR, "日志不丢失",
     "事件日志完整不丢失；战报生成可脱离 UI 测试。",
     "首版", "P0", "已确定", "单元测试", "§12", ""),
    ("NFR-03", MOD_NFR, "规则可单测",
     "时间推进、移动路径与速度、展开、收缩、自动合法化、链路判定、战报生成为纯规则函数。",
     "首版", "P0", "已确定", "单元测试", "§12 / §23", ""),
    ("NFR-04", MOD_NFR, "明确不做清单",
     "不做：华约/轴心国可操作阵营、多人联机、海军/战略轰炸。",
     "两期", "P0", "已确定", "A-12", "§12 / §14", ""),

    ("V1-01", MOD_V1, "首版定位",
     "实时行军部署垂直切片：载入北约预设编制，空旷六角地图自然时间行军；拖父牌子单位跟随；缩放展开子单位并微操；收缩回收；HQ 实时判定指挥距离；结束生成战报。",
     "首版", "P0", "已确定", "A-01 ~ A-12", "§13", ""),
    ("V1-02", MOD_V1, "路径生成",
     "右键目标格生成路径（首版可用直线或简单 A*），状态转 moving。",
     "首版", "P0", "已确定", "A-03", "§17", ""),
    ("V1-03", MOD_V1, "移动中重新下令",
     "移动中可暂停并重新下令；新路径从当前位置开始。",
     "首版", "P1", "已确定", "A-03", "§17", ""),
    ("V1-04", MOD_V1, "到达终点",
     "到达终点后状态 idle，写入「移动结束」事件（含起止格与耗时）。",
     "首版", "P0", "已确定", "A-03", "§17", ""),
    ("V1-05", MOD_V1, "父移动的连带规则",
     "上级移动时子单位相对偏移不变、随父锚点同步平移；若子单位越界/重叠则自动合法化或暂停父移动并提示。",
     "首版", "P0", "已确定", "A-04 / A-05", "§17", "二选一策略见 Q-04"),
    ("V1-06", MOD_V1, "不消耗移动次数",
     "展开/收缩不消耗移动次数但耗时 30 游戏分钟；无「每回合移动一次」限制，仅受路径与速度约束。",
     "首版", "P0", "已确定", "A-08", "§17", ""),
    ("V1-07", MOD_V1, "任意可见兵牌可微操",
     "任意当前层级可见的兵牌均可右键移动（仅受单位状态限制）。",
     "首版", "P0", "已确定", "A-07", "§18", ""),
    ("V1-08", MOD_V1, "状态变更必留痕",
     "所有状态变化（移动/展开/收缩/链路）写入事件日志。",
     "首版", "P0", "已确定", "A-09 / A-10", "§18", ""),
    ("V1-09", MOD_V1, "首版 UI 最小集",
     "地图、时间条、缩放、选中面板、右键移动、展开/收缩、链路覆盖、结束游戏与报告保存、存读档。",
     "首版", "P0", "已确定", "A-01 ~ A-11", "§21", ""),
    ("V1-10", MOD_V1, "可运行构建交付",
     "交付可运行 PC 构建（空旷地图 + 北约预设编制）。",
     "首版", "P0", "已确定", "验收复跑", "§23", ""),

    ("TOWN-01", MOD_TOWN, "城镇真实轮廓",
     "城镇形状不画正圆：用 OSM 住宅/工业地块烘出真实建成区轮廓，分区线叠在轮廓与城区范围上。",
     "两期", "P0", "已确定", "A-13 / 目视检查", "v0.5 新增", "富尔达 70 块地块"),
    ("TOWN-02", MOD_TOWN, "分区体系",
     "核心整圆 + 外环按东/北/西/南切 4 扇区；更大城市加第三环。5 个图形（核心+4扇区）全部控制 = 完全控制该城。",
     "两期", "P0", "已确定", "A-13", "v0.5 新增", ""),
    ("TOWN-03", MOD_TOWN, "战斗宽度（城区正面）",
     "核心区 3 连当量、外环每扇区 2 连当量、第三环每扇区 1.5；富尔达全城 11 连 ≈ 1.2 个营。",
     "两期", "P0", "已确定", "A-14", "v0.5 新增", "数值可调，见 17 表"),
    ("TOWN-04", MOD_TOWN, "超编惩罚",
     "超出战斗宽度的部队不增加火力，只增加暴露与被杀伤概率（城区堆兵 = 送死）。",
     "长期", "P1", "待细化", "战斗系统上线后评审", "v0.5 新增", "需与交火系统一起定数值"),
    ("TOWN-05", MOD_TOWN, "城外野战正面",
     "要扩大正面只能在城外野战展开；城区只提供有限正面与防御加成。",
     "长期", "P1", "已确定", "战斗系统上线后评审", "v0.5 新增", ""),
    ("TOWN-06", MOD_TOWN, "卫星城",
     "主城 3.5km 内、半径小于主城 60% 的聚落列为卫星城，各自独立成环并在面板列出。",
     "两期", "P1", "已确定", "A-13", "v0.5 新增", ""),
    ("TOWN-07", MOD_TOWN, "城镇规模换算",
     "半径由建成区面积换算 r=√(A/π)，并按聚落等级设下限（市 1.5km / 镇 0.95km）。",
     "首版", "P0", "已确定", "烘焙脚本核对", "v0.5 新增", ""),
    ("TOWN-08", MOD_TOWN, "环数规则",
     "半径 <3km 为两环（核心+4扇区），≥3km 为三环（核心+内环4扇区+外环4扇区）。",
     "首版", "P0", "已确定", "烘焙脚本核对", "v0.5 新增", ""),

    ("CTRL-01", MOD_CTRL, "实控范围",
     "战场由接触线分为我方 / 敌方 / 争夺带三段，按栅格生成控制场，边界平滑；改剧本接触线即可整体移位。",
     "两期", "P0", "已确定", "A-15", "v0.5 新增", "288×216 栅格"),
    ("CTRL-02", MOD_CTRL, "敌情掌握度",
     "敌方区域掌握度随纵深衰减（贴前线 0.85 → 45km 深处 0.12）；我方区域全知（1.0）。",
     "首版", "P0", "已确定", "A-15", "v0.5 新增", "数值在 scenario 内可调"),
    ("CTRL-03", MOD_CTRL, "态势显示开关",
     "实控范围 / 敌情掌握度两个开关，关掉即回到纯地形图；层级越高叠加越淡（L0 100% / L1 82% / L2 62%）。",
     "首版", "P0", "已确定", "A-15", "v0.5 新增", ""),
    ("CTRL-04", MOD_CTRL, "城镇扇区控制",
     "每个扇区独立归属（面板显示控制方），城区扇区中心显示蓝/红/黄控制点；全部扇区失守 = 城陷。",
     "两期", "P0", "已确定", "A-13 / A-15", "v0.5 新增", ""),
    ("CTRL-05", MOD_CTRL, "接触线数据",
     "剧本文件定义接触线经纬度序列与争夺带宽（默认 3.8km），与地图数据分离，便于换剧本。",
     "首版", "P1", "已确定", "剧本文件核对", "v0.5 新增", "scenario_fulda.json"),
    ("CTRL-06", MOD_CTRL, "方向校准",
     "接触线不约定左右侧：载入时用我方城市（富尔达）实测校准，避免剧本顺写/倒写导致敌我翻边。",
     "首版", "P0", "已确定", "单元测试", "v0.5 新增", ""),
]

wb = Workbook()

ws = wb.active
ws.title = "00 说明与图例"
ws.sheet_view.showGridLines = False
ws.sheet_properties.tabColor = NAVY
for col, wd in zip("ABCDE", [16, 20, 30, 34, 40]):
    ws.column_dimensions[col].width = wd

ws.merge_cells("A1:E1")
c = ws["A1"]
c.value = "铁幕 1985 · 需求规格总表 v0.5"
c.font = Font(name=FONT, size=18, bold=True, color="FFFFFF")
c.fill = TITLE_FILL
c.alignment = Alignment(vertical="center", horizontal="left", indent=1)
ws.row_dimensions[1].height = 42

ws.merge_cells("A2:E2")
c = ws["A2"]
c.value = ("长期蓝图（第一部分 v0.4） + 首版垂直切片（第二部分 v0.4）   ｜   "
          "本工作簿为需求梳理与参考台账，项目暂不进入开发")
c.font = Font(name=FONT, size=10, bold=True, color=NAVY)
c.fill = PatternFill("solid", fgColor=PALE)
c.alignment = Alignment(vertical="center", horizontal="left", indent=1)
ws.row_dimensions[2].height = 24
ws.row_dimensions[3].height = 8

row = 4

def section(text):
    global row
    ws.merge_cells(f"A{row}:E{row}")
    c = ws[f"A{row}"]
    c.value = text
    c.font = Font(name=FONT, size=11, bold=True, color="FFFFFF")
    c.fill = SEC_FILL
    c.alignment = Alignment(vertical="center", horizontal="left", indent=1)
    ws.row_dimensions[row].height = 22
    row += 1

def kv(label, value, h=None):
    global row
    a = ws.cell(row=row, column=1, value=label)
    a.font = Font(name=FONT, size=10, bold=True, color=NAVY)
    a.alignment = Alignment(vertical="center", horizontal="left", wrap_text=True)
    a.fill = PatternFill("solid", fgColor=BAND)
    a.border = BORDER
    ws.merge_cells(f"B{row}:E{row}")
    b = ws.cell(row=row, column=2, value=value)
    b.font = Font(name=FONT, size=10, color="262626")
    b.alignment = Alignment(vertical="center", horizontal="left", wrap_text=True, indent=1)
    b.border = BORDER
    ws.row_dimensions[row].height = h or max(20, est_height([value], [126], 14, 6))
    row += 1

section("一、基本信息")
kv("项目代号", "Iron Curtain 1985（铁幕 1985）")
kv("文档名称", "铁幕 1985 · 需求规格总表")
kv("文档版本", "v0.5（台账整理版 · 无网格 + 城镇分区 + 实控态势）")
kv("整理日期", TODAY)
kv("源文档", "第一部分 · 完整需求规格说明书 v0.4（§1–§12）＋ 第二部分 · 首版实现要求 v0.4（§13–§23）")
kv("项目状态", "需求梳理完成，暂不落实（不进入开发、不排期）")
kv("目标平台", "PC 单机（Windows）；数据与规则层平台无关")
kv("玩家阵营", "仅北约（敌方仅作靶子/脚本，不做可操作阵营）")
kv("首版验证目标", "时间系统 + 层级缩放 + 父子联动 + 自动部署 + 微操 + 指挥距离实时判定 + 战报生成")

section("二、图例与取值约定")

def legend(head, w_label=None):
    global row
    for j, txt in enumerate(head, start=1):
        c = ws.cell(row=row, column=j, value=txt)
        c.font = Font(name=FONT, size=10, bold=True, color=NAVY)
        c.fill = HEAD_FILL
        c.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)
        c.border = BORDER
    ws.row_dimensions[row].height = 22
    row += 1

def legend_row(a, b, rest):
    global row
    c1 = ws.cell(row=row, column=1, value=a)
    c1.font = Font(name=FONT, size=10, bold=True)
    c1.alignment = Alignment(vertical="center", horizontal="left", wrap_text=True)
    c1.border = BORDER
    c2 = ws.cell(row=row, column=2, value=b)
    c2.font = Font(name=FONT, size=10)
    c2.alignment = Alignment(vertical="center", horizontal="left", wrap_text=True)
    c2.border = BORDER
    ws.merge_cells(f"C{row}:E{row}")
    c3 = ws.cell(row=row, column=3, value=rest)
    c3.font = Font(name=FONT, size=10, color="262626")
    c3.alignment = Alignment(vertical="center", horizontal="left", wrap_text=True, indent=1)
    c3.border = BORDER
    ws.row_dimensions[row].height = max(20, est_height([rest], [104], 14, 6))
    row += 1

legend(["字段", "取值", "含义 / 处理方式"])
legend_row("范围", "首版", "v0.4 垂直切片必须实现（§13–§23）；不做即视为首版未达标")
legend_row("范围", "长期", "首版不做，仅蓝图保留（交火、指令、地形、构筑等）")
legend_row("范围", "两期", "首版须有可用雏形，长期继续强化（数据、日志、指挥链路等）")
legend_row("优先级", "P0", "切片核心，缺一不可")
legend_row("优先级", "P1", "首版应有；资源紧张时可降级或后补")
legend_row("优先级", "P2", "长期项，首版不排入")
legend_row("状态", "已确定", "需求已明确，可直接按描述落地")
legend_row("状态", "待细化", "方向确定，数值/细节待设计（不需高层决策）")
legend_row("状态", "待确认", "需人决策，已登记到「14 待确认问题」表")

section("三、工作表索引")
legend(["序号", "工作表", "内容与维护提示"])
INDEX = [
    ("00 说明与图例", "项目基本信息、图例约定、索引、自动统计与使用说明（本页）"),
    ("01 需求总表", "【权威台账】全部需求条目：ID / 模块 / 说明 / 范围 / 优先级 / 状态 / 验证方式 / 来源"),
    ("02 首版范围矩阵", "功能域 × 首版/长期 的做与不做对照，用于防范围蔓延"),
    ("03 参数与时间设定", "所有可调数值（速度、耗时、距离、上限）集中一处，对应 time_config.json"),
    ("04 数据结构字段字典", "unit / HQ / event / map / config 字段定义、类型、取值、首版是否必需"),
    ("05 事件类型与枚举", "event_type 全清单 + state / link_status / echelon / unit_type 等枚举值"),
    ("06 展开收缩与父子规则", "展开、收缩、自动合法化、父带子移动、微操锚点的规则卡（含异常分支）"),
    ("07 指挥链路规则", "层级、判定公式、更新频率、根节点、首版边界"),
    ("08 交火系统（长期）", "交火结算流水线与待填数值表占位（首版不实现）"),
    ("09 战报规格", "报告章节、内容要求、数据来源、史料笔法示例"),
    ("10 UI 清单", "控件级清单：地图、时间条、缩放、选中面板、按钮、开关"),
    ("11 数据文件与交付物", "JSON / 模板文件与规则模块、构建产物的交付清单"),
    ("12 验收用例", "A-01 ~ A-12 验收用例：前置 / 步骤 / 预期（对应源文档 §22）"),
    ("13 术语表", "兵牌、基准子单位、ZOC、2D6、D/S/R/E 等术语与缩写"),
    ("14 待确认问题", "Q-01 起的问题清单：影响、选项、建议、决策记录"),
    ("15 路线图", "M0–M8 阶段划分、目标、产物与依赖（供未来排期参考）"),
    ("16 变更记录", "版本演进摘要，新增/修改需求时追加一行"),
    ("17 城镇分区", "城镇轮廓、核心/四扇区、战斗宽度与超编规则（v0.5 新增）"),
    ("18 实控范围", "接触线、争夺带、敌情掌握度与显示规则（v0.5 新增）"),
]
for i, (name, desc) in enumerate(INDEX, start=1):
    c1 = ws.cell(row=row, column=1, value=i)
    c1.font = Font(name=FONT, size=10)
    c1.alignment = Alignment(vertical="center", horizontal="center")
    c1.border = BORDER
    c2 = ws.cell(row=row, column=2, value=name)
    c2.font = Font(name=FONT, size=10, bold=True, color="1F3864")
    c2.alignment = Alignment(vertical="center", horizontal="left", indent=1)
    c2.border = BORDER
    ws.merge_cells(f"C{row}:E{row}")
    c3 = ws.cell(row=row, column=3, value=desc)
    c3.font = Font(name=FONT, size=10, color="262626")
    c3.alignment = Alignment(vertical="center", horizontal="left", wrap_text=True, indent=1)
    c3.border = BORDER
    ws.row_dimensions[row].height = max(20, est_height([desc], [104], 14, 6))
    row += 1

section("四、规模统计（公式自动计算，随台账更新）")
legend(["指标", "数值", "计算口径"])
STATS = [
    ("需求条目总数", "=COUNTA('01 需求总表'!A4:A500)", "需求总表已填行数"),
    ("首版必须实现", "=COUNTIF('01 需求总表'!E4:E500,\"首版\")+COUNTIF('01 需求总表'!E4:E500,\"两期\")",
     "范围 = 首版 或 两期"),
    ("长期蓝图条目", "=COUNTIF('01 需求总表'!E4:E500,\"长期\")+COUNTIF('01 需求总表'!E4:E500,\"两期\")",
     "范围 = 长期 或 两期"),
    ("P0 条目", "=COUNTIF('01 需求总表'!F4:F500,\"P0\")", "优先级 = P0"),
    ("待确认/待细化", "=COUNTIF('01 需求总表'!G4:G500,\"待确认\")+COUNTIF('01 需求总表'!G4:G500,\"待细化\")",
     "需继续设计或决策的条目"),
    ("验收用例数", "=COUNTA('12 验收用例'!A4:A200)", "12 表用例行数"),
    ("待决策问题数", "=COUNTA('14 待确认问题'!A4:A200)", "14 表问题行数"),
]
for a, b, cc in STATS:
    c1 = ws.cell(row=row, column=1, value=a)
    c1.font = Font(name=FONT, size=10, bold=True)
    c1.alignment = Alignment(vertical="center", horizontal="left", indent=1)
    c1.border = BORDER
    c2 = ws.cell(row=row, column=2, value=b)
    c2.font = Font(name=FONT, size=12, bold=True, color="C00000")
    c2.alignment = Alignment(vertical="center", horizontal="center")
    c2.border = BORDER
    ws.merge_cells(f"C{row}:E{row}")
    c3 = ws.cell(row=row, column=3, value=cc)
    c3.font = Font(name=FONT, size=9, italic=True, color=GREY)
    c3.alignment = Alignment(vertical="center", horizontal="left", indent=1)
    c3.border = BORDER
    ws.row_dimensions[row].height = 22
    row += 1

section("五、使用说明（日后维护方式）")
TIPS = [
    ("① 单一台账", "新增/修改需求一律写进「01 需求总表」末尾，不另建文档；其它表只做字典、规则、验收视图。"),
    ("② ID 规则", "模块缩写 - 两位序号（GEN/TM/MAP/ZOOM/UNIT/FIRE/CMD/BUILD/RPT/UI/DATA/NFR/V1）；新增模块先在本页索引登记。"),
    ("③ 状态流转", "待确认 →（决策后）→ 已确定；数值细节未定用「待细化」，并在备注写清缺什么。"),
    ("④ 参数唯一源", "所有数值改「03 参数与时间设定」，并同步 time_config.json，避免代码与文档两套值。"),
    ("⑤ 验收对齐", "每条首版需求都要能指到一个 A-xx 用例；新增首版需求时同步在「12 验收用例」补行。"),
    ("⑥ 版本留痕", "每次定稿在「16 变更记录」追加一行并更新本页版本号（v0.4 → v0.5 …）。"),
    ("⑦ 明确不做", "新想法先判断落「02 首版范围矩阵」还是「长期」，避免首版被撑大。"),
]
for a, b in TIPS:
    c1 = ws.cell(row=row, column=1, value=a)
    c1.font = Font(name=FONT, size=10, bold=True, color=NAVY)
    c1.alignment = Alignment(vertical="top", horizontal="left", indent=1, wrap_text=True)
    c1.border = BORDER
    ws.merge_cells(f"B{row}:E{row}")
    c2 = ws.cell(row=row, column=2, value=b)
    c2.font = Font(name=FONT, size=10, color="262626")
    c2.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True, indent=1)
    c2.border = BORDER
    ws.row_dimensions[row].height = max(20, est_height([b], [120], 14, 6))
    row += 1

ws1 = wb.create_sheet()
ws1.title = "01 需求总表"
widths = [11, 12, 26, 76, 7, 7, 9, 20, 14, 18]
end = build(
    ws1,
    "01 需求总表 · 全部需求条目（权威台账）",
    "范围：首版=垂直切片必须实现 / 长期=仅蓝图保留 / 两期=首版雏形+长期强化。状态为「待确认」的行需在 14 表登记决策。新增需求请追加到末尾并沿用 ID 规则。",
    ["需求ID", "模块", "需求名称", "需求说明", "范围", "优先级", "状态", "验证方式", "来源", "备注"],
    REQ, widths, "1F3864", freeze="B4",
)

dv_scope = DataValidation(type="list", formula1='"首版,长期,两期"', allow_blank=True)
dv_prio = DataValidation(type="list", formula1='"P0,P1,P2"', allow_blank=True)
dv_stat = DataValidation(type="list", formula1='"已确定,待细化,待确认,已废弃"', allow_blank=True)
for dv in (dv_scope, dv_prio, dv_stat):
    ws1.add_data_validation(dv)
dv_scope.add(f"E4:E500")
dv_prio.add(f"F4:F500")
dv_stat.add(f"G4:G500")

ws1.conditional_formatting.add(
    f"G4:G500",
    CellIsRule(operator="equal", formula=['"待确认"'],
               fill=PatternFill("solid", fgColor=ORANGE),
               font=Font(name=FONT, size=10, bold=True, color="C00000")),
)
ws1.conditional_formatting.add(
    f"G4:G500",
    CellIsRule(operator="equal", formula=['"待细化"'],
               fill=PatternFill("solid", fgColor=YELLOW),
               font=Font(name=FONT, size=10, color="7F6000")),
)

SCOPE = [
    ("S-01", "时间", "时间流逝 / 暂停 / 1x-2x-4x 倍速", "√", "√", "v0.4 核心，全部行动的时间成本依赖它"),
    ("S-02", "时间", "移动消耗时间（逐格推进、暂停冻结）", "√", "√", "速度统一 1 格/游戏小时"),
    ("S-03", "时间", "展开/收缩消耗 30 游戏分钟", "√", "√", "期间不可移动"),
    ("S-04", "时间", "战斗/交火消耗时间", "×", "√", "首版无战斗，故不结算"),
    ("S-05", "编制", "三档缩放 L0/L1/L2 与可操作集合", "√", "√", "不做连续平滑缩放"),
    ("S-06", "编制", "父子层级 展开 / 收缩 / 自动合法化", "√", "√", "垂直切片主线"),
    ("S-07", "编制", "微操（基准子单位带动父锚点）", "√", "√", "任意可见兵牌可下令"),
    ("S-08", "指挥", "指挥链路实时判定 + 中断/恢复记录", "√", "√", "首版只显示与记录"),
    ("S-09", "指挥", "链路影响移动/展开合法性、提供加成", "×", "√", "长期才作为规则约束"),
    ("S-10", "指挥", "指令系统（进攻/防御/火力/机动/恢复）", "×", "√", "指令点、持续时间均未设计"),
    ("S-11", "战斗", "接触交火 / 远程交火 摇骰结算", "×", "√", "首版无战斗"),
    ("S-12", "战斗", "编制状态 满员/减员/缺编、翻面", "×", "√", "字段可先留空"),
    ("S-13", "地图", "地形效果（terrain_effects）", "×", "√", "首版空旷地图，仅保留字段"),
    ("S-14", "地图", "格边/河流/桥梁/道路", "×", "√", "数据字段预留"),
    ("S-15", "地图", "ZOC", "×", "√", "仅保留接口，不启用"),
    ("S-16", "地图", "分块加载与 LOD 渲染", "×", "√", "首版地图小，暂不需要"),
    ("S-17", "边界", "战前自由构筑、点数池、难度", "×", "√", "首版仅载入预设编制"),
    ("S-18", "边界", "敌方（华约/轴心）兵牌与 AI", "×", "×", "明确不做；仅允许放固定靶子且不结算"),
    ("S-19", "边界", "多人联机", "×", "×", "明确不做"),
    ("S-20", "边界", "海军 / 战略轰炸", "×", "×", "明确不做"),
    ("S-21", "战报", "事件日志 + Markdown 战报生成与保存", "√", "√", "首版核心奖励机制"),
    ("S-22", "战报", "PDF / 配图 / 地图态势图导出图片", "×", "√", "首版用文字表格代替"),
    ("S-23", "系统", "存档 / 载入（时间、状态、路径、日志）", "√", "√", "验收项 A-11"),
    ("S-24", "系统", "胜负条件判定", "×", "√", "首版仅手动结束或时间上限"),
    ("S-25", "数值", "行动资源 / 行动力差异", "×", "√", "首版速度统一"),
    ("S-26", "态势", "实控范围（我方 / 敌方 / 争夺带）", "√", "√", "v0.5：剧本静态控制场 + 显示开关"),
    ("S-27", "态势", "敌情掌握度（纵深衰减）", "√", "√", "v0.5：越深越模糊"),
    ("S-28", "城镇", "城镇分区（核心 + 四扇区）与战斗宽度", "√", "√", "v0.5：真实轮廓 + 分区线"),
    ("S-29", "城镇", "超编惩罚 / 城外野战正面", "×", "√", "需与战斗系统一起落地"),
]
build(
    wb.create_sheet(),
    "02 首版范围矩阵 · 做与不做（防范围蔓延）",
    "√ = 该期包含；× = 该期不做。新增想法先在此定位：若落在「首版」列需同步补需求行与验收用例，否则一律进长期。",
    ["编号", "功能域", "功能项", "首版 v0.4", "长期 v1.x", "说明 / 理由"],
    SCOPE, [9, 8, 44, 11, 11, 52], "C00000", freeze="A4",
)
ws2 = wb["Sheet"]
ws2.title = "02 首版范围矩阵"

PARAMS = [
    ("PAR-01", "时间最小单位", "1", "游戏分钟", "模拟与日志的时间刻度", "时间", "是（time_config）", "§2.1"),
    ("PAR-02", "1x 兑换率", "1 现实秒 = 1 游戏分钟", "—", "默认速度", "时间", "是", "§2.1"),
    ("PAR-03", "倍速档位", "1 / 2 / 4", "倍速", "另有暂停档（0x）", "时间", "是", "§2.1"),
    ("PAR-04", "移动速度", "1", "格/游戏小时", "首版全单位统一，无差异", "移动", "是", "§15"),
    ("PAR-05", "展开耗时", "30", "游戏分钟", "expanding 状态时长", "展开收缩", "是", "§15"),
    ("PAR-06", "收缩耗时", "30", "游戏分钟", "contracting 状态时长", "展开收缩", "是", "§15"),
    ("PAR-07", "收缩最大间距", "2", "六角格", "子单位与基准子单位距离上限", "展开收缩", "是", "§16"),
    ("PAR-08", "每格堆叠上限", "1", "兵牌/格", "父隐藏时是否占格待定 Q-07", "单位", "是", "§16"),
    ("PAR-09", "单个上级子单位上限", "7", "个", "预设编制设计约束", "单位", "是", "§16"),
    ("PAR-10", "地图尺寸", "20 × 15", "六角格", "首版空旷地图", "地图", "是", "§21"),
    ("PAR-11", "链路判定周期", "1", "游戏分钟", "实时判定间隔", "指挥链路", "是", "§15"),
    ("PAR-12", "链路判定阈值", "command_range", "六角格", "按单位/HQ 数据配置", "指挥链路", "是", "§19"),
    ("PAR-13", "交火结算耗时", "10", "游戏分钟", "长期；首版不实现", "交火", "长期", "§2.2 / §6"),
    ("PAR-14", "交火骰", "2D6", "—", "长期", "交火", "长期", "§6"),
    ("PAR-15", "根节点判定", "师 HQ 默认畅通", "—", "不参与距离判定", "指挥链路", "是", "§19"),
    ("PAR-16", "存档格式", "待定（建议 JSON）", "—", "需含时间/状态/路径/日志", "系统", "待确认", "§21 / Q-11"),
    ("PAR-17", "剧本时间上限", "待定（建议 24 游戏小时）", "游戏小时", "到达即触发结束与战报", "战报", "待确认", "§9.2 / Q-15"),
    ("PAR-18", "目标帧率", "60", "FPS", "4x 下移动仍平滑", "非功能", "建议", "§12"),
]
build(
    wb.create_sheet(),
    "03 参数与时间设定 · 唯一数值源",
    "改数值只改本表，并同步 time_config.json / units_preset_nato.json。标「待确认」的参数同时登记在 14 表。",
    ["参数ID", "参数名", "取值", "单位", "说明", "所属系统", "是否可配置", "来源"],
    PARAMS, [10, 22, 24, 14, 44, 14, 18, 12], "2E5B9A", freeze="A4",
)
wb["Sheet"].title = "03 参数与时间设定"

FIELDS = [
    ("unit", "unit_id", "单位唯一标识", "string", "NATO-3BN-01", "是", "全局唯一，事件日志以此关联"),
    ("unit", "unit_name", "番号 / 名称", "string", "第3营", "是", "战报中直接引用"),
    ("unit", "faction", "阵营", "enum", "NATO", "是", "首版固定 NATO；敌方不纳入编制"),
    ("unit", "echelon", "编制层级", "enum", "师/旅/团/营/连/排/武器组", "是", "决定缩放层级可见性"),
    ("unit", "parent_id", "上级单位", "string|null", "NATO-3BDE", "是", "根节点为 null"),
    ("unit", "children_ids", "下级单位列表", "string[]", "[\"NATO-3BN-01-C1\"]", "是", "与 parent_id 双向一致"),
    ("unit", "anchor_child_id", "基准子单位", "string|null", "NATO-3BN-01-C1", "是", "上级位置 = 该子单位位置"),
    ("unit", "relative_offset", "相对父锚点偏移", "object{q,r}", "{q:1,r:0}", "是", "六角轴向偏移，展开时按此落位"),
    ("unit", "unit_type", "兵种类型", "enum", "步兵/坦克/反坦克/炮兵/HQ", "是", "影响 UI 图标与长期修正"),
    ("unit", "position", "所在格", "object{q,r}", "{q:8,r:6}", "是", "父单位位置由锚点推导"),
    ("unit", "command_range", "指挥半径", "int", "3", "HQ 是", "六角格数；非 HQ 可留空"),
    ("unit", "command_points", "指令点", "int", "4", "长期", "首版字段保留不使用"),
    ("unit", "parent_hq_id", "直属 HQ", "string|null", "NATO-3BN-HQ", "是", "链路判定对象"),
    ("unit", "expanded", "是否已展开", "bool", "true / false", "是", "true 时显示子单位、隐藏父"),
    ("unit", "link_status", "链路状态", "enum", "畅通 / 中断 / 根节点", "是", "每游戏分钟刷新"),
    ("unit", "move_speed", "移动速度", "number", "1", "是", "格/游戏小时；首版统一"),
    ("unit", "move_path", "当前路径", "object{q,r}[]", "[{q:9,r:6},{q:10,r:5}]", "是", "首格为当前格或下一格（实现时定）"),
    ("unit", "move_progress", "当前格到下一格进度", "number 0~1", "0.42", "是", "暂停即冻结此值"),
    ("unit", "state", "行动状态", "enum", "idle / moving / expanding / contracting", "是", "互斥；不可同时"),
    ("unit", "state_timer", "状态剩余时间", "int", "18", "是", "游戏分钟；expanding/contracting 用"),
    ("unit", "last_event_time", "最近事件时间", "int", "3720", "是", "游戏分钟时间戳"),
    ("unit", "strength_state", "编制状态", "enum", "满员/减员/缺编", "长期", "§5.2；首版留空"),
    ("hq", "command_range", "指挥半径", "int（六角格）", "3", "是", "链路判定阈值"),
    ("hq", "command_points", "指令点数", "int", "4", "长期", "指令系统资源"),
    ("hq", "parent_hq_id", "上级 HQ", "string|null", "null（师 HQ）", "是", "链路串联成树"),
    ("hq", "link_status", "链路状态", "enum", "根节点默认畅通", "是", "上级中断则下级一并中断"),
    ("event", "event_id", "事件唯一标识", "string", "E-000123", "是", "单调递增，便于排序"),
    ("event", "game_time", "游戏内时间戳", "int（游戏分钟）", "1445", "是", "显示时转换为 日 时:分"),
    ("event", "event_type", "事件类型", "enum", "MOVE_START / MOVE_END / …", "是", "取值见 05 表"),
    ("event", "unit_id", "关联单位", "string", "NATO-3BN-01", "是", "无单位事件可为空（GAME_START）"),
    ("event", "unit_name", "单位番号快照", "string", "第3营", "否", "避免单位改名后战报错乱"),
    ("event", "from_hex", "起点格", "object{q,r}|null", "{q:8,r:6}", "否", "移动/链路类事件使用"),
    ("event", "to_hex", "终点格", "object{q,r}|null", "{q:10,r:5}", "否", "移动类事件使用"),
    ("event", "detail", "补充信息", "string / json", "{\"duration\":120,\"dist\":2}", "否", "耗时、距离、原因、被合法化的目标格等"),
    ("map", "terrain", "地形类型", "string", "plain", "是（字段）", "首版恒为 plain"),
    ("map", "elevation", "高程", "int", "0", "否", "长期影响移动/视线"),
    ("map", "owner", "控制方", "enum", "NATO", "否", "长期"),
    ("map", "stacking", "堆叠单位", "string[]", "[]", "是", "上限 1，规则层校验"),
    ("map", "edges", "格边数据", "object", "{\"NE\":\"bridge\"}", "长期", "河流/桥梁/道路"),
    ("config", "minute_per_second", "1x 兑换率", "number", "1", "是", "time_config.json"),
    ("config", "speed_levels", "倍速档位", "number[]", "[1,2,4]", "是", "time_config.json"),
    ("config", "expand_minutes", "展开耗时", "int", "30", "是", "time_config.json"),
    ("config", "contract_minutes", "收缩耗时", "int", "30", "是", "time_config.json"),
    ("config", "scenario_end_minutes", "剧本时间上限", "int", "待定", "是", "到达即结束并出报"),
]
build(
    wb.create_sheet(),
    "04 数据结构字段字典",
    "对象=unit / hq / event / map / config。实现时以本表为准生成数据类与 JSON 校验；新增字段请标注首版是否必需，避免规则层被字段空值击穿。",
    ["对象", "字段名", "中文名", "类型", "取值 / 枚举", "首版必需", "说明与约定"],
    FIELDS, [9, 20, 22, 16, 30, 11, 52], "375623", freeze="A4",
)
wb["Sheet"].title = "04 数据结构字段字典"

ENUM_ROWS = [
    ("event_type", "GAME_START", "游戏开始", "载入剧本并首次取消暂停时", "是", "记录初始时间与编制快照点"),
    ("event_type", "GAME_END", "游戏结束", "手动结束或到达剧本时间上限", "是", "触发战报生成"),
    ("event_type", "MOVE_START", "移动开始", "下达移动指令、状态转 moving 时", "是", "含 from_hex 与完整路径"),
    ("event_type", "MOVE_END", "移动结束", "到达路径终点、状态转 idle 时", "是", "含起止格、总耗时、距离"),
    ("event_type", "MOVE_REPLAN", "移动改令", "移动中重新下达路径", "否", "长期/可选，便于战报叙述转折"),
    ("event_type", "EXPAND_START", "展开开始", "点击展开、状态转 expanding 时", "是", "倒计时 30 游戏分钟"),
    ("event_type", "EXPAND_DONE", "展开完成", "state_timer 归零、子单位出现", "是", "含被就近合法化的子单位与目标格"),
    ("event_type", "CONTRACT_START", "收缩开始", "点击收缩、状态转 contracting 时", "是", "需先通过 ≤2 距离校验"),
    ("event_type", "CONTRACT_DONE", "收缩完成", "state_timer 归零、父落锚点格", "是", "含状态取最差的结果"),
    ("event_type", "LINK_LOST", "链路中断", "六角距离 > command_range 或上级中断", "是", "含单位、HQ、距离、阈值"),
    ("event_type", "LINK_RECOVERED", "链路恢复", "由中断转回畅通", "是", "战报中成对叙述"),
    ("event_type", "UNIT_POSITION_CORRECTED", "位置合法化", "父移动/展开导致越界或重叠，被就近安置", "是", "含原目标格与实际落点"),
    ("event_type", "ORDER_ISSUED", "指令下达", "玩家下达进攻/防御等指令", "长期", "指令系统上线后"),
    ("event_type", "FIRE_RESOLVED", "交火结算", "一次交火 2D6 结算完成", "长期", "含修正明细与结果 D/S/R/E"),
    ("event_type", "SAVE / LOAD", "存档 / 载入", "玩家存档或载入", "否", "可选，便于战报标注断点"),
    ("state", "idle", "待机", "无可执行行动", "是", "默认状态"),
    ("state", "moving", "移动中", "沿 move_path 推进", "是", "受 move_progress 驱动"),
    ("state", "expanding", "展开中", "倒计时中，不可移动", "是", "state_timer = 剩余分钟"),
    ("state", "contracting", "收缩中", "倒计时中，不可移动", "是", "同上"),
    ("link_status", "ok", "畅通", "距离 ≤ command_range 且上级畅通", "是", "UI 绿色"),
    ("link_status", "lost", "中断", "距离超限或上级中断", "是", "UI 红色，写日志"),
    ("link_status", "root", "根节点", "师 HQ 自身", "是", "默认畅通，不参与判定"),
    ("echelon", "师 / 旅 / 团", "战役层", "L0 可见", "是", "含师、旅 HQ"),
    ("echelon", "营 / 连", "中间层", "L1 可见", "是", "含营、连 HQ"),
    ("echelon", "排 / 武器组", "微操层", "L2 可见", "是", "最小可操作单位"),
    ("unit_type", "步兵", "Infantry", "—", "是", "基础兵种"),
    ("unit_type", "坦克", "Armor", "—", "是", ""),
    ("unit_type", "反坦克", "AT", "—", "是", ""),
    ("unit_type", "炮兵", "Artillery", "—", "是", "首版不射击，仅行军"),
    ("unit_type", "HQ", "指挥所", "—", "是", "含 command_range"),
    ("交火结果", "D / S / R / E", "待细化", "2D6 查表结果档位", "长期", "常见为 Disorder/Suppressed/Retreat/Eliminated，需定稿 Q-12"),
]
build(
    wb.create_sheet(),
    "05 事件类型与枚举 · 日志与状态词表",
    "event_type 是战报生成的唯一输入源：新增事件类型时须同步更新上表、09 战报规格（哪些进报告）与 20.1 需求行。",
    ["枚举组", "值", "中文名", "触发时机 / 含义", "首版", "备注"],
    ENUM_ROWS, [14, 28, 14, 46, 7, 44], "7030A0", freeze="A4",
)
wb["Sheet"].title = "05 事件类型与枚举"

RULES = [
    ("R-01", "展开触发", "玩家点击「展开」→ state=expanding，state_timer=30；期间不可移动、不可再次展开/收缩。", "已在 moving/expanding/contracting 时按钮不可用", "是"),
    ("R-02", "展开落位", "子单位按 relative_offset 相对父格落位；父格本身可放一个子单位（即偏移 0,0 者）。", "排序固定（按 children_ids 顺序）以保证可复现", "是"),
    ("R-03", "非法格判定", "越界、非己方控制格、已被其他兵牌占据（堆叠上限 1）均视为非法格。", "父格在同批展开中已释放，需先释放再判占用", "是"),
    ("R-04", "就近合法化", "非法格以最短六角距离螺旋搜索最近合法空格；同等距离按固定方向序取一，保证结果确定。", "全部候选均被占用时判为空间不足", "是"),
    ("R-05", "空间不足", "禁止展开：状态回到 idle、不扣时间、UI 提示「空间不足」，可选写日志。", "不得部分展开（原子性）", "是"),
    ("R-06", "展开完成", "state_timer 归零 → expanded=true，父隐藏，子单位继承父的 link_status 与时间进度。", "子单位此刻起各自独立判定链路", "是"),
    ("R-07", "收缩前置校验", "所有子单位与基准子单位六角距离 ≤2，否则禁止收缩并提示违规单位。", "校验在点击时做一次，倒计时中再校验（防移动后违规）", "是"),
    ("R-08", "收缩完成", "父落基准子单位所在格，父状态取子单位中最差者；子单位隐藏，expanded=false。", "「最差」排序需定义 Q-06", "是"),
    ("R-09", "父移动带子", "父移动时子单位 relative_offset 不变，位置随父锚点同步平移（逐格同步插值）。", "父暂停则整体冻结", "是"),
    ("R-10", "父移动冲突", "子单位平移后越界/重叠时：自动就近合法化，或暂停父移动并提示（二选一）。", "策略待决策 Q-04；冲突处理必写日志", "是"),
    ("R-11", "微操基准子单位", "基准子单位移动 → 父 position 跟随为新格；其 relative_offset 视为 0。", "父被隐藏时仍维护锚点", "是"),
    ("R-12", "微操非基准子单位", "仅更新自身 relative_offset 与 position，父位置不变。", "若移动后距父过远，再收缩时会被距离校验拒绝", "是"),
    ("R-13", "堆叠与父占位", "每格最多 1 兵牌；父隐藏时是否仍占用该格需明确。", "Q-07：建议展开后父不占格", "是"),
    ("R-14", "状态取最差", "收缩后父的 state 取子单位中最差状态（如任一 expanding 则父为 expanding）。", "全局优先级需定义：contracting > expanding > moving > idle", "是"),
    ("R-15", "时间进度继承", "展开完成的子单位继承父的 state_timer 余量（父在移动中展开时先冻结，再按剩余进度续行）。", "缩放不重置进度", "是"),
    ("R-16", "缩放不改变规则", "切换 L0/L1/L2 只改变可见集合与操作入口，不改变任何单位数据。", "禁止在缩放时重置路径/进度", "是"),
]
build(
    wb.create_sheet(),
    "06 展开收缩与父子规则 · 规则卡",
    "每条规则都应有对应单元测试；标注「是」的为首版必须实现。异常分支（R-03/R-04/R-05/R-10/R-13）是最容易漏测的部分。",
    ["规则ID", "场景", "规则内容", "异常与边界", "首版"],
    RULES, [9, 20, 74, 50, 7], "00878F", freeze="A4",
)
wb["Sheet"].title = "06 展开收缩与父子规则"

CMD_ROWS = [
    ("C-01", "层级结构", "师 HQ → 旅/团 HQ → 营 HQ → 连 HQ → 排；每级一个直属 HQ。", "是"),
    ("C-02", "判定公式", "六角距离(单位, 直属 HQ) ≤ command_range 且直属 HQ 自身链路畅通 → 畅通；否则中断。", "是"),
    ("C-03", "距离度量", "六角格最短步数（不经地形惩罚，首版无 ZOC/地形）。", "是"),
    ("C-04", "更新时机", "每游戏分钟重算一次；移动插值跨越格边界时立即重算，保证 UI 不滞后一格。", "是"),
    ("C-05", "根节点", "师 HQ 为根，link_status=root，恒畅通；不做距离判定。", "是"),
    ("C-06", "级联", "上级中断则其下属全部中断（不受自身距离影响）。", "是"),
    ("C-07", "记录", "LINK_LOST / LINK_RECOVERED 成对写入事件日志，含单位、HQ、实际距离、阈值。", "是"),
    ("C-08", "首版边界", "链路状态只显示与记录；不阻断移动/展开，不提供数值加成。", "是"),
    ("C-09", "覆盖显示", "可切换显示各 HQ 的 command_range 覆盖范围，默认关闭。", "是"),
    ("C-10", "长期影响", "链路中断时降低战斗修正、限制指令下达；由指令系统与交火系统接入。", "长期"),
    ("C-11", "展开后的判定", "展开后子单位各自以直属 HQ 判定；父隐藏期间不再单独判定。", "是"),
    ("C-12", "收缩后的判定", "收缩后父按自身到直属 HQ 的距离判定，子单位不再判定。", "是"),
]
build(
    wb.create_sheet(),
    "07 指挥链路规则",
    "首版链路是「显示器 + 记录器」，不是行动门槛；这一边界必须写进代码注释，避免后期顺手加限制破坏验收。",
    ["规则ID", "项目", "规则 / 要求", "首版"],
    CMD_ROWS, [9, 18, 100, 7], "1F3864", freeze="A4",
)
wb["Sheet"].title = "07 指挥链路规则"

FIRE_ROWS = [
    ("F-01", "输入", "攻击方单位数值（火力/素质）、防御方数值（防护/地形加成）、双方状态与指令。", "长期", "首版不实现"),
    ("F-02", "修正", "攻击修正 = 基础火力 + 地形攻击修正 + 指令加成；防御修正 = 防护值 + 地形防御修正。", "长期", "数值表待填"),
    ("F-03", "差值", "差值 = 攻击修正 − 防御修正（可为负）。", "长期", ""),
    ("F-04", "掷骰", "2D6（两枚六面骰求和），按差值行 + 点数列查结果表。", "长期", ""),
    ("F-05", "结果档位", "D / S / R / E 四档（含义待定稿：Disorder / Suppressed / Retreat / Eliminated 待确认 Q-12）。", "长期", ""),
    ("F-06", "结果落地", "D/S → 状态与数值惩罚；R → 强制后撤格数；E → 单位移除或翻面。", "长期", ""),
    ("F-07", "时间成本", "每次交火结算消耗约 10 游戏分钟，结算期间双方处于交火锁定。", "长期", ""),
    ("F-08", "资源成本", "消耗行动资源/指令点（与指令系统共用）。", "长期", ""),
    ("F-09", "可追溯", "UI 展开显示逐项修正来源（数据驱动，禁止魔法数字）。", "长期", ""),
    ("F-10", "与链路关系", "链路中断时进攻/防御修正受损（长期联动）。", "长期", ""),
    ("F-11", "日志", "FIRE_RESOLVED 事件记录双方、修正明细、骰值、结果，供战报引用。", "长期", ""),
    ("F-12", "首版替代", "首版完全没有战斗：不出现射击按钮、不结算、不显示相关数值。", "首版", "验收 A-12 检查项"),
]
build(
    wb.create_sheet(),
    "08 交火系统（长期设计占位）",
    "首版明确不实现；本表仅为长期设计的流程骨架与待填项，避免以后重新推导。落地前需先定稿差值表与结果档位含义。",
    ["编号", "要素", "说明", "阶段", "备注"],
    FIRE_ROWS, [9, 16, 90, 10, 30], "C00000", freeze="A4",
)
wb["Sheet"].title = "08 交火系统（长期）"

RPT_ROWS = [
    ("RPT-A", "标题 / 封面", "剧本名 + 日期时间范围（如「1945年5月6日 0600 时 — 1200 时」）、参战方（北约）、生成时间、总分栏可选。", "剧本配置 + GAME_START/GAME_END 时间", "是"),
    ("RPT-B", "编制序列表", "按层级缩进列出：番号、层级、兵种、指挥官（HQ）、初始位置；可加初始指挥半径。", "units_preset_nato.json 初始快照", "是"),
    ("RPT-C", "行动纪要", "按时间线逐条叙述移动开始/结束、展开/收缩、链路变化；每条含时间、单位、起止格、耗时/距离，采用战史笔法。", "事件日志（结构化 → 自然语言）", "是"),
    ("RPT-D", "指挥链路摘要", "统计各 HQ 的中断/恢复次数与最长中断时长，列关键时段的链路状态。", "LINK_LOST / LINK_RECOVERED", "是"),
    ("RPT-E", "结束态势", "结束时刻各单位最终位置表（层级、番号、位置、状态、链路）；长期加地图态势图图片。", "单位最终状态快照", "是"),
    ("RPT-F", "统计附录", "总行军距离（格）、总游戏时长、移动次数、展开次数、收缩次数、链路中断次数、最远脱离指挥的单位。", "事件日志聚合计算", "是"),
    ("RPT-G", "输出与保存", "生成 Markdown（或 HTML）文本，UI 提供另存为 .md；文件名建议 剧本名_结束时间.md。", "模板文件 report_template.md", "是"),
    ("RPT-H", "生成独立性", "生成函数只接收（事件日志, 编制数据, 结束快照, 模板）四参数，不依赖 UI/渲染。", "纯函数库", "是"),
    ("RPT-I", "文风", "军语、被动语态偏多、时间前置；避免游戏化词汇（如「玩家点了右键」），改写为「奉命」「转进」「展开」。", "叙述模板 + 词表", "是"),
    ("RPT-J", "长期扩展", "PDF 导出、地图态势图配图、多语言、按剧本切换模板风格。", "report_templates 表", "长期"),
]
build(
    wb.create_sheet(),
    "09 战报规格 · 章节与数据来源",
    "战报是最容易「看起来有、其实空」的部分：每章都必须能指到具体事件类型与数据字段，否则砍掉该章。",
    ["编号", "章节", "内容要求", "数据来源", "首版"],
    RPT_ROWS, [9, 18, 80, 44, 7], "BF8F00", freeze="A4",
)
wb["Sheet"].title = "09 战报规格"

ws9 = wb["09 战报规格"]
ws9.row_dimensions[14].height = 6
r = 15
ws9.merge_cells(f"A{r}:E{r}")
c = ws9[f"A{r}"]
c.value = "史料笔法示例（供报告模板与生成器措辞参考）"
c.font = Font(name=FONT, size=11, bold=True, color="FFFFFF")
c.fill = PatternFill("solid", fgColor="BF8F00")
c.alignment = Alignment(vertical="center", horizontal="left", indent=1)
ws9.row_dimensions[r].height = 22
SAMPLES = [
    ("移动", "1945年5月6日0600时，第3营奉命自A7向东北方向行军，历时2游戏小时抵达C9，途中与旅指挥部链路保持畅通。"),
    ("改令", "同日0800时，该营于B8附近奉旅部新令转向东南，原定路线作废，行军序列未乱。"),
    ("展开", "0820时，第3营于C9展开，各连依预定队形就位，历时30分钟；其间与营指挥部链路一度因展开间距变化而中断，旋于0850时恢复。"),
    ("收缩", "1100时，各连向基准连靠拢完成收拢，第3营重新集结于C9，部队状态以最差单位为准。"),
    ("链路", "0950时，第9连推进至H12，脱离营指挥部指挥半径（6格）达8格，链路中断；1040时回撤至H10，链路恢复。"),
    ("收尾", "1200时，全旅停止前进，转入待机。本阶段共行军47格，展开3次，收缩2次，链路中断5次。"),
]
for k, (tag, text) in enumerate(SAMPLES):
    rr = r + 1 + k
    c1 = ws9.cell(row=rr, column=1, value=tag)
    c1.font = Font(name=FONT, size=10, bold=True, color="7F6000")
    c1.alignment = Alignment(vertical="top", horizontal="left", indent=1)
    c1.border = BORDER
    ws9.merge_cells(f"B{rr}:E{rr}")
    c2 = ws9.cell(row=rr, column=2, value=text)
    c2.font = Font(name=FONT, size=10, color="262626")
    c2.alignment = Alignment(vertical="top", horizontal="left", wrap_text=True, indent=1)
    c2.border = BORDER
    ws9.row_dimensions[rr].height = est_height([text], [sum([80, 44, 9, 18])], 15, 6)

UI_ROWS = [
    ("UI-A", "主地图区", "20×15 六角格渲染；兵牌、路径、选高亮、指挥半径覆盖层；支持平移与三档缩放。", "鼠标拖拽平移 / 缩放开关切换", "是"),
    ("UI-B", "时间控制条", "暂停、1x、2x、4x 四按钮 + 当前游戏时间（日 时:分）+ 当前倍速高亮。", "空格暂停；1/2/3 切倍速", "是"),
    ("UI-C", "缩放控制", "L0 / L1 / L2 三档切换，显示当前层级与可见层说明。", "点击切换（可加滚轮，首版非必须）", "是"),
    ("UI-D", "选中面板", "单位番号、层级、兵种、状态、移动速度、当前位置、距直属 HQ 距离/半径、链路状态、当前路径与剩余时间。", "左键选中；空点取消", "是"),
    ("UI-E", "移动指令", "右键目标格生成路径并下达；路径以连线+箭头显示；移动中可重新下达。", "右键 / 拖动兵牌", "是"),
    ("UI-F", "展开 / 收缩按钮", "仅在合法上下文可用，禁用时给出原因提示（如在移动中、距离超限、空间不足）。", "按钮点击", "是"),
    ("UI-G", "进度反馈", "expanding/contracting/moving 显示进度条与剩余游戏分钟；任意缩放层级可见。", "—", "是"),
    ("UI-H", "链路覆盖开关", "切换显示全部 HQ 的 command_range 覆盖与链路着色。", "开关按钮", "是"),
    ("UI-I", "结束游戏", "结束游戏按钮 → 二次确认 → 暂停时间 → 生成战报 → 提供保存。", "按钮点击", "是"),
    ("UI-J", "存档 / 载入", "菜单项：保存（选路径）/ 载入；载入后时间、状态、路径、日志一致。", "菜单", "是"),
    ("UI-K", "事件/提示区", "最近事件与非法操作提示（如「空间不足」「距离超限」）；可选简易日志面板。", "—", "P1"),
    ("UI-L", "战报查看", "生成后弹出可滚动的 Markdown 预览，含「另存为 .md」。", "—", "是"),
]
build(
    wb.create_sheet(),
    "10 UI 清单 · 首版最小控件集",
    "首版 UI 只求「能验收」，不追求美术完成度；但控件禁用原因必须可见（避免玩家以为卡了）。",
    ["编号", "区域 / 控件", "要求", "交互 / 快捷键", "首版"],
    UI_ROWS, [9, 20, 88, 34, 7], "2E5B9A", freeze="A4",
)
wb["Sheet"].title = "10 UI 清单"

DELIV = [
    ("数据文件", "F-01", "units_preset_nato.json", "北约预设编制：单位树（含 echelon/parent_id/children_ids/anchor_child_id/relative_offset）、初始位置、command_range、HQ 关系。", "是", "待产出"),
    ("数据文件", "F-02", "map_empty.json", "20×15 六角格定义：坐标体系、地形字段（首版 plain）、堆叠初值空。", "是", "待产出"),
    ("数据文件", "F-03", "time_config.json", "minute_per_second、speed_levels、expand_minutes、contract_minutes、scenario_end_minutes。", "是", "待产出"),
    ("数据文件", "F-04", "report_template.md", "战报 Markdown 模板：章节占位符与笔法示例（见 09 表）。", "是", "待产出"),
    ("数据文件", "F-05", "terrain_effects 表", "地形效果数值（移动倍率/防御/攻击修正）；首版保持空表或默认值。", "长期", "占位"),
    ("数据文件", "F-06", "save_*.json", "存档：游戏时间、倍速、单位完整状态（含路径与进度）、事件日志、视野/缩放设置。", "是", "待产出"),
    ("规则模块", "M-01", "time 时间推进", "游戏时间累加、倍速换算、暂停、剧本时间上限判定；纯函数、可注入步长。", "是", "待产出"),
    ("规则模块", "M-02", "movement 移动", "路径生成（直线/简单 A*）、逐格推进、进度插值、到达判定、改令。", "是", "待产出"),
    ("规则模块", "M-03", "expand/contract 展开收缩", "30 分钟状态机、落位、原子性、完成回调。", "是", "待产出"),
    ("规则模块", "M-04", "legality 合法化", "越界/占用判定、螺旋最近合法格搜索、确定性排序。", "是", "待产出"),
    ("规则模块", "M-05", "chain 指挥链路", "六角距离、阈值判定、级联中断、状态变更事件。", "是", "待产出"),
    ("规则模块", "M-06", "events 事件日志", "结构化事件追加、按时间排序、查询/聚合、序列化。", "是", "待产出"),
    ("规则模块", "M-07", "report 战报生成", "事件日志 + 编制 + 结束快照 + 模板 → Markdown 文本。", "是", "待产出"),
    ("规则模块", "M-08", "persistence 存读档", "全量状态序列化/反序列化与一致性校验。", "是", "待产出"),
    ("交付产物", "D-01", "可运行 PC 构建", "空旷地图 + 北约预设编制，可完成 A-01~A-12。", "是", "待产出"),
    ("交付产物", "D-02", "验收用例清单", "本工作簿 12 表可导出为手动测试清单；后续可脚本化。", "是", "已具备（本表）"),
    ("交付产物", "D-03", "单元测试集", "覆盖 M-01~M-08 的规则函数测试，含边界（空间不足、越界、链路级联）。", "是", "待产出"),
]
build(
    wb.create_sheet(),
    "11 数据文件与交付物清单",
    "交付物分三类：数据文件（可编辑内容）、规则模块（可单测的纯逻辑）、交付产物（构建与测试）。技术栈未定不影响此清单。",
    ["类别", "编号", "名称 / 文件", "内容与结构要点", "首版", "状态"],
    DELIV, [11, 8, 26, 82, 7, 11], "375623", freeze="A4",
)
wb["Sheet"].title = "11 数据文件与交付物"

CASES = [
    ("A-01", "V1-01 / ZOOM-01 / MAP-06",
     "预设编制与空地图已就绪；游戏未开始",
     "① 启动并载入 units_preset_nato.json；② 观察默认为 L0 层级；③ 观察时间条状态",
     "L0 仅显示旅/团级与师/旅 HQ；游戏时间为起始时刻；时间处于暂停状态（未自动推进）",
     "功能"),
    ("A-02", "TM-02 / TM-03 / TM-04",
     "A-01 通过",
     "① 取消暂停，观察 10 现实秒；② 切 2x 观察 10 秒；③ 切 4x 观察 10 秒；④ 按空格暂停后再观察 10 秒",
     "1x：约 10 游戏分钟；2x：约 20；4x：约 40；暂停后游戏时间与所有进度完全不动",
     "功能"),
    ("A-03", "V1-02 / TM-06 / UNIT-10",
     "时间暂停中，已选中一个营级单位",
     "① 右键相距 4 格的目标格；② 观察路径与状态；③ 取消暂停推进至中途暂停；④ 重新下令",
     "生成路径、状态 moving；以 1 格/游戏小时推进（4 格约 4 游戏小时）；中途暂停停在格内进度（move_progress 保留）；改令后新路径自当前位置开始",
     "功能"),
    ("A-04", "ZOOM-04 / UNIT-04 / TM-07",
     "L0 层级，团级单位未展开",
     "① 拖动团级至目标格（暂停状态）；② 切 L1 并点「展开」；③ 观察 30 游戏分钟内状态；④ 完成后检查子单位位置",
     "拖动时子单位 offset 不变、随父平移；展开期间 state=expanding 且有进度条；30 分钟后子单位按 relative_offset 出现，父隐藏",
     "功能"),
    ("A-05", "UNIT-06 / UNIT-09 / R-04",
     "构造某子单位目标偏移格已被另一兵牌占据",
     "① 执行展开；② 检查该子单位落点；③ 检查是否重叠；④ 查看事件日志",
     "该子单位自动落到最近合法空格，无任何格出现 2 个兵牌；日志有位置合法化记录（含原目标格与实际落点）",
     "边界"),
    ("A-06", "ZOOM-02 / ZOOM-03 / UNIT-08 / R-07",
     "L1 层级，营级可操作",
     "① 微操营级后切 L2 展开排级并核对位置；② 微操若干排级使其距基准排 ≤2；③ 执行收缩并等待 30 分钟",
     "L2 排级位置与偏移一致；收缩通过距离校验，父落基准排所在格，子单位隐藏，父状态取最差",
     "功能"),
    ("A-07", "UNIT-04 / UNIT-07 / R-11 / R-12",
     "L2 层级，已展开至排级",
     "① 拖动基准排到新格；② 观察父位置；③ 再拖动一个非基准排；④ 观察父位置与 relative_offset",
     "① 父位置跟随基准排新格；② 非基准排移动只改自身偏移，父位置不变",
     "功能"),
    ("A-08", "TM-07 / UI-05 / V1-06",
     "任一可展开单位",
     "① 发起展开后立即尝试右键移动；② 发起收缩后立即尝试移动；③ 观察进度显示",
     "两种状态期间移动指令被拒绝（按钮禁用或提示原因）；UI 显示进度条与剩余游戏分钟；完成后恢复 idle 并可移动",
     "功能"),
    ("A-09", "CMD-03 / CMD-04 / CMD-06 / RPT-02",
     "选中一个连级单位，其营 HQ command_range=3",
     "① 移出半径（距离 4）后观察面板；② 再返回半径内；③ 检查事件日志",
     "面板实时显示实际距离、半径与链路状态；超出即显示中断；返回即恢复；日志成对出现 LINK_LOST / LINK_RECOVERED 且含距离",
     "功能"),
    ("A-10", "RPT-01~RPT-12",
     "已完成若干移动/展开/收缩/链路变化",
     "① 点击「结束游戏」；② 检查报告章节；③ 保存为 .md 并打开",
     "时间立即暂停；报告含标题与时间范围、编制序列表、时间线行动纪要、链路摘要、结束态势、统计附录；可另存 .md 且内容完整",
     "功能"),
    ("A-11", "UI-08 / NFR-02",
     "游戏进行中，已产生日志与在途路径",
     "① 存档；② 继续推进时间并改变单位状态；③ 载入存档",
     "载入后游戏时间、倍速、各单位状态/路径/move_progress/链路、事件日志与存档时完全一致",
     "功能"),
    ("A-12", "GEN-08 / UNIT-03 / CMD-06 / NFR-04",
     "任意时刻",
     "① 检查可选单位是否全为北约；② 检查是否存在交火/射击/指令按钮；③ 检查地形是否影响移动耗时",
     "仅北约可操作；无华约/轴心兵牌；无交火、无指令、无地形消耗；移动耗时仅由速度决定",
     "合规"),
    ("A-13", "TOWN-01 / TOWN-02 / TOWN-06 / CTRL-04",
     "地图已载入，切到 L2",
     "① 放大到富尔达；② 依次点选核心区与四个扇区；③ 观察扇区中心控制点与左侧面板",
     "城区显示真实不规则轮廓（非正圆）与虚线分区；核心 1 个 + 外环 4 个扇区；每扇区中心显示蓝/红/黄控制点；面板显示控制方；卫星城在面板列出",
     "功能"),
    ("A-14", "TOWN-03 / TOWN-04",
     "已选中富尔达核心区",
     "① 查看「战斗宽度」区块；② 查看全城合计；③ 阅读超编后果说明",
     "核心显示 3 个连当量；全城合计 11 连 ≈ 1.2 个营；超编后果（不增火力、只增暴露）文案可见",
     "规则核对"),
    ("A-15", "CTRL-01 / CTRL-02 / CTRL-03",
     "地图已载入（默认 L0）",
     "① 关闭/打开「实控范围」；② 关闭/打开「敌情掌握度」；③ 观察接触线与敌方纵深明暗",
     "两个开关即时生效并重绘；接触线为深色虚线、两侧存在争夺带；敌方区域越深越暗；全部关闭后回到纯地形图",
     "功能"),
]
build(
    wb.create_sheet(),
    "12 验收用例 · 首版验收标准（对应源文档 §22）",
    "首版达标 = A-01 ~ A-12 全部通过。用例已按「可手动执行」编写；自动化时保持「前置 / 步骤 / 预期」三段结构以免歧义。",
    ["用例ID", "关联需求", "前置条件", "步骤", "预期结果", "类型"],
    CASES, [9, 26, 30, 52, 62, 8], "BF8F00", freeze="A4",
)
wb["Sheet"].title = "12 验收用例"

TERMS = [
    ("兵牌", "Counter", "地图上的单位棋子，含番号、兵种、层级等信息的可视化载体"),
    ("六角格", "Hex", "地图基本单元；本作以轴向坐标 (q, r) 表示，距离用六角最短步数"),
    ("战役级", "Operational", "以旅/团为单位、关注行军与部署的层级（L0 视图）"),
    ("战术级", "Tactical", "以营连排为单位、关注微操的层级（L1/L2 视图）"),
    ("HQ", "Headquarters", "指挥所；持有 command_range、parent_hq_id、link_status"),
    ("指挥链路", "Chain of Command", "单位 → 直属 HQ → 上级 HQ 的判定链；畅通或中断"),
    ("指挥半径", "command_range", "HQ 可有效指挥的六角格距离"),
    ("基准子单位", "anchor_child_id", "代表父单位位置的子单位；其移动会带动父锚点"),
    ("相对偏移", "relative_offset", "子单位相对父锚点（基准子单位）的六角轴向位移，展开时按此落位"),
    ("展开", "Expand", "把父单位替换为其子单位，消耗 30 游戏分钟，父隐藏"),
    ("收缩", "Contract", "把子单位收拢回父单位，要求与基准子单位距离 ≤2，耗时 30 游戏分钟"),
    ("就地合法化", "Legality Fix", "目标格非法（越界/被占）时自动改投最近合法空格"),
    ("堆叠", "Stacking", "同一格的单位数量；首版上限 1 个兵牌"),
    ("ZOC", "Zone of Control", "控制区；首版仅保留接口不启用"),
    ("LOD", "Level of Detail", "按缩放层级改变渲染精度与信息密度"),
    ("游戏分钟", "Game Minute", "最小时间单位；1x 时 1 现实秒 = 1 游戏分钟"),
    ("倍速", "Speed Level", "暂停 / 1x / 2x / 4x，仅改变时间倍率"),
    ("垂直切片", "Vertical Slice", "只做一条贯通全流程的最小可玩切片；首版即此形态"),
    ("事件日志", "Event Log", "结构化行动记录，是战报生成的唯一数据源"),
    ("战报", "After-Action Report", "按战史笔法生成的可阅读报告（首版 Markdown）"),
    ("2D6", "Two D6", "两枚六面骰求和；长期交火结算用"),
    ("D/S/R/E", "—", "交火结果档位，含义待定稿（见 Q-12）"),
    ("行动资源", "Action Resource", "长期概念：交火/指令的消耗品，首版不引入"),
    ("指令点", "Command Points", "长期概念：HQ 下发指令的资源池"),
    ("两期", "Both Phases", "本台账取值范围之一：首版做雏形、长期继续强化"),
]
build(
    wb.create_sheet(),
    "13 术语表",
    "跨文档沟通时优先用本表词条；新增术语请同时补到对应需求行的说明里，避免同义异名。",
    ["术语", "英文 / 缩写", "释义", "备注"],
    [(a, b, c, "") for a, b, c in TERMS], [22, 24, 78, 26], "7030A0", freeze="A4",
)
wb["Sheet"].title = "13 术语表"

QUESTIONS = [
    ("Q-01", "背景是冷战还是二战？", "全套命名、年代、单位库、战报日期（§1.1 首句标注「待确认」）",
     "A 冷战（1980s 中欧）；B 二战（1944–45 西欧/东线）", "先做数据无关的规则层，最后再定皮；若必须选，冷战更贴合「北约/华约」框架",
     "待决策", "用户"),
    ("Q-02", "技术栈与引擎？", "实现方式、渲染方案、UI 框架、构建流程",
     "A 引擎（Godot/Unity）；B 自研/Web（Electron+Canvas）", "规则层纯逻辑、与渲染解耦，可技术栈无关地先写规则与测试",
     "待决策", "用户"),
    ("Q-03", "六角格布局与坐标表示？", "路径生成、距离算法、地图文件格式",
     "A 平顶 + 偏移坐标（odd-r）；B 尖顶 + 轴向 (q,r)", "统一用轴向 (q,r) 存储，渲染时再转屏幕坐标；距离用 cube 距离公式",
     "待决策", "开发"),
    ("Q-04", "父移动导致子单位越界/重叠时，合法化还是暂停父移动？", "V1-05、R-10、移动体验",
     "A 自动就近合法化（流畅，但可能「偷偷挪位」）；B 暂停父移动并提示（可控，但打断节奏）",
     "首版选 A + 日志提示；长期可做开关", "待决策", "用户"),
    ("Q-05", "父隐藏期间，父的状态是否继续计时、子单位是否继承？", "R-06 / R-15 时间进度继承",
     "A 完全继承（父子同源）；B 父冻结、子独立", "A：展开完成后父的状态由子单位的最差状态回填",
     "待细化", "开发"),
    ("Q-06", "收缩时「状态取最差」的具体排序？", "R-08 / R-14",
     "待定优先级，如 contracting > expanding > moving > idle；数值状态另需规则", "先定义枚举优先级表，写进规则表与单元测试",
     "待细化", "开发"),
    ("Q-07", "展开后父所在格是否仍被父占用（隐形占位）？", "R-13 堆叠、展开落位",
     "A 父不占格（该格可给子单位）；B 父隐形占格（该格禁用）", "A 更符合直觉，且与「父隐藏」一致",
     "待决策", "开发"),
    ("Q-08", "指挥官（HQ）与番号命名规范？", "编制序列表、战报文风、预设数据",
     "如「第3营」「第2装甲团」「1st Bn / 3rd Bde」等", "与 Q-01 背景一起定；首版用占位番号即可",
     "待细化", "用户"),
    ("Q-09", "事件时间戳精度是否足够到分钟？", "日志顺序、战报时间表述、同分钟多事件排序",
     "A 分钟（简单）；B 秒级内部时间（精确排序）", "内部用秒或毫秒，展示与日志用分钟，避免同分钟事件乱序",
     "待细化", "开发"),
    ("Q-10", "编制序列表的「初始位置」取哪个时点？", "RPT-B 数据来源",
     "A 存档/剧本载入瞬间；B GAME_START 时刻（可能已移动）", "取剧本载入瞬间的预设位置，最稳定可复现",
     "待细化", "开发"),
    ("Q-11", "存档格式与版本兼容策略？", "UI-08、persistence 模块",
     "A 单文件 JSON（可读、好调试）；B 二进制（小、快）", "首版 JSON + version 字段；不做向后兼容，仅报错提示",
     "待决策", "开发"),
    ("Q-12", "交火结果 D/S/R/E 的含义与数值表？", "长期交火系统落地",
     "常见解释：Disorder / Suppressed / Retreat / Eliminated", "交火上线前必须定稿，且同时定差值范围与列数",
     "待细化", "用户"),
    ("Q-13", "首版地图上是否需要放固定靶子（不可操作、不结算）？", "§14 与 GEN-08 表述有张力",
     "A 完全不放；B 放但灰显、不参与任何结算", "首版建议不放，避免验收 A-12 判不清",
     "待决策", "用户"),
    ("Q-14", "是否首版就需要「翻面」美术与减员表现？", "§5.2 与首版不做清单",
     "A 不做（仅数据字段）；B 做粗略翻面", "首版不做，字段留空（UNIT-02）", "待决策", "用户"),
    ("Q-15", "剧本时间上限默认值？", "RPT-03 结束触发、战报时长叙述",
     "如 6 / 12 / 24 游戏小时", "预设 24 游戏小时，可配置", "待决策", "用户"),
]
build(
    wb.create_sheet(),
    "14 待确认问题 · 决策台账",
    "状态：待决策（需人拍板）/ 待细化（设计层面）。决策后把「建议」列保留、在「决策记录」写结论，并把对应需求行状态改为已确定。",
    ["问题ID", "问题", "影响范围", "可选方案", "建议", "状态", "决策记录"],
    QUESTIONS, [9, 40, 44, 46, 50, 10, 16], "C00000", freeze="A4",
)
wb["Sheet"].title = "14 待确认问题"

ROAD = [
    ("M0", "项目准备", "定技术栈、目录结构、数据格式（JSON schema）、坐标体系", "选型说明、数据契约、仓库骨架", "Q-02 / Q-03", "—", "不写玩法代码"),
    ("M1", "规则库 + 单测", "时间推进、移动、展开/收缩、合法化、链路、事件日志、战报生成（全部纯函数）", "规则模块 M-01~M-08 + 单元测试", "M0", "A-09 / A-10 的规则层", "可无 UI 跑通一次完整行动序列"),
    ("M2", "地图与渲染", "20×15 六角格渲染、兵牌显示、三档 LOD、选中与路径可视化", "地图渲染、缩放切换", "M1", "A-01 / A-04", "先求正确后求好看"),
    ("M3", "时间与移动联调", "时间条、倍速、暂停语义、右键下令、插值推进", "可玩的时间与行军", "M1 / M2", "A-02 / A-03", "重点测 4x 下不跳帧"),
    ("M4", "层级与父子联动", "展开/收缩动效与状态机、微操、基准子单位规则、自动合法化", "完整的编制操作", "M3", "A-04~A-08", "边界用例最多的阶段"),
    ("M5", "指挥链路", "实时判定、覆盖显示、中断/恢复日志与 UI 呈现", "链路可视化", "M4", "A-09", "严格不加行为限制"),
    ("M6", "战报系统", "日志 → Markdown 生成器、模板、预览与另存", "可读史料报告", "M1（可提前）", "A-10", "可与 M3 并行"),
    ("M7", "存读档", "全量状态序列化、载入一致性校验", "存档/载入", "M4 / M5", "A-11", "决定后续调试效率"),
    ("M8", "验收与打磨", "跑完 A-01~A-12、修边界、写测试清单、出构建", "可交付 PC 构建", "M0~M7", "A-01~A-12", "以验收表为准，不加新功能"),
]
build(
    wb.create_sheet(),
    "15 路线图 · 阶段划分（供未来排期参考，当前不执行）",
    "M1 规则库是唯一可「脱离 UI 先行」的阶段；M6 战报可与 M3 并行。本表不排日期，只在真正启动开发时使用。",
    ["阶段", "名称", "目标", "主要产物", "依赖", "关联验收", "备注"],
    ROAD, [7, 20, 60, 34, 14, 22, 34], "375623", freeze="A4",
)
wb["Sheet"].title = "15 路线图"

CHANGES = [
    ("v0.1", "（历史）", "初始构想：六角格兵棋，回合制，北约兵牌，编制层级与指挥链路。", "用户早期需求"),
    ("v0.2", "（历史）", "引入父/子单位聚合与展开、相对偏移、基准子单位规则。", "用户早期需求"),
    ("v0.3", "（历史）", "明确展开/收缩规则、微操与自动合法化；确立首版垂直切片范围。", "用户需求演进"),
    ("v0.4", "（历史）", "重大变更：时间系统由回合制改为自然时间流逝 + 暂停/倍速；新增战报史料系统（事件日志 + Markdown 报告）；首版明确不做交火/指令/地形。", "第一部分 v0.4 + 第二部分 v0.4"),
    ("v0.4-t", "（历史）", "整理为需求台账工作簿：拆分 17 张表（台账/范围/参数/字段/事件/规则/验收/问题/路线），补 ID 体系与可决策问题清单。", "本次整理"),
    ("v0.5", TODAY, "方向变更：放弃六角格，改连续坐标（米制）地图；距离、指挥半径、堆叠、ZOC 语义由「格」改为「米/面积」。§3/§7/§16 与 A-01~A-12 需同步修订。", "用户决策"),
    ("v0.5", TODAY, "新增城镇分区模型（TOWN-01~08、17 表）：真实建成区轮廓 + 核心/四扇区，战斗宽度与超编惩罚。", "用户需求"),
    ("v0.5", TODAY, "新增实控范围与敌情掌握（CTRL-01~06、18 表）：接触线、争夺带、掌握度纵深衰减、城镇扇区控制。", "用户需求"),
    ("v0.5", TODAY, "路网数据修复：短路段不再丢弃、简化容差 20–35m、恢复 secondary 等级（1785 → 22085 条）。", "缺陷修复"),
    ("", "", "", ""),
    ("", "", "", ""),
]
build(
    wb.create_sheet(),
    "16 变更记录",
    "每次定稿追加一行；需求级改动请同时改「01 需求总表」并在本表说明原因，便于回溯为什么某条被砍或加。",
    ["版本", "日期", "变更摘要", "来源 / 依据"],
    CHANGES, [10, 14, 100, 40], "7F7F7F", freeze="A4",
)
wb["Sheet"].title = "16 变更记录"

TOWNS = [
    ("TOWN-A", "城镇轮廓", "不用正圆：OSM 的 residential/commercial/industrial 地块按「最近且等级最高」归属到城镇，再做连通生长（间距 <150m 才并入）得到连片城区，简化 25m 后逐块绘制。飞地与卫星村不会并进主城。", "map_fulda.json → towns[].blocks"),
    ("TOWN-B", "城镇规模", "取「容纳 80% 建成区面积」的半径再乘 1.15 作为外缘：既不会被沿公路的带状郊区拖到 12km，也能覆盖主体城区；下限 600m。", "富尔达 r≈4.0km（含 Künzell / Petersberg 连绵区）"),
    ("TOWN-C", "城镇形态（三种）", "按真实建成区形状自动选：parcel（r<1000m，整块一个地块）/ radial（紧凑型：核心 + 四扇区）/ band（狭长型：沿主轴并列分段，长宽比≥1.55 时触发，2–5 段）。", "富尔达 radial；Bebra band（3 段）"),
    ("TOWN-D", "核心区", "整圆，半径 0.42R（两环）或 0.30R（三环）；建筑最密、防御最高、正面最窄。", "富尔达核心 r=1.25km"),
    ("TOWN-E", "外环扇区", "按方位切 4 个扇区（东 -45°~45°、北 45°~135°、西 135°~225°、南 225°~315°）；每个扇区外缘取该方向真实建成区的伸出距离（不超过整体外缘 1.05 倍），因此分区跟着城镇形状走，而不是套一个圆。", "富尔达东扇区伸出 4.2km"),
    ("TOWN-F", "战斗宽度 · 核心", "3 个连当量。一个营挤进核心只会占住街角，其余暴露。", "3"),
    ("TOWN-G", "战斗宽度 · 外环", "每扇区 2 个连当量。", "4×2 = 8"),
    ("TOWN-H", "战斗宽度 · 第三环", "每扇区 1.5 个连当量（城郊/农舍，正面更宽）。", "本图暂无三环城"),
    ("TOWN-I", "全城合计", "各分区容量之和；容量按分区建成区面积算（0.55 连/km²，1–8 连，0.5 连取整），不再固定「扇区 2 连」。富尔达约 11 连 ≈ 1.2 个营。", "按面积动态"),
    ("TOWN-J", "防御加成", "核心 +4、外环 +3、第三环 +2（长期交火系统用）。", "—"),
    ("TOWN-K", "控制判定", "每个扇区独立归属；核心 + 4 扇区全部失守 = 完全控制该城。UI 在扇区中心显示蓝/红/黄控制点。", "5/5 图形"),
    ("TOWN-L", "超编后果", "超出战斗宽度的部队不增加火力，只增加暴露与被杀伤概率；要扩大正面必须到城外野战。", "长期规则"),
    ("TOWN-M", "卫星城", "主城 3.5km 内、半径 < 主城 60% 的聚落列为卫星城（如富尔达东侧 Maberzell 3.2km），各自独立成环。", "面板列出"),
    ("TOWN-N", "数据位置", "城镇参数在 map_fulda.json 的 towns[]（含 blocks 轮廓）；分区规则在 app/src/core/towns.ts；"
     "战斗宽度数值目前写死在规则层，后续挪进 data/ 供策划调。", "代码引用"),
    ("TOWN-O", "并列分段（band）", "狭长城市沿主轴切成 2–5 段，段与段并列；段界线垂直于主轴、贯穿整个城区宽度；每段容量按段内建成区面积算。", "Bebra 3 段"),
    ("TOWN-P", "主轴与长宽比", "用建成区顶点做 PCA 求主轴；长宽比 = 主轴跨度 / 次轴跨度，≥1.55 判为狭长，自动启用并列分段。", "阈值可调"),
]
build(
    wb.create_sheet(),
    "17 城镇分区与战斗宽度（v0.5）",
    "城区不是一块地：每片扇区的正面被街道与楼房切割，多投的部队只增加伤亡。改数值先改本表，再改 core/towns.ts。",
    ["编号", "项目", "规则 / 取值", "示例（富尔达）"],
    TOWNS, [12, 20, 92, 34], "C55A11", freeze="A4",
)
wb["Sheet"].title = "17 城镇分区"

CTRL = [
    ("CTRL-A", "控制场", "地图按 288×216 栅格计算控制场：每格 0 我方 / 1 敌方 / 2 争夺带；边界平滑，不做硬多边形。", "约 0.4km/格"),
    ("CTRL-B", "接触线", "剧本文件 scenario_fulda.json 的 front[]（经纬度序列，由北向南）定义接触线；与地图数据分离，换剧本只改这个文件。", "9 个节点"),
    ("CTRL-C", "争夺带", "接触线两侧 contestedWidthM（默认 3.8km）内为争夺带，双方都不完全控制。", "3.8km"),
    ("CTRL-D", "掌握度 · 我方", "我方区域全知，conf = 1.0。", "1.0"),
    ("CTRL-E", "掌握度 · 敌方", "随纵深线性衰减：贴前线 0.85 → depthM（45km）处 0.12。越往敌方纵深越模糊。", "0.85 → 0.12"),
    ("CTRL-F", "方向校准", "接触线不约定左右侧；载入时用我方城市（富尔达）实测，若落错边则反转序列，保证「富尔达在我方」。", "自动"),
    ("CTRL-G", "显示 · 实控着色", "我方 rgba(58,110,190,58)、敌方 rgba(186,76,58,52)、争夺带 rgba(176,148,64,66)，叠在晕渲之上、路网之下。", "开关 1"),
    ("CTRL-H", "显示 · 敌情掌握", "敌方区域按 (1-conf) 加深压暗，肉眼即可读出「哪里看不清」。", "开关 2"),
    ("CTRL-I", "显示 · 接触线", "深色虚线绘制接触线，随控制区开关一起显隐。", "—"),
    ("CTRL-J", "层级衰减", "叠加强度随缩放层级减弱：L0 100% / L1 82% / L2 62%，避免糊住地形细节。", "—"),
    ("CTRL-K", "城镇扇区控制", "每个扇区在中心点采样控制场，显示蓝/红/黄控制点；面板显示「控制方」。", "A-13 / A-15"),
    ("CTRL-L", "与单位的关系", "单位接入后，控制场应由「控制区锚点」动态生成（占领点 + 半径），当前为剧本静态基线。", "长期"),
]
build(
    wb.create_sheet(),
    "18 实控范围与敌情掌握（v0.5）",
    "控制区是「态势」而不是「规则」：目前只影响显示与城镇归属，后续才接入战斗与补给。改剧本只动 scenario_fulda.json。",
    ["编号", "项目", "规则 / 取值", "示例 / 备注"],
    CTRL, [12, 22, 90, 26], "2F5597", freeze="A4",
)
wb["Sheet"].title = "18 实控范围"

order = [
    "00 说明与图例", "01 需求总表", "02 首版范围矩阵", "03 参数与时间设定",
    "04 数据结构字段字典", "05 事件类型与枚举", "06 展开收缩与父子规则",
    "07 指挥链路规则", "08 交火系统（长期）", "09 战报规格", "10 UI 清单",
    "11 数据文件与交付物", "12 验收用例", "13 术语表", "14 待确认问题",
    "15 路线图", "16 变更记录", "17 城镇分区", "18 实控范围",
]
wb._sheets = [wb[n] for n in order]
wb.active = 0

ws0 = wb["00 说明与图例"]
ws0.freeze_panes = "A3"
ws0.page_setup.orientation = "portrait"
ws0.page_setup.fitToWidth = 1
ws0.page_setup.fitToHeight = 0
ws0.sheet_properties.pageSetUpPr.fitToPage = True

wb.calculation.fullCalcOnLoad = True

out = r"E:\PersonalGame\Project1\Docx\战术地图军棋_需求规格总表_v0.5.xlsx"
wb.save(out)
print("SAVED", out)
print("SHEETS", len(wb.sheetnames))
print("REQ_ROWS", len(REQ), "CASES", len(CASES), "QUESTIONS", len(QUESTIONS))
