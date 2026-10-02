# get-token.ps1 — Retrieve IMA OpenAPI credentials (Client ID + API Key)
#
# Usage:
#   $creds = & "<SCRIPT_PATH>\get-token.ps1" | ConvertFrom-Json
#   # Returns JSON: {"client_id":"...","api_key":"..."}
#
# Supports two credential sources (by priority):
#   1. Local proxy service (platform-hosted mode, enabled when AUTH_GATEWAY_PORT env var exists)
#   2. Environment variables / config files (local mode)

$ErrorActionPreference = "Stop"

# ── Mode 1: Local proxy service (platform-hosted) ────────────────────────────

if ($env:AUTH_GATEWAY_PORT) {
    $ProxyPort = $env:AUTH_GATEWAY_PORT
    $ProxyBase = "http://localhost:${ProxyPort}"

    # BUILD_ENV=test uses test env; otherwise uses production
    $RemoteBase = if ($env:BUILD_ENV -eq "test") { "https://jprx.sparta.html5.qq.com" } else { "https://jprx.m.qq.com" }

    $Platform = if ($env:CREDENTIAL_PLATFORM) { $env:CREDENTIAL_PLATFORM } else { "ima" }
    $body = @{ platform = $Platform } | ConvertTo-Json -Compress
    $RemoteUrl = "${RemoteBase}/data/4164/forward"

    try {
        $response = Invoke-RestMethod -Uri "${ProxyBase}/proxy/api" `
            -Method Post `
            -Headers @{ "Remote-URL" = $RemoteUrl; "Content-Type" = "application/json" } `
            -Body $body `
            -TimeoutSec 10
    } catch {
        [Console]::Error.WriteLine("ERROR: $_")
        exit 1
    }

    if ($response.ret -ne 0) {
        [Console]::Error.WriteLine("ERROR: ret=$($response.ret)")
        exit 1
    }

    # access_token → api_key, extra_data.client_id → client_id
    $apiKey = $response.data.resp.data.access_token
    $clientId = $response.data.resp.data.extra_data.client_id

    if (-not $clientId -or $clientId -eq "null" -or -not $apiKey -or $apiKey -eq "null") {
        [Console]::Error.WriteLine("ERROR: failed to retrieve IMA credentials, please complete IMA authorization in the integration panel first")
        exit 1
    }

    Write-Output (@{ client_id = $clientId; api_key = $apiKey } | ConvertTo-Json -Compress)
    exit 0
}

# ── Mode 2: Environment variables / config files (local mode) ────────────────

$ImaClientId = $env:IMA_OPENAPI_CLIENTID
$ImaApiKey = $env:IMA_OPENAPI_APIKEY

if (-not $ImaClientId) {
    $configPath = Join-Path $HOME ".config/ima/client_id"
    if (Test-Path $configPath) { $ImaClientId = (Get-Content $configPath -Raw).Trim() }
}

if (-not $ImaApiKey) {
    $configPath = Join-Path $HOME ".config/ima/api_key"
    if (Test-Path $configPath) { $ImaApiKey = (Get-Content $configPath -Raw).Trim() }
}

if (-not $ImaClientId -or -not $ImaApiKey) {
    [Console]::Error.WriteLine("ERROR: missing IMA credentials. Please set env vars IMA_OPENAPI_CLIENTID + IMA_OPENAPI_APIKEY or write to ~/.config/ima/")
    exit 1
}

Write-Output (@{ client_id = $ImaClientId; api_key = $ImaApiKey } | ConvertTo-Json -Compress)
