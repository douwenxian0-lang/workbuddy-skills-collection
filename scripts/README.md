# scripts/ —— 索引生成工具

仓库根目录的 `README.md` 与 `SKILLS-INDEX.md` 是**生成**的，这两个脚本负责生成它们。

## 为什么用 API 而不是 clone

仓库约 **155 MB / 8,500 个文件**，但生成索引只需要每个 `SKILL.md` 的**头部 frontmatter**。
所以这里用 `git/trees` 拿文件树 + GraphQL 批量读 Blob 文本（每批 40 个、8 批左右），
比 `git clone` 快两个数量级，也不怕 CDN 抖动（批内自带重试）。

## 用法

```powershell
# 前置：GitHub CLI 已登录
gh auth status

# 1) 读取所有 SKILL.md 的 frontmatter → scripts/skills.json
pwsh -File scripts/fetch-skills-meta.ps1

# 2) 生成根目录的 README.md 与 SKILLS-INDEX.md
pwsh -File scripts/gen-skills-index.ps1
```

参数（都可省略）：

| 脚本 | 参数 | 默认 |
|---|---|---|
| `fetch-skills-meta.ps1` | `-Owner` / `-Repo` / `-Branch` | `douwenxian0-lang` / `workbuddy-skills-collection` / `main` |
| | `-OutJson` | `scripts/skills.json` |
| | `-BatchSize` / `-MaxRetry` | `40` / `4` |
| `gen-skills-index.ps1` | `-SkillsJson` | `scripts/skills.json` |
| | `-Out` | 仓库根目录（`scripts/` 的上一级） |

## 解析规则（重要）

- 技能目录 = 顶层含 `SKILL.md` 的目录；
- 描述优先取 frontmatter `description`，缺失时依次回退 `summary` → `title` → 正文首段，
  所以**即使某个 SKILL.md 没写 `description`，索引里也会有可读说明**；
- 描述截取首句（最多 110 字符），并转义 Markdown 表格里的 `|`；
- 分类按目录名前缀（`html-ppt*`、`bmad-*`、`tencent*`、`skill_<数字>` 等），见脚本里的 `Category-Of`。

## 只读保证

两个脚本**只读**技能目录 / `skills.json`，**只写**根目录的 `README.md` 与 `SKILLS-INDEX.md`
（以及 `fetch` 写出的 `skills.json`）。不会改动任何技能内容。

## 建议

- `skills.json` 是中间产物，可加进 `.gitignore`（每次重新生成即可）；
- 新增技能后重跑两个脚本，diff 应只包含新增技能行。
