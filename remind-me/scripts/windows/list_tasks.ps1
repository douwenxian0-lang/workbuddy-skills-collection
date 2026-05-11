# 列出所有在途的提醒任务 (Windows 版本)
param(
    [switch]$Expired
)

$configDir = "$env:USERPROFILE\.config\remind-me-skill"
$tasksDir = "$configDir\tasks"

if (-not (Test-Path $tasksDir)) {
    Write-Output "没有在途任务"
    exit 0
}

$count = 0
$now = [DateTimeOffset]::Now.ToUnixTimeSeconds()

Get-ChildItem -Path $tasksDir -Filter "*.task" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw

    # 解析任务文件
    $title = if ($content -match "^TITLE=(.+)$") { $Matches[1] } else { "" }
    $message = if ($content -match "^MESSAGE=(.+)$") { $Matches[1] } else { "" }
    $targetAt = if ($content -match "^TARGET_AT=(\d+)$") { [long]$Matches[1] } else { 0 }
    $pid = if ($content -match "^PID=(\d+)$") { $Matches[1] } else { "" }

    $targetTime = [DateTimeOffset]::FromUnixTimeSeconds($targetAt).LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss")

    # 判断任务状态
    $status = ""
    if ($targetAt -lt $now) {
        if ($Expired) {
            $status = "[已过期-待确认] "
        } else {
            # 非过期模式跳过过期任务
            return
        }
    }

    $count++
    Write-Output "[$count] ${status}$title"
    Write-Output "    时间: $targetTime"
    Write-Output "    内容: $message"
    Write-Output "    PID: $pid"
    Write-Output ""
}

if ($count -eq 0) {
    if ($Expired) {
        Write-Output "没有待确认的过期任务"
    } else {
        Write-Output "没有在途任务"
    }
}