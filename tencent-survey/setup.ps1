#Requires -Version 5.1
<#
.SYNOPSIS
    Setup script for Tencent Survey MCP Skill (Internal OpenClaw version)

.DESCRIPTION
    All-in-one configuration and authorization script for Windows (PowerShell).
    Functions:
      1. Check if mcporter has tencent-survey configured (with valid Authorization)
      2. When not configured or Token invalid, display authorization URL
      3. Poll and wait for user to complete authorization, then write Token to mcporter
      4. Provide friendly messages for timeout, expired, and error scenarios

.USAGE
    # Step 1: Check status (returns immediately, non-blocking)
    powershell -ExecutionPolicy Bypass -File setup.ps1 wj_check_and_start_auth
    # Output:
    #   READY                  -> Service ready, proceed with user task
    #   NONCE:<nonce>          -> Nonce value (output before AUTH_REQUIRED)
    #   AUTH_REQUIRED:<url>    -> Show auth URL to user, then run Step 2
    #   ERROR:*                -> Report error to user

    # Step 2: Wait for authorization (blocking, up to ~300s)
    powershell -ExecutionPolicy Bypass -File setup.ps1 wj_wait_auth
    # Output:
    #   TOKEN_READY:ok         -> Auth success, Token saved, proceed with user task
    #   AUTH_TIMEOUT           -> Tell user: authorization timed out
    #   ERROR:*                -> Report error to user
#>

param(
    [Parameter(Position = 0)]
    [string]$Command
)

# Force UTF-8 output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# ── Global Configuration ─────────────────────────────────────────────────────
$script:WJ_API_BASE = if ($env:WJ_API_BASE_URL) { $env:WJ_API_BASE_URL } else { "https://wj.qq.com" }
$script:WJ_AUTH_PAGE = if ($env:WJ_AUTH_PAGE_URL) { $env:WJ_AUTH_PAGE_URL } else { "https://wj.qq.com/oauth/authorize" }

# Extract extra query params from WJ_AUTH_PAGE_URL (e.g. _tde_id=2952)
$script:WJ_EXTRA_QUERY = ""
if ($script:WJ_AUTH_PAGE -match '\?(.+)$') {
    $script:WJ_EXTRA_QUERY = $Matches[1]
}

# Construct API URLs
$script:WJ_MCP_URL = "$($script:WJ_API_BASE)/api/v2/mcp"
$script:WJ_TOKEN_POLL_URL = "$($script:WJ_API_BASE)/api/v2/account/tokens/device-auth/poll"
if ($script:WJ_EXTRA_QUERY) {
    $script:WJ_MCP_URL = "$($script:WJ_MCP_URL)?$($script:WJ_EXTRA_QUERY)"
    $script:WJ_TOKEN_POLL_URL = "$($script:WJ_TOKEN_POLL_URL)?$($script:WJ_EXTRA_QUERY)"
}
$script:WJ_SERVICE_NAME = "tencent-survey"

# Polling parameters: every 2s, max 150 times (~300s)
$script:WJ_POLL_INTERVAL = 2
$script:WJ_POLL_MAX = 150

# Temp directory: use per-user private directory
$script:WJ_TMP_DIR = Join-Path $env:TEMP ".wj_auth_$($env:USERNAME)"
if (-not (Test-Path $script:WJ_TMP_DIR)) {
    New-Item -ItemType Directory -Path $script:WJ_TMP_DIR -Force | Out-Null
}

$script:WJ_CODE_FILE = Join-Path $script:WJ_TMP_DIR "code"
$script:WJ_NONCE_FILE = Join-Path $script:WJ_TMP_DIR "nonce"
$script:WJ_URL_FILE = Join-Path $script:WJ_TMP_DIR "url"

# ── Helper: Safe write (reject symlinks) ─────────────────────────────────────
function Write-SafeFile {
    param([string]$Path, [string]$Content)
    $item = Get-Item $Path -ErrorAction SilentlyContinue
    if ($item -and $item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Error "ERROR:security - Symlink detected, refusing to write: $Path"
        return $false
    }
    Set-Content -Path $Path -Value $Content -Encoding UTF8 -NoNewline
    return $true
}

