---
name: super-human
slug: super-human
version: 2.0.0
description: "全能超人 v2.0 - 融合 BMAD敏捷开发 + Open Design快速原型 + superpowers + agency + design + memory。支持敏捷开发全流程、Open Design原型生成、专家角色库支持。"
metadata: {"clawdbot":{"emoji":"🦸","requires":{"bins":[]},"os":["linux","darwin","win32"]}}
---

# 全能超人 (Super Human)

**融合多个顶级技能的终极AI工作流系统** - 让AI真正理解你的需求，智能选择最佳工作流，动态加载专业角色，无缝管理记忆。

---

## 核心理念

**不是简单的技能堆叠，而是智能融合**：
- ✅ **模式自动识别** - 开发任务用superpowers流程，商业任务用agency流程
- ✅ **BMAD敏捷开发** - 集成BMAD方法，支持编排器、产品经理、架构师、开发者、Scrum主管、UX设计师角色
- ✅ **Open Design快速原型** - 支持 Open Design 编辑级落地页和幻灯片原型生成
- ✅ **角色动态加载** - 支持专业角色库（需单独安装角色文件）
- ✅ **记忆系统协同** - 内置记忆+扩展记忆，快慢结合
- ✅ **设计智能执行** - 自动学习视觉偏好，生成符合品味的作品
- ✅ **冲突自动优化** - 工作流程无缝衔接，无重复、无矛盾

---

## 快速开始

### 1. 开发模式（自动触发）

**触发词**: 「开发」、「写代码」、「做个XX」、「实现XX功能」、「帮我做」

**工作流程**（来自superpowers）:
```
1. 澄清需求 (Clarify)
   ↓
2. 制定设计 (Plan)
   ↓
3. 执行开发 (Execute with TDD)
   ↓
4. 系统调试 (Debug)
   ↓
5. 完成分支 (Finish)
```

**示例**:
```
用户：帮我做一个网站
AI：[澄清] 网站是什么类型的？个人站还是企业站？
用户：个人博客
AI：[设计] 我计划用HTML+CSS+JS，3个文件搞定
用户：好的
AI：[执行] 
1. 创建 index.html
2. 创建 style.css  
3. 创建 script.js
[审核] 博客功能完整，符合需求
```

### 2. BMAD 敏捷开发模式（新增）

**触发词**: 「BMAD」、「敏捷开发」、「产品规划」、「架构设计」

**BMAD角色系统**（6个专业角色）:
- **bmad-orchestrator** - 编排器，协调整个工作流
- **bmad-product-manager** - 产品经理，负责需求分析和产品规划
- **bmad-architect** - 系统架构师，设计技术架构
- **bmad-developer** - 开发者，执行代码实现
- **bmad-scrum-master** - Scrum主管，管理敏捷流程
- **bmad-ux-designer** - UX设计师，优化用户体验

**BMAD工作流程**:
```
1. 产品规划 (Product Manager)
   ↓
2. 架构设计 (Architect)
   ↓
3. 敏捷迭代 (Scrum Master + Developer)
   ↓
4. UX优化 (UX Designer)
   ↓
5. 编排协调 (Orchestrator)
```

**示例**:
```
用户：用BMAD方法开发一个任务管理应用
AI：[BMAD流程]
  1. [Product Manager] 分析需求：任务CRUD、用户系统、通知系统
  2. [Architect] 设计架构：React + Node.js + MongoDB
  3. [Scrum Master] 创建用户故事和冲刺计划
  4. [Developer] 开始实现第一个冲刺
  5. [UX Designer] 设计用户界面和交互流程
```

### 3. 商业管理模式（自动触发）

**触发词**: 「客户」、「项目」、「定价」、「提案」、「机构」

**工作流程**（来自agency）:
```
1. 客户接入 (Client Onboarding)
   ↓
2. 定价提案 (Pricing & Proposals)
   ↓
3. 项目跟踪 (Project Tracking)
   ↓
4. 交付物管理 (Deliverables)
   ↓
5. 团队协调 (Team Coordination)
   ↓
6. 学习系统 (Learning System)
   ↓
7. 按类型定制 (Agency Type Specifics)
```

### 4. Open Design 快速原型模式

**触发词**: 「落地页」、「editorial site」、「杂志风」、「品牌页」

**可用技能**:
- **open-design-landing** - 编辑级品牌落地页（Atelier Zero 设计语言）
- **open-design-landing-deck** - 配套幻灯片原型

**设计系统**: Atelier Zero（Warm paper + Inter Tight + Playfair Display，适合编辑/杂志风格）

**Open Design工作流程**:
```
1. 收集品牌信息（brief → inputs.json）
   ↓
2. 选择图片策略（placeholder / generate / bring-your-own）
   ↓
3. 生成单页HTML（自包含，CSS内联）
   ↓
4. 预览并迭代
```

