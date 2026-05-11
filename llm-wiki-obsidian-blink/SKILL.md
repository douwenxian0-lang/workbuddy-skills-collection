---
title: "LLM Wiki - Obsidian 知识管理系统"
summary: "基于 Andrej Karpathy 的 LLM Wiki 模式实现的 Obsidian 知识库，利用 LLM 维护可复利的知识层"
---

# LLM Wiki - Obsidian 知识管理系统

基于 Andrej Karpathy 的 [LLM Wiki 模式](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 实现的 Obsidian 知识库，利用 LLM 维护可复利的个人知识层。

## 核心理念

传统 Wiki 失败的原因是维护成本太高——人类不擅长处理繁琐的交叉引用、一致性检查和内容更新。而 LLM 恰好擅长这些"记账"工作。

## 三层架构

1. **原始资料层** (`raw/`)：不可变的事实来源
2. **知识层** (`wiki/`)：LLM 维护的结构化知识网络
3. **配置层** (`TheSchema.md`)：定义系统规则和工作流

## 知识层结构

- `sources/` - 来源摘要页
- `entities/` - 实体页（人物、项目等）
- `concepts/` - 概念页（方法、理论等）
- `comparisons/` - 比较分析页
- `overview/` - 总览综合页
- `index.md` - 内容索引
- `log.md` - 操作日志

## 使用场景

- 当用户需要建立个人知识管理系统时
- 当用户需要整理和连接 Obsidian 笔记时
- 当用户需要 LLM 帮助维护 Wiki 知识库时
- 当用户提到 "wiki"、"知识库"、"obsidian"、"复利知识" 时

## 工作流程

1. 将原始资料放入 `raw/` 目录
2. LLM 读取 `TheSchema.md` 了解规则
3. LLM 生成/更新 `wiki/` 中的结构化知识页
4. 自动维护交叉引用、一致性和索引

## 特性

- 持久化知识积累（可复利）
- 自动化维护（交叉引用、一致性检查）
- 结构化组织（来源、实体、概念、比较、总览）
- 完整可追溯性（操作日志和来源引用）
- Obsidian 原生（双向链接、标签、图谱）