# ── Helper: Cleanup temp files ────────────────────────────────────────────────
function Clear-TempFiles {
    if (Test-Path $script:WJ_TMP_DIR) {
        Remove-Item -Path $script:WJ_TMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $script:WJ_TMP_DIR -Force | Out-Null
}

# ── Helper: Find mcporter command ─────────────────────────────────────────────
function Find-Mcporter {
    $cmd = Get-Command mcporter -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # Try common QClaw paths
    $candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\QClaw\resources\openclaw\config\bin\mcporter.cmd"),
        (Join-Path $env:ProgramFiles "QClaw\resources\openclaw\config\bin\mcporter.cmd")
    )
    # Also try version-specific paths
    $qclawDir = Join-Path $env:ProgramFiles "QClaw"
    if (Test-Path $qclawDir) {
        Get-ChildItem $qclawDir -Directory -Filter "v*" -ErrorAction SilentlyContinue | ForEach-Object {
            $candidates += Join-Path $_.FullName "resources\openclaw\config\bin\mcporter.cmd"
        }
    }

    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    return $null
}

# ── Check mcporter installation ───────────────────────────────────────────────
function Test-Mcporter {
    $mcporter = Find-Mcporter
    if ($mcporter) { return $true }

    # Try to install via npm
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if ($npm) {
        Write-Host "Installing mcporter..."
        & npm install -g mcporter 2>&1 | Select-Object -Last 3
        $mcporter = Find-Mcporter
        if ($mcporter) {
            Write-Host "mcporter installed successfully"
            return $true
        }
    }
    return $false
}

# ── Invoke mcporter with proper path handling ─────────────────────────────────
function Invoke-Mcporter {
    param([string[]]$Arguments)
    $mcporter = Find-Mcporter
    if (-not $mcporter) {
        throw "mcporter not found"
    }
    $result = & $mcporter @Arguments 2>&1
    return $result
}

# ── Get current Token from mcporter config ────────────────────────────────────
function Get-WjToken {
    try {
        $output = Invoke-Mcporter @("config", "get", $script:WJ_SERVICE_NAME)
        $line = ($output | Select-String -Pattern "Authorization:" | Select-Object -First 1)
        if ($line) {
            $token = ($line.ToString() -replace '.*Authorization:\s*', '').Trim()
            return $token
        }
    } catch {
        # Ignore errors
    }
    return ""
}

# ── Save Token to mcporter config ─────────────────────────────────────────────
function Save-WjToken {
    param([string]$Token)
    if (-not $Token) { return $false }

    try {
        $mcArgs = @(
            "config", "add", $script:WJ_SERVICE_NAME, $script:WJ_MCP_URL,
            "--header", "Authorization=Bearer $Token",
            "--transport", "http",
            "--scope", "home"
        )
        Invoke-Mcporter $mcArgs | Out-Null

        # Verify
        $listOutput = Invoke-Mcporter @("list")
        $found = $listOutput | Select-String -Pattern $script:WJ_SERVICE_NAME -Quiet
        return [bool]$found
    } catch {
        return $false
    }
}

# ── Check service status ──────────────────────────────────────────────────────
# Returns: 0 = ready, 1 = not registered, 2 = token empty
function Get-ServiceStatus {
    try {
        $listOutput = Invoke-Mcporter @("list")
        $found = $listOutput | Select-String -Pattern $script:WJ_SERVICE_NAME -Quiet
        if (-not $found) { return 1 }
    } catch {
        return 1
    }

    $token = Get-WjToken
    if (-not $token) { return 2 }
    return 0
}

# ── Generate authorization URL ────────────────────────────────────────────────
function New-AuthUrl {
    $initUrl = "$($script:WJ_API_BASE)/api/v2/account/tokens/device-auth/init"
    if ($script:WJ_EXTRA_QUERY) {
        $initUrl = "$initUrl`?$($script:WJ_EXTRA_QUERY)"
    }

    try {
        $response = Invoke-RestMethod -Uri $initUrl -Method POST -ContentType "application/json" -ErrorAction Stop
    } catch {
        return "ERROR:init_request_failed - Cannot connect to server $initUrl"
    }

    # Parse response
    $respCode = $response.code
    if ($respCode -and $respCode.ToString().ToUpper() -ne "OK") {
        return "ERROR:init_failed - Server returned error: $respCode"
    }

    $code = $response.data.code
    $nonce = $response.data.nonce

    # Validate code format
    if ($code -notmatch '^[0-9a-f]{16,64}$') {
        return "ERROR:invalid_code - Server returned invalid code format: $code"
    }
    if (-not $nonce) {
        return "ERROR:invalid_nonce - Server did not return nonce"
    }

    # Save code and nonce to temp files
    if (-not (Write-SafeFile -Path $script:WJ_CODE_FILE -Content $code)) { return "ERROR:write_failed" }
    if (-not (Write-SafeFile -Path $script:WJ_NONCE_FILE -Content $nonce)) { return "ERROR:write_failed" }

    # Build auth URL
    $sep = "?"
    if ($script:WJ_AUTH_PAGE -match '\?') { $sep = "&" }
    return "$($script:WJ_AUTH_PAGE)${sep}code=${code}&nonce=${nonce}"
}

