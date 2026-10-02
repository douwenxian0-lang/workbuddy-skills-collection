# get-token.ps1 — Fetch WeRead API Key from credential gateway
#
# Usage:
#   $token = & .\get-token.ps1
#   $env:WEREAD_API_KEY = $token
#
# Token is auto-injected via local proxy service (JWT), no manual input needed

$ErrorActionPreference = "Stop"

# -- Remote API base URL (BUILD_ENV=test uses test env, otherwise production) --

if ($env:BUILD_ENV -eq "test") {
    $RemoteBaseUrl = "https://jprx.sparta.html5.qq.com"
} else {
    $RemoteBaseUrl = "https://jprx.m.qq.com"
}

# -- Proxy port and request URL --

if ($env:CREDENTIAL_PLATFORM) { $Platform = $env:CREDENTIAL_PLATFORM } else { $Platform = "weread" }
if ($env:AUTH_GATEWAY_PORT)   { $ProxyPort = $env:AUTH_GATEWAY_PORT }   else { $ProxyPort = "19000" }

$ProxyBase = "http://localhost:${ProxyPort}"
$RemoteUrl = "${RemoteBaseUrl}/data/4164/forward"

$body = @{ platform = $Platform } | ConvertTo-Json -Compress

try {
    $response = Invoke-RestMethod -Uri "${ProxyBase}/proxy/api" `
        -Method Post `
        -Headers @{ "Remote-URL" = $RemoteUrl } `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 10
} catch {
    [Console]::Error.WriteLine("ERROR: Gateway request failed: $_. Please authorize WeRead in the integration panel first.")
    exit 1
}

if ($response.ret -ne 0) {
    [Console]::Error.WriteLine("ERROR: Gateway returned error (ret=$($response.ret)). Please authorize WeRead in the integration panel first.")
    exit 1
}

# Check business-layer error code
$bizCode = $response.data.resp.common.code
if ($bizCode -and $bizCode -ne 0) {
    $bizMsg = $response.data.resp.common.message
    if (-not $bizMsg) { $bizMsg = "WeRead session expired" }
    [Console]::Error.WriteLine("ERROR: Business error code=${bizCode}, ${bizMsg}. Please re-authorize WeRead in the integration panel.")
    exit 1
}

# Extract access_token
$apiKey = $response.data.resp.data.access_token

if (-not $apiKey -or $apiKey -eq "null") {
    [Console]::Error.WriteLine("ERROR: API Key not found. Please authorize WeRead in the integration panel first.")
    exit 1
}

Write-Output $apiKey
