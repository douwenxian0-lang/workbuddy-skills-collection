# Phase 1 调研脚本化方案

> ~~状态：方案阶段（未动代码）~~
> **状态：已废弃（2026-05-07）**
> 废弃原因：Phase 1 已改为使用内置 `online-search` skill（ProSearch）直接搜索，主 agent 串行执行，无需 subagent 也无需独立搜索脚本。详见 SKILL.md Phase 1。
>
> ~~目标：把 Phase 1 的 3 个 subagent 调研从"纯 LLM 发挥"改为"脚本收集 + LLM 提炼"，降低失败率~~

---

## 一、当前问题

Phase 1 要 spawn 3 个 subagent，每个做 WebSearch + 写入 `references/research/*.md`。失败模式：

1. subagent 忘记把结果写文件
2. WebSearch 结果质量差 / 被墙 / robots.txt 受限
3. 3 个并行有一个卡住或超时，主 agent 不知道该等还是推进
4. 调研中途 token 爆了，后面 Phase 2-3-4-5 没料下锅
5. 汇总时去重不充分，信息冲突

核心原因：**调研的"找素材"和"分析素材"两步都交给 LLM**，但 LLM 擅长分析、不擅长可靠地执行搜索和文件 I/O。

## 二、设计思路

**脚本负责"找素材"（确定性），LLM 负责"分析素材"（创造性）。**

参考 `agent-workspace-creator` 的模式：parse_session.py（确定性脚本）→ LLM（创造性填充）。

```
              ┌─────────────────────────────────┐
              │     scripts/research.py          │
              │  输入: 人名 + 维度 + 语言        │
              │  输出: JSON (sources + snippets)  │
              └───────────┬─────────────────────┘
                          │
              ┌───────────▼─────────────────────┐
              │     LLM (主 agent / subagent)    │
              │  输入: JSON + 提炼指令           │
              │  输出: references/research/*.md  │
              └─────────────────────────────────┘
```

## 三、`scripts/research.py` 详细设计

### 3.1 接口定义

```bash
python3 [skill目录]/scripts/research.py \
  --person "查理·芒格" \
  --dimension thought-core \        # thought-core | expression | context
  --lang zh \                        # zh | en（决定搜索策略）
  --max-sources 20 \                 # 每个维度最多收集的来源数
  --timeout 300 \                    # 总超时秒数
  --output /tmp/research_thought-core.json
```

### 3.2 输出 JSON 结构

```json
{
  "person": "查理·芒格",
  "dimension": "thought-core",
  "lang": "zh",
  "collectedAt": "2026-04-29T14:00:00Z",
  "queries": [
    {
      "query": "查理·芒格 核心投资哲学 多元思维模型",
      "engine": "web_search",
      "resultsCount": 8
    }
  ],
  "sources": [
    {
      "url": "https://...",
      "title": "芒格的多元思维模型",
      "type": "article",          // article | book | podcast | video | interview | social
      "credibility": "primary",   // primary | secondary | inferred
      "snippet": "前 500 字...",
      "fetchedAt": "2026-04-29T14:01:00Z"
    }
  ],
  "stats": {
    "queriesExecuted": 5,
    "sourcesFound": 15,
    "sourcesFetched": 12,
    "sourcesFailed": 3,
    "totalSnippetChars": 45000
  },
  "errors": [
    {
      "url": "https://...",
      "error": "403 Forbidden",
      "fallback": "used cached snippet from search result"
    }
  ]
}
```

### 3.3 搜索策略（脚本内置，不依赖 LLM 决策）

每个维度有预定义的搜索模板：

