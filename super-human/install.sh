#!/bin/bash
# 全能超人 (Super Human) v2.0 - 安装脚本
# 用法: ./install.sh [target_dir]
# 默认安装到 ~/.workbuddy/skills/

set -e

SKILL_NAME="super-human"
SKILL_VERSION="2.0.0"
DEFAULT_TARGET="$HOME/.workbuddy/skills"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  全能超人 (Super Human) v${SKILL_VERSION} 安装${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查目标目录
if [ -z "$1" ]; then
    TARGET_DIR="$DEFAULT_TARGET"
else
    TARGET_DIR="$1"
fi

echo -e "${YELLOW}[1/4] 检查安装目录...${NC}"
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}目录不存在，正在创建: $TARGET_DIR${NC}"
    mkdir -p "$TARGET_DIR"
fi
echo -e "${GREEN}✓ 安装目录: $TARGET_DIR${NC}"
echo ""

# 检查依赖技能
echo -e "${YELLOW}[2/4] 检查依赖技能...${NC}"
DEPS=("superpowers" "agency" "agency-agents-zh" "design" "memory")
OPTIONAL_DEPS=("bmad-orchestrator" "bmad-product-manager" "bmad-architect" "bmad-developer" "bmad-scrum-master" "bmad-ux-designer")

echo "必需依赖:"
for dep in "${DEPS[@]}"; do
    if [ -d "$TARGET_DIR/$dep" ]; then
        echo -e "${GREEN}  ✓ $dep${NC}"
    else
        echo -e "${RED}  ✗ $dep (未安装)${NC}"
    fi
done

echo ""
echo "可选依赖 (BMAD敏捷开发):"
for dep in "${OPTIONAL_DEPS[@]}"; do
    if [ -d "$TARGET_DIR/$dep" ]; then
        echo -e "${GREEN}  ✓ $dep${NC}"
    else
        echo -e "${YELLOW}  ○ $dep (未安装，BMAD模式不可用)${NC}"
    fi
done
echo ""

# 复制技能文件
echo -e "${YELLOW}[3/4] 安装技能文件...${NC}"
if [ -d "$TARGET_DIR/$SKILL_NAME" ]; then
    echo -e "${YELLOW}警告: 目标目录已存在，是否覆盖? (y/n)${NC}"
    read -r response
    if [ "$response" != "y" ]; then
        echo -e "${RED}安装已取消${NC}"
        exit 1
    fi
    rm -rf "$TARGET_DIR/$SKILL_NAME"
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cp -r "$SCRIPT_DIR" "$TARGET_DIR/$SKILL_NAME"
rm -f "$TARGET_DIR/$SKILL_NAME/install.sh"  # 不复制安装脚本本身

echo -e "${GREEN}✓ 技能文件已复制到: $TARGET_DIR/$SKILL_NAME${NC}"
echo ""

# 验证安装
echo -e "${YELLOW}[4/4] 验证安装...${NC}"
if [ -f "$TARGET_DIR/$SKILL_NAME/SKILL.md" ]; then
    echo -e "${GREEN}✓ SKILL.md 存在${NC}"
else
    echo -e "${RED}✗ SKILL.md 缺失${NC}"
    exit 1
fi

if [ -f "$TARGET_DIR/$SKILL_NAME/README.md" ]; then
    echo -e "${GREEN}✓ README.md 存在${NC}"
else
    echo -e "${YELLOW}○ README.md 缺失（可选）${NC}"
fi

if [ -d "$TARGET_DIR/$SKILL_NAME/references" ]; then
    echo -e "${GREEN}✓ references/ 目录存在${NC}"
else
    echo -e "${YELLOW}○ references/ 目录缺失（可选）${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 安装完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}使用方式:${NC}"
echo "  1. 重启 WorkBuddy"
echo "  2. 输入: /skills 查看是否已加载"
echo "  3. 开始使用触发词，例如:"
echo "     - 「帮我做一个网站」(开发模式)"
echo "     - 「用BMAD方法开发...」(BMAD模式)"
echo "     - 「新客户接入：...」(商业模式)"
echo "     - 「用Apple设计系统做...」(Open Design模式)"
echo ""
echo -e "${GREEN}技能位置: $TARGET_DIR/$SKILL_NAME${NC}"
echo ""
