# gen-skills-index.ps1 —— 从 skills.json 生成 README.md 与 SKILLS-INDEX.md
#
# 前置：先跑 scripts/fetch-skills-meta.ps1 生成 skills.json（或自备同结构 JSON）。
# 用法：pwsh -File scripts/gen-skills-index.ps1
#       pwsh -File scripts/gen-skills-index.ps1 -SkillsJson scripts/skills.json -Out ..
#
# 只读 skills.json，只写两个 Markdown 文件，不改动任何技能目录。

param(
    [string]$SkillsJson = (Join-Path $PSScriptRoot 'skills.json'),
    [string]$Out        = (Split-Path $PSScriptRoot -Parent)
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $SkillsJson)) { throw "缺 $SkillsJson —— 请先运行 scripts/fetch-skills-meta.ps1" }

function First-Sentence([string]$text, [int]$max = 110) {
    if ([string]::IsNullOrWhiteSpace($text)) { return '' }
    $t = ($text -replace '^\s*>\s*', '' -replace '^\s*["'']', '' -replace '\s+', ' ').Trim()
    $m = [regex]::Match($t, '^.{1,' + $max + '}?(?=[。；;\.!?！？]|$)')
    $s = if ($m.Success) { $m.Value } else { $t.Substring(0, [Math]::Min($max, $t.Length)) }
    if ($s.Length -lt $t.Length) { $s += '…' }
    return $s -replace '\|', '\\|'
}

function Category-Of([string]$name) {
    if ($name -match '^skill_\d+$')  { return '09 · 数字 ID 技能（迁移产物）' }
    if ($name -like 'html-ppt*')     { return '01 · HTML PPT 模板族' }
    if ($name -like 'bmad-*')        { return '02 · BMAD 角色族' }
    if ($name -like 'tencent*')      { return '03 · 腾讯产品技能' }
    if ($name -match '^(orbit|agent|video|social|image|web-prototype|design|github|ima)-') { return '04 · 平台/工具技能族' }
    if ($name -match 'template|^swiss-|^editorial-|^after-hours-|^field-notes-|^digits-') { return '05 · 设计模板族' }
    return '06 · 独立技能'
}

$raw = @(Get-Content -LiteralPath $SkillsJson -Raw | ConvertFrom-Json)
$rows = foreach ($r in $raw) {
    [pscustomobject]@{
        Dir     = $r.Dir
        Name    = $r.Name
        Desc    = First-Sentence $r.Desc
        Files   = [int]$r.Files
        KB      = [double]$r.KB
        Version = $r.Ver
        Cat     = Category-Of $r.Dir
    }
}
$rows = @($rows)
if ($rows.Count -eq 0) { throw 'skills.json 为空' }

$totalFiles = ($rows | Measure-Object Files -Sum).Sum
$totalMB    = [math]::Round((($rows | Measure-Object KB -Sum).Sum) / 1024, 1)
$noDesc     = @($rows | Where-Object { -not $_.Desc }).Count
$utf8 = [System.Text.UTF8Encoding]::new($false)

# ---------- SKILLS-INDEX.md ----------
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# 技能索引（自动生成）')
[void]$sb.AppendLine('')
[void]$sb.AppendLine("> 由 `scripts/gen-skills-index.ps1` 从各 `SKILL.md` 的 frontmatter 生成，共 **$($rows.Count) 个技能**、$totalFiles 个文件、约 $totalMB MB。")
[void]$sb.AppendLine('> 描述取自 `description` 首句；缺失时回退 `summary` / `title` / 正文首段。')
[void]$sb.AppendLine('')
foreach ($cat in ($rows | Group-Object Cat | Sort-Object Name)) {
    [void]$sb.AppendLine("## $($cat.Name)（$($cat.Count) 个）")
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('| 技能目录 | 描述 | 文件 | 大小 |')
    [void]$sb.AppendLine('|---|---|---:|---:|')
    foreach ($r in ($cat.Group | Sort-Object Dir)) {
        $desc = if ($r.Desc) { $r.Desc } else { '（未提供 description）' }
        [void]$sb.AppendLine("| ``$($r.Dir)`` | $desc | $($r.Files) | $($r.KB) KB |")
    }
    [void]$sb.AppendLine('')
}
[IO.File]::WriteAllText((Join-Path $Out 'SKILLS-INDEX.md'), $sb.ToString(), $utf8)

