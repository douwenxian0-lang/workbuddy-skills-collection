# 取消指定的提醒任务 (Windows 版本)
param(
    [Parameter(Mandatory=$true)]
    [int]$Pid
)

$configDir = "$env:USERPROFILE\.config\remind-me-skill"
$tasksDir = "$configDir\tasks"

# 查找对应的任务文件
$taskFile = Get-ChildItem -Path $tasksDir -Filter "*_${Pid}.task" -ErrorAction SilentlyContinue | Select-Object -First 1

$title = $null
if ($taskFile) {
    $content = Get-Content $taskFile.FullName -Raw
    if ($content -match "^TITLE=(.+)$") {
        $title = $Matches[1]
    }
    Remove-Item $taskFile.FullName -Force
}

# 停止 Job
try {
    Stop-Job -Id $Pid -ErrorAction Stop
    Remove-Job -Id $Pid
    if ($title) {
        Write-Output "已取消提醒: $title"
    } else {
        Write-Output "已取消提醒 (PID: $Pid)"
    }
} catch {
    Write-Output "进程 $Pid 不存在或已结束"
}