**示例**:
```
用户：做一个编辑风格的落地页，品牌叫"Lumen Field"
AI：[Open Design流程]
  1. 收集品牌信息（名称、标语、坐标、联系方式）
  2. 使用 placeholder 图片策略（快速预览）
  3. 生成 index.html（Atelier Zero 风格）
  4. 提供预览链接
```

### 5. 专业角色加载（自动触发）

**触发词**: 「作为XX专家」、「我需要XX师」、「用XX的角色」

**示例**:
```
用户：作为安全工程师，请审查这段代码
AI：[加载角色] 从agency-agents-zh加载安全工程师角色定义
    [执行] 按照安全工程师的工作流程执行任务...
```

**可用的专业角色**（示例 - 需单独安装角色文件）:
- **工程领域**: 安全工程师、后端架构师、前端开发者、DevOps自动化师、数据工程师
- **设计领域**: UI设计师、UX研究员、视觉故事讲述者
- **中国市场原创**: 小红书运营专家、抖音内容策略师、微信小程序开发者

---

## 工作流程详解

### 开发模式（superpowers流程）

#### 阶段1: 澄清 (Clarify)

**规则**:
- 一次只问一个问题
- 优先使用选择题，而非开放性问题
- 每个项目都要经过此流程

**必问问题**:
- 你真正想做什么？（目的）
- 有什么限制？（时间、技术栈、依赖）
- 成功是什么样子的？（成功标准）
- 这个不应该做什么？（范围边界）

**硬门**: 在设计获批之前，禁止编写任何代码！

#### 阶段2: 制定设计 (Plan)

**设计文档包含**:
- 架构概览
- 组件及其职责
- 数据流
- 错误处理方法
- 测试策略

**输出**: `docs/plans/YYYY-MM-DD-<topic>-design.md`

#### 阶段3: 执行开发 (Execute with TDD)

**强制规则**:
- TDD必须 - 先写失败的测试，再实现代码
- 小步迭代 - 每个任务2-5分钟
- 频繁提交 - 每次测试通过后提交

**子代理驱动开发**:
```
1. sessions_spawn 一个实现者子代理（带任务和完整计划上下文）
2. 等待完成通知
3. sessions_spawn 一个规范审查者子代理 → 必须确认代码符合规范
4. sessions_spawn 一个代码质量审查者子代理 → 必须批准质量
5. 修复任何问题，必要时重新审查
6. 标记任务完成，移动到下一个
```

#### 阶段4: 系统调试 (Debug)

**硬门**: 没有根因调查，禁止修复！

**四个阶段**:
1. **根因调查** - 读取错误、重现、检查最近更改、追踪数据流
2. **模式分析** - 找到工作示例、比较、识别差异
3. **假设+测试** - 一次一个假设，测试证明/反驳
4. **修复+验证** - 修复根因，而非症状；验证修复不会破坏任何东西

#### 阶段5: 完成分支 (Finish)

**触发**: 所有任务完成，所有测试通过

**步骤**:
1. 验证所有测试通过
2. 确定基础分支
3. 提供4个选项：本地合并 / 推送+PR / 保持 / 丢弃
4. 执行选择
5. 清理

### 商业管理模式（agency流程）

#### 核心操作

**客户接入**:
- 简介到达（音频、邮件、文档）→ 提取范围、预算、时间线 → 生成结构化简介 → 标记危险信号（范围蔓延、不切实际的截止日期）→ 创建客户文件夹

**定价**:
- 给定范围 → 应用配置中的价目表 → 计算带有复杂性乘数的估算 → 生成提案PDF → 与历史类似项目比较

**项目跟踪**:
- 维护所有活跃项目的统一看板 → 截止日期警报 → 检测停滞项目 → 按客户生成每周状态

**交付物**:
- 转换粗略笔记/输入 → 结构化交付物 → 对照简介审查 → 如需要适应多种格式

#### 工作空间结构

```
~/.workbuddy/skills/agency/
├── clients/           # 每个客户一个文件
│   ├── index.md       # 客户列表（含状态）
│   └── [name].md      # 客户档案、历史、偏好
├── projects/          # 活跃项目跟踪
├── templates/         # 可重用的提案、简介、报告
├── knowledge/         # SOP、学习、案例研究
└── config.md          # 费率、利润、团队结构
```

---

## 角色动态加载系统

### 如何使用

1. **识别需求** - 确定需要哪种专家
2. **加载角色** - 从 `agency-agents-zh/` 加载对应的角色定义
3. **执行任务** - AI按照专家的工作流程执行
4. **交付成果** - 输出符合专业标准的成果

### 角色定义位置

