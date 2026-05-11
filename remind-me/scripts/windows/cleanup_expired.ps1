# 标记过期的提醒任务（由 wakeup_handler 处理确认）(Windows 版本)

$configDir = "$env:USERPROFILE\.config\remind-me-skill"
$tasksDir = "$configDir\tasks"

if (-not (Test-Path $tasksDir)) {
    exit 0
}

$now = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$expiredCount = 0

Get-ChildItem -Path $tasksDir -Filter "*.task" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw

    # 解析任务文件
    $targetAt = if ($content -match "^TARGET_AT=(\d+)$") { [long]$Matches[1] } else { 0 }
    $notified = if ($content -match "^NOTIFIED=(\w+)$") { $Matches[1] } else { "false" }

    if ($targetAt -eq 0) { return }

    # 只处理已过期且未标记为已通知的任务
    if ($targetAt -lt $now -and $notified -eq "false") {
        $title = if ($content -match "^TITLE=(.+)$") { $Matches[1] } else { "提醒" }
        $message = if ($content -match "^MESSAGE=(.+)$") { $Matches[1] } else { "" }

        # 发送 Windows 通知（使用 PowerShell 原生方式）
        # 使用 BurntToast 如果可用，否则使用系统通知
        try {
            if (Get-Module -ListAvailable -Name BurntToast -ErrorAction SilentlyContinue) {
                New-BurntToastNotification -Text "[待确认] $title", "提醒已过期，解锁时将弹出确认: $message" -Silent
            } else {
                # 使用 Windows Script Host 显示通知
                $wshell = New-Object -ComObject WScript.Shell
                $wshell.Popup("提醒已过期，解锁时将弹出确认: $message", 5, "[待确认] $title", 64) | Out-Null
            }
        } catch {
            # 静默失败
        }

        $expiredCount++
    }
}

if ($expiredCount -gt 0) {
    Write-Output "发现 $expiredCount 个过期任务，将在解锁时弹出确认"
}