---
name: "skill-accuracy-checker"
description: "Automatically verify skill description accuracy. Check numeric claims, feature lists, skill references, and fix false advertising before publishing. Use this skill after creating or modifying any skill to ensure descriptions match reality."
agent_created: true
---

# Skill Accuracy Checker

Auto-verify skill descriptions against actual content to prevent false claims and misrepresentations.

## When to Use This Skill

Trigger this skill automatically after:
- Creating a new skill
- Modifying an existing skill's description
- User requests skill accuracy verification
- Before publishing/sharing a skill

## Verification Workflow

### Step 1: Extract Claims from Description

Read the target skill's `SKILL.md` and extract all verifiable claims:

**Numeric claims** (must verify count):
- Patterns: `\d+个`, `\d+种`, `\d+个技能`, `\d+个主题`, `\d+个角色`
- Examples: "193个AI专家", "72个设计系统", "36个主题"

**Feature claims** (must verify existence):
- Listed capabilities in description
- Referenced sub-skills or dependencies
- Supported formats or integrations

**File/Directory claims** (must verify existence):
- Referenced paths
- Listed skill names
- Bundled resources

### Step 2: Verify Against Reality

**For numeric claims**:
1. Use `Glob` or `Bash(ls)` to count actual items
2. Compare claimed number vs actual count
3. Flag mismatches as errors

Example verification:
```
Claim: "193 个即插即用的 AI 专家角色"
Action: Glob "*.md" in agency-agents-zh/
Result: 0 files (only framework)
Verdict: FALSE CLAIM
```

**For feature claims**:
1. Check if described features exist in scripts/references/assets
2. Test described workflows
3. Verify referenced skills are installed

**For file/directory claims**:
1. Use `Read` or `Bash(test -d/test -f)` to verify existence
2. Check if referenced paths are valid

### Step 3: Generate Verification Report

Create a structured report:

```markdown
## 验证报告 - [技能名称]

### ✅ 准确声称
- Claim: "X" → Verified: Y items exist

### ❌ 虚假声称
- Claim: "193个AI专家" → Actual: 0 files (only framework)
- Action: Remove or correct claim

### ⚠️ 无法验证
- Claim: "支持XXX功能" → Need manual testing
```

### Step 4: Auto-Fix Common Issues

When false claims are detected, automatically fix:

**Template replacements**:
- `"X个专业角色"` → `"AI 专家角色库框架 - 实际角色文件需单独安装"`
- `"X种设计原型"` → `"设计原型框架 - 具体原型需配置"`
- `"支持X个集成"` → `"支持主流平台集成（具体数量详见文档）"`

**Markdown fixes**:
- Remove non-existent skill references
- Update outdated version numbers
- Correct file paths

## Verification Scripts

### scripts/verify_counts.py

```python
#!/usr/bin/env python3
"""
Verify numeric claims in skill descriptions.
Usage: python verify_counts.py <skill-directory>
"""

import os
import re
import sys
from pathlib import Path

def extract_numeric_claims(text):
    """Extract patterns like '193个', '72个', '36种'"""
    pattern = r'(\d+)[个种款台套]'
    matches = re.findall(pattern, text)
    return [int(m) for m in matches]

def count_actual_items(directory, pattern="*.md"):
    """Count actual items in directory"""
    if not os.path.exists(directory):
        return 0
    return len(list(Path(directory).glob(pattern)))

def verify_skill(skill_path):
    """Main verification logic"""
    skill_md = os.path.join(skill_path, "SKILL.md")
    if not os.path.exists(skill_md):
        print(f"ERROR: SKILL.md not found in {skill_path}")
        return
    
    with open(skill_md, 'r', encoding='utf-8') as f:
        content = f.read()
    
    claims = extract_numeric_claims(content)
    print(f"Found numeric claims: {claims}")
    
    # Add verification logic here
    # ...

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_counts.py <skill-directory>")
        sys.exit(1)
    verify_skill(sys.argv[1])
```

### scripts/check_references.py

Checks if referenced skills/files actually exist.

## Common False Claim Patterns

See `references/common_false_claims.md` for a comprehensive list of patterns and fixes.

## Integration with Skill Workflow

After creating or modifying a skill, ALWAYS run this verification:

1. Read target skill's SKILL.md
2. Extract all verifiable claims
3. Verify against actual file system
4. Generate report
5. Auto-fix if possible
6. Ask user for confirmation on fixes

## Important Notes

- **Never trust numbers in descriptions** - always verify
- **Check actual file counts** - don't rely on documentation
- **Test referenced features** - ensure they actually work
- **Update descriptions** - to match reality
- **Document limitations** - be honest about capabilities

## Example Usage

**User**: "Check super-human skill for accuracy"

**Workflow**:
1. Read `~/.workbuddy/skills/super-human/SKILL.md`
2. Extract claims: "31种设计原型", "72个设计系统", "193个专业角色"
3. Verify each claim against actual files
4. Generate report showing false claims
5. Auto-fix or suggest corrections
6. Update SKILL.md with accurate descriptions
