#!/bin/bash
# 创建定时提醒任务 (Linux 版本)

# 参数解析
title="${1:-提醒}"
message="${2:-时间到了！}"
target_epoch="$3"

# 创建配置目录
config_dir="$HOME/.config/remind-me-skill"
tasks_dir="$config_dir/tasks"
mkdir -p "$tasks_dir"

# 安装 systemd user service（如未安装）
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$script_dir/install_agent.sh" 2>/dev/null || true

# 计算等待秒数
now=$(date +%s)
wait_seconds=$((target_epoch - now))

if [ "$wait_seconds" -le 0 ]; then
  echo "错误：目标时间已过" >&2
  exit 1
fi

# 启动后台任务
(
  sleep "$wait_seconds"
  # 加载对话框工具
  source "$script_dir/dialog.sh"
  dialog_info "$title" "$message" 60
) &

pid=$!

# 创建任务文件记录
task_file="$tasks_dir/${target_epoch}_${pid}.task"
cat > "$task_file" << EOF
TITLE=$title
MESSAGE=$message
CREATED_AT=$now
TARGET_AT=$target_epoch
PID=$pid
NOTIFIED=false
EOF

# 返回 PID
echo "$pid"