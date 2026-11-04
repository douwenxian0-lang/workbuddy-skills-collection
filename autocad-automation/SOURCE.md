# 来源

- 技能类型：**自建**（2026-11-04），灵感来自公众号文章《WorkBuddy连接AutoCAD，让电脑制图自动化》（图片消息型推文，无仓库链接）
- 文章核心思路：自然语言 → MCP/COM → Python 驱动 AutoCAD → 出图纸 + 材料清单
- 实现方式：pywin32 COM 驱动本机 AutoCAD（ProgID AutoCAD.Application，已验证 2024.2）
- 关键坑：AutoCAD COM 所有数组参数必须显式 VARIANT(VT_ARRAY|VT_R8)，pywin32 传普通 list/tuple 会 E_INVALIDARG
- 已实测：R25 圆 @ (50,50) + 200×150 矩形 + 文字 + 尺寸标注 → DWG 保存 + 材料清单 CSV 生成，与文章演示一致
