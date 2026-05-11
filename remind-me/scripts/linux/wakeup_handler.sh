#!/bin/bash
# 系统登录时处理过期提醒任务 (Linux 版本)

config_dir="$HOME/.config/remind-me-skill"
tasks_dir="$config_dir/tasks"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载对话框工具
source "$script_dir/dialog.sh"

[ -d "$tasks_dir" ] || exit 0

now=$(date +%s)

# 查找已过期但未确认的任务（NOTIFIED=false）
for task_file in "$tasks_dir"/*.task; do
  [ -f "$task_file" ] || continue

  target_at=$(grep "^TARGET_AT=" "$task_file" 2>/dev/null | cut -d= -f2)
  notified=$(grep "^NOTIFIED=" "$task_file" 2>/dev/null | cut -d= -f2)
  [ -z "$target_at" ] && continue

  # 只处理已过期且未通知的任务
  if [ "$target_at" -lt "$now" ] && [ "$notified" = "false" ]; then
    title=$(grep "^TITLE=" "$task_file" | cut -d= -f2-)
    message=$(grep "^MESSAGE=" "$task_file" | cut -d= -f2-)

    # 弹出确认对话框
    dialog_confirm "$title" "[过期提醒] $message" "已确认" "稍后（30分钟）"
    result=$?

    if [ $result -eq 0 ]; then
      # 用户已确认，删除任务
      rm -f "$task_file"
    elif [ $result -eq 1 ]; then
      # 用户选择稍后，推迟30分钟
      new_target=$((now + 30 * 60))
      # 更新任务文件中的目标时间
      sed "s/^TARGET_AT=.*/TARGET_AT=$new_target/" "$task_file" > "${task_file}.tmp" && \
        mv "${task_file}.tmp" "$task_file"
      # 保持 NOTIFIED=false，下次登录会继续提醒
    fi
    # 如果用户取消或超时（result=2），保持 NOTIFIED=false，下次登录再次提醒
  fi
done