param()
# resolve-route.ps1 — personal-mail-skill routing decision script (Windows version)
#
# Purpose: Deterministically decide whether an email task should route to agent-email or imap-smtp-email,
#          replacing the previous unreliable "prompt injection" approach.
#
# Output: A single JSON line; LLM reads the corresponding SKILL.md based on the next_skill field.
#   Success examples:
#     {"success":true,"next_skill":"agent-email","reason":"user default preference is qq_agent_mail"}
#     {"success":true,"next_skill":"imap-smtp-email","reason":"user default preference is qq_mail"}
#     {"success":true,"next_skill":"imap-smtp-email","reason":"no preference set, fallback route"}
#   Failure examples:
#     {"success":false,"next_skill":"imap-smtp-email","reason":"config read failed, fallback route"}
#
# Usage: powershell -ExecutionPolicy Bypass -File resolve-route.ps1
#
# Environment variables (auto-injected by OpenClaw runtime):
#   QCLAW_PLUGIN_CONFIG_PATH — full path to qclaw-plugin-config.json
#   AUTH_GATEWAY_PORT        — Auth Gateway local port (default 19000)
#   BUILD_ENV                — environment identifier (test = test environment)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ── Utility functions ──

function Emit-Route($success, $nextSkill, $reason) {
    $payload = [ordered]@{
        success    = [bool]$success
        next_skill = $nextSkill
        reason     = $reason
    }
    $payload | ConvertTo-Json -Depth 4 -Compress
}

function Json-Extract($jsonStr, $fieldPath) {
    # Use node to parse JSON and extract fields (passed via env vars to avoid PowerShell string interpolation issues)
    $env:_JSON_INPUT = $jsonStr
    $env:_JSON_PATH = $fieldPath
    try {
        $result = node -e "const data=JSON.parse(process.env._JSON_INPUT);const keys=process.env._JSON_PATH.replace(/^\./,'').split('.').filter(Boolean);let val=data;for(const k of keys){val=val&&val[k];}if(val===null||val===undefined)console.log('null');else if(typeof val==='object')console.log(JSON.stringify(val));else console.log(val);" 2>$null
    } catch {
        return "null"
    } finally {
        Remove-Item Env:_JSON_INPUT -ErrorAction SilentlyContinue
        Remove-Item Env:_JSON_PATH -ErrorAction SilentlyContinue
    }
    if (-not $result) { return "null" }
    return $result.Trim()
}

# ── Step 1: Read default email preference from qclaw-plugin-config.json ──

$ConfigPath = $env:QCLAW_PLUGIN_CONFIG_PATH
$ProviderId = ""
$Address = ""

if ($ConfigPath -and (Test-Path $ConfigPath)) {
    try {
        $configContent = Get-Content -Path $ConfigPath -Raw -Encoding UTF8
        $ProviderId = Json-Extract $configContent ".email.default.providerId"
        $Address = Json-Extract $configContent ".email.default.address"

        if ($ProviderId -eq "null") { $ProviderId = "" }
        if ($Address -eq "null") { $Address = "" }
    } catch {
        $ProviderId = ""
        $Address = ""
    }
}

# ── Step 2: If default preference exists, route directly ──

if ($ProviderId) {
    if ($ProviderId -eq "qq_agent_mail") {
        $addrInfo = ""
        if ($Address) { $addrInfo = ", address $Address" }
        Write-Output (Emit-Route $true "agent-email" "user default preference is qq_agent_mail (Agent Mail${addrInfo})")
        exit 0
    } else {
        $addrInfo = ""
        if ($Address) { $addrInfo = " (address $Address)" }
        Write-Output (Emit-Route $true "imap-smtp-email" "user default preference is ${ProviderId}${addrInfo}")
        exit 0
    }
}

# ── Step 3: No preference -> query 4230 API to check binding status ──

$RemoteBaseUrl = "https://jprx.m.qq.com"
if ($env:BUILD_ENV -eq "test") { $RemoteBaseUrl = "https://jprx.sparta.html5.qq.com" }

$ProxyPort = "19000"
if ($env:AUTH_GATEWAY_PORT) { $ProxyPort = $env:AUTH_GATEWAY_PORT }

$ProxyBase = "http://localhost:${ProxyPort}"
$RemoteUrl = "${RemoteBaseUrl}/data/4230/forward"

# Try querying 4230, but don't block on failure — fallback route to imap-smtp-email
try {
    $response = Invoke-RestMethod -Uri "${ProxyBase}/proxy/api" `
        -Method Post `
        -Headers @{ "Remote-URL" = $RemoteUrl; "Content-Type" = "application/json" } `
        -Body '{}' `
        -TimeoutSec 10
} catch {
    Write-Output (Emit-Route $true "imap-smtp-email" "cannot connect to credential service, fallback route to imap-smtp-email")
    exit 0
}

if ($response.ret -ne 0) {
    Write-Output (Emit-Route $true "imap-smtp-email" "credential service returned error (ret=$($response.ret)), fallback route to imap-smtp-email")
    exit 0
}

# Parse platforms list returned by 4230
$platforms = $null
if ($response.data.resp.data.platforms) {
    $platforms = $response.data.resp.data.platforms
} elseif ($response.data.data.platforms) {
    $platforms = $response.data.data.platforms
} elseif ($response.data.platforms) {
    $platforms = $response.data.platforms
}

if (-not $platforms -or $platforms.Count -eq 0) {
    Write-Output (Emit-Route $true "imap-smtp-email" "user has no personal email bound, route to imap-smtp-email (system intercept layer will guide binding)")
    exit 0
}

# Filter enabled valid platforms
$allowed = @("qq_agent_mail", "163_mail", "qq_mail", "gmail", "outlook", "sina_mail", "sohu_mail")
$bound = @($platforms | Where-Object {
    $_.platform -and ($allowed -contains $_.platform) -and ($_.is_enabled -ne $false)
})

if ($bound.Count -eq 0) {
    Write-Output (Emit-Route $true "imap-smtp-email" "user has no personal email bound, route to imap-smtp-email (system intercept layer will guide binding)")
    exit 0
} elseif ($bound.Count -eq 1) {
    $p = $bound[0].platform
    if ($p -eq "qq_agent_mail") {
        Write-Output (Emit-Route $true "agent-email" "user only bound Agent Mail (qq_agent_mail), auto-routing")
    } else {
        Write-Output (Emit-Route $true "imap-smtp-email" "user only bound ${p}, auto-routing to imap-smtp-email")
    }
    exit 0
} else {
    $platformNames = ($bound | ForEach-Object { $_.platform }) -join ", "
    Write-Output (Emit-Route $true "imap-smtp-email" "user bound multiple emails (${platformNames}) but no default preference set, route to imap-smtp-email (system intercept layer will show selection card)")
    exit 0
}