```
~/.workbuddy/skills/agency-agents-zh/
├── academic/          # 学术领域
├── design/           # 设计领域
├── engineering/      # 工程领域（最大）
├── finance/          # 金融领域
├── game-development/ # 游戏开发
├── marketing/        # 市场营销
├── product/          # 产品管理
└── ...
```

### 快速开始

```bash
# 查看所有可用的专家角色
cat ~/.workbuddy/skills/agency-agents-zh/AGENT-LIST.md

# 查看特定角色定义
cat ~/.workbuddy/skills/agency-agents-zh/engineering/engineering-security-engineer.md
```

---

## 记忆系统协同

### 双轨记忆系统

```
内置Agent记忆          本技能扩展记忆 (~/.workbuddy/memory/)
┌─────────────────────┐        ┌─────────────────────────────┐
│ MEMORY.md           │        │ 无限分类存储                │
│ memory/ (daily logs)│   +    │ 任何你想要的结构            │
│ 基本回忆能力        │        │ 完美组织                    │
└─────────────────────┘        └─────────────────────────────┘
         ↓                                  ↓
   快速上下文                       深度和长期存储
   (自动工作)                      (按需扩展)
```

### 写入策略

**立即写入** - 当用户分享重要信息时：
1. 写入 ~/.workbuddy/memory/ 中的适当文件
2. 更新类别 INDEX.md
3. 然后回应

**不要等待。不要批处理。立即写入。**

### 搜索策略

**对于小记忆（<50文件）**:
```bash
# Grep足够快
grep -r "keyword" ~/.workbuddy/memory/
```

**对于大记忆（50+文件）**:
通过索引导航：
```
1. ~/.workbuddy/memory/INDEX.md → 找到类别
2. ~/.workbuddy/memory/{category}/INDEX.md → 找到项目
3. ~/.workbuddy/memory/{category}/{item}.md → 读取详情
```

---

## 设计智能执行

### 自动学习视觉偏好

**规则**:
- 从选择、反馈和反应中检测模式
- 支持所有设计类型（UI、图形、视频、打印、任何视觉）
- 在2+一致偏好后确认
- 保持条目超级紧凑
- 检查 `dimensions.md` 获取类别，`criteria.md` 获取格式

### 设计偏好结构

```
### 美学
<!-- 通用视觉品味。格式: "特质" -->

### 按媒介
<!-- 不同偏好按类型。格式: "媒介: 特质" -->

### 品牌
<!-- 命名项目/品牌 with 独特风格。格式: "名称: 特质" -->

### 永不
<!-- 用户拒绝或视觉上不喜欢的东西 -->
```

---

## 冲突优化策略

### 1. 工作流程冲突优化

**原冲突**: superpowers强调严格TDD，agency注重商业运营

**优化方案**:
- 模式自动识别，无需手动切换
- 共享记忆系统和角色库
- 开发项目用superpowers流程，商业项目用agency流程

### 2. 记忆系统冲突优化

**原冲突**: memory技能使用~/.workbuddy/memory/，内置记忆使用MEMORY.md

**优化方案**:
- 明确分离：内置记忆用于快速上下文，~/.workbuddy/memory/用于深度存储
- 建立同步机制：可选地从内置记忆同步特定内容
- 统一索引：在 ~/.workbuddy/memory/INDEX.md 中维护全局索引

### 3. 角色定义冲突优化

**原冲突**: agency-agents-zh的角色可能与superpowers的工作流角色重叠

**优化方案**:
- 将agency-agents-zh的角色库作为**角色储备库**
- superpowers工作流中的角色从储备库中动态加载
- 避免重复定义，统一角色行为标准

### 4. 设计流程冲突优化

**原冲突**: design技能自动学习偏好，superpowers有固定设计阶段

**优化方案**:
- 将design技能作为**设计执行层**
- superpowers的设计阶段调用design技能执行
- design技能学习到的偏好反馈到superpowers的设计模板

### 5. BMAD集成冲突优化（新增）

**原冲突**: BMAD有独立的角色系统，与superpowers和agency的角色可能重叠

**优化方案**:
- **角色映射**: 将BMAD的6个角色映射到现有系统
  - bmad-orchestrator → super-human的编排层
  - bmad-product-manager → agency-agents-zh的产品专家
  - bmad-architect → agency-agents-zh的系统架构师
  - bmad-developer → superpowers的TDD流程
  - bmad-scrum-master → agency的项目跟踪
  - bmad-ux-designer → design技能的执行层
