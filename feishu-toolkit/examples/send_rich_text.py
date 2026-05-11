#!/usr/bin/env python3
"""发送富文本消息示例: @用户 + 超链接 + 图片混排"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from feishu_toolkit import FeishuClient

client = FeishuClient()

# 1. 查用户 open_id（按需替换邮箱）
# uid = client.get_user_id_by_email("zhangsan@company.com")

# 2. 列出群组，选择目标 chat_id
chats = client.list_chats()
for c in chats:
    print(f"  {c['chat_id']}  |  {c.get('name', 'N/A')}")

if not chats:
    print("No chats found.")
    sys.exit(1)

chat_id = chats[0]["chat_id"]
print(f"\nSending to: {chat_id}\n")

result = client.send_rich_text(chat_id, "Feishu Toolkit Demo", [
    [client.text("This is a "), client.text("rich text"), client.text(" message")],
    [client.text("With a link: "), client.link("GitHub", "https://github.com")],
    [client.text("And @all: "), client.at_all()],
])

print(f"Sent! msg_id: {result['data']['message_id']}")
