# fetch-skills-meta.ps1 —— 经 GitHub API 读取每个技能 SKILL.md 的 frontmatter，产出 skills.json
#
# 为什么不用 git clone：本仓库约 155 MB，而这里只需要每个 SKILL.md 的头部；
# 用 tree API + GraphQL 批量读，304 个文件 8 次请求即可（并且不受 CDN 抖动影响）。
#
# 前置：gh CLI 已登录（gh auth status 通过），可访问本仓库。
# 用法：pwsh -File scripts/fetch-skills-meta.ps1
#       pwsh -File scripts/fetch-skills-meta.ps1 -Owner someone -Repo his-skills

param(
    [string]$Owner    = 'douwenxian0-lang',
    [string]$Repo     = 'workbuddy-skills-collection',
    [string]$Branch   = 'main',
    [string]$OutJson  = (Join-Path $PSScriptRoot 'skills.json'),
    [int]$BatchSize   = 40,
    [int]$MaxRetry    = 4
)
$ErrorActionPreference = 'Stop'

Write-Host "仓库：$Owner/$Repo  分支：$Branch"
Write-Host "取文件树 …"
$treeRaw = (& gh api "repos/$Owner/$Repo/git/trees/$Branch`?recursive=1" 2>&1 | Out-String)
if ($treeRaw -notmatch '"tree"') { throw "取文件树失败：$($treeRaw.Substring(0,[Math]::Min(200,$treeRaw.Length)))" }
$tree = $treeRaw | ConvertFrom-Json
if ($tree.truncated) { Write-Host '  ⚠ 文件树被截断（仓库过大），缺失部分会以「未提供描述」出现' -ForegroundColor Yellow }
$blobs = @($tree.tree | Where-Object { $_.type -eq 'blob' })

# 顶层技能目录 = 含 <dir>/SKILL.md 的目录
$tops = $blobs | Where-Object { $_.path -match '/' } | Group-Object { ($_.path -split '/')[0] }
$skills = @()
foreach ($g in $tops) {
    $md = $g.Group | Where-Object { $_.path -eq ($g.Name + '/SKILL.md') } | Select-Object -First 1
    if (-not $md) { continue }
    $skills += [pscustomobject]@{
        Dir    = $g.Name
        Files  = @($g.Group).Count
        KB     = [math]::Round((($g.Group | Measure-Object size -Sum).Sum) / 1KB, 1)
        MdSize = $md.size
    }
}
$skills = @($skills | Sort-Object Dir)
Write-Host "  含 SKILL.md 的技能 = $($skills.Count)"
if ($skills.Count -eq 0) { throw '没有找到任何 <dir>/SKILL.md' }

# frontmatter 解析：支持 description/summary/title，缺 frontmatter 时回退正文首段
function Get-Fm([string]$text) {
    if (-not $text) { return @{} }
    $lines = $text -split "`r?`n"
    if ($lines.Count -eq 0 -or $lines[0].Trim() -ne '---') { return @{} }
    $fm = @{}; $desc = @(); $inDesc = $false; $inOther = $false
    for ($i = 1; $i -lt [Math]::Min($lines.Count, 500); $i++) {
        $ln = $lines[$i]
        if ($ln.Trim() -eq '---') { break }
        if ($inDesc) { if ($ln -match '^(\s+)\S') { $desc += $ln.Trim(); continue } else { $inDesc = $false } }
        if ($inOther) { if ($ln -match '^(\s+)\S') { continue } else { $inOther = $false } }
        if ($ln -match '^([A-Za-z0-9_\-]+):\s*(.*)$') {
            $k = $Matches[1]; $v = $Matches[2].Trim()
            if ($v -match '^[|>][-+0-9]*$') { if ($k -eq 'description') { $inDesc = $true; $desc = @() } else { $inOther = $true } }
            elseif ($v.Length -gt 0) { $fm[$k] = $v }
        }
    }
    if ($desc.Count -gt 0) { $fm['description'] = ($desc -join ' ') }
    return $fm
}

function Get-BodyFirstParagraph([string]$text) {
    $lines = $text -split "`r?`n"
    return (($lines | Where-Object { $_.Trim() -ne '' -and -not $_.StartsWith('#') -and -not $_.StartsWith('```') } | Select-Object -First 2) -join ' ')
}

$descMap = @{}
$total = $skills.Count
for ($start = 0; $start -lt $total; $start += $BatchSize) {
    $batch = $skills[$start..([Math]::Min($start + $BatchSize - 1, $total - 1))]
    $ok = $false
    for ($attempt = 1; $attempt -le $MaxRetry -and -not $ok; $attempt++) {
        $parts = @(); $i = 0
        foreach ($s in $batch) {
            $parts += ('f{0}: object(expression:"{1}:{2}/SKILL.md") {{ ... on Blob {{ text }} }}' -f $i, $Branch, $s.Dir)
            $i++
        }
        $q = 'query { repository(owner:"' + $Owner + '", name:"' + $Repo + '") { ' + ($parts -join ' ') + ' } }'
        $res = (& gh api graphql -f query=$q 2>&1 | Out-String)
        if ($res -notmatch '"data"') {
            Write-Host ("  批 {0} 第 {1} 次失败，重试 …" -f $start, $attempt) -ForegroundColor Yellow
            Start-Sleep -Seconds 3
            continue
        }
        try { $j = $res | ConvertFrom-Json } catch { continue }
        $i = 0
        foreach ($s in $batch) {
            $node = $j.data.repository.("f$i"); $i++
            if (-not $node -or -not $node.text) { continue }
            $fm = Get-Fm $node.text
            $d = $fm['description']; if (-not $d) { $d = $fm['summary'] }
            if (-not $d) { $d = $fm['title'] }
            if (-not $d) { $d = Get-BodyFirstParagraph $node.text }
            $descMap[$s.Dir] = [pscustomobject]@{
                Name = $(if ($fm['name']) { $fm['name'] } elseif ($fm['title']) { $fm['title'] } else { $s.Dir })
                Desc = $(if ($d) { $d } else { '' })
                Ver  = $(if ($fm['version']) { $fm['version'] } else { '' })
            }
        }
        $ok = $true
    }
    Write-Host ("  批 {0}-{1} 完成（累计 {2}）" -f $start, ($start + $batch.Count - 1), $descMap.Count)
}

$rows = foreach ($s in $skills) {
    $m = $descMap[$s.Dir]
    [pscustomobject]@{
        Dir   = $s.Dir
        Name  = $(if ($m) { $m.Name } else { $s.Dir })
        Desc  = $(if ($m) { $m.Desc } else { '' })
        Ver   = $(if ($m) { $m.Ver } else { '' })
        Files = $s.Files
        KB    = $s.KB
    }
}
$rows = @($rows)
[IO.File]::WriteAllText($OutJson, ($rows | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
Write-Host "  已写 $OutJson（$($rows.Count) 条，缺描述 $(@($rows | Where-Object { -not $_.Desc }).Count)）" -ForegroundColor Green
