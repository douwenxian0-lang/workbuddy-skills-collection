"""扫描所有本地 skill，生成注册表。

扫描 ~/.workbuddy/skills/ 和工作区 .workbuddy/skills/，
解析每个 skill 的 SKILL.md frontmatter，按关键词分类，
输出 references/skill_registry.json 和 references/skill_registry.md。

用法: python scan_skills.py
"""

import os
import sys
import json
import re
from pathlib import Path

# 修复 Windows 终端 UTF-8 输出
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def parse_frontmatter(content: str) -> dict:
    """解析 YAML frontmatter（--- 之间的内容）"""
    fm = {}
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return fm
    lines = match.group(1).split("\n")
    current_key = None
    current_value = []
    for line in lines:
        if current_key and (line.startswith("  ") or line == ""):
            current_value.append(line)
            continue
        if current_key and current_value:
            fm[current_key] = "\n".join(current_value).strip()
            current_value = []
        if ":" in line:
            idx = line.index(":")
            key = line[:idx].strip()
            val = line[idx + 1:].strip().strip("\"'")
            if val == "|":
                current_key = key
                current_value = []
            else:
                fm[key] = val
                current_key = None
    if current_key and current_value:
        fm[current_key] = "\n".join(current_value).strip()
    return fm


def scan_dir(base: str, label: str) -> list:
    """扫描一个 skill 目录，返回 skill 信息列表"""
    skills = []
    if not os.path.exists(base):
        return skills
    for name in sorted(os.listdir(base)):
        skill_dir = os.path.join(base, name)
        if not os.path.isdir(skill_dir):
            continue
        if name.startswith("."):
            continue

        # 查找 SKILL.md（支持嵌套，最多2层）
        skill_md = None
        for cand in [
            os.path.join(skill_dir, "SKILL.md"),
            os.path.join(skill_dir, "skill", "SKILL.md"),
        ]:
            if os.path.exists(cand):
                skill_md = cand
                break
        if skill_md is None:
            for cand in Path(skill_dir).rglob("SKILL.md"):
                if cand != Path(skill_dir) / "SKILL.md":
                    skill_md = str(cand)
                    break

        info = {
            "name": name,
            "path": skill_dir,
            "source": label,
            "display_name": name,
            "description": "",
            "user_invocable": False,
        }

        if skill_md and os.path.exists(skill_md):
            try:
                with open(skill_md, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                fm = parse_frontmatter(content)
                info["display_name"] = fm.get("name", name)
                info["description"] = fm.get("description", "")
                info["user_invocable"] = fm.get("user-invocable", False) in [True, "true", "True"]
                if isinstance(info["description"], str) and "\n" in info["description"]:
                    info["description"] = info["description"].split("\n")[0].strip()
            except Exception:
                pass

        scripts_dir = os.path.join(skill_dir, "scripts")
        info["scripts"] = sorted([
            f for f in (os.listdir(scripts_dir) if os.path.exists(scripts_dir) else [])
            if os.path.isfile(os.path.join(scripts_dir, f)) and f.endswith((".py", ".sh", ".js", ".ts"))
        ])

        skills.append(info)
    return skills


# 输出目录：skill-dispatcher/references/
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(SCRIPT_DIR)

all_skills = []

# 扫描 ~/.workbuddy/skills（用户级）
wb_home = str(Path.home() / ".workbuddy" / "skills")
all_skills.extend(scan_dir(wb_home, "workbuddy_home"))

# 扫描工作区 .workbuddy/skills（项目级）
wb_ws = os.environ.get("WORKBUDDY_WORKSPACE", "")
if wb_ws:
    wb_ws_skills = os.path.join(wb_ws, ".workbuddy", "skills")
    all_skills.extend(scan_dir(wb_ws_skills, "workbuddy_workspace"))

# 去重（按 display_name 小写）
seen = set()
unique = []
for s in all_skills:
    key = s["display_name"].lower()
    if key not in seen:
        seen.add(key)
        unique.append(s)

print(f"共扫描 {len(all_skills)} 个 skill 条目，去重后 {len(unique)} 个")

# 关键词分类
kw_map = {
    "数据分析": ["数据", "data", "analysis", "统计", "statistic", "chart", "图表",
                 "可视化", "visualization", "excel", "xlsx", "csv", "stock", "股票",
                 "finance", "金融", "财务", "估值", "量化", "quant", "equity",
                 "trading", "tushare", "akshare", "dcf", "financial"],
    "设计创作": ["design", "设计", "figma", "ui", "ux", "css", "tailwind", "poster",
                 "海报", "landing", "page", "frontend", "前端", "webapp", "react",
                 "vue", "component", "html", "ppt", "slide", "deck", "presentation",
                 "模板", "template", "motion", "animation", "视频", "video", "frame",
                 "image", "图片", "draw", "canvas", "logo", "brand", "carousel",
                 "banner", "prototype", "wireframe", "nano", "excalidraw",
                 "hyperframes", "remotion", "图表", "杂志", "magazine"],
    "办公效率": ["文档", "document", "word", "docx", "pptx", "powerpoint", "markdown",
                 "pdf", "报告", "note", "笔记", "notion", "obsidian", "email", "邮件",
                 "gmail", "imap", "calendar", "日历", "会议", "meeting", "weekly",
                 "release", "changelog", "spec", "prd", "产品", "管理", "project",
                 "task", "plan", "planning", "team", "okr", "sprint", "scrum",
                 "roadmap", "onboarding", "hr", "runbook", "finance-report", "invoice"],
    "研究搜索": ["search", "搜索", "research", "研究", "deep", "find", "发现", "lookup",
                 "brave", "tavily", "baidu", "prismfy", "web", "fetch", "article",
                 "news", "新闻", "summarize", "summary", "transcript", "youtube",
                 "video", "深度", "调研", "分析报告", "report"],
    "开发编程": ["code", "开发", "编程", "dev", "build", "docker", "dockerfile", "sdk",
                 "api", "cli", "server", "mcp", "agent", "浏览器", "browser",
                 "playwright", "selenium", "测试", "test", "debug", "deploy", "git",
                 "github", "repo", "npm", "node", "python", "refactor", "code-review",
                 "lsp"],
    "AI智能": ["ai", "llm", "gpt", "claude", "gemini", "whisper", "speech", "ocr",
                "humanize", "humanizer", "translate", "翻译", "bot", "skill", "插件",
                "memory", "记忆", "self-improving", "proactive", "evolution",
                "agent-browser", "agent-memory"],
    "生活娱乐": ["weather", "天气", "music", "音乐", "joke", "game", "游戏", "recipe",
                 "food", "travel", "旅游", "健康", "health", "fitness", "remind", "提醒"],
}
categories = {}
for s in unique:
    name = s["display_name"]
    desc = (s.get("description", "") or "").lower()
    scripts_str = " ".join(s.get("scripts", [])).lower()
    cats = []
    for cat, kws in kw_map.items():
        if any(kw in name.lower() or kw in desc or kw in scripts_str for kw in kws):
            cats.append(cat)
    info = s.copy()
    info["categories"] = cats if cats else ["通用工具"]
    categories[name] = info

# 保存 JSON
json_path = os.path.join(OUT_DIR, "references", "skill_registry.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(categories, f, ensure_ascii=False, indent=2)

# 生成 Markdown 注册表
import datetime
md_path = os.path.join(OUT_DIR, "references", "skill_registry.md")
lines = [
    "# Skill 注册表\n",
    f"自动生成时间: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n",
    f"共 {len(categories)} 个 skill\n",
]
for cat_name in ["数据分析", "设计创作", "办公效率", "研究搜索", "开发编程", "AI智能", "生活娱乐", "通用工具"]:
    items = [(n, s) for n, s in categories.items() if cat_name in s.get("categories", [])]
    if not items:
        continue
    lines.append(f"\n## {cat_name}（{len(items)} 个）\n")
    for name, info in sorted(items, key=lambda x: x[0]):
        desc = (info.get("description", "") or "")[:150]
        scripts = ", ".join(info.get("scripts", [])) or "—"
        invocable = " [可调用]" if info.get("user_invocable") else ""
        lines.append(f"- **{name}**{invocable}: {desc}  `脚本: {scripts}`")
with open(md_path, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"注册表已生成: {json_path}")
print(f"注册表已生成: {md_path}")
