# 安装 Task Scheduler，在系统唤醒和登录时检查过期提醒 (Windows 版本)

$taskName = "RemindMe-Skill-Wakeup"

# 检查是否已存在
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    exit 0
}

# 获取脚本路径
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$wakeupHandler = "$scriptDir\wakeup_handler.ps1"

# 获取当前用户
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

# 创建触发器
# 1. 登录时触发
$trigger1 = New-ScheduledTaskTrigger -AtLogOn -User $currentUser

# 2. 工作站解锁时触发
$trigger2 = New-ScheduledTaskTrigger -EventLog "Security" -EventId "4801"

# 创建操作
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$wakeupHandler`""

# 创建设置
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# 创建主体（使用当前用户权限）
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive

# 注册任务
try {
    Register-ScheduledTask -TaskName $taskName -Trigger $trigger1, $trigger2 -Action $action -Settings $settings -Principal $principal -Force | Out-Null
    Write-Output "Task Scheduler 已安装: $taskName"
} catch {
    Write-Error "安装 Task Scheduler 失败: $_"
}