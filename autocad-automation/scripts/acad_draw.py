#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""acad_draw.py — 通过 COM 驱动 AutoCAD 绘图并输出材料清单。

用法:
  python acad_draw.py --spec spec.json --out-dir C:/tmp/cadout [--visible] [--dwg 出图名]

spec.json 结构:
{
  "units": "mm",
  "entities": [
    {"type": "circle",    "center": [50, 50], "radius": 25, "color": 1},
    {"type": "line",      "from": [0, 0], "to": [100, 100]},
    {"type": "rectangle", "corner1": [0, 0], "corner2": [600, 400]},
    {"type": "polyline",  "points": [[0,0],[100,0],[100,80]], "closed": true},
    {"type": "arc",       "center": [0, 0], "radius": 50, "start_deg": 0, "end_deg": 90},
    {"type": "ellipse",   "center": [0,0], "major_len": 60, "major_deg": 0, "ratio": 0.5},
    {"type": "text",      "text": "客厅", "at": [100, 200], "height": 30},
    {"type": "dim",       "p1": [0,0], "p2": [600,0], "offset": 40}
  ],
  "bom": {                        # 可选，不填则自动按实体统计
    "rows": [["序号","名称","规格","数量"], [1, "圆形构件", "Φ50", 1]]
  }
}

