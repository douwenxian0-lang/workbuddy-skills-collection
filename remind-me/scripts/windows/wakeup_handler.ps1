# 系统唤醒时处理过期提醒任务 (Windows 版本)

$configDir = "$env:USERPROFILE\.config\remind-me-skill"
$tasksDir = "$configDir\tasks"

if (-not (Test-Path $tasksDir)) {
    exit 0
}

$now = [DateTimeOffset]::Now.ToUnixTimeSeconds()

# 加载 Windows Forms
Add-Type -AssemblyName System.Windows.Forms

Get-ChildItem -Path $tasksDir -Filter "*.task" | ForEach-Object {
    $taskFile = $_.FullName
    $content = Get-Content $taskFile -Raw

    # 解析任务文件
    $targetAt = if ($content -match "^TARGET_AT=(\d+)$") { [long]$Matches[1] } else { 0 }
    $notified = if ($content -match "^NOTIFIED=(\w+)$") { $Matches[1] } else { "false" }

    if ($targetAt -eq 0) { return }

    # 只处理已过期且未通知的任务
    if ($targetAt -lt $now -and $notified -eq "false") {
        $title = if ($content -match "^TITLE=(.+)$") { $Matches[1] } else { "提醒" }
        $message = if ($content -match "^MESSAGE=(.+)$") { $Matches[1] } else { "" }

        # 弹出确认对话框
        $result = [System.Windows.Forms.MessageBox]::Show(
            "[过期提醒] $message",
            $title,
            [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
            [System.Windows.Forms.MessageBoxIcon]::Information,
            [System.Windows.Forms.MessageBoxDefaultButton]::Button2
        )

        # Yes = 已确认, No = 稍后, Cancel = 关闭/超时
        switch ($result) {
            "Yes" {
                # 用户已确认，删除任务
                Remove-Item $taskFile -Force
            }
            "No" {
                # 用户选择稍后，推迟30分钟
                $newTarget = $now + (30 * 60)
                $newContent = $content -replace "^TARGET_AT=\d+", "TARGET_AT=$newTarget"
                Set-Content -Path $taskFile -Value $newContent -Encoding UTF8
                # 保持 NOTIFIED=false，下次唤醒会继续提醒
            }
            default {
                # Cancel 或关闭按钮，保持 NOTIFIED=false，下次唤醒再次提醒
            }
        }
    }
}