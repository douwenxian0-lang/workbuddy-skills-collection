---
name: remind-me-skill
description: 创建后台定时提醒任务，在指定时间通过系统通知打断用户。支持 macOS、Windows 和 Linux，支持睡眠/锁屏后唤醒时的过期提醒确认。当用户需要设置定时提醒、倒计时、闹钟或需要在特定时间点（如"5分钟后"、"下午3点"、API限额重置时间等）收到系统通知时使用。
---

# Remind Me Skill - Break

创建跨平台后台定时提醒，在指定时间弹出系统对话框打断用户。**支持 macOS、Windows 和 Linux**，支持电脑从睡眠/锁屏状态唤醒后及时提醒过期通知并获得用户确认。

## 工作流程

1. **检测平台**（macOS、Windows 或 Linux）
2. **参数解析**
3. **计算目标时间戳**（Unix epoch）
4. **调用平台对应的脚本创建任务**：
   - macOS: `scripts/create_reminder.sh "<标题>" "<内容>" <目标时间戳>`
   - Windows: `scripts/windows/create_reminder.ps1 -Title "<标题>" -Message "<内容>" -TargetEpoch <目标时间戳>`
   - Linux: `scripts/linux/create_reminder.sh "<标题>" "<内容>" <目标时间戳>`
5. **返回结果**（必须严格使用以下格式）：
   ```
   已在后台设置提醒任务：
   - 提醒时间：<格式化时间>
   - 提醒内容：<内容>

   后台进程 PID: <pid>

   如果您想取消提醒，可以运行：
   ```
   kill <pid>
   ```
   ```

## 任务管理

在途任务存储在 `~/.config/remind-me-skill/tasks/<timestamp>_<pid>.task`：
- 任务文件格式：TITLE=, MESSAGE=, CREATED_AT=, TARGET_AT=, PID=, NOTIFIED=false
- 提醒触发后：
  - 正常触发：自动删除任务文件
  - 过期触发（唤醒时）：弹出确认对话框，用户确认后删除

### 过期提醒处理机制

当电脑在提醒时间处于睡眠/锁屏状态时：

**macOS:**
1. **唤醒检测**：通过 LaunchAgent 在系统唤醒/登录时自动触发检查（每分钟检查一次）
2. **过期提醒确认**：弹出对话框 `[过期提醒] xxx`，提供两个选项：
   - **已确认**：删除任务，表示用户已知晓
   - **稍后（30分钟）**：推迟30分钟，下次唤醒或定时再次提醒
3. **超时处理**：对话框5分钟后自动关闭，下次唤醒时再次提醒

**Windows:**
1. **解锁检测**：通过 Task Scheduler 在登录和工作站解锁时自动触发检查
2. **过期提醒确认**：弹出消息框 `[过期提醒] xxx`，提供两个选项：
   - **是**：删除任务，表示用户已知晓
   - **否**：推迟30分钟，下次解锁时再次提醒
3. **关闭处理**：关闭消息框会保持任务，下次解锁时再次提醒

**Linux:**
1. **登录检测**：通过 systemd user timer 在登录时自动触发检查（每分钟检查一次）
2. **过期提醒确认**：弹出对话框 `[过期提醒] xxx`（使用 zenity/kdialog），提供两个选项：
   - **已确认**：删除任务，表示用户已知晓
   - **稍后（30分钟）**：推迟30分钟，下次登录或定时再次提醒
3. **对话框工具**：自动检测 zenity（GTK）、kdialog（KDE）或回退到 notify-send

## 脚本参考

### macOS

| 脚本 | 用途 |
|------|------|
| `scripts/create_reminder.sh` | 创建提醒任务，自动安装 LaunchAgent（如未安装），返回 PID |
| `scripts/cancel_task.sh <pid>` | 取消指定任务 |
| `scripts/list_tasks.sh` | 列出所有在途任务（跳过已过期的）|
| `scripts/list_tasks.sh --expired` | 列出待确认的过期任务 |
| `scripts/cleanup_expired.sh` | 标记过期任务，发送通知告知用户唤醒时将弹出确认 |
| `scripts/wakeup_handler.sh` | 唤醒时执行，处理过期提醒确认（内部使用）|
| `scripts/install_agent.sh` | 安装 LaunchAgent（内部使用）|

### Windows

