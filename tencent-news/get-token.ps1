# get-token.ps1 — Retrieve Tencent News API Key from credential proxy
#
# Usage:
#   $apiKey = & .\get-token.ps1
#   sh scripts/run-cli.sh apikey-set $apiKey
#
# JWT is auto-injected by local proxy; no manual token input required

$ErrorActionPreference = "Stop"

$Platform  = if ($env:CREDENTIAL_PLATFORM) { $env:CREDENTIAL_PLATFORM } else { "tencent_news" }
$ProxyPort = if ($env:AUTH_GATEWAY_PORT)   { $env:AUTH_GATEWAY_PORT }   else { "19000" }
$ProxyBase = "http://localhost:${ProxyPort}"

# BUILD_ENV=test uses test env; otherwise uses production
$RemoteBaseUrl = if ($env:BUILD_ENV -eq "test") { "https://jprx.sparta.html5.qq.com" } else { "https://jprx.m.qq.com" }
$RemoteUrl = "${RemoteBaseUrl}/data/4164/forward"

$body = @{ platform = $Platform } | ConvertTo-Json -Compress

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
    [Console]::Error.WriteLine("ERROR: ret=$($response.ret), please complete Tencent News authorization in the integration panel first")
    exit 1
}

$accessToken = $response.data.resp.data.access_token

if (-not $accessToken -or $accessToken -eq "null") {
    [Console]::Error.WriteLine("ERROR: failed to retrieve API Key, please complete Tencent News authorization in the integration panel first")
    exit 1
}

Write-Output $accessToken
