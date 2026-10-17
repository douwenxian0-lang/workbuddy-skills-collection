# WorkBuddy / OpenClaw 技能集合

一组可直接使用的 AI Agent 技能（每个技能一个目录，入口为该目录下的 `SKILL.md`）。

## 统计

| 指标 | 数值 |
|---|---|
| 技能数 | **250** |
| 文件数 / 体积 | 6798 / 约 126.5 MB |
| 缺少可解析 description | 0 |

## 分类概览

| 分类 | 数量 | 索引 |
|---|---:|---|
| 01 · HTML PPT 模板族 | 1 | [查看](SKILLS-INDEX.md) |
| 02 · BMAD 角色族 | 6 | [查看](SKILLS-INDEX.md) |
| 03 · 腾讯产品技能 | 11 | [查看](SKILLS-INDEX.md) |
| 04 · 平台/工具技能族 | 26 | [查看](SKILLS-INDEX.md) |
| 05 · 设计模板族 | 9 | [查看](SKILLS-INDEX.md) |
| 06 · 独立技能 | 197 | [查看](SKILLS-INDEX.md) |

## 怎么用

1. 在 [SKILLS-INDEX.md](SKILLS-INDEX.md) 里按关键词找到需要的技能；
2. 打开该目录的 `SKILL.md`：`name` / `description`（触发场景）/ 步骤与脚本；
3. 目录内可能带 `references/`（资料）、`scripts/`（可执行脚本）、`assets/`（素材）。

## 目录约定

| 路径 | 含义 |
|---|---|
| `<skill>/SKILL.md` | 必填：技能入口（frontmatter + 说明） |
| `<skill>/references/` | 可选：参考资料 |
| `<skill>/scripts/` | 可选：可执行脚本 |
| `_meta_template.json` | 发布元数据模板（`ownerId` / `slug` / `version` / `publishedAt`） |
| `.disable_to_model_invocation_migration.json` 等 | 技能系统 schema 迁移的一次性标记（勿删） |

## 维护：重新生成索引

本 README 与 `SKILLS-INDEX.md` 都是**生成**的，不要手改。新增/修改技能后执行：

```powershell
pwsh -File scripts/fetch-skills-meta.ps1    # 经 gh API 读取所有 SKILL.md 头部 → scripts/skills.json
pwsh -File scripts/gen-skills-index.ps1      # 生成根目录 README.md + SKILLS-INDEX.md
```

前置：GitHub CLI 已登录（`gh auth status`）。脚本只读技能目录、只写上述两个 Markdown 文件。
