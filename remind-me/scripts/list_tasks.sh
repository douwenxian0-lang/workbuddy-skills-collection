#!/bin/bash
# 列出所有在途的提醒任务

config_dir="$HOME/.config/remind-me-skill"
tasks_dir="$config_dir/tasks"

# 解析参数
show_expired=false
if [ "$1" = "--expired" ]; then
  show_expired=true
fi

[ -d "$tasks_dir" ] || { echo "没有在途任务"; exit 0; }

count=0
now=$(date +%s)

for task_file in "$tasks_dir"/*.task; do
  [ -f "$task_file" ] || continue

  title=$(grep "^TITLE=" "$task_file" | cut -d= -f2-)
  message=$(grep "^MESSAGE=" "$task_file" | cut -d= -f2-)
  target_at=$(grep "^TARGET_AT=" "$task_file" | cut -d= -f2)
  pid=$(grep "^PID=" "$task_file" | cut -d= -f2)
  notified=$(grep "^NOTIFIED=" "$task_file" | cut -d= -f2)

  target_time=$(date -r "$target_at" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -d "@$target_at" "+%Y-%m-%d %H:%M:%S" 2>/dev/null)

  # 判断任务状态
  status=""
  if [ "$target_at" -lt "$now" ]; then
    if [ "$show_expired" = true ]; then
      status="[已过期-待确认] "
    else
      # 非过期模式跳过过期任务
      continue
    fi
  fi

  echo "[$((++count))] ${status}$title"
  echo "    时间: $target_time"
  echo "    内容: $message"
  echo "    PID: $pid"
  echo ""
done

if [ "$count" -eq 0 ]; then
  if [ "$show_expired" = true ]; then
    echo "没有待确认的过期任务"
  else
    echo "没有在途任务"
  fi
fi