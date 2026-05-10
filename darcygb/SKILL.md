---
name: darcygb
description: Claude Code Agents 集合 - 6个专业代理（Jenny验证器、合规检查器、代码质量专家、现实检查、任务完成验证器、UI测试器）
---

# Claude Code Agents 集合

这是一个专业代理集合，扩展 Claude Code 的能力，提供专项任务支持和最佳实践验证。

## 可用代理

### 1. 🔍 Jenny - 实现验证代理
**文件**: `Jenny.md`

Jenny 验证实际构建的内容是否匹配项目规格。当需要以下场景时使用：
- 验证认证系统是否符合安全要求
- 确保数据库架构正确实现多租户规格
- 验证实现是否满足规定需求
- 获取功能完整性的独立评估

### 2. ✅ Claude MD 合规检查器
**文件**: `claude-md-compliance-checker.md`

此代理确保代码更改遵循 CLAUDE.md 文件中定义的项目特定指南。用于：
- 验证新实现是否遵循项目标准
- 检查修改是否符合编码规范
- 确保与文档化的项目原则一致
- 验证是否遵守团队约定

### 3. 🎯 代码质量实用主义者
**文件**: `code-quality-pragmatist.md`

审查代码是否过度工程化、不必要的复杂性和 poor developer experience。使用此代理来：
- 识别过度工程的解决方案
- 发现不必要的抽象
- 发现过早优化
- 确保代码保持简单和可维护

### 4. 📊 Karen - 现实检查代理
**文件**: `karen.md`

Karen 提供项目完成度的现实评估并创建可操作的计划。当需要以下场景时使用：
- 评估实际与声称的项目完成度
- 切入不完整的实现
- 创建现实的计划来完成工作
- 在不过度工程化的情况下验证功能完整性

### 5. 🔧 任务完成验证器
**文件**: `task-completion-validator.md`

验证声称的任务完成情况是否真正功能完整。使用此代理来：
- 验证认证系统是否端到端工作
- 确保数据库集成功能正常
- 验证功能是否按预期工作，而不仅仅是存根
- 确认实现是否达到底层目标

### 6. 🖥️ UI 全面测试器
**文件**: `ui-comprehensive-tester.md`

跨 Web 和移动平台执行全面的 UI 测试。此代理：
- 自动选择合适的测试工具（Puppeteer, Playwright, Mobile MCP）
- 测试用户流程和边缘案例
- 在不同平台上验证功能
- 执行系统的 UI 验证

## 如何使用这些代理

这些代理定义设计用于 Claude Code。要使用代理：

1. 确保已安装并配置 Claude Code
2. 在需要其专业知识时引用特定代理
3. 代理将根据其定义的专业知识提供专注的协助

## 示例使用场景

- **实现功能后**：使用 `task-completion-validator` 确保真正完成
- **提交代码前**：运行 `code-quality-pragmatist` 检查过度工程化
- **当需求似乎满足时**：使用 `Jenny` 验证实现是否匹配规格
- **对于 UI 更改**：部署 `ui-comprehensive-tester` 进行全面验证
- **评估项目状态时**：使用 `Karen` 进行现实的完成评估
- **进行更改后**：运行 `claude-md-compliance-checker` 确保指南合规

## 代理协作协议

这些代理设计为可协作工作，提供交叉验证和全面的项目评估。

**协作触发器**：
- 如果实现差距涉及不必要的复杂性："考虑 @code-quality-pragmatist 确定更简单的方案是否满足规格"
- 如果规格合规与项目规则冲突："必须咨询 @claude-md-compliance-checker 解决与 CLAUDE.md 的冲突"
- 如果声称的实现需要验证："推荐 @task-completion-validator 验证功能是否真正工作"
- 对于整体项目健全性检查："建议 @karen 评估现实的完成时间线"

## 安装说明

这些代理已安装到 `~/.workbuddy/skills/darcygb/` 目录。

**文件结构**：
```
~/.workbuddy/skills/darcygb/
├── SKILL.md                              # 本文件（技能定义）
├── Jenny.md                              # 实现验证代理
├── claude-md-compliance-checker.md      # 合规检查器
├── code-quality-pragmatist.md           # 代码质量专家
├── karen.md                             # 现实检查代理
├── task-completion-validator.md         # 任务完成验证器
└── ui-comprehensive-tester.md          # UI 全面测试器
```

## 来源

- **GitHub 仓库**: https://github.com/darcyegb/ClaudeCodeAgents
- **维护者**: darcyegb
- **许可**: 提供 As-Is 用于 Claude Code
- **版本**: 1.0.0 (2026-05-10)

---

**这些代理有助于确保代码质量、完整性和软件开发项目中的最佳实践遵循。**
