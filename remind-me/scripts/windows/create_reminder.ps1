# 创建定时提醒任务 (Windows 版本)
param(
    [Parameter(Mandatory=$true)]
    [string]$Title = "提醒",

    [Parameter(Mandatory=$true)]
    [string]$Message = "时间到了！",

    [Parameter(Mandatory=$true)]
    [long]$TargetEpoch
)

# 创建配置目录
$configDir = "$env:USERPROFILE\.config\remind-me-skill"
$tasksDir = "$configDir\tasks"
New-Item -ItemType Directory -Force -Path $tasksDir | Out-Null

# 安装 Task Scheduler（如未安装）
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$scriptDir\install_agent.ps1" 2>$null

# 计算等待秒数
$now = [DateTimeOffset]::Now.ToUnixTimeSeconds()
$waitSeconds = $TargetEpoch - $now

if ($waitSeconds -le 0) {
    Write-Error "错误：目标时间已过"
    exit 1
}

# 创建后台任务 (使用 PowerShell Job)
$job = Start-Job -ScriptBlock {
    param($waitSec, $msg, $ttl)
    Start-Sleep -Seconds $waitSec

    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $msg,
        $ttl,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
} -ArgumentList $waitSeconds, $Message, $Title

$pid = $job.Id

# 创建任务文件记录
$taskFile = "$tasksDir\${TargetEpoch}_${pid}.task"
@"
TITLE=$Title
MESSAGE=$Message
CREATED_AT=$now
TARGET_AT=$TargetEpoch
PID=$pid
NOTIFIED=false
"@ | Set-Content -Path $taskFile -Encoding UTF8

# 返回 PID
Write-Output $pid