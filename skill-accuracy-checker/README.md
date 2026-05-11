# Skill Accuracy Checker - 使用指南

## 🎯 功能说明

自动验证技能描述的准确性，检测虚假声称、夸大宣传、过时信息。

## 📋 使用场景

### 1. 自动触发（推荐）
每次创建或修改技能后，自动运行自查：
```bash
python ~/.workbuddy/skills/skill-accuracy-checker/scripts/verify_counts.py <skill-directory>
```

### 2. 手动触发
当需要验证特定技能时：
```bash
cd ~/.workbuddy/skills/skill-accuracy-checker
python scripts/verify_counts.py /path/to/skill/
```

## 🔍 验证内容

### 自动检测的类型

1. **数字声称**
   - 模式: `XXX个YYY`, `XXX种YYY`, `XXX款YYY`
   - 示例: "193个专家", "72个系统", "36个主题"
   - 验证: 统计实际文件/目录数量

2. **外部技能引用**
   - 模式: BMAD 角色、agent 列表
   - 示例: "6个专业角色" (BMAD)
   - 验证: 检查 `~/.workbuddy/skills/` 中的匹配技能

3. **功能声称**（部分支持）
   - 需要手动验证
   - 会在报告中标记为 "待验证"

## 📊 报告格式

```
🔍 技能描述验证报告
============================================================

✅ 准确的声称:
  • 6个专业角色 → 实际: 6 个

❌ 虚假的声称 (需要修复):
  • 声称: 193个专家
    实际: 0 个
    建议: 更新描述为实际数量或删除此声称

⚠️  无法自动验证的声称 (需要手动检查):
  • 3个文件搞定
    原因: 无法自动验证此类型的声称
```

## 🔧 集成到工作流

### 创建技能后自动验证

在创建或修改技能后，Always:

1. 读取技能的 `SKILL.md`
2. 运行验证脚本
3. 检查报告
4. 如有虚假声称，立即修复
5. 重新验证直到通过

### 示例工作流

```bash
# 1. 创建技能
# ... 创建 SKILL.md, scripts/, references/

# 2. 自动验证
python ~/.workbuddy/skills/skill-accuracy-checker/scripts/verify_counts.py ~/.workbuddy/skills/my-new-skill

# 3. 检查报告
# 如果有 ❌ 虚假声称，修复 SKILL.md

# 4. 重新验证
python ~/.workbuddy/skills/skill-accuracy-checker/scripts/verify_counts.py ~/.workbuddy/skills/my-new-skill

# 5. 确认无虚假声称后，提交或发布
```

## 📝 常见修复模板

### 模板 1: 数量声称 → 框架描述
```markdown
BEFORE: "193 个即插即用的 AI 专家角色"
AFTER:  "AI 专家角色库框架 - 实际角色文件需单独安装"
```

### 模板 2: 不存在的功能 → 计划功能
```markdown
BEFORE: "支持自动部署到 AWS"
AFTER:  "计划支持自动部署 (当前版本需手动配置)"
```

### 模板 3: 夸大描述 → 准确描述
```markdown
BEFORE: "完美支持所有平台"
AFTER:  "支持主流平台 (Windows, macOS, Linux)"
```

## 🚀 未来改进

- [ ] 自动修复常见虚假声称
- [ ] 检查功能描述与实际代码的匹配
- [ ] 验证文件路径和引用
- [ ] 检查版本号一致性
- [ ] 集成到 `skill-creator` 工作流

## 📖 参考资料

- `references/common_false_claims.md` - 常见虚假声称模式
- `SKILL.md` - 完整的技能定义和使用说明

---

**创建日期**: 2026-05-10  
**版本**: 1.0.0  
**维护者**: WorkBuddy AI
