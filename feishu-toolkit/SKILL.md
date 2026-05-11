---
name: feishu-integration
description: >
  飞书/Lark 开放平台集成工具包，补齐官方 lark-mcp 无法覆盖的能力。
  提供图片上传、富文本消息构建（含@用户/图片/超链接）、飞书文档创建与内容写入、
  交互卡片消息、多维表格操作、通讯录查询等功能。
  Use when: 需要发送飞书消息（特别是富文本/图片/卡片）、创建飞书文档、
  操作多维表格、上传图片到飞书、通过邮箱/手机号查找用户 open_id、
  或新项目需要接入飞书开放平台时使用此 skill。
---

# Feishu Integration Toolkit

补齐官方 `@larksuiteoapi/lark-mcp` 无法处理的场景，同时提供飞书 API 领域知识。

## 与官方 MCP 的分工

| 场景 | 推荐方式 |
|------|----------|
| 多维表格 CRUD、普通文本消息、搜索文档 | **官方 MCP** (已覆盖) |
| 上传图片、发送图片消息 | **本 Skill 脚本** (MCP 不支持文件上传) |
| 富文本消息（含 @用户、图片、链接混排） | **本 Skill 脚本** (MCP 格式易出错) |
| 创建文档并写入结构化内容 | **本 Skill 脚本** (MCP 缺少 Block 创建接口) |
| 交互卡片消息 | **本 Skill 脚本** (提供 builder 简化构建) |

## 环境准备

```bash
pip install requests
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
python scripts/feishu_toolkit.py auth
```

## 核心用法

### 1. 发送富文本消息（含 @用户）

```python
from feishu_toolkit import FeishuClient

client = FeishuClient()
uid = client.get_user_id_by_email("zhangsan@company.com")

client.send_rich_text("oc_xxx", "分析报告", [
    [client.text("以下是本周数据分析，请 "), client.at(uid, "张三"), client.text(" 查收")],
    [client.text("播放量环比增长 "), client.text("23.5%"), client.text("，详情见: "), client.link("完整报告", "https://example.com/report")],
    [client.img("img_v3_xxx")],
])
```

### 2. 上传图片并发送

```python
image_key = client.upload_image("/path/to/chart.png")
client.send_image("oc_xxx", image_key)
```

### 3. 发送交互卡片

```python
card = client.build_card("数据告警", [
    client.card_markdown("**播放量异常下降**"),
    client.card_fields([
        ("**歌曲**: 星晴", True),
        ("**平台**: QQ音乐", True),
        ("**当前值**: 12,345", True),
        ("**基线值**: 45,678", True),
    ]),
    client.card_divider(),
    client.card_button("查看详情", "https://dashboard.example.com/song/123"),
], color="red")

client.send_card("oc_xxx", card)
```

### 4. 创建飞书文档并写入内容

```python
result = client.create_document_with_content("周报: 音乐数据分析", [
    client.heading_block("概览", level=1),
    client.text_block("本周各平台数据表现良好，整体播放量环比增长 15%。"),
    client.heading_block("各平台详情", level=2),
    client.bullet_block("QQ音乐: 播放量 120万，评论 3500"),
    client.bullet_block("网易云: 播放量 85万，评论 2100"),
    client.bullet_block("抖音: 播放量 200万，点赞 1.2万"),
    client.divider_block(),
    client.heading_block("关键代码", level=2),
    client.code_block("SELECT song_name, SUM(play_count) FROM metrics GROUP BY 1", language=62),
])
print(f"文档地址: {result['url']}")
```

## music-toolkit 联动说明

**当 AI 需要把音乐数据发送到飞书群时，应使用 music-toolkit 的内置推送命令，而不是直接调用本 feishu-toolkit。**

### 调用链

```
music_toolkit.py  push-playlist-detail / push-song / push-search / download-playlist
        ↓  (FeishuPusher 动态导入)
feishu_toolkit.FeishuClient  ← 你现在看的这个文件
        ↓
飞书 Open API
```

### 典型场景

| 用户请求 | 正确做法 |
|---------|---------|
| 把汽水歌单数据推送到飞书 | `cd music-toolkit && python music_toolkit.py push-playlist-detail "<url>" --sort likes` |
| 下载歌单并发文件到群 | `python music_toolkit.py download-playlist <id> <source> --send-chat oc_xxx` |
| 搜索歌曲并推送卡片 | `python music_toolkit.py push-search "晴天"` |
| 把音乐数据以卡片发到群 | 先用 music-toolkit 的 push-* 命令，它内部会自动调用 feishu-toolkit |

### 直接使用 feishu-toolkit 的场景

以下场景直接使用本 feishu-toolkit，不需要经过 music-toolkit：
- 发送图片、富文本消息（含 @用户）
- 创建飞书文档（非音乐类内容）
- 操作多维表格
- 通讯录查询

### feishu-toolkit 安装位置

music-toolkit 默认在以下路径寻找 feishu-toolkit（按优先级）：
1. 环境变量 `FEISHU_TOOLKIT_PATH`
2. `../feishu-toolkit/`（同级目录，推荐）
3. `~/claude-workspaces/feishu-toolkit/`

## 详细参考

- 完整消息格式: [references/message-formats.md](references/message-formats.md)
- 飞书开放平台文档: https://open.feishu.cn/document
- 官方 MCP: https://www.npmjs.com/package/@larksuiteoapi/lark-mcp