# ── Poll for Token ────────────────────────────────────────────────────────────
function Wait-ForToken {
    if (-not (Test-Path $script:WJ_CODE_FILE)) {
        Write-Output "ERROR:no_code - Code file not found, run wj_check_and_start_auth first"
        return $null
    }

    $code = (Get-Content $script:WJ_CODE_FILE -Raw).Trim()
    if (-not $code) {
        Write-Output "ERROR:empty_code - Authorization code is empty"
        return $null
    }

    $pollSep = "?"
    if ($script:WJ_TOKEN_POLL_URL -match '\?') { $pollSep = "&" }
    $url = "$($script:WJ_TOKEN_POLL_URL)${pollSep}code=${code}"

    for ($i = 1; $i -le $script:WJ_POLL_MAX; $i++) {
        Start-Sleep -Seconds $script:WJ_POLL_INTERVAL

        try {
            $response = Invoke-RestMethod -Uri $url -Method GET -ErrorAction Stop
        } catch {
            Write-Host "  [$i/$($script:WJ_POLL_MAX)] Request failed"
            continue
        }

        $respCode = $response.code
        if ($respCode -and $respCode.ToString().ToUpper() -ne "OK") {
            Write-Host "  [$i/$($script:WJ_POLL_MAX)] resp_code=$respCode (not Ok)"
            continue
        }

        $status = $response.data.status
        $token = $response.data.token

        switch ($status) {
            "completed" {
                Write-Host "  [$i/$($script:WJ_POLL_MAX)] status=completed"
                if ($token) {
                    return $token
                }
                Write-Output "ERROR:empty_token - status=completed but token is empty"
                return $null
            }
            "pending" {
                Write-Host "  [$i/$($script:WJ_POLL_MAX)] status=pending"
                continue
            }
            default {
                Write-Host "  [$i/$($script:WJ_POLL_MAX)] status=$status (unknown)"
                continue
            }
        }
    }

    Write-Output "AUTH_TIMEOUT"
    return $null
}

# ── Main Entry A: Check status / Generate auth URL (non-blocking) ─────────────
function Invoke-CheckAndStartAuth {
    if (-not (Test-Mcporter)) {
        Write-Output "ERROR:mcporter_not_found - Please install Node.js and npm first"
        return
    }

    # If TENCENT_SURVEY_TOKEN env var is set, write directly to config
    if ($env:TENCENT_SURVEY_TOKEN) {
        if ($env:TENCENT_SURVEY_TOKEN -notmatch '^wjpt_') {
            Write-Output "ERROR:invalid_token_prefix - TENCENT_SURVEY_TOKEN must start with wjpt_"
            return
        }
        $saved = Save-WjToken -Token $env:TENCENT_SURVEY_TOKEN
        if ($saved) {
            Write-Output "READY"
        } else {
            Write-Output "ERROR:save_token_failed - Failed to write Token to config"
        }
        return
    }

    # Check existing service status
    $status = Get-ServiceStatus
    switch ($status) {
        0 {
            Write-Output "READY"
            return
        }
        default {
            # Need authorization
            Clear-TempFiles

            $authUrl = New-AuthUrl
            if ($authUrl -match '^ERROR:') {
                Write-Output $authUrl
                return
            }

            # Save URL to file for reference
            Write-SafeFile -Path $script:WJ_URL_FILE -Content $authUrl | Out-Null

            # Output nonce if available
            if (Test-Path $script:WJ_NONCE_FILE) {
                $nonce = (Get-Content $script:WJ_NONCE_FILE -Raw).Trim()
                if ($nonce) {
                    Write-Output "NONCE:$nonce"
                }
            }

            Write-Output "AUTH_REQUIRED:$authUrl"
        }
    }
}

