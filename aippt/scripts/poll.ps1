$ErrorActionPreference = "Stop"

chcp 65001 | Out-Null
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

if (-not $env:SESSION_ID) {
    [Console]::Error.WriteLine("[ERROR] Missing SESSION_ID environment variable")
    [Console]::Error.WriteLine("Usage: `$env:SESSION_ID='<sessionId>'; powershell -ExecutionPolicy Bypass -File poll.ps1")
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

$EncodedSessionId = [System.Uri]::EscapeDataString($env:SESSION_ID)
$Upstream = "https://api.zhihui.qq.com/bll-design-agent/agent/events?sessionId=$EncodedSessionId"

try {
    $response = Invoke-WebRequest -Uri $Upstream `
        -Method Get `
        -Headers @{
            "Authorization" = "Bearer $AipptApiKey"
            "X-API-Key"     = $AipptApiKey
            "X-Platform"    = "qclaw"
            "Accept"        = "application/json"
        } `
        -TimeoutSec 30 `
        -UseBasicParsing
} catch {
    [Console]::Error.WriteLine("[ERROR] events request failed: $_")
    exit 1
}

if ($response.StatusCode -ne 200) {
    [Console]::Error.WriteLine("[ERROR] events HTTP $($response.StatusCode):")
    [Console]::Error.WriteLine($response.Content)
    exit 1
}

$RawJson = $response.Content
try {
    $obj = $RawJson | ConvertFrom-Json -ErrorAction Stop
} catch {
    Write-Output $RawJson
    exit 0
}

$interrupt = $null
if ($obj -and $obj.data -and $obj.data.interrupt) {
    $interrupt = $obj.data.interrupt
}

if ($interrupt -and $interrupt.type -eq 'pptIntakeStyleCards') {
    $TmpDir = Join-Path $SkillDir ".tmp"
    if (-not (Test-Path $TmpDir)) {
        New-Item -ItemType Directory -Path $TmpDir -Force | Out-Null
    }

    $cards = $null
    if ($interrupt.data -and $interrupt.data.styleCards) {
        $cards = $interrupt.data.styleCards
    }
    if ($cards) {
        foreach ($card in $cards) {
            if (-not $card.previewBase64) { continue }
            $b64 = [string]$card.previewBase64
            if ($b64.TrimStart().StartsWith('data:') -and $b64.Contains(',')) {
                $b64 = $b64.Substring($b64.IndexOf(',') + 1)
            }
            $cid = if ($card.candidateId) { [string]$card.candidateId } else { 'unknown' }
            $safeCid = -join ($cid.ToCharArray() | Where-Object { ($_ -match '[A-Za-z0-9_\-]') })
            if (-not $safeCid) { $safeCid = 'unknown' }
            $pngPath = Join-Path $TmpDir "style-$safeCid.png"
            try {
                $bytes = [Convert]::FromBase64String($b64)
                [System.IO.File]::WriteAllBytes($pngPath, $bytes)
                $card | Add-Member -NotePropertyName 'previewPath' -NotePropertyValue (Resolve-Path $pngPath).Path -Force
                $card.PSObject.Properties.Remove('previewBase64') | Out-Null
            } catch {
            }
        }
    }
    $RawJson = $obj | ConvertTo-Json -Depth 30 -Compress
}

Write-Output $RawJson
