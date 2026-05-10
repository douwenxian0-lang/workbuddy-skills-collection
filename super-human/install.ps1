# 全能超人 (Super Human) v2.0 - Windows 安装脚本
# 用法: .\install.ps1 [target_dir]
# 默认安装到 $HOME\.workbuddy\skills\

$SKILL_NAME = "super-human"
$SKILL_VERSION = "2.0.0"
$DEFAULT_TARGET = "$HOME\.workbuddy\skills"

Write-Host "========================================" -ForegroundColor Green
Write-Host "  全能超人 (Super Human) v$SKILL_VERSION 安装" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查目标目录
if ($args.Count -eq 0) {
    $TARGET_DIR = $DEFAULT_TARGET
} else {
    $TARGET_DIR = $args[0]
}

Write-Host "[1/4] 检查安装目录..." -ForegroundColor Yellow
if (-not (Test-Path $TARGET_DIR)) {
    Write-Host "目录不存在，正在创建: $TARGET_DIR" -ForegroundColor Red
    New-Item -ItemType Directory -Path $TARGET_DIR -Force | Out-Null
}
Write-Host "✓ 安装目录: $TARGET_DIR" -ForegroundColor Green
Write-Host ""

# 检查依赖技能
Write-Host "[2/4] 检查依赖技能..." -ForegroundColor Yellow
$DEPS = @("superpowers", "agency", "agency-agents-zh", "design", "memory")
$OPTIONAL_DEPS = @("bmad-orchestrator", "bmad-product-manager", "bmad-architect", "bmad-developer", "bmad-scrum-master", "bmad-ux-designer")

Write-Host "必需依赖:"
foreach ($dep in $DEPS) {
    if (Test-Path "$TARGET_DIR\$dep") {
        Write-Host "  ✓ $dep" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $dep (未安装)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "可选依赖 (BMAD敏捷开发):"
foreach ($dep in $OPTIONAL_DEPS) {
    if (Test-Path "$TARGET_DIR\$dep") {
        Write-Host "  ✓ $dep" -ForegroundColor Green
    } else {
        Write-Host "  ○ $dep (未安装，BMAD模式不可用)" -ForegroundColor Yellow
    }
}
Write-Host ""

# 复制技能文件
Write-Host "[3/4] 安装技能文件..." -ForegroundColor Yellow
if (Test-Path "$TARGET_DIR\$SKILL_NAME") {
    Write-Host "警告: 目标目录已存在，是否覆盖? (y/n)" -ForegroundColor Yellow
    $response = Read-Host
    if ($response -ne "y") {
        Write-Host "安装已取消" -ForegroundColor Red
        exit 1
    }
    Remove-Item -Recurse -Force "$TARGET_DIR\$SKILL_NAME"
}

# 获取脚本所在目录
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item -Recurse "$SCRIPT_DIR" "$TARGET_DIR\$SKILL_NAME"
Remove-Item -Recurse -Force "$TARGET_DIR\$SKILL_NAME\install.ps1" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$TARGET_DIR\$SKILL_NAME\install.sh" -ErrorAction SilentlyContinue

Write-Host "✓ 技能文件已复制到: $TARGET_DIR\$SKILL_NAME" -ForegroundColor Green
Write-Host ""

# 验证安装
Write-Host "[4/4] 验证安装..." -ForegroundColor Yellow
if (Test-Path "$TARGET_DIR\$SKILL_NAME\SKILL.md") {
    Write-Host "✓ SKILL.md 存在" -ForegroundColor Green
} else {
    Write-Host "✗ SKILL.md 缺失" -ForegroundColor Red
    exit 1
}

if (Test-Path "$TARGET_DIR\$SKILL_NAME\README.md") {
    Write-Host "✓ README.md 存在" -ForegroundColor Green
} else {
    Write-Host "○ README.md 缺失（可选）" -ForegroundColor Yellow
}

if (Test-Path "$TARGET_DIR\$SKILL_NAME\references") {
    Write-Host "✓ references/ 目录存在" -ForegroundColor Green
} else {
    Write-Host "○ references/ 目录缺失（可选）" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ 安装完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "使用方式:" -ForegroundColor Yellow
Write-Host "  1. 重启 WorkBuddy"
Write-Host "  2. 输入: /skills 查看是否已加载"
Write-Host "  3. 开始使用触发词，例如:"
Write-Host "     - 「帮你做一个网站」(开发模式)"
Write-Host "     - 「用BMAD方法开发...」(BMAD模式)"
Write-Host "     - 「新客户接入：...」(商业模式)"
Write-Host "     - 「用Apple设计系统做...」(Open Design模式)"
Write-Host ""
Write-Host "技能位置: $TARGET_DIR\$SKILL_NAME" -ForegroundColor Green
Write-Host ""
