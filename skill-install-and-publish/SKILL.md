---
name: skill-install-and-publish
description: >
  技能安装与发布完整工作流。克隆 GitHub 技能仓库、检查安装状态、
  创建 SKILL.md 包装文件、推送到 workbuddy-skills GitHub 仓库、
  检查并标注技能冲突、生成技能使用说明报告并保存到桌面。
  当用户说"帮我安装这个 skill 并推送到 GitHub"、"把这些技能整理到仓库"、
  "检查我的技能安装状态"、"生成技能报告"时触发此工作流。
agent_created: true
---

# Skill 安装与发布工作流

处理从克隆技能仓库到推送 GitHub 并生成报告的完整流程。

## 工作流步骤

### 步骤 1：检查安装状态

```bash
# 列出 workbuddy-skills 仓库中的技能
ls ~/workbuddy-skills/skills/

# 检查每个技能是否有 SKILL.md
for skill in $(ls ~/workbuddy-skills/skills/); do
  if [ ! -f ~/workbuddy-skills/skills/$skill/SKILL.md ]; then
    echo "MISSING SKILL.md: $skill"
  fi
done

# 检查 /tmp 中是否有待安装的克隆仓库
ls /tmp/ | grep -v "^[a-z]"  # 寻找可能是仓库的目录
```

### 步骤 2：为缺少 SKILL.md 的技能创建文档

为每个缺少 SKILL.md 的技能，读取其 README.md，然后创建 SKILL.md：

```markdown
---
name: <skill-name>
description: >
  <技能功能一句话描述>
agent_created: true
---

# <技能名称>

**<功能描述>**

## 核心能力
...

## 安装
...

## 使用
...

## 参考
- GitHub: <URL>
- 论文: <arXiv URL>（如有）
```

### 步骤 3：推送到 GitHub

**方法 A：git push（首选）**

```bash
cd ~/workbuddy-skills

# 暂存并提交
git add -A
git commit -m "Add <skill-name> skill"

# 推送（需要配置好认证）
git push origin main
```

**方法 B：GitHub API（当 git push 因大文件/代理/认证失败时）**

```bash
# 上传单个文件
CONTENT=$(base64 -w 0 "skills/$skill/SKILL.md")
gh api "repos/<owner>/workbuddy-skills/contents/skills/$skill/SKILL.md" \
  -X PUT \
  -f "message=Add SKILL.md for $skill" \
  -f content="$CONTENT" \
  -f branch="main"

# 批量上传（使用 upload_files.py）
cd ~/workbuddy-skills && python3 upload_files.py
```

**方法 C：批量 API 上传脚本（upload_files.py）**

脚本位置: `~/workbuddy-skills/upload_files.py`

功能：
- 读取 `git diff origin/main..HEAD --name-only` 获取待上传文件列表
- 跳过 `.png/.jpg/.ttf` 等二进制大文件
- 每个文件用 GitHub API 单独上传
- 速率限制：0.3s 间隔

### 步骤 4：检查并标注冲突流程

检查以下类型的冲突：

| 冲突类型 | 示例 | 处理方式 |
|---------|------|---------|
| 功能高度重叠 | skillclaw + CoEvoskill + SkillRL | 按场景分工，在各技能描述中注明 |
| 功能部分重叠 | find-skills + Skill-SD | 保留两者，注明各自使用场景 |
| 依赖/包含关系 | skill-vetter ⊂ find-skills | 保留独立版本，方便单独调用 |

检查命令：
```bash
# 提取所有技能描述，对比关键词
for skill in ~/workbuddy-skills/skills/*/SKILL.md; do
  echo "=== $(basename $(dirname $skill)) ==="
  grep -A 3 "description:" $skill | head -5
done
```

### 步骤 5：生成技能使用说明报告

报告保存到：`C:\Users\Administrator\Desktop\WorkBuddy技能使用说明报告_YYYY-MM-DD.md`

报告包含：
1. 技能总览表（名称、类型、功能、状态）
2. 各技能详细说明（触发场景、安装、使用命令）
3. 冲突与重叠分析
4. 推荐工作流
5. 待完善项目
6. GitHub 仓库信息

---

## 常见问题处理

### 问题 1：git push 失败（认证 401）

**原因**: Windows Credential Manager 存了旧的 GitHub 凭证，优先级高于 `gh auth git-credential`

**解决**:
```powershell
# 删除旧凭证
cmdkey /delete:"git:https://github.com"

# 配置仓库级凭证助手
git config --local credential.helper ""
git config --local --add credential.helper "!\"C:/Program Files/GitHub CLI/gh\" auth git-credential"
```

### 问题 2：git push 因大文件超时（HTTP 408）

**原因**: commit 中包含大 PNG/TTF 等二进制文件，pack 传输超时

**解决**:
```bash
# 重置最后一个提交
git reset --soft HEAD~1

# 取消大文件的暂存
git restore --staged "path/to/large/files/"

# 重新提交（不含大文件）
git add -A
git commit -m "..."

# 或使用 GitHub API 批量上传（见步骤 3 方法 C）
```

### 问题 3：stderr 被吞，exit code 1 无错误信息

**原因**: bash sandbox 可能拦截 stderr

**诊断**:
```bash
GIT_TRACE=1 GIT_CURL_VERBOSE=1 git push origin main > /tmp/trace.txt 2>&1
cat /tmp/trace.txt | grep -E "(401|403|error|fatal)"
```

### 问题 4：代理问题

**症状**: curl 可以访问 GitHub API，但 git push 失败

**原因**: `HTTPS_PROXY` 大写环境变量，curl 识别但 git 默认不识别

**解决**:
```bash
export https_proxy=$HTTPS_PROXY
export http_proxy=$HTTP_PROXY
git push origin main
```

---

## 相关文件

| 文件 | 位置 | 用途 |
|------|------|------|
| upload_files.py | ~/workbuddy-skills/ | 批量 API 上传脚本 |
| workbuddy-skills/ | ~/workbuddy-skills/ | 主仓库目录 |
| 技能报告 | Desktop/ | 生成的使用说明报告 |

---

## 注意事项

1. **大文件处理**: gym_cards 的 PNG 图片（每张 0.1-1.2MB）应跳过或使用 LFS
2. **认证冲突**: Windows 系统下需特别注意 Credential Manager 与 gh CLI 的冲突
3. **代理设置**: 大写 HTTPS_PROXY 需手动导出为小写
4. **API 速率限制**: GitHub API 认证用户 5000 次/小时，批量上传时保持 0.3s 间隔
