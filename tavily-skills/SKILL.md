---
title: "Tavily Skills - Web搜索与内容提取技能集"
summary: "Tavily驱动的Web搜索、内容提取、站点爬取、URL发现和深度研究技能集合"
---

# Tavily Skills

Tavily 驱动的 Web 搜索、内容提取、站点爬取、URL 发现和深度研究技能集合。

## 可用子技能

| 技能 | 描述 |
|-------|-------------|
| **tavily-search** | Web搜索，LLM优化的结果。支持域名过滤、时间范围和多种搜索深度。 |
| **tavily-extract** | 从特定URL提取干净的markdown/text内容。处理JS渲染页面。 |
| **tavily-crawl** | 爬取网站并从多个页面提取内容。保存为本地markdown文件。 |
| **tavily-map** | 发现网站上的所有URL，不提取内容。比爬取更快。 |
| **tavily-research** | 综合AI驱动的研究，带引用。30-120秒内多源综合。 |
| **tavily-cli** | 概览技能，包含工作流指南、安装/认证说明。 |
| **tavily-best-practices** | 构建生产就绪Tavily集成的参考文档。 |

## 工作流

从简单开始，需要时升级：

1. **Search** — 搜索主题相关页面（`tvly search "query" --json`）
2. **Extract** — 从特定URL获取内容（`tvly extract "https://..." --json`）
3. **Map** — 发现站点上的URL（`tvly map "https://..." --json`）
4. **Crawl** — 从站点部分批量提取（`tvly crawl "https://..." --output-dir ./docs/`）
5. **Research** — 深度多源分析（`tvly research "topic" --model pro`）

## 安装

### 安装技能

```bash
# Agent技能（Claude Code, Cursor等）
npx skills add https://github.com/tavily-ai/skills
```

### 安装 Tavily CLI

技能需要安装 Tavily CLI (`tvly`)：

```bash
curl -fsSL https://cli.tavily.com/install.sh | bash
```

或手动安装：

```bash
uv tool install tavily-cli   # 或: pip install tavily-cli
```

### 认证

```bash
tvly login --api-key tvly-YOUR_KEY
# 或: tvly login                      (打开浏览器进行OAuth)
# 或: export TAVILY_API_KEY=tvly-...
```

在 [tavily.com](https://tavily.com) 获取 API key。

## 使用场景

- 当用户需要Web搜索时
- 当用户需要提取网页内容时
- 当用户需要爬取网站时
- 当用户提到 "tavily"、"web search"、"内容提取" 时
- 需要进行深度研究和分析时

## 子技能位置

所有子技能位于 `skills/` 子目录：
- `skills/tavily-search/SKILL.md`
- `skills/tavily-extract/SKILL.md`
- `skills/tavily-crawl/SKILL.md`
- `skills/tavily-map/SKILL.md`
- `skills/tavily-research/SKILL.md`
- `skills/tavily-cli/SKILL.md`
- `skills/tavily-best-practices/SKILL.md`
