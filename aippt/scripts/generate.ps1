$ErrorActionPreference = "Stop"

chcp 65001 | Out-Null
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if ($env:PROMPT_FILE) {
    if (-not (Test-Path $env:PROMPT_FILE)) {
        [Console]::Error.WriteLine("[ERROR] PROMPT_FILE does not exist: $($env:PROMPT_FILE)")
        exit 1
    }
    $promptBytes = [System.IO.File]::ReadAllBytes($env:PROMPT_FILE)
    $env:PROMPT = [System.Text.Encoding]::UTF8.GetString($promptBytes)
} elseif ($env:PROMPT_B64) {
    try {
        $promptBytes = [Convert]::FromBase64String($env:PROMPT_B64)
        $env:PROMPT = [System.Text.Encoding]::UTF8.GetString($promptBytes)
    } catch {
        [Console]::Error.WriteLine("[ERROR] PROMPT_B64 decode failed: $_")
        exit 1
    }
}

if (-not $env:PROMPT) {
    [Console]::Error.WriteLine("[ERROR] Missing PROMPT/PROMPT_FILE/PROMPT_B64")
    [Console]::Error.WriteLine("Recommended (UTF-8 safe):")
    [Console]::Error.WriteLine("  `$env:PROMPT_FILE='C:\\path\\to\\prompt.txt'; powershell -File generate.ps1")
    [Console]::Error.WriteLine("  `$env:PROMPT_B64='<base64-of-utf8-bytes>'; powershell -File generate.ps1")
    exit 1
}

if (-not $env:QCLAW_LLM_BASE_URL) {
    [Console]::Error.WriteLine("[ERROR] QCLAW_LLM_BASE_URL is not set")
    exit 1
}

$AuthGwBase = $env:QCLAW_LLM_BASE_URL -replace '/llm$', ''
$AipptUrl = "${AuthGwBase}/aippt/agent/run"

$bodyObj = @{
    prompt        = $env:PROMPT
    taskAgentType = "ppt_v2"
    num           = 1
}
$Body = $bodyObj | ConvertTo-Json -Compress -Depth 10
$BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)

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

Write-Host "[INFO] Generating PPT..."
Write-Host ""

$AuthToken = if ($env:QCLAW_LLM_API_KEY) { $env:QCLAW_LLM_API_KEY } else { "__QCLAW_AUTH_GATEWAY_MANAGED__" }

try {
    $response = Invoke-RestMethod -Uri $AipptUrl `
        -Method Post `
        -Headers @{
            "Content-Type"  = "application/json; charset=utf-8"
            "Authorization" = "Bearer $AuthToken"
            "X-API-Key"     = $AipptApiKey
            "X-Platform"    = "qclaw"
        } `
        -Body $BodyBytes `
        -TimeoutSec 300
} catch {
    [Console]::Error.WriteLine("[ERROR] API request failed: $_")
    exit 1
}

if (-not $response.success) {
    [Console]::Error.WriteLine("[ERROR] Generation failed:")
    $response | ConvertTo-Json -Depth 5 | ForEach-Object { [Console]::Error.WriteLine($_) }
    exit 1
}

$ProjectId    = if ($response.projectId)    { $response.projectId }    else { "" }
$WorkspaceUrl = if ($response.workspaceUrl) { $response.workspaceUrl } else { "" }
$Message      = if ($response.message)      { $response.message }      else { "" }

if ($WorkspaceUrl -and ($WorkspaceUrl -notlike "*from=qclaw*")) {
    if ($WorkspaceUrl -like "*`?*") {
        $WorkspaceUrl = "${WorkspaceUrl}&from=qclaw"
    } else {
        $WorkspaceUrl = "${WorkspaceUrl}?from=qclaw"
    }
}

$SessionId = ""
if ($response.PSObject.Properties.Name -contains "sessionId" -and $response.sessionId) {
    $SessionId = [string]$response.sessionId
}
if (-not $SessionId -and ($response.PSObject.Properties.Name -contains "sessionIds")) {
    $sids = $response.sessionIds
    if ($sids -and $sids.Count -gt 0) {
        $SessionId = [string]$sids[0]
    }
}

Write-Host "[OK] Task started, PPT is being generated in background"
Write-Host ""
Write-Host "[SUCCESS] PPT generation task submitted!"
Write-Host ""
Write-Host "Result:"

$result = @{
    projectId    = $ProjectId
    sessionId    = $SessionId
    workspaceUrl = $WorkspaceUrl
    message      = $Message
}
$result | ConvertTo-Json -Depth 5

Write-Host ""
if ($WorkspaceUrl) {
    Write-Host "Edit URL: ${WorkspaceUrl}"
}
if ($SessionId) {
    Write-Host "sessionId: ${SessionId} (for poll / resume)"
} else {
    [Console]::Error.WriteLine("[WARN] Failed to extract sessionId from response; subsequent poll/resume will not work")
}
