#!/bin/bash
# 安装 systemd user service，在登录时检查过期提醒 (Linux 版本)

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_dir="$HOME/.config/remind-me-skill"
systemd_dir="$HOME/.config/systemd/user"

# 检查是否支持 systemd
if ! command -v systemctl &> /dev/null; then
  echo "警告：未检测到 systemd，跳过安装 systemd service" >&2
  exit 0
fi

# 已安装则跳过
if [ -f "$systemd_dir/remind-me.timer" ] && systemctl --user is-enabled remind-me.timer &> /dev/null; then
  exit 0
fi

# 确保目录存在
mkdir -p "$systemd_dir"
mkdir -p "$config_dir"

wakeup_handler="$script_dir/wakeup_handler.sh"

# 创建 systemd service 文件
cat > "$systemd_dir/remind-me.service" << EOF
[Unit]
Description=Remind Me Skill Wakeup Handler
After=graphical-session.target

[Service]
Type=oneshot
ExecStart=$wakeup_handler
StandardOutput=journal
StandardError=journal
EOF

# 创建 systemd timer 文件
cat > "$systemd_dir/remind-me.timer" << EOF
[Unit]
Description=Remind Me Skill Timer

[Timer]
OnBootSec=30
OnUnitActiveSec=60
OnActiveSec=30
Unit=remind-me.service

[Install]
WantedBy=default.target
EOF

# 重新加载 systemd 用户配置
systemctl --user daemon-reload

# 启用并启动 timer
systemctl --user enable remind-me.timer
systemctl --user start remind-me.timer

echo "systemd user service 已安装: remind-me.timer"
echo "状态检查: systemctl --user status remind-me.timer"