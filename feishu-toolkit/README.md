# Feishu Toolkit

<p align="center">
  <strong>飞书/Lark 开放平台 Python 工具包</strong><br>
  单文件、零配置，为 AI Agent 和自动化场景而生
</p>

<p align="center">
  <a href="#features">功能</a> ·
  <a href="#quick-start">快速开始</a> ·
  <a href="#usage">使用指南</a> ·
  <a href="#cards">卡片消息</a> ·
  <a href="#wiki">知识库</a> ·
  <a href="#ai-agent">AI Agent 集成</a> ·
  <a href="#api">API 参考</a>
</p>

---

## Why?

飞书官方提供了 [MCP Server](https://www.npmjs.com/package/@larksuiteoapi/lark-mcp) 用于 AI 工具集成，但存在以下限制：

| 场景 | 官方 MCP | 本工具 |
|------|:--------:|:------:|
| 图片上传/发送 | ❌ 不支持 | ✅ |
| 富文本消息（@用户 + 图片 + 链接混排） | ⚠️ 格式复杂易出错 | ✅ Builder API |
| 创建文档并写入结构化内容 | ❌ 缺少 Block API | ✅ |
| 交互卡片消息 | ⚠️ 需手写 JSON | ✅ Builder API |
| 知识库（Wiki）文档创建 | ❌ | ✅ |
| 多维表格 CRUD | ✅ | ✅ |
| 纯文本消息 | ✅ | ✅ |

本项目是对官方 MCP 的**补充**，而非替代。推荐两者配合使用。

<h2 id="features">Features</h2>

- **单文件** - 只需 `feishu_toolkit.py`，复制即用
- **零框架依赖** - 仅依赖 `requests`
- **双模式** - 既是 Python 库，也是 CLI 工具
- **Builder API** - 用链式方法构建富文本、卡片、文档，告别手写 JSON
- **Token 自动管理** - `tenant_access_token` 自动获取、缓存、续期
- **AI Agent 友好** - 内置 Cursor / Claude Code Skill 配置

### 支持的能力

| 类别 | 能力 |
|------|------|
| **消息** | 文本、富文本（@用户/图片/链接/表情）、图片、文件、交互卡片 |
| **图片** | 上传图片、获取 image_key |
| **文件** | IM 文件上传（≤30MB）、Drive 分片上传（无大小限制） |
| **云盘** | 文件夹管理、分片上传、权限设置、分享链接 |
| **文档** | 创建文档、写入 Block（标题/段落/列表/代码块/引用/分割线，自动分批） |
| **知识库** | 列出知识空间、在知识库中创建文档、云文档移入知识库 |
| **多维表格** | 创建表格、批量创建记录、搜索记录 |
| **通讯录** | 邮箱/手机号 → open_id 查询 |
| **群组** | 列出机器人已加入的群组 |

<h2 id="quick-start">Quick Start</h2>

### 安装

```bash
# 方式 1: 一键安装 Skill（推荐，AI Agent 可直接使用）
curl -fsSL https://raw.githubusercontent.com/mix9581/feishu-toolkit/main/install.sh | bash

# 方式 2: 直接下载单文件
curl -O https://raw.githubusercontent.com/mix9581/feishu-toolkit/main/feishu_toolkit.py

# 方式 3: 克隆仓库
git clone https://github.com/mix9581/feishu-toolkit.git

# 安装依赖
pip install requests
```

### 准备工作

1. 前往 [飞书开放平台](https://open.feishu.cn/app) 创建应用（或使用已有应用）
2. 获取 **App ID** 和 **App Secret**
3. 启用**机器人**能力
4. 根据需要添加 API 权限（消息、文档、多维表格、`wiki:wiki` 等）
5. 将机器人添加到目标群组

### 设置凭证

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### 验证连通性

```bash
python feishu_toolkit.py auth
python feishu_toolkit.py list-chats
```

<h2 id="usage">Usage</h2>

### 作为 Python 库

```python
from feishu_toolkit import FeishuClient

client = FeishuClient()  # 从环境变量读取凭证
# 或: client = FeishuClient(app_id="cli_xxx", app_secret="xxx")
```

#### 发送文本消息

```python
client.send_text("oc_xxx", "Hello from Feishu Toolkit!")
```

#### 发送富文本消息（含 @用户）

```python
uid = client.get_user_id_by_email("zhangsan@company.com")

client.send_rich_text("oc_xxx", "周报通知", [
    [client.text("Hi "), client.at(uid, "张三"), client.text(" 本周报告已生成")],
    [client.text("播放量环比增长 23.5%，详情: "), client.link("查看报告", "https://example.com")],
])
```

#### 上传图片并发送

```python
image_key = client.upload_image("./chart.png")
client.send_image("oc_xxx", image_key)
```

#### 上传文件并发送

```python
# 小文件 (≤30MB): IM 直接上传
file_key = client.upload_file("./report.pdf")
client.send_file("oc_xxx", file_key)
```

#### 大文件上传到云盘（Drive 分片上传）

飞书 IM 文件上传限制 30MB，超过需要用 **Drive 分片上传**。本工具封装了完整的 3 步流程：

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  1. prepare  │ →  │ 2. part × N │ →  │  3. finish   │
│  获取 upload │    │  每片 4MB    │    │  返回 token  │
│  _id + 分片数│    │  带 Adler32  │    │              │
└─────────────┘    └─────────────┘    └─────────────┘
```

```python
# 大文件 (>30MB): Drive 分片上传
folder_token = client.get_root_folder_token()
music_folder = client.find_or_create_folder("Music", folder_token)

file_token = client.upload_file_to_drive(
    "./songs.zip",                    # 本地文���路径
    parent_node=music_folder,         # 目标文件夹 token
    on_progress=lambda seq, total: print(f"[{seq}/{total}]"),
)

# 设置分享权限
client.set_drive_public_permission(file_token)
print(f"下载链接: https://feishu.cn/file/{file_token}")
```

**为什么要打包成 zip？**

AI Agent 调用工具时，常见的错误做法是逐个上传文件（比如 20 首歌 → 20 次 IM 上传），导致：
- 每个文件都要单独调用一次 API，效率极低
- IM 上传有 30MB 限制，大文件直接失败
- 群里收到 20 条文件消息，体验很差

正确做法（本工具的 `music-toolkit` 中已实现）：
1. **打包**: 所有文件压缩成 1 个 zip
2. **智能路由**: zip ≤30MB → IM 直接发送；zip >30MB → Drive 分片上传
3. **分享**: 设置组织内可读权限，发送含下载链接的卡片消息

这样无论歌单有多少首歌、文件多大，用户只收到 1 条消息，点击即可下载完整压缩包。

#### 创建飞书文档（云空间）

```python
result = client.create_document_with_content("自动生成的分析报告", [
    client.heading_block("概览", level=1),
    client.text_block("本周各平台数据表现良好，整体播放量环比增长 15%。"),
    client.heading_block("详细数据", level=2),
    client.bullet_block("QQ音乐: 播放量 120万"),
    client.bullet_block("网易云: 播放量 85万"),
    client.divider_block(),
    client.code_block("SELECT song, SUM(plays) FROM metrics GROUP BY 1", language=62),
])
print(f"文档地址: {result['url']}")
```

#### 多维表格操作

```python
client.create_bitable_records(app_token, table_id, [
    {"fields": {"歌曲": "星晴", "播放量": 120000, "平台": "QQ音乐"}},
    {"fields": {"歌曲": "晴天", "播放量": 85000,  "平台": "网易云"}},
])
```

### 作为 CLI 工具

```bash
python feishu_toolkit.py auth
python feishu_toolkit.py list-chats
python feishu_toolkit.py send-text oc_xxx "消息内容"
python feishu_toolkit.py upload-image ./image.png
python feishu_toolkit.py send-image oc_xxx ./image.png
python feishu_toolkit.py get-user-id --email user@company.com
python feishu_toolkit.py create-doc "文档标题"
python feishu_toolkit.py list-wikis
python feishu_toolkit.py create-wiki-doc "文档标题" --space-id <space_id>
```

<h2 id="cards">卡片消息（Card Builder）</h2>

飞书交互卡片支持多种组件，Toolkit 提供了完整的 Builder API，无需手写 JSON。

### 基础卡片

```python
card = client.build_card("告警标题", [
    client.card_markdown("**播放量异常下降**，请及时处理"),
    client.card_divider(),
    client.card_button("查看详情", "https://example.com"),
], color="red")

client.send_card("oc_xxx", card)
```

颜色值：`blue`（默认）、`green`、`red`、`yellow`、`grey`、`orange`、`purple`、`turquoise`、`indigo`

### 带副标题的卡片

```python
card = client.build_card(
    title="数据周报",
    elements=[...],
    subtitle="2024-W12 · 音乐平台数据",
    color="blue",
)
```

### 字段列表（card_fields）

```python
client.card_fields([
    ("**歌曲**: 星晴", True),      # True = 宽格式（独占一行）
    ("**平台**: QQ音乐", True),
    ("**播放量**: 120,000", False), # False = 窄格式（左右两列）
    ("**评论数**: 3,500", False),
])
```

### 图片（card_image）

```python
image_key = client.upload_image("./chart.png")

client.card_image(image_key, alt="播放量趋势图", mode="fit_horizontal")
# mode: "fit_horizontal"（自适应宽度）| "crop_center"（居中裁剪）
```

### 多按钮行（card_action + card_btn）

```python
# 单按钮（旧 API，保持兼容）
client.card_button("查看详情", "https://example.com", button_type="primary")

# 多按钮（新 API，横向排列）
client.card_action(
    client.card_btn("确认",    url=None,                  btn_type="primary"),
    client.card_btn("查看",    url="https://example.com", btn_type="default"),
    client.card_btn("忽略",    url=None,                  btn_type="danger",
                    confirm=("确认忽略?", "此操作不可撤销")),
)
```

`btn_type`：`default` | `primary` | `danger`

`confirm=(title, text)` 点击时弹出确认对话框。

### 多列布局（card_column_set）

```python
client.card_column_set(
    client.card_column([
        client.card_markdown("**左列**\n今日播放量\n`1,234,567`"),
    ], weight=1),
    client.card_column([
        client.card_markdown("**右列**\n环比增长\n`+23.5%`"),
    ], weight=1),
    flex_mode="none",  # "none" | "stretch" | "flow" | "bisect" | "trisect"
)
```

### 备注行（card_note）

```python
client.card_note(
    client.note_img(image_key, alt="logo"),
    client.note_md("数据来源: 内部 BI 平台 · 更新时间: 2024-03-15 10:00"),
)
```

### 完整示例：数据告警卡片

```python
image_key = client.upload_image("./trend_chart.png")

card = client.build_card(
    title="播放量异常告警",
    subtitle="QQ音乐 · 星晴",
    elements=[
        client.card_markdown(
            f"检测到播放量 {client.md_color('显著下降', 'red')}，"
            f"当前值 {client.md_bold('12,345')} 低于基线 45,678"
        ),
        client.card_fields([
            ("**歌曲**: 星晴",          True),
            ("**平台**: QQ音乐",        True),
            ("**当前播放量**: 12,345",  False),
            ("**基线播放量**: 45,678",  False),
            ("**下降幅度**: -73%",      False),
            ("**告警等级**: P1",        False),
        ]),
        client.card_image(image_key, alt="播放量趋势图"),
        client.card_divider(),
        client.card_action(
            client.card_btn("立即处理", url="https://dashboard.example.com", btn_type="primary"),
            client.card_btn("忽略",     btn_type="danger",
                            confirm=("确认忽略?", "将不再收到此告警的通知")),
        ),
        client.card_note(
            client.note_md(f"自动告警 · {client.md_link('查看告警规则', 'https://example.com/rules')}"),
        ),
    ],
    color="red",
)

client.send_card("oc_xxx", card)
```

### Markdown 字符串助手（`md_*`）

卡片 markdown 内容支持 lark_md 语法，Toolkit 提供了一组助手方法：

```python
client.md_bold("加粗文字")          # **加粗文字**
client.md_italic("斜体文字")        # *斜体文字*
client.md_strike("删除线")          # ~~删除线~~
client.md_color("红色文字", "red")  # <font color='red'>红色文字</font>
                                    # 颜色: red/orange/yellow/green/blue/purple/grey/default
client.md_tag("标签", "blue")       # <text_tag color='blue'>标签</text_tag>
client.md_at("ou_xxx")              # <at id=ou_xxx></at>
client.md_at_all()                  # <at id=all></at>
client.md_link("链接文字", "https://example.com")  # [链接文字](https://example.com)
client.md_code_inline("code")       # `code`
client.md_code_block("print('hi')", lang="python")  # ```python\n...\n```
client.md_header("标题", level=1)   # # 标题
client.md_hr()                      # ---
```

<h2 id="wiki">知识库（Wiki）使用指南</h2>

### 快速上手

```python
# 1. 列出有权限的知识空间
spaces = client.list_wiki_spaces()
# => [{"space_id": "7617624023723150526", "name": "团队知识库", "space_type": "team"}]

# 2. 在知识库中创建文档（一步到位）
result = client.create_document_in_wiki(
    space_id="7617624023723150526",
    title="周报: 音乐数据分析",
    blocks=[
        client.heading_block("概览", level=1),
        client.text_block("本周各平台数据表现良好，整体播放量环比增长 15%。"),
        client.bullet_block("QQ音乐: 播放量 120万"),
        client.bullet_block("网易云: 播放量 85万"),
    ],
)
print(result["url"])  # https://feishu.cn/wiki/NL54wnsSFifl16k8EYJc6hoOnlA

# 3. 将已有云文档移入知识库
result = client.move_doc_to_wiki(
    space_id="7617624023723150526",
    obj_token="Hbtxd9SVIo7eWOxbdgbcqX5wnKc",
    obj_type="docx",
)

# 4. 通过 wiki URL 获取文档的实际 obj_token
node = client.get_wiki_node("NL54wnsSFifl16k8EYJc6hoOnlA")
print(node["obj_token"])  # 用于调用文档内容 API
```

### CLI 命令

```bash
# 列出有权限的知识空间，获取 space_id
python feishu_toolkit.py list-wikis

# 在知识库创建文档（挂载为一级节点）
python feishu_toolkit.py create-wiki-doc "周报" --space-id 7617624023723150526

# 挂载到指定父节点下
python feishu_toolkit.py create-wiki-doc "子页面" --space-id 7617624023723150526 --parent wikcnXxx
```

### ⚠️ 常见坑：list-wikis 返回空列表

调用 `list_wiki_spaces()` 返回空，但没有报错——这是**权限配置问题**，不是代码问题。

**根本原因**：飞书知识库有两套独立的权限体系，很多人会搞混：

| 操作入口 | 作用 | 能让 list-wikis 生效？ |
|----------|------|:---------------------:|
| 文档内「**...**」→「管理协作者」→ 添加应用 | 给**单篇文档**授权 | ❌ 不够 |
| 知识库「**齿轮图标 ⚙️**」→「成员设置」→ 添加群 | 给**整个知识空间**授权 | ✅ |

**正确操作步骤**：

1. 在飞书客户端，创建一个群聊，将应用添加为**群机器人**
2. 打开目标知识库，点击左侧底部的 **⚙️ 齿轮图标**（不是文档内的 `...`）
3. 进入「**成员设置**」→「**添加成员**」
4. 搜索**步骤 1 中的群**，将其添加为成员或管理员
5. 同时确认应用在开放平台已申请 `wiki:wiki` 权限并**发布了新版本**

> 💡 文档协作者权限（方式一）和知识空间成员权限（方式二）是完全独立的两套体系，两者都设置才能覆盖所有场景。

<h2 id="ai-agent">AI Agent 集成</h2>

### 一键安装 Skill

```bash
curl -fsSL https://raw.githubusercontent.com/mix9581/feishu-toolkit/main/install.sh | bash
```

安装后重启 Claude Code / Cursor，AI 会自动识别何时使用本工具发送飞书消息或操作知识库。

### 配合 Music Toolkit 使用

[music-toolkit](https://github.com/mix9581/music-toolkit) 使用本工具实现音乐文件推送和歌词文档创建：

```bash
# 安装 music-toolkit
git clone https://github.com/mix9581/music-toolkit.git ~/music-toolkit

# 下载歌单 → 打包发群 → 创建歌词文档（一条命令）
python3 ~/music-toolkit/music_toolkit.py download-playlist 9582035807 qq \
  --send-chat oc_xxx --lyrics-doc
```

music-toolkit 依赖本工具的能力：

| 场景 | 使用的 feishu-toolkit API |
|------|--------------------------|
| 推送歌曲卡片 | `build_card` + `card_fields` + `card_markdown` + `send_card` |
| 发送歌曲文件 | `upload_file` (≤30MB) 或 `upload_file_to_drive` (>30MB) |
| 创建歌词文档 | `create_document_with_content` + `heading_block` + `code_block` |
| 设置分享权限 | `set_drive_public_permission` |

### 配合官方 MCP 使用（推荐）

```json
{
  "mcpServers": {
    "lark-mcp": {
      "command": "npx",
      "args": ["-y", "@larksuiteoapi/lark-mcp", "mcp", "-a", "<app_id>", "-s", "<app_secret>"]
    }
  }
}
```

### 手动安装 Skill

```bash
# Claude Code
cp -r skill/ ~/.claude/skills/feishu-integration/

# Cursor
cp -r skill/ ~/.cursor/skills/feishu-integration/
```

<h2 id="api">API Reference</h2>

### 消息

| 方法 | 说明 |
|------|------|
| `send_text(id, text)` | 发送纯文本消息 |
| `send_rich_text(id, title, content)` | 发送富文本消息（@用户/图片/链接） |
| `send_image(id, image_key)` | 发送图片消息 |
| `send_file(id, file_key)` | 发送文件消息 |
| `send_card(id, card)` | 发送交互卡片 |
| `upload_image(path)` | 上传图片，返回 image_key |
| `upload_file(path, file_type)` | 上传文件（≤30MB），返回 file_key |

### 用户 & 群组

| 方法 | 说明 |
|------|------|
| `get_user_id_by_email(email)` | 邮箱 → open_id |
| `get_user_id_by_mobile(mobile)` | 手机号 → open_id |
| `list_chats()` | 列出已加入的群组 |

### 文档

| 方法 | 说明 |
|------|------|
| `create_document(title)` | 创建空文档 |
| `create_document_with_content(title, blocks)` | 创建文档并写入内容 |
| `add_document_blocks(doc_id, parent_id, blocks)` | 向文档追加 Block |

### 云盘（Drive）

| 方法 | 说明 |
|------|------|
| `get_root_folder_token()` | 获取云盘根目录 token |
| `create_folder(name, parent_node)` | 创建文件夹 |
| `list_folder_children(folder_token)` | 列出文件夹内容 |
| `find_or_create_folder(name, parent)` | 查找或创建子文件夹 |
| `upload_file_to_drive(path, parent, name, on_progress)` | 分片上传（3 步：prepare → part × N → finish） |
| `set_drive_public_permission(token, type, share)` | 设置分享权限 |
| `get_drive_file_url(file_token)` | 构建文件访问 URL |

### 知识库（Wiki）

| 方法 | 说明 |
|------|------|
| `list_wiki_spaces()` | 列出有权限的知识空间 |
| `get_wiki_node(node_token)` | node_token → 节点信息（含 obj_token） |
| `create_document_in_wiki(space_id, title, blocks)` | 在知识库中创建文档（一步到位） |
| `move_doc_to_wiki(space_id, obj_token, obj_type)` | 将云文档移入知识库 |
| `get_wiki_task_result(task_id)` | 查询异步移动任务状态 |

### 多维表格

| 方法 | 说明 |
|------|------|
| `create_bitable(name)` | 创建多维表格 |
| `create_bitable_records(app, table, records)` | 批量创建记录 |
| `search_bitable_records(app, table, filter)` | 搜索记录 |

### 卡片 Builder

| 方法 | 说明 |
|------|------|
| `build_card(title, elements, color, subtitle)` | 构建卡片 JSON |
| `card_markdown(content)` | Markdown 文本块 |
| `card_fields(fields)` | 字段列表（键值对展示） |
| `card_image(image_key, alt, mode)` | 图片块 |
| `card_button(text, url, button_type)` | 单按钮（兼容旧接口） |
| `card_action(*buttons)` | 多按钮横向排列 |
| `card_btn(text, url, btn_type, value, confirm)` | 构建单个按钮（供 card_action 使用） |
| `card_column_set(*columns, flex_mode)` | 多列布局容器 |
| `card_column(elements, width, weight)` | 列（供 card_column_set 使用） |
| `card_note(*elements)` | 备注行 |
| `note_md(content)` | 备注中的 Markdown 元素 |
| `note_img(image_key, alt)` | 备注中的图片元素 |
| `card_divider()` | 分割线 |

### Markdown 助手（`md_*`）

| 方法 | 输出示例 |
|------|----------|
| `md_bold(text)` | `**text**` |
| `md_italic(text)` | `*text*` |
| `md_strike(text)` | `~~text~~` |
| `md_color(text, color)` | `<font color='red'>text</font>` |
| `md_tag(text, color)` | `<text_tag color='blue'>text</text_tag>` |
| `md_at(user_id)` | `<at id=ou_xxx></at>` |
| `md_at_all()` | `<at id=all></at>` |
| `md_link(text, url)` | `[text](url)` |
| `md_code_inline(code)` | `` `code` `` |
| `md_code_block(code, lang)` | ` ```python\n...\n``` ` |
| `md_header(text, level)` | `# text` |
| `md_hr()` | `---` |

## 环境要求

- Python >= 3.9
- requests

## License

[MIT](LICENSE)
