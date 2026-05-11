#!/bin/bash
# 标记过期的提醒任务（由 wakeup_handler 处理确认）(Linux 版本)

config_dir="$HOME/.config/remind-me-skill"
tasks_dir="$config_dir/tasks"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载对话框工具
source "$script_dir/dialog.sh"

[ -d "$tasks_dir" ] || exit 0

now=$(date +%s)
expired_count=0

for task_file in "$tasks_dir"/*.task; do
  [ -f "$task_file" ] || continue

  target_at=$(grep "^TARGET_AT=" "$task_file" 2>/dev/null | cut -d= -f2)
  notified=$(grep "^NOTIFIED=" "$task_file" 2>/dev/null | cut -d= -f2)
  [ -z "$target_at" ] && continue

  # 只处理已过期且未标记为已通知的任务
  if [ "$target_at" -lt "$now" ] && [ "$notified" = "false" ]; then
    title=$(grep "^TITLE=" "$task_file" | cut -d= -f2-)
    message=$(grep "^MESSAGE=" "$task_file" | cut -d= -f2-)

    # 发送通知告知用户有过期提醒待确认
    dialog_notify "[待确认] $title" "提醒已过期，登录时将弹出确认: $message"

    expired_count=$((expired_count + 1))
  fi
done

[ "$expired_count" -gt 0 ] && echo "发现 $expired_count 个过期任务，将在登录时弹出确认"