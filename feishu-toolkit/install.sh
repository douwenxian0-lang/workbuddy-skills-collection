#\!/bin/bash
# Feishu Toolkit - One-click skill installer for Claude Code / Cursor
set -e

SKILL_DIR="${HOME}/.claude/skills/feishu-integration"
REPO="https://raw.githubusercontent.com/mix9581/feishu-toolkit/main/skill"

echo "Installing feishu-integration skill..."
mkdir -p "$SKILL_DIR/scripts" "$SKILL_DIR/references"

curl -fsSL "$REPO/SKILL.md"                          -o "$SKILL_DIR/SKILL.md"
curl -fsSL "$REPO/scripts/feishu_toolkit.py"         -o "$SKILL_DIR/scripts/feishu_toolkit.py"
curl -fsSL "$REPO/references/message-formats.md"     -o "$SKILL_DIR/references/message-formats.md"

pip install requests -q

echo ""
echo "Done\! Skill installed to: $SKILL_DIR"
echo ""
echo "Next steps:"
echo "  export FEISHU_APP_ID=\"cli_xxx\""
echo "  export FEISHU_APP_SECRET=\"xxx\""
echo "  python3 $SKILL_DIR/scripts/feishu_toolkit.py auth"

