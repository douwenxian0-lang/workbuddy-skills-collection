#!/bin/bash
# 安装 LaunchAgent，在系统唤醒和登录时检查过期提醒

launch_agent_dir="$HOME/Library/LaunchAgents"
plist_name="com.local-link.remind-me.plist"
plist_path="$launch_agent_dir/$plist_name"

# 已安装则跳过
[ -f "$plist_path" ] && exit 0

# 确保目录存在
mkdir -p "$launch_agent_dir"

# 获取脚本路径
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
wakeup_handler="$script_dir/wakeup_handler.sh"

# 创建 LaunchAgent plist
cat > "$plist_path" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.local-link.remind-me</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$wakeup_handler</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <false/>

    <key>StartOnMount</key>
    <true/>

    <!-- 每分钟检查一次，确保系统唤醒后能及时处理过期提醒 -->
    <key>StartInterval</key>
    <integer>60</integer>

    <key>ThrottleInterval</key>
    <integer>30</integer>

    <key>StandardOutPath</key>
    <string>/tmp/remind-me-skill.log</string>

    <key>StandardErrorPath</key>
    <string>/tmp/remind-me-skill.error.log</string>
</dict>
</plist>
EOF

# 加载 LaunchAgent
launchctl load "$plist_path" 2>/dev/null || launchctl bootstrap gui/$(id -u) "$plist_path" 2>/dev/null || true

echo "LaunchAgent 已安装: $plist_path"