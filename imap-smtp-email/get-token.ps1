param(
    [string]$Token = "",
    [string]$Email = "",
    [string]$Platform = ""
)
# get-token.ps1 — Retrieve email auth code from credential gateway and write to imap-smtp-email/.env
$ErrorActionPreference = "Stop"

# ── Encoding protection: force UTF-8 without BOM ──
# Windows PowerShell 5.x defaults to system code page (GBK/936), which causes:
#   1. Write-Output Chinese JSON output becomes GBK, resolve-account.cjs JSON.parse fails
#   2. Set-Content -Encoding UTF8 actually writes UTF-8 BOM, Node.js reads .env with BOM prefix on first key
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$SkillDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile  = Join-Path $SkillDir ".env"
# BUILD_ENV=test uses test env; otherwise uses production
$RemoteBaseUrl = if ($env:BUILD_ENV -eq "test") { "https://jprx.sparta.html5.qq.com" } else { "https://jprx.m.qq.com" }
$ProxyPort = if ($env:AUTH_GATEWAY_PORT) { $env:AUTH_GATEWAY_PORT } else { "19000" }
$ProxyBase = "http://localhost:${ProxyPort}"
$RemoteUrl = "${RemoteBaseUrl}/data/4164/forward"
$CheckedPlatforms = @("163_mail", "qq_mail", "gmail", "outlook", "sina_mail", "sohu_mail")
$Failures = New-Object System.Collections.ArrayList

function Write-Json($success, $message, $errorCode = $null, $extra = @{}) {
    $payload = [ordered]@{
        success = [bool]$success
        message = $message
    }
    foreach ($key in $extra.Keys) {
        $payload[$key] = $extra[$key]
    }
    if ($null -ne $errorCode -and "$errorCode" -ne "") {
        $payload.error_code = [int]$errorCode
    }
    $payload | ConvertTo-Json -Depth 6 -Compress
}