```python
SEARCH_TEMPLATES = {
    "thought-core": {
        "zh": [
            "{person} 核心思想 哲学",
            "{person} 著作 书 推荐",
            "{person} 决策 逻辑 案例",
            "{person} 争议 观点",
            "{person} 自创概念 术语",
        ],
        "en": [
            "{person} core philosophy mental models",
            "{person} books key ideas",
            "{person} decision making case studies",
            "{person} controversial opinions",
            "{person} original concepts terminology",
        ]
    },
    "expression": {
        "zh": [
            "{person} 采访 播客 对话",
            "{person} 演讲 公开发言",
            "{person} 说话方式 语录",
            "{person} 辩论 回应 争论",
            "{person} 幽默 段子",
        ],
        "en": [
            "{person} interview podcast conversation",
            "{person} speech public talk",
            "{person} quotes speaking style",
            "{person} debate response argument",
            "{person} humor funny moments",
        ]
    },
    "context": {
        "zh": [
            "{person} 人物传记 经历",
            "{person} 早年 成长 背景",
            "{person} 评价 分析 他人看法",
            "{person} 时间线 里程碑",
            "{person} 最近 近期动态 2025 2026",
        ],
        "en": [
            "{person} biography early life background",
            "{person} career timeline milestones",
            "{person} analysis criticism review",
            "{person} recent news 2025 2026",
            "{person} influences mentors",
        ]
    }
}
```

**中文人物额外追加**（`--lang zh`）：
```python
ZH_EXTRA_QUERIES = [
    "site:zhihu.com {person}",
    "site:mp.weixin.qq.com {person}",
    "site:bilibili.com {person} 演讲 采访",
    "site:xiaoyuzhoufm.com {person}",
    "{person} 36氪 OR 晚点 OR 极客公园 OR 财新",
]
```

### 3.4 抓取策略

```python
def fetch_source(url, timeout=30):
    """
    抓取逻辑：
    1. 先尝试直接 fetch（respect robots.txt）
    2. 如果失败（403/timeout/paywall）→ 使用搜索引擎 cache
    3. 如果 cache 也没有 → 只保留搜索结果的 snippet（通常 2-3 句）
    4. 无论如何都返回结果，只是 snippet 长度不同
    """
    pass
```

**关键设计**：`fetch_source` **永远返回结果**，不抛异常。最坏情况返回搜索结果的标题+摘要作为 snippet。错误记录在 `errors` 数组里供 LLM 参考质量。

### 3.5 去重与排序

脚本层面做简单去重：
- URL 去重（同一页面只保留一次）
- 标题相似度去重（Jaccard > 0.8 的合并）
- 按 credibility 排序（primary > secondary > inferred）
- 按 snippet 长度排序（长的更有价值）

### 3.6 失败兜底

```python
def run_research(person, dimension, lang, max_sources, timeout):
    try:
        # 正常流程
        results = execute_search_queries(...)
        sources = fetch_all_sources(...)
        return format_output(results, sources)
    except Exception as e:
        # 兜底：返回空结构 + 错误信息
        return {
            "person": person,
            "dimension": dimension,
            "sources": [],
            "stats": {"queriesExecuted": 0, "sourcesFound": 0, ...},
            "errors": [{"error": str(e), "fallback": "script failed entirely"}]
        }
```

**脚本层面的兜底保证**：无论发生什么，都输出一个合法的 JSON 文件。LLM 读到 `sources: []` 时知道要用自身知识兜底。

## 四、与 Phase 1 的集成方式

### 改造后的 Phase 1 流程

```
Phase 0.5 完成
    │
    ├── [并行] python3 research.py --person X --dimension thought-core --output /tmp/r1.json
    ├── [并行] python3 research.py --person X --dimension expression --output /tmp/r2.json
    └── [并行] python3 research.py --person X --dimension context --output /tmp/r3.json
         │
         ▼
    3 个 JSON 全部就绪（脚本保证有输出，不会卡住）
         │
         ▼
    LLM 读取 3 个 JSON + 提炼指令
         │
    ├── 写入 01-thought-core.md      ← 从 r1.json 的 snippets 提炼
    ├── 写入 02-expression-profile.md ← 从 r2.json 的 snippets 提炼
    └── 写入 03-context-and-perception.md ← 从 r3.json 的 snippets 提炼
         │
         ▼
    Phase 1 完成 → 进入 Phase 2
```

### 关键变化

