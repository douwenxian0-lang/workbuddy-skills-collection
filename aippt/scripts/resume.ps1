$ErrorActionPreference = "Stop"

chcp 65001 | Out-Null
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $env:SESSION_ID) {
    [Console]::Error.WriteLine("[ERROR] Missing SESSION_ID environment variable")
    exit 1
}
if (-not $env:INTERRUPT_ID) {
    [Console]::Error.WriteLine("[ERROR] Missing INTERRUPT_ID environment variable")
    exit 1
}

if ($env:ACTION_FILE) {
    if (-not (Test-Path $env:ACTION_FILE)) {
        [Console]::Error.WriteLine("[ERROR] ACTION_FILE does not exist: $($env:ACTION_FILE)")
        exit 1
    }
    $actionBytes = [System.IO.File]::ReadAllBytes($env:ACTION_FILE)
    $env:ACTION_JSON = [System.Text.Encoding]::UTF8.GetString($actionBytes)
} elseif ($env:ACTION_B64) {
    try {
        $actionBytes = [Convert]::FromBase64String($env:ACTION_B64)
        $env:ACTION_JSON = [System.Text.Encoding]::UTF8.GetString($actionBytes)
    } catch {
        [Console]::Error.WriteLine("[ERROR] ACTION_B64 decode failed: $_")
        exit 1
    }
}

if (-not $env:ACTION_JSON) {
    [Console]::Error.WriteLine("[ERROR] Missing ACTION_JSON/ACTION_FILE/ACTION_B64")
    exit 1
}

try {
    $actionObj = $env:ACTION_JSON | ConvertFrom-Json -ErrorAction Stop
} catch {
    [Console]::Error.WriteLine("[ERROR] ACTION_JSON is not valid JSON: $_")
    exit 1
}
if (-not $actionObj.type) {
    [Console]::Error.WriteLine("[ERROR] ACTION_JSON must be an object with a non-empty 'type' field")
    exit 1
}

$SkillDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AipptApiKey = ""

$getTokenPath = Join-Path $SkillDir "get-token.ps1"
if (Test-Path $getTokenPath) {
    try {
        $AipptApiKey = & powershell -ExecutionPolicy Bypass -File $getTokenPath 2>$null
    } catch {
        $AipptApiKey = ""
    }
}

if (-not $AipptApiKey) {
    [Console]::Error.WriteLine("[ERROR] Failed to get AIPPT API Key. Please authorize in the integration panel first.")
    exit 1
}

$bodyObj = @{
    sessionId   = $env:SESSION_ID
    interruptId = $env:INTERRUPT_ID
    action      = $actionObj
}
$Body = $bodyObj | ConvertTo-Json -Compress -Depth 20
$BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)

$Upstream = "https://api.zhihui.qq.com/bll-design-agent/agent/resume-interrupt"

try {
    $response = Invoke-WebRequest -Uri $Upstream `
        -Method Post `
        -Headers @{
            "Content-Type"  = "application/json; charset=utf-8"
            "Accept"        = "application/json"
            "Authorization" = "Bearer $AipptApiKey"
            "X-API-Key"     = $AipptApiKey
            "X-Platform"    = "qclaw"
        } `
        -Body $BodyBytes `
        -TimeoutSec 30 `
        -UseBasicParsing
} catch {
    [Console]::Error.WriteLine("[ERROR] resume-interrupt request failed: $_")
    exit 1
}

if ($response.StatusCode -ne 200) {
    [Console]::Error.WriteLine("[ERROR] resume-interrupt HTTP $($response.StatusCode):")
    [Console]::Error.WriteLine($response.Content)
    exit 1
}

Write-Output $response.Content