输出: <out-dir>/<dwg名>.dwg + 材料清单.csv + result.json
"""
import argparse, json, math, os, sys, csv, datetime, traceback

DEFAULT_PROGID = "AutoCAD.Application"

def connect(visible: bool):
    import win32com.client
    import pythoncom
    pythoncom.CoInitialize()
    # 优先接管已开实例，否则启动新实例（首次启动约 30-60s）
    try:
        acad = win32com.client.GetActiveObject(DEFAULT_PROGID)
        launched = False
    except Exception:
        acad = win32com.client.Dispatch(DEFAULT_PROGID)
        launched = True
    acad.Visible = bool(visible)
    return acad, launched

def pt(p, z=0.0):
    """AutoCAD COM 所有点参数都要显式 VARIANT(VT_ARRAY|VT_R8)。"""
    from win32com.client import VARIANT
    import pythoncom
    return VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8,
                   [float(p[0]), float(p[1]), float(p[2]) if len(p) > 2 else float(z)])

def flat_doubles(seq):
    from win32com.client import VARIANT
    import pythoncom
    return VARIANT(pythoncom.VT_ARRAY | pythoncom.VT_R8, [float(x) for x in seq])

def draw(ms, spec):
    n = 0
    for e in spec.get("entities", []):
        t = e["type"]
        color = e.get("color")
        if t == "circle":
            obj = ms.AddCircle(pt(e["center"]), float(e["radius"]))
        elif t == "line":
            obj = ms.AddLine(pt(e["from"]), pt(e["to"]))
        elif t == "polyline":
            pts = []
            for p in e["points"]:
                pts += [float(p[0]), float(p[1])]
            obj = ms.AddLightWeightPolyline(flat_doubles(pts))
            if e.get("closed"):
                obj.Closed = True
        elif t == "rectangle":
            c1, c2 = e["corner1"], e["corner2"]
            x1, y1 = float(c1[0]), float(c1[1]); x2, y2 = float(c2[0]), float(c2[1])
            pts = [x1, y1, x2, y1, x2, y2, x1, y2]
            obj = ms.AddLightWeightPolyline(flat_doubles(pts))
            obj.Closed = True
        elif t == "arc":
            obj = ms.AddArc(pt(e["center"]), float(e["radius"]),
                            math.radians(float(e.get("start_deg", 0))),
                            math.radians(float(e.get("end_deg", 180))))
        elif t == "ellipse":
            deg = math.radians(float(e.get("major_deg", 0)))
            major = flat_doubles([float(e["major_len"]) * math.cos(deg),
                                  float(e["major_len"]) * math.sin(deg), 0.0])
            obj = ms.AddEllipse(pt(e["center"]), major, float(e.get("ratio", 0.5)))
        elif t == "text":
            obj = ms.AddText(str(e["text"]), pt(e["at"]), float(e.get("height", 25)))
        elif t == "dim":
            obj = ms.AddDimAligned(pt(e["p1"]), pt(e["p2"]),
                                   pt(e.get("textpos", e["p2"])))
            obj.TextOverride = e.get("override") or ""
        else:
            raise ValueError(f"未知实体类型: {t}")
        if color is not None:
            try:
                obj.color = int(color)   # ACI 颜色索引 1红 2黄 3绿 4青 5蓝 7白
            except Exception:
                pass
        n += 1
    return n

def auto_bom(spec):
    rows = [["序号", "名称", "规格", "数量"]]
    stats = {}
    order = []
    for e in spec.get("entities", []):
        t = e["type"]
        if t == "circle":
            name, g = "圆形构件", f"Φ{2 * float(e['radius']):g}"
        elif t == "rectangle":
            w = abs(float(e["corner2"][0]) - float(e["corner1"][0]))
            h = abs(float(e["corner2"][1]) - float(e["corner1"][1]))
            name, g = "矩形构件", f"{w:g}×{h:g}"
        elif t == "line":
            dx = float(e["to"][0]) - float(e["from"][0]); dy = float(e["to"][1]) - float(e["from"][1])
            name, g = "线段", f"L{math.hypot(dx, dy):g}"
        elif t == "polyline":
            pts = e["points"]; L = 0.0
            for a, b in zip(pts, pts[1:]):
                L += math.hypot(b[0]-a[0], b[1]-a[1])
            name, g = "多段线", f"L{L:g}"
        elif t == "arc":
            r = float(e["radius"]); a0 = math.radians(float(e.get("start_deg", 0)))
            a1 = math.radians(float(e.get("end_deg", 180)))
            name, g = "弧段", f"R{r:g}/{math.degrees(abs(a1 - a0)):g}°"
        elif t == "ellipse":
            name, g = "椭圆", f"{2*float(e['major_len']):g}×{2*float(e['major_len'])*float(e.get('ratio',0.5)):g}"
        elif t == "text":
            name, g = "文字", str(e.get("text", ""))[:20]
        elif t == "dim":
            continue
        else:
            continue
        key = (name, g)
        if key not in stats:
            stats[key] = 0; order.append(key)
        stats[key] += 1
    for i, key in enumerate(order, 1):
        rows.append([i, key[0], key[1], stats[key]])
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True, help="绘图规格 JSON 文件路径")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--dwg", default=None, help="DWG 文件名（不含扩展名）")
    ap.add_argument("--visible", action="store_true", help="显示 AutoCAD 窗口")
    ap.add_argument("--launch-timeout", type=int, default=180)
    args = ap.parse_args()

    spec = json.load(open(args.spec, encoding="utf-8"))
    os.makedirs(args.out_dir, exist_ok=True)
    name = args.dwg or f"CAD图_{datetime.datetime.now():%Y%m%d_%H%M%S}"

    result = {"ok": False, "dwg": None, "bom_csv": None, "drawn": 0, "launched_new": False, "error": None}
    try:
        acad, launched = connect(args.visible)
        result["launched_new"] = launched
        doc = acad.ActiveDocument if acad.Documents.Count else acad.Documents.Add()
        drawn = draw(doc.ModelSpace, spec)
        result["drawn"] = drawn
        # 材料清单
        bom = spec.get("bom", {}).get("rows") if isinstance(spec.get("bom"), dict) else None
        rows = bom or auto_bom(spec)
        csv_path = os.path.join(args.out_dir, "材料清单.csv")
        with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f).writerows(rows)
        result["bom_csv"] = csv_path
        # 保存 DWG
        dwg_path = os.path.join(args.out_dir, name + ".dwg")
        if os.path.exists(dwg_path):
            os.remove(dwg_path)
        doc.SaveAs(dwg_path)
        result["dwg"] = dwg_path
        result["ok"] = True
    except Exception as ex:
        result["error"] = f"{type(ex).__name__}: {ex}"
        result["trace"] = traceback.format_exc(limit=4)
    finally:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        sys.exit(0 if result["ok"] else 1)

if __name__ == "__main__":
    main()