- **工作流集成**: BMAD流程作为"敏捷开发模式"，与superpowers的"严格TDD模式"并存
- **记忆共享**: BMAD的项目状态（bmad/*.yaml）同步到~/.workbuddy/memory/agile/

### 6. Open Design集成冲突优化

**原冲突**: Open Design技能可能与design技能的偏好学习冲突

**优化方案**:
- **技能分层**: 
  - Open Design作为**快速原型层**（生成初始原型）
  - design技能作为**偏好优化层**（迭代和优化）
- **工作流集成**: 
  - 开发模式：Open Design生成原型 → design技能优化 → superpowers实现
  - 商业模式：Open Design生成交付物 → agency管理客户反馈

---

## 关键原则

### 开发模式原则（来自superpowers）

- **一次一个问题** 在头脑风暴期间
- **TDD始终** - 先写失败的测试，删除在测试前写的代码
- **YAGNI** - 从所有设计中删除不必要的功能
- **DRY** - 无重复
- **系统化优于临时** - 遵循流程，特别是在时间压力下
- **证据优于主张** - 在声明成功之前验证
- **频繁提交** - 每次测试通过后

### 商业管理模式原则（来自agency）

- **绝不在没有人类批准的情况下** 发送提案或与客户沟通
- **跟踪时间/成本 vs 估算** - 当项目亏损时警报
- **从纠正中学习** - 更新模板和知识库
- **跨会话维护客户上下文** - 参考历史

### 记忆系统原则（来自memory）

- **分离于内置记忆** - 本系统在 ~/.workbuddy/memory/ 中。永远不要修改：Agent的MEMORY.md（工作空间根目录），Agent的memory/文件夹（如果在工作空间中）
- **用户定义结构** - 在设置期间，询问他们想存储什么
- **每个类别有一个索引** - 维护INDEX.md
- **立即写入** - 当用户分享信息时，立即写入
- **通过分裂扩展** - 当类别增长很大时，分裂成子类别

---

## 配置

### 首次使用设置

1. **选择模式** - 让系统自动识别，或手动指定
2. **配置文件结构** - 为记忆系统定义类别
3. **加载角色库** - 确认agency-agents-zh已安装
4. **设置设计偏好** - 让design技能自动学习，或手动配置

### 配置文件

**主配置**: `~/.workbuddy/skills/agency/config.md`（用于商业管理模式）
**记忆配置**: `~/.workbuddy/memory/config.md`（用于记忆系统）
**设计配置**: `skills/super-human/design-preferences.md`（用于设计偏好）

---

## 疑难解答

### 问题：模式识别错误

**症状**: 系统选择了错误的工作流模式

**修复**:
1. 明确指定模式：「用开发模式」、「用商业管理模式」
2. 检查触发词是否清晰
3. 重新训练模式识别系统

### 问题：角色加载失败

**症状**: 无法加载请求的专业角色

**修复**:
1. 检查agency-agents-zh是否正确安装
2. 查看 `~/.workbuddy/skills/agency-agents-zh/AGENT-LIST.md` 确认角色名称
3. 手动指定角色文件路径

### 问题：记忆系统混乱

**症状**: 找不到存储的信息，或内置记忆与扩展记忆冲突

**修复**:
1. 检查 ~/.workbuddy/memory/INDEX.md 是否最新
2. 验证内置记忆和扩展记忆的分离
3. 运行记忆系统诊断

---

## 相关技能

**已融合的技能（核心）**:
- `superpowers` - 开发工作流（TDD、子代理驱动）
- `agency` - 商业管理机构（客户、项目、定价）
- `agency-agents-zh` - 专家角色库框架（需单独安装角色文件）
- `design` - 设计执行和偏好学习
- `memory` - 扩展记忆系统

**已融合的技能（BMAD敏捷开发）**:
- `bmad-orchestrator` - 编排器（协调整个工作流）
- `bmad-product-manager` - 产品经理（需求分析、产品规划）
- `bmad-architect` - 系统架构师（技术架构设计）
- `bmad-developer` - 开发者（代码实现）
- `bmad-scrum-master` - Scrum主管（敏捷流程管理）
- `bmad-ux-designer` - UX设计师（用户体验优化）

**已融合的技能（Open Design快速原型）**:
- `open-design-landing` - 编辑级品牌落地页（Atelier Zero 设计语言）
- `open-design-landing-deck` - 配套幻灯片原型

**推荐安装的补充技能**:
- `workflow-runner` - 用于多智能体协作工作流
- `security-auditor` - 与安全工程师角色互补
- `decide` - 决策跟踪模式
- `escalate` - 何时涉及人类
- `learn` - 自适应学习

---

## 反馈和改进

**这个融合技能正在建设中**。你的反馈很重要：

- **如果有用**: `clawhub star super-human`
- **获取更新**: `clawhub sync`
- **报告问题**: 描述什么没按预期工作
- **建议改进**: 描述可以增强什么

---

**版本**: 2.0.0
**最后更新**: 2026-05-10
**状态**: 生产就绪（BMAD + Open Design 集成完成，核心功能完整）