# ---------- README.md ----------
$rb = New-Object System.Text.StringBuilder
[void]$rb.AppendLine('# WorkBuddy / OpenClaw 技能集合')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('一组可直接使用的 AI Agent 技能（每个技能一个目录，入口为该目录下的 `SKILL.md`）。')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('## 统计')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('| 指标 | 数值 |')
[void]$rb.AppendLine('|---|---|')
[void]$rb.AppendLine("| 技能数 | **$($rows.Count)** |")
[void]$rb.AppendLine("| 文件数 / 体积 | $totalFiles / 约 $totalMB MB |")
[void]$rb.AppendLine("| 缺少可解析 description | $noDesc |")
[void]$rb.AppendLine('')
[void]$rb.AppendLine('## 分类概览')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('| 分类 | 数量 | 索引 |')
[void]$rb.AppendLine('|---|---:|---|')
foreach ($cat in ($rows | Group-Object Cat | Sort-Object Name)) {
    [void]$rb.AppendLine("| $($cat.Name) | $($cat.Count) | [查看](SKILLS-INDEX.md) |")
}
[void]$rb.AppendLine('')
[void]$rb.AppendLine('## 怎么用')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('1. 在 [SKILLS-INDEX.md](SKILLS-INDEX.md) 里按关键词找到需要的技能；')
[void]$rb.AppendLine('2. 打开该目录的 `SKILL.md`：`name` / `description`（触发场景）/ 步骤与脚本；')
[void]$rb.AppendLine('3. 目录内可能带 `references/`（资料）、`scripts/`（可执行脚本）、`assets/`（素材）。')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('## 目录约定')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('| 路径 | 含义 |')
[void]$rb.AppendLine('|---|---|')
[void]$rb.AppendLine('| `<skill>/SKILL.md` | 必填：技能入口（frontmatter + 说明） |')
[void]$rb.AppendLine('| `<skill>/references/` | 可选：参考资料 |')
[void]$rb.AppendLine('| `<skill>/scripts/` | 可选：可执行脚本 |')
[void]$rb.AppendLine('| `_meta_template.json` | 发布元数据模板（`ownerId` / `slug` / `version` / `publishedAt`） |')
[void]$rb.AppendLine('| `.disable_to_model_invocation_migration.json` 等 | 技能系统 schema 迁移的一次性标记（勿删） |')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('## 维护：重新生成索引')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('本 README 与 `SKILLS-INDEX.md` 都是**生成**的，不要手改。新增/修改技能后执行：')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('```powershell')
[void]$rb.AppendLine('pwsh -File scripts/fetch-skills-meta.ps1    # 经 gh API 读取所有 SKILL.md 头部 → scripts/skills.json')
[void]$rb.AppendLine('pwsh -File scripts/gen-skills-index.ps1      # 生成根目录 README.md + SKILLS-INDEX.md')
[void]$rb.AppendLine('```')
[void]$rb.AppendLine('')
[void]$rb.AppendLine('前置：GitHub CLI 已登录（`gh auth status`）。脚本只读技能目录、只写上述两个 Markdown 文件。')
[IO.File]::WriteAllText((Join-Path $Out 'README.md'), $rb.ToString(), $utf8)

Write-Host "  生成完成：$($rows.Count) 个技能 / $totalFiles 文件 / 约 $totalMB MB" -ForegroundColor Green
Write-Host "  README.md       = $((Get-Item (Join-Path $Out 'README.md')).Length) B"
Write-Host "  SKILLS-INDEX.md = $((Get-Item (Join-Path $Out 'SKILLS-INDEX.md')).Length) B"
Write-Host "  缺 description  = $noDesc"