| 维度 | 改造前 | 改造后 |
|------|--------|--------|
| **搜索词** | LLM 自己想搜什么 | 脚本内置搜索模板（确定性） |
| **搜索执行** | subagent 用 WebSearch tool | 脚本直接调用搜索 API |
| **页面抓取** | subagent 决定抓不抓、怎么抓 | 脚本统一抓取策略 + robots.txt 合规 |
| **失败处理** | subagent 可能停下来解释"搜不到" | 脚本永远输出 JSON，`sources: []` 也是合法输出 |
| **文件写入** | subagent 可能忘记写文件 | 脚本保证 JSON 文件存在 → LLM 读 JSON 写 md（读→写一步到位） |
| **超时控制** | 没有机制，subagent 可能跑很久 | 脚本层面 `--timeout` 硬约束 |
| **并行执行** | 依赖 LLM 的 subagent 调度 | 3 个脚本进程并行，主进程 wait |
| **Token 消耗** | 搜索+分析都消耗 LLM token | 搜索不消耗 token，只有分析消耗 |

### LLM 提炼阶段的 prompt 设计

```markdown
你将收到一份关于 [人名] 的 [维度名] 调研数据（JSON 格式）。
请基于 sources 中的 snippets 进行结构化提炼，输出到 `references/research/[文件名].md`。

规则：
1. 只使用 snippets 中的实际内容，不要编造
2. 来源标记：每条提炼注明来自哪个 source（用 [S1] [S2] 编号）
3. 区分「他说过的」vs「别人说他的」vs「推断的」
4. 发现矛盾时保留矛盾
5. 如果 sources 为空或极少，明确标注「信息不足，以下基于通识」
6. 信息可信度从 stats 中判断：sourcesFound < 5 → 信息匮乏模式
```

## 五、实现步骤（按优先级）

### 第一步：骨架（1 天）
- [ ] `research.py` 基本结构：参数解析、搜索模板、输出 JSON
- [ ] 搜索 API 集成：用 WebSearch API 或 SerpAPI（根据部署环境）
- [ ] 简单 fetch：requests.get + timeout + 错误记录

### 第二步：智能抓取（1 天）
- [ ] robots.txt 检查
- [ ] 搜索引擎 cache fallback
- [ ] snippet 截取（前 500 字 + 关键段落）
- [ ] 去重逻辑

### 第三步：中文特化（0.5 天）
- [ ] 中文人物的额外搜索策略
- [ ] 知乎/微信公众号/B站 的特殊抓取逻辑
- [ ] 编码处理

### 第四步：集成 + 测试（0.5 天）
- [ ] SKILL.md Phase 1 章节更新（用 research.py 替代 subagent 搜索）
- [ ] 3 个测试人物跑完整流程验证：
  - 芒格（英文信息丰富）
  - 张小龙（中文信息丰富）
  - 冷门人物（信息匮乏场景）

## 六、依赖与约束

| 依赖 | 说明 |
|------|------|
| Python 3.9+ | 目录里已有 Python 脚本 |
| `requests` | HTTP 抓取（或用 `urllib3`） |
| WebSearch API | 需要确认部署环境用什么搜索 API（WorkBuddy 的 WebSearch tool？还是外部 SerpAPI？） |
| 无新增外部依赖 | 尽量用标准库 + requests |

**开放问题**：
1. QClaw 端内调用 skill 时，LLM 能不能直接执行 `python3 scripts/research.py`？还是只能调用 WebSearch tool？这决定了脚本是直接调搜索引擎 API 还是仍然依赖 LLM 的 WebSearch tool 做搜索、脚本只负责组织查询和收集结果。
2. 如果只能用 WebSearch tool，脚本退化为"查询模板生成器"——输出搜索词列表 + 结果收集器，搜索本身还是 LLM 执行。这种模式下好处是不需要额外 API key，坏处是搜索部分仍有 LLM 不可靠性。

---

> 写于 2026-04-29。等你确认思路 + 回答开放问题后动代码。
