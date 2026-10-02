# get-token.ps1 — Retrieve Figma access_token from credential hosting service
#
# ============================================================================
# AI/LLM INSTRUCTION:
# When calling this script, you MUST use the following exact syntax:
#
#   $env:FIGMA_TOKEN = & .\get-token.ps1
#
# CRITICAL RULES:
# - Do NOT put the call inside any quotes (single or double).
# - Do NOT use string interpolation like "$(...)" around it.
# - The `&` operator and `.\get-token.ps1` must be OUTSIDE of any quotes.
#
# WRONG examples (will assign literal string, not the token):
#   $env:FIGMA_TOKEN = "& .\get-token.ps1"
#   $env:FIGMA_TOKEN = '& .\get-token.ps1'
#   $env:FIGMA_TOKEN = "$(& .\get-token.ps1)"
#
# CORRECT:
#   $env:FIGMA_TOKEN = & .\get-token.ps1
# ============================================================================
#
# Token is automatically injected via JWT by the local proxy service.
#
# Compatibility: Windows PowerShell 5.1+ / PowerShell 7+

$ErrorActionPreference = "Stop"

# -- Force console output encoding to UTF-8 --
if ($PSVersionTable.PSVersion.Major -le 5) {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
}

# -- Remote API base URL (BUILD_ENV=test uses test env, otherwise production) --
# Note: PS 5.1 does not support `$var = if(...){...}else{...}` assignment syntax

if ($env:BUILD_ENV -eq "test") {
    $RemoteBaseUrl = "https://jprx.sparta.html5.qq.com"
} else {
    $RemoteBaseUrl = "https://jprx.m.qq.com"
}

# -- Proxy port and request URL --

if ($env:CREDENTIAL_PLATFORM) {
    $Platform = $env:CREDENTIAL_PLATFORM
} else {
    $Platform = "figma"
}

if ($env:AUTH_GATEWAY_PORT) {
    $ProxyPort = $env:AUTH_GATEWAY_PORT
} else {
    $ProxyPort = "19000"
}

$ProxyBase = "http://localhost:${ProxyPort}"
$RemoteUrl = "${RemoteBaseUrl}/data/4164/forward"

# -- Build request body (ensure UTF-8 encoding) --
$bodyObject = @{ platform = $Platform }
$bodyJson = $bodyObject | ConvertTo-Json -Compress
# Convert JSON string to UTF-8 byte array to prevent PS 5.1 from using system default encoding
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)

# -- Build request parameters (compatible with both PS 5.1 and PS 7) --
$requestParams = @{
    Uri         = "${ProxyBase}/proxy/api"
    Method      = "Post"
    Headers     = @{ "Remote-URL" = $RemoteUrl }
    ContentType = "application/json; charset=utf-8"
    Body        = $bodyBytes
    TimeoutSec  = 10
}

# PS 7+ may require -SkipCertificateCheck for HTTPS; not needed for local HTTP
# PS 5.1 does not support -SkipHttpErrorCheck; use try/catch instead

try {
    $response = Invoke-RestMethod @requestParams
} catch [System.Net.WebException] {
    $errMsg = $_.Exception.Message
    [Console]::Error.WriteLine("ERROR: Network error - $errMsg")
    exit 1
} catch {
    $errMsg = $_.Exception.Message
    [Console]::Error.WriteLine("ERROR: $errMsg")
    exit 1
}

# -- Parse response --
# Invoke-RestMethod may return PSCustomObject or string in PS 5.1
# If string is returned (rare), parse manually
if ($response -is [string]) {
    try {
        $response = $response | ConvertFrom-Json
    } catch {
        [Console]::Error.WriteLine("ERROR: Failed to parse response as JSON")
        exit 1
    }
}

if ($response.ret -ne 0) {
    $retVal = $response.ret
    [Console]::Error.WriteLine("ERROR: ret=$retVal")
    exit 1
}

# -- Extract access_token (handle nested property access) --
$accessToken = $null
try {
    $accessToken = $response.data.resp.data.access_token
} catch {
    # PS 5.1 may fail on chained property access in some cases
    try {
        $data = $response.data
        $resp = $data.resp
        $respData = $resp.data
        $accessToken = $respData.access_token
    } catch {
        [Console]::Error.WriteLine("ERROR: Failed to extract access_token from response")
        exit 1
    }
}

if (-not $accessToken -or $accessToken -eq "null" -or $accessToken -eq "") {
    [Console]::Error.WriteLine("ERROR: access_token not found. Please complete Figma authorization in the integration panel first.")
    exit 1
}

# Output token to stdout (capturable by variable assignment)
$accessToken
