param(
    [string]$Token = "",
    [string]$Email = ""
)
# get-token.ps1 - Get QQ Agent Mail access_token from credential service
$ErrorActionPreference = "Stop"

$SkillDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile  = Join-Path $SkillDir ".env"
$Platform = "qq_agent_mail"

# BUILD_ENV=test uses test environment
$RemoteBaseUrl = $(if ($env:BUILD_ENV -eq "test") { "https://jprx.sparta.html5.qq.com" } else { "https://jprx.m.qq.com" })
$ProxyPort = $(if ($env:AUTH_GATEWAY_PORT) { $env:AUTH_GATEWAY_PORT } else { "19000" })
$ProxyBase = "http://localhost:${ProxyPort}"
$RemoteUrl = "${RemoteBaseUrl}/data/4164/forward"
$AgentlyBaseUrl = $(if ($env:AGENTLY_BASE_URL) { $env:AGENTLY_BASE_URL } else { "https://api.agent.qq.com" })

function Write-Json($success, $message, $errorCode, $extra) {
    $payload = [ordered]@{
        success = [bool]$success
        message = $message
    }
    if ($extra -and $extra.Count -gt 0) {
        foreach ($key in $extra.Keys) {
            $payload[$key] = $extra[$key]
        }
    }
    if ($null -ne $errorCode -and "$errorCode" -ne "") {
        $payload.error_code = [int]$errorCode
    }
    $payload | ConvertTo-Json -Depth 6 -Compress
}

function Write-Env($emailAddr, $tokenVal, $tokenSource) {
    $homeDir = $env:USERPROFILE
    $lines = @(
        "# QQ Agent Mail Configuration",
        "AGENTLY_BASE_URL=$AgentlyBaseUrl",
        "AGENTLY_ACCESS_TOKEN=$tokenVal",
        "AGENTLY_EMAIL=$emailAddr",
        "",
        "# File access whitelist",
        "ALLOWED_READ_DIRS=$homeDir\Downloads,$homeDir\Documents",
        "ALLOWED_WRITE_DIRS=$homeDir\Downloads",
        "",
        "# Token source",
        "TOKEN_SOURCE=$tokenSource"
    )
    $envContent = $lines -join "`r`n"
    Set-Content -Path $EnvFile -Value $envContent -Encoding UTF8 -NoNewline
}

# Mode 1: Manual token (troubleshooting only)
if ($Token) {
    if ($Token -match '\s') {
        Write-Output (Write-Json $false "Token cannot contain spaces" 1 @{ mode = "manual-token" })
        exit 1
    }
    if ($Email -and $Email -notmatch '@') {
        Write-Output (Write-Json $false "Invalid email format" 1 @{ mode = "manual-token" })
        exit 1
    }
    $emailAddr = $(if ($Email) { $Email.Trim() } else { "unknown@agent.qq.com" })
    Write-Env $emailAddr $Token "manual_token"
    Write-Output (Write-Json $true "Agent mail credentials written" $null @{ env_path = $EnvFile; mode = "manual-token"; email = $emailAddr })
    exit 0
}

# Mode 2: Fetch from credential service (platform=qq_agent_mail)
$body = @{ platform = $Platform } | ConvertTo-Json -Compress
try {
    $response = Invoke-RestMethod -Uri "${ProxyBase}/proxy/api" `
        -Method Post `
        -Headers @{ "Remote-URL" = $RemoteUrl; "Content-Type" = "application/json" } `
        -Body $body `
        -TimeoutSec 10
} catch {
    Write-Output (Write-Json $false "Failed to request credential service. Check local proxy or login status." 999 @{ platform = $Platform; mode = "credential-service" })
    exit 1
}

if ($response.ret -ne 0) {
    Write-Output (Write-Json $false "Credential service gateway error, ret=$($response.ret)" 999 @{ platform = $Platform; mode = "credential-service" })
    exit 1
}

$common = $response.data.resp.common
$commonCode = $(if ($null -ne $common.code -and "$($common.code)" -ne "") { [int]$common.code } else { 999 })
$commonMessage = $(if ($common.message) { [string]$common.message } else { "Credential service failed, please authorize Agent Mail in integration panel" })
if ($commonCode -ne 0) {
    Write-Output (Write-Json $false $commonMessage $commonCode @{ platform = $Platform; mode = "credential-service" })
    exit 1
}

$accessToken = $response.data.resp.data.access_token
$emailAddress = $response.data.resp.data.extra_data.email
if (-not $accessToken) {
    Write-Output (Write-Json $false "Credential service did not return a valid token" 3 @{ platform = $Platform; mode = "credential-service" })
    exit 1
}
if (-not $emailAddress) {
    $emailAddress = "unknown@agent.qq.com"
}

Write-Env $emailAddress $accessToken "credential_service"
Write-Output (Write-Json $true "Refreshed Agent Mail credentials from credential service" $null @{ env_path = $EnvFile; mode = "credential-service"; platform = $Platform; email = $emailAddress })
exit 0