# ── Main Entry B: Wait for authorization (blocking, up to ~300s) ──────────────
function Invoke-WaitAuth {
    $token = Wait-ForToken

    if ($token -and $token -notmatch '^(ERROR:|AUTH_TIMEOUT)') {
        $saved = Save-WjToken -Token $token
        Clear-TempFiles
        if ($saved) {
            Write-Output "TOKEN_READY:ok"
        } else {
            Write-Output "ERROR:save_token_failed - Failed to write Token to config"
        }
    } elseif ($token -eq $null) {
        # Error already output by Wait-ForToken
        Clear-TempFiles
    } else {
        # AUTH_TIMEOUT or ERROR already in output stream
        Clear-TempFiles
    }
}

# ── Script Entry Point ────────────────────────────────────────────────────────
switch ($Command) {
    "wj_check_and_start_auth" {
        Invoke-CheckAndStartAuth
    }
    "wj_wait_auth" {
        Invoke-WaitAuth
    }
    "setup" {
        Write-Host ""
        Write-Host "=========================================="
        Write-Host "  Tencent Survey MCP Skill Setup Wizard"
        Write-Host "=========================================="
        Write-Host ""

        if (-not (Test-Mcporter)) {
            Write-Host "ERROR: mcporter not found. Please install Node.js first."
            exit 1
        }
        Write-Host "[OK] mcporter is available"
        Write-Host ""

        $status = Get-ServiceStatus
        if ($status -eq 0) {
            Write-Host "[OK] tencent-survey is already configured and ready!"
            Write-Host ""
            Write-Host "Usage:"
            Write-Host "  mcporter call tencent-survey.get_survey --args '{`"survey_id`": 12345}'"
            exit 0
        }

        Write-Host "Authorization required..."
        Write-Host ""

        Clear-TempFiles
        $authUrl = New-AuthUrl
        if ($authUrl -match '^ERROR:') {
            Write-Host "Failed to generate auth URL: $authUrl"
            exit 1
        }

        $nonce = ""
        if (Test-Path $script:WJ_NONCE_FILE) {
            $nonce = (Get-Content $script:WJ_NONCE_FILE -Raw).Trim()
        }

        Write-Host "Please open the following URL in your browser to authorize:"
        Write-Host ""
        Write-Host "  $authUrl"
        Write-Host ""
        if ($nonce) {
            Write-Host "  Nonce: $nonce"
            Write-Host ""
        }
        Write-Host "  Use QQ or WeChat to scan and authorize."
        Write-Host ""
        Write-Host "Waiting for authorization (max $($script:WJ_POLL_MAX * $script:WJ_POLL_INTERVAL)s)..."
        Write-Host ""

        $token = Wait-ForToken
        if ($token -and $token -notmatch '^(ERROR:|AUTH_TIMEOUT)') {
            Write-Host ""
            Write-Host "Authorization successful! Saving config..."
            $saved = Save-WjToken -Token $token
            Clear-TempFiles
            if ($saved) {
                Write-Host "[OK] Token saved to mcporter config"
                Write-Host ""
                Write-Host "Setup complete! You can now use Tencent Survey tools."
                Write-Host ""
                Write-Host "Usage:"
                Write-Host "  mcporter call tencent-survey.get_survey --args '{`"survey_id`": 12345}'"
            } else {
                Write-Host "WARNING: Failed to save Token to mcporter config"
                Write-Host "Please run manually:"
                Write-Host "  mcporter config add $($script:WJ_SERVICE_NAME) `"$($script:WJ_MCP_URL)`" --header `"Authorization=Bearer <token>`" --transport http --scope home"
            }
        } else {
            Write-Host ""
            Write-Host "Authorization failed or timed out."
            Write-Host "Please try again: powershell -File setup.ps1 setup"
            exit 1
        }
    }
    default {
        if ($Command) {
            Write-Host "ERROR:unknown_command - Unknown command: $Command"
            Write-Host ""
        }
        Write-Host "Usage:"
        Write-Host "  powershell -ExecutionPolicy Bypass -File setup.ps1 wj_check_and_start_auth"
        Write-Host "  powershell -ExecutionPolicy Bypass -File setup.ps1 wj_wait_auth"
        Write-Host "  powershell -ExecutionPolicy Bypass -File setup.ps1 setup"
    }
}
