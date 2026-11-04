---
name: autocad-automation
description: 用自然语言指令驱动本机 AutoCAD 自动制图：画圆/线/多段线/矩形/弧/椭圆/文字/尺寸标注，生成 DWG 图纸并输出材料清单 CSV。触发词：AutoCAD、CAD、CAD图纸、DWG、DXF、画图、绘制、制图、图纸、施工图、材料清单、标注、画个圆、画矩形、画墙线、参数化绘图、CAD自动化、装修图纸、放样。
---

# AutoCAD 制图自动化（WorkBuddy + COM）

把用户的自然语言制图指令变成 JSON 规格，调用 `scripts/acad_draw.py` 通过 COM 驱动本机 AutoCAD（已验证：AutoCAD 2024.2，ProgID `AutoCAD.Application`）完成绘制、保存 DWG、生成材料清单。

## 何时触发

用户出现以下任一意图即触发：
- 「画一个/绘制…」（含几何词：圆/矩形/墙/线/弧/标注）
- 「生成 CAD 图纸」「导出 DWG」「出施工图」
- 「根据这段描述画图」「把这张户型描述画成图」
- 「输出材料清单」（结合图纸实体）

## 工作流（四步，对应「需求描述→MCP/COM 连接→生成→出清单」）

### 1. 需求 → JSON 规格（AI 完成，不写死模板）

把自然语言映射为 spec.json，规则：
- 长度单位默认 **mm**，坐标原点在左下，用户说「圆心 (50,50)」就直接用
- 「半径 R25 的圆」→ `{"type":"circle","center":[50,50],"radius":25}`
- 「600×400 的矩形」→ rectangle（corner1/corner2）
- 「从 (0,0) 到 (100,100) 的线」→ line；「沿这些点走的多段线/墙线」→ polyline（闭合墙线 closed:true）
- 「标注尺寸」→ dim（p1/p2 为被标注两点，offset 为尺寸线偏移）
- 强调颜色可用 ACI：1红 2黄 3绿 4青 5蓝 7白
- 文字说明 → text（height 默认 25，即 2.5cm 字高）

写 spec 到任务目录（如 `桌面/公众号流水线/../cad任务/spec.json` 或用户指定目录）。

### 2. 运行

```bash
PY="C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
"$PY" "C:/Users/Administrator/.workbuddy/skills/autocad-automation/scripts/acad_draw.py" \
  --spec spec.json --out-dir <输出目录> [--visible]
```

- 默认隐藏窗口后台跑（自动化优先）；用户想围观就加 `--visible`
- AutoCAD 未运行时脚本会自动启动（首启 30~60s，耐心等）
- 脚本输出 result.json：`ok / dwg / bom_csv / drawn / error`

### 3. 交付物

- `<名称>.dwg`：可直接用 AutoCAD 打开
- `材料清单.csv`：按实体自动统计（圆形构件 Φ50 ×1 等），也可在 spec 里用 `bom.rows` 手工指定
- 汇报时用表格展示清单内容

### 4. 迭代修改

用户说「圆改成 R30」「加一面墙」→ 改 spec.json 重跑（DWG 会重新生成）。局部修改永远是改规格重画，不要试图「在旧图上补一笔」。

## 环境与依赖

- pywin32 已装入默认 venv（win32com）
- AutoCAD ProgID 兼容列表：`AutoCAD.Application`（CurVer 自动解析到 24.2）
- 若 `GetActiveObject` 失败说明 AutoCAD 没开，脚本会 Dispatch 自启
- COM 数组点坐标用 `[x, y]` 或 `[x, y, z]` 均可

## 已验证案例（2026-11-04）

「绘制一个半径25的圆，圆心坐标为 (50,50)」→ R25 圆 + 材料清单「圆形构件 Φ50 ×1」+ DWG 保存成功，与文章演示一致。

## 已知限制

- 走 COM 基础实体（圆/线/多段线/弧/椭圆/文字/对齐标注）；复杂块、图案填充、图层管理未封装，需要时扩展脚本
- 弧角度单位为度（脚本内部转弧度）
- 隐藏窗口模式下 AutoCAD 进程在脚本退出后保留（复用 GetActiveObject），不重复启动
- 需要本机有正版 AutoCAD 授权；无 CAD 时脚本会报 COM 错误，此时降级：改用「生成 DXF 脚本（.scr）」方案（用户手动在 CAD 里 SCRIPT 命令运行）——遇到再扩展