| 脚本 | 用途 |
|------|------|
| `scripts/windows/create_reminder.ps1` | 创建提醒任务，自动安装 Task Scheduler（如未安装），返回 PID |
| `scripts/windows/cancel_task.ps1 -Pid <pid>` | 取消指定任务 |
| `scripts/windows/list_tasks.ps1` | 列出所有在途任务（跳过已过期的）|
| `scripts/windows/list_tasks.ps1 -Expired` | 列出待确认的过期任务 |
| `scripts/windows/cleanup_expired.ps1` | 标记过期任务，发送通知告知用户解锁时将弹出确认 |
| `scripts/windows/wakeup_handler.ps1` | 解锁/登录时执行，处理过期提醒确认（内部使用）|
| `scripts/windows/install_agent.ps1` | 安装 Task Scheduler（内部使用）|

### Linux

| 脚本 | 用途 |
|------|------|
| `scripts/linux/create_reminder.sh` | 创建提醒任务，自动安装 systemd service（如未安装），返回 PID |
| `scripts/linux/cancel_task.sh <pid>` | 取消指定任务 |
| `scripts/linux/list_tasks.sh` | 列出所有在途任务（跳过已过期的）|
| `scripts/linux/list_tasks.sh --expired` | 列出待确认的过期任务 |
| `scripts/linux/cleanup_expired.sh` | 标记过期任务，发送通知告知用户登录时将弹出确认 |
| `scripts/linux/wakeup_handler.sh` | 登录时执行，处理过期提醒确认（内部使用）|
| `scripts/linux/install_agent.sh` | 安装 systemd user service（内部使用）|
| `scripts/linux/dialog.sh` | 通用对话框封装，自动检测 zenity/kdialog（内部使用）|

## 使用示例

**用户**: "5分钟后提醒我 API 限额重置"

**处理**:
```bash
# 1. 检测平台并创建提醒
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    target=$(($(date +%s) + 300))
    pid=$(scripts/create_reminder.sh "API 限额重置" "您的 API 限额已重置" $target)
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    target=$(($(date +%s) + 300))
    pid=$(scripts/linux/create_reminder.sh "API 限额重置" "您的 API 限额已重置" $target)
else
    # Windows (Git Bash/Cygwin)
    target=$(($(date +%s) + 300))
    pid=$(powershell.exe -ExecutionPolicy Bypass -File scripts/windows/create_reminder.ps1 -Title "API 限额重置" -Message "您的 API 限额已重置" -TargetEpoch $target)
fi

# 2. 按模板返回结果
```

**查看待确认的过期任务**:
```bash
# macOS
scripts/list_tasks.sh --expired

# Linux
scripts/linux/list_tasks.sh --expired

# Windows (PowerShell)
scripts/windows/list_tasks.ps1 -Expired
```

## 依赖

### macOS
- `osascript` 用于显示对话框和通知
- `date` 命令用于时间计算
- `launchctl` 用于 LaunchAgent 管理（自动处理）

### Windows
- PowerShell 5.0+ 或 PowerShell Core
- Windows Forms (System.Windows.Forms) 用于显示对话框
- Task Scheduler 服务用于唤醒检测（自动安装）

### Linux
- systemd (大多数现代发行版已预装)
- `zenity` (GTK/GNOME/XFCE) 或 `kdialog` (KDE) 用于显示对话框
- `notify-send` (libnotify) 用于通知（可选，通常已预装）
- Bash 和 coreutils

## 技术说明

### macOS
- **LaunchAgent**: `~/Library/LaunchAgents/com.local-link.remind-me.plist`
  - 在系统唤醒、登录、挂载磁盘时触发
  - 每分钟检查一次过期任务
  - 自动加载，无需用户手动配置
- **日志文件**: `/tmp/remind-me-skill.log` 和 `/tmp/remind-me-skill.error.log`

### Windows
- **Task Scheduler**: `RemindMe-Skill-Wakeup`
  - 在登录和工作站解锁时触发
  - 使用当前用户权限运行，确保安全
  - 自动注册，无需用户手动配置
- **任务文件位置**: `%USERPROFILE%\.config\remind-me-skill\tasks\`

### Linux
- **systemd user service**: `remind-me.timer`
  - 在登录和系统启动后 30 秒触发
  - 每分钟检查一次过期任务
  - 使用用户会话权限运行
  - 自动启用，无需 root 权限
- **任务文件位置**: `~/.config/remind-me-skill/tasks/`
- **日志查看**: `journalctl --user -u remind-me.service`
- **状态检查**: `systemctl --user status remind-me.timer`