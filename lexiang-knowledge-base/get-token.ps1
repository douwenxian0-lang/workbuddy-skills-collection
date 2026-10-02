# get-token.ps1 - Fetch credential from hosted service (Windows)
#
# Usage:
#   $result = & powershell -File get-token.ps1

$ErrorActionPreference = "Stop"

if ($env:BUILD_ENV -eq "test") {
    $RemoteBaseUrl = "https://jprx.sparta.html5.qq.com"
} else {
    $RemoteBaseUrl = "https://jprx.m.qq.com"
}

$ProxyPort = if ($env:AUTH_GATEWAY_PORT) { $env:AUTH_GATEWAY_PORT } else { "19000" }
$ProxyBaseUrl = "http://localhost:$ProxyPort"

$Platform = if ($env:CREDENTIAL_PLATFORM) { $env:CREDENTIAL_PLATFORM } else { "lexiang" }

$Body = "{`"platform`":`"$Platform`"}"
$RemoteUrl = "$RemoteBaseUrl/data/4164/forward"

try {
    $response = Invoke-RestMethod -Uri "$ProxyBaseUrl/proxy/api" `
        -Method POST `
        -Headers @{
            "Remote-URL"   = $RemoteUrl
            "Content-Type" = "application/json"
        } `
        -Body $Body `
        -TimeoutSec 10
} catch {
    Write-Error "ERROR: Request failed. Please authorize lexiang-knowledge-base in the integration panel first."
    exit 1
}

if ($response.ret -ne 0) {
    Write-Error "ERROR: ret=$($response.ret). Please authorize lexiang-knowledge-base in the integration panel first."
    exit 1
}

$accessValue = $response.data.resp.data.access_token

if ([string]::IsNullOrEmpty($accessValue) -or $accessValue -eq "null") {
    Write-Error "ERROR: No credential returned. Please authorize lexiang-knowledge-base in the integration panel first."
    exit 1
}

Write-Output $accessValue
