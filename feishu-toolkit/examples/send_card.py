#!/usr/bin/env python3
"""发送交互卡片消息示例"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from feishu_toolkit import FeishuClient

client = FeishuClient()

chats = client.list_chats()
if not chats:
    print("No chats found.")
    sys.exit(1)

chat_id = chats[0]["chat_id"]

card = client.build_card("Weekly Report", [
    client.card_markdown("**Key Metrics Overview**\nAll platforms performing well."),
    client.card_fields([
        ("**Platform A**\n120K plays", True),
        ("**Platform B**\n85K plays", True),
        ("**Platform C**\n200K plays", True),
        ("**Total**\n405K plays", True),
    ]),
    client.card_divider(),
    client.card_markdown("_Updated: 2026-03-13_"),
    client.card_button("View Dashboard", "https://github.com"),
], color="turquoise")

result = client.send_card(chat_id, card)
print(f"Card sent! msg_id: {result['data']['message_id']}")
