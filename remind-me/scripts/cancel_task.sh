#!/bin/bash
# 取消指定的提醒任务

pid="$1"

if [ -z "$pid" ]; then
  echo "用法: $0 <PID>" >&2
  exit 1
fi

config_dir="$HOME/.config/remind-me-skill"
tasks_dir="$config_dir/tasks"

# 查找对应的任务文件
task_file=$(find "$tasks_dir" -name "*_${pid}.task" 2>/dev/null | head -1)

if [ -n "$task_file" ]; then
  title=$(grep "^TITLE=" "$task_file" | cut -d= -f2-)
  rm -f "$task_file"
fi

# 杀死进程
if kill "$pid" 2>/dev/null; then
  echo "已取消提醒${title:+: $title}"
else
  echo "进程 $pid 不存在或已结束"
  [ -n "$task_file" ] && rm -f "$task_file"
fi
