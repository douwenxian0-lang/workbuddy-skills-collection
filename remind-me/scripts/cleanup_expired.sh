#!/bin/bash
# 标记过期的提醒任务（由 wakeup_handler 处理确认）

config_dir="$HOME/.config/remind-me-skill"
tasks_dir="$config_dir/tasks"

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

    # 标记为已过期但未确认（NOTIFIED 保持 false，等待唤醒时处理）
    # 发送通知告知用户有过期提醒待确认
    osascript -e "display notification \"提醒已过期，唤醒时将弹出确认: $message\" with title \"[待确认] $title\"" 2>/dev/null || true

    expired_count=$((expired_count + 1))
  fi
done

[ "$expired_count" -gt 0 ] && echo "发现 $expired_count 个过期任务，将在唤醒时弹出确认"
