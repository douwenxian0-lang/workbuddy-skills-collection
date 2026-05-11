# Timer Reminder 实现细节

## 任务文件格式

路径：`~/.config/remind-me-skill/tasks/<target_epoch>_<pid>.task`

内容：
```
TITLE=<提醒标题>
MESSAGE=<提醒内容>
CREATED_AT=<创建时间戳>
TARGET_AT=<目标时间戳>
PID=<后台进程PID>
```

## 后台进程实现

使用子 shell + sleep 实现：
```bash
(sleep $wait_seconds && 
  osascript -e "display dialog \"内容\" with title \"标题\" buttons {\"OK\"} default button 1 giving up after 60" &&
  rm -f $task_file) &
```

## 过期任务清理机制

**触发时机**：技能被使用时自动执行

**清理逻辑**：
1. 遍历 `~/.config/remind-me-skill/tasks/*.task`
2. 检查 TARGET_AT < 当前时间
3. 显示通知：`display notification`（非对话框，避免打断）
4. 删除任务文件

## 取消任务

通过 PID 取消：
```bash
kill <pid>
# 同时删除对应的 .task 文件
```

## 系统关机处理

由于使用子 shell + sleep，关机时进程会被终止。
重启后通过 `cleanup_expired.sh` 检测并提醒用户错过的任务。
