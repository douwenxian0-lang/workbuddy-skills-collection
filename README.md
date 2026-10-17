# WorkBuddy / OpenClaw 技能集合

一组可直接使用的 AI Agent 技能（每个技能一个目录，入口为该目录下的 `SKILL.md`）。

## 统计

| 指标 | 数值 |
|---|---|
| 技能数 | **303** |
| 文件数 / 体积 | 6804 / 约 154 MB |
| 缺少可解析 description | 0 |

## 分类概览

| 分类 | 数量 | 说明 |
|---|---:|---|
| 01 · HTML PPT 模板族 | 51 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#01---HTML-PPT-模板族) |
| 02 · BMAD 角色族 | 6 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#02---BMAD-角色族) |
| 03 · 腾讯产品技能 | 10 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#03---腾讯产品技能) |
| 04 · 平台/工具技能族 | 27 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#04---平台-工具技能族) |
| 05 · 设计模板族 | 9 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#05---设计模板族) |
| 06 · 独立技能 | 168 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#06---独立技能) |
| 09 · 数字 ID 技能（迁移产物） | 32 | 见 [SKILLS-INDEX.md](SKILLS-INDEX.md#09---数字-ID-技能-迁移产物-) |

## 怎么用

1. 在 [SKILLS-INDEX.md](SKILLS-INDEX.md) 里按关键词找到需要的技能；
2. 打开该目录的 `SKILL.md`，里面含 `name` / `description`（触发场景）/ 具体步骤与脚本；
3. 目录内可能还带 `references/`（参考资料）、`scripts/`（可执行脚本）、`assets/`（素材）。

## 目录约定

| 路径 | 含义 |
|---|---|
| `<skill>/SKILL.md` | 必填：技能入口（frontmatter + 说明） |
| `<skill>/references/` | 可选：参考资料 |
| `<skill>/scripts/` | 可选：可执行脚本 |
| `_meta_template.json` | 发布元数据模板（`ownerId` / `slug` / `version` / `publishedAt`） |
| `.disable_to_model_invocation_migration.json` 等 | 技能系统 schema 迁移的一次性标记（勿删） |

> 本 README 与 SKILLS-INDEX.md 由脚本从现有目录与 frontmatter **生成**，不改变任何技能内容。