function Infer-Servers($domain) {
    switch ($domain) {
        "163.com"       { $script:imapHost = "imap.163.com";          $script:smtpHost = "smtp.163.com";          $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "vip.163.com"   { $script:imapHost = "imap.vip.163.com";      $script:smtpHost = "smtp.vip.163.com";      $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "126.com"       { $script:imapHost = "imap.126.com";          $script:smtpHost = "smtp.126.com";          $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "vip.126.com"   { $script:imapHost = "imap.vip.126.com";      $script:smtpHost = "smtp.vip.126.com";      $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "188.com"       { $script:imapHost = "imap.188.com";          $script:smtpHost = "smtp.188.com";          $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "vip.188.com"   { $script:imapHost = "imap.vip.188.com";      $script:smtpHost = "smtp.vip.188.com";      $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "yeah.net"      { $script:imapHost = "imap.yeah.net";         $script:smtpHost = "smtp.yeah.net";         $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "gmail.com"     { $script:imapHost = "imap.gmail.com";        $script:smtpHost = "smtp.gmail.com";        $script:smtpPort = "587"; $script:smtpSecure = "false"; return $true }
        "outlook.com"   { $script:imapHost = "outlook.office365.com"; $script:smtpHost = "smtp-mail.outlook.com"; $script:smtpPort = "587"; $script:smtpSecure = "false"; return $true }
        "hotmail.com"   { $script:imapHost = "outlook.office365.com"; $script:smtpHost = "smtp-mail.outlook.com"; $script:smtpPort = "587"; $script:smtpSecure = "false"; return $true }
        "live.com"      { $script:imapHost = "outlook.office365.com"; $script:smtpHost = "smtp-mail.outlook.com"; $script:smtpPort = "587"; $script:smtpSecure = "false"; return $true }
        "live.cn"       { $script:imapHost = "outlook.office365.com"; $script:smtpHost = "smtp-mail.outlook.com"; $script:smtpPort = "587"; $script:smtpSecure = "false"; return $true }
        "qq.com"        { $script:imapHost = "imap.qq.com";           $script:smtpHost = "smtp.qq.com";           $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "foxmail.com"   { $script:imapHost = "imap.qq.com";           $script:smtpHost = "smtp.qq.com";           $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "vip.qq.com"    { $script:imapHost = "imap.vip.qq.com";       $script:smtpHost = "smtp.vip.qq.com";       $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "yahoo.com"     { $script:imapHost = "imap.mail.yahoo.com";   $script:smtpHost = "smtp.mail.yahoo.com";   $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "sina.com"      { $script:imapHost = "imap.sina.com";         $script:smtpHost = "smtp.sina.com";         $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "sina.cn"       { $script:imapHost = "imap.sina.com";         $script:smtpHost = "smtp.sina.com";         $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "vip.sina.com"  { $script:imapHost = "imap.vip.sina.com";     $script:smtpHost = "smtp.vip.sina.com";     $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "sohu.com"      { $script:imapHost = "imap.sohu.com";         $script:smtpHost = "smtp.sohu.com";         $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "139.com"       { $script:imapHost = "imap.139.com";          $script:smtpHost = "smtp.139.com";          $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "exmail.qq.com" { $script:imapHost = "imap.exmail.qq.com";    $script:smtpHost = "smtp.exmail.qq.com";    $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        "aliyun.com"    { $script:imapHost = "imap.aliyun.com";       $script:smtpHost = "smtp.aliyun.com";       $script:smtpPort = "465"; $script:smtpSecure = "true"; return $true }
        default { return $false }
    }
}

function Platform-FromDomain($domain) {
    switch ($domain) {
        { $_ -in @("163.com","vip.163.com","126.com","vip.126.com","188.com","vip.188.com","yeah.net") } { return "163_mail" }
        { $_ -in @("qq.com","foxmail.com","vip.qq.com","exmail.qq.com") } { return "qq_mail" }
        { $_ -eq "gmail.com" } { return "gmail" }
        { $_ -in @("outlook.com","hotmail.com","live.com","live.cn") } { return "outlook" }
        { $_ -in @("sina.com","sina.cn","vip.sina.com") } { return "sina_mail" }
        { $_ -eq "sohu.com" } { return "sohu_mail" }
        default { return "" }
    }
}

function Write-Env($emailAddr, $tokenVal, $tokenSource) {
    $homeDir = $env:USERPROFILE
    $emailDomain = ($emailAddr -split '@')[-1]
    $envContent = @"
# Provider hint
EMAIL_PROVIDER_HINT=$emailDomain

# IMAP Configuration
IMAP_HOST=$imapHost
IMAP_PORT=993
IMAP_USER=$emailAddr
IMAP_PASS=$tokenVal
IMAP_TLS=true
IMAP_REJECT_UNAUTHORIZED=true
IMAP_MAILBOX=INBOX
IMAP_CONN_TIMEOUT_MS=20000
IMAP_AUTH_TIMEOUT_MS=15000
IMAP_SOCKET_TIMEOUT_MS=30000
IMAP_CONNECTION_RETRIES=2
IMAP_RETRY_DELAY_MS=1500
IMAP_KEEPALIVE_INTERVAL_MS=10000
IMAP_IDLE_INTERVAL_MS=300000

# SMTP Configuration
SMTP_HOST=$smtpHost
SMTP_PORT=$smtpPort
SMTP_SECURE=$smtpSecure
SMTP_USER=$emailAddr
SMTP_PASS=$tokenVal
SMTP_FROM=$emailAddr
SMTP_REJECT_UNAUTHORIZED=true
SMTP_CONNECTION_TIMEOUT_MS=30000
SMTP_GREETING_TIMEOUT_MS=30000
SMTP_SOCKET_TIMEOUT_MS=60000
SMTP_DNS_TIMEOUT_MS=30000
SMTP_CONNECTION_RETRIES=2
SMTP_RETRY_DELAY_MS=1500

# File access whitelist
ALLOWED_READ_DIRS=$homeDir\Downloads,$homeDir\Documents
ALLOWED_WRITE_DIRS=$homeDir\Downloads

# Token source (used to decide whether runtime auto-refresh may overwrite this file)
TOKEN_SOURCE=$tokenSource
"@
    # Use .NET API to write UTF-8 without BOM — Windows PowerShell 5.x Set-Content -Encoding UTF8
    # writes BOM (EF BB BF), causing Node.js to fail parsing .env first key with BOM prefix
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($EnvFile, $envContent, $utf8NoBom)
}

function Add-Failure($platform, $errorCode, $message) {
    [void]$Failures.Add([pscustomobject]@{
        platform = $platform
        error_code = [int]$errorCode
        message = $message
    })
}

function Emit-BestFailureAndExit() {
    $selected = $Failures | Where-Object { $_.error_code -eq 21004 } | Select-Object -First 1
    if (-not $selected) {
        $selected = $Failures | Select-Object -First 1
    }
    if (-not $selected) {
        $selected = [pscustomobject]@{
            platform = ""
            error_code = 3
            message = "No valid email credentials retrieved from credential service. Please log in and enable email capability, or use setup.sh for manual configuration."
        }
    }
    Write-Output (Write-Json $false $selected.message $selected.error_code @{ checked_platforms = $CheckedPlatforms; source = "credential_service"; platform = $selected.platform })
    exit 1
}

if ($Token -or $Email) {
    if (-not $Token -or -not $Email) {
        Write-Output (Write-Json $false "-Token and -Email must be provided together" 1 @{ mode = "manual-token" })
        exit 1
    }
    if ($Token -match '\s') {
        Write-Output (Write-Json $false "Auth code must not contain spaces or newlines" 1 @{ mode = "manual-token" })
        exit 1
    }
    if ($Email -notmatch '@') {
        Write-Output (Write-Json $false "Invalid email address format" 1 @{ mode = "manual-token" })
        exit 1
    }
    $Email = $Email.Trim()
    $domain = ($Email -split '@')[-1]
    if (-not (Infer-Servers $domain)) {
        Write-Output (Write-Json $false "get-token.ps1 does not support auto-inferring domain ${domain}, please use setup.sh or manually write .env" 1 @{ mode = "manual-token" })
        exit 1
    }
    Write-Env $Email $Token "manual_token"
    Write-Output (Write-Json $true "Email credentials written successfully" $null @{ env_path = $EnvFile; mode = "manual-token" })
    exit 0
}

# ── Mode 2: Fetch credentials for a specific platform ──
if ($Platform) {
    $bodyStr = @{ platform = $Platform } | ConvertTo-Json -Compress
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyStr)
    try {
        $response = Invoke-RestMethod -Uri "${ProxyBase}/proxy/api" `
            -Method Post `
            -Headers @{ "Remote-URL" = $RemoteUrl; "Content-Type" = "application/json; charset=utf-8" } `
            -Body $bodyBytes `
            -TimeoutSec 10
    } catch {
        Write-Output (Write-Json $false "Failed to request credential service, please check local proxy or login status." 999 @{ platform = $Platform; mode = "platform-specific" })
        exit 1
    }

    if ($response.ret -ne 0) {
        Write-Output (Write-Json $false "Credential service gateway returned error, ret=$($response.ret)" 999 @{ platform = $Platform; mode = "platform-specific" })
        exit 1
    }

    $common = $response.data.resp.common
    $commonCode = if ($null -ne $common.code -and "$($common.code)" -ne "") { [int]$common.code } else { 999 }
    $commonMessage = if ($common.message) { [string]$common.message } else { "Credential service returned failure" }
    if ($commonCode -ne 0) {
        Write-Output (Write-Json $false $commonMessage $commonCode @{ platform = $Platform; mode = "platform-specific" })
        exit 1
    }

    $accessToken = $response.data.resp.data.access_token
    $emailAddress = $response.data.resp.data.extra_data.email_address
    if (-not $accessToken -or -not $emailAddress) {
        Write-Output (Write-Json $false "Credential service did not return a valid email address or auth code" 3 @{ platform = $Platform; mode = "platform-specific" })
        exit 1
    }

    $domain = ($emailAddress -split '@')[-1]
    if (-not (Infer-Servers $domain)) {
        Write-Output (Write-Json $false "get-token.ps1 does not support auto-inferring domain ${domain}, please use setup.sh or manually write .env" 1 @{ platform = $Platform; mode = "platform-specific" })
        exit 1
    }

    Write-Env $emailAddress $accessToken "credential_service"
    Write-Output (Write-Json $true "Email credentials refreshed from credential service" $null @{ env_path = $EnvFile; mode = "platform-specific"; platform = $Platform; email = $emailAddress })
    exit 0
}

# ── Mode 3: Auto-iterate all platforms ──
foreach ($platform in $CheckedPlatforms) {
    $bodyStr = @{ platform = $platform } | ConvertTo-Json -Compress
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyStr)
    try {
        $response = Invoke-RestMethod -Uri "${ProxyBase}/proxy/api" `
            -Method Post `
            -Headers @{ "Remote-URL" = $RemoteUrl; "Content-Type" = "application/json; charset=utf-8" } `
            -Body $bodyBytes `
            -TimeoutSec 10
    } catch {
        Add-Failure $platform 999 "Failed to request credential service, please check local proxy or login status."
        continue
    }

    if ($response.ret -ne 0) {
        Add-Failure $platform 999 "Credential service gateway returned error, ret=$($response.ret)"
        continue
    }

    $common = $response.data.resp.common
    $commonCode = if ($null -ne $common.code -and "$($common.code)" -ne "") { [int]$common.code } else { 999 }
    $commonMessage = if ($common.message) { [string]$common.message } else { "Credential service returned failure" }
    if ($commonCode -ne 0) {
        Add-Failure $platform $commonCode $commonMessage
        continue
    }

    $accessToken = $response.data.resp.data.access_token
    $emailAddress = $response.data.resp.data.extra_data.email_address
    if (-not $accessToken -or -not $emailAddress) {
        Add-Failure $platform 3 "Credential service did not return a valid email address or auth code"
        continue
    }

    $domain = ($emailAddress -split '@')[-1]
    $expectedPlatform = Platform-FromDomain $domain
    if ($expectedPlatform -and $expectedPlatform -ne $platform) {
        Add-Failure $platform 3 "Email ${emailAddress} returned by credential service does not match platform ${platform}"
        continue
    }

    if (-not (Infer-Servers $domain)) {
        Add-Failure $platform 1 "get-token.ps1 does not support auto-inferring domain ${domain}, please use setup.sh or manually write .env"
        continue
    }

    Write-Env $emailAddress $accessToken "credential_service"
    Write-Output (Write-Json $true "Email credentials refreshed from credential service" $null @{ env_path = $EnvFile; mode = "credential-service"; platform = $platform; email = $emailAddress })
    exit 0
}

Emit-BestFailureAndExit
