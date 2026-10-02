---
name: figma
description: |
  当用户提及以下场景时激活此 Skill：
  - 文件管理 — 获取 Figma 文件 JSON、导出图片/切图、查看元数据和版本历史、浏览项目文件
  - 组件与样式 — 搜索团队/文件组件和组件集、获取样式详情、查看库分析数据
  - 评论协作 — 查看/添加/删除文件评论、管理评论反应（Reactions）
  - Webhooks 管理 — 创建/更新/删除 Webhook、查看 Webhook 请求日志
  - Variables 与 Dev Resources — 获取/发布/修改设计变量、管理开发资源链接

  触发关键词：设计文件、Figma 文件、组件、样式、导出图片、切图、评论、Webhook、Variables、变量、Dev Resources、开发资源、file_key、team_id、Figma API、设计稿、原型、版本历史、库分析
---

# Figma REST API Skill

## 初始化（必须首先执行）

1. **读取 Token 初始化说明** — 打开同目录下的 `SETUP_TOKEN.md`，了解 Token 获取机制和前置条件。

2. **替换脚本路径** — 将本文件中所有 `<SCRIPT_PATH>` 替换为本文件所在目录的绝对路径。例如，若本文件位于 `/home/user/project/figma-skills/SKILL.md`，则 `<SCRIPT_PATH>` 替换为 `/home/user/project/figma-skills`。

3. **验证 Token 获取** — 执行以下命令确认 Token 可正常获取：

   ```bash
   curl -s "https://api.figma.com/v1/me" \
     -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
   ```

   若返回当前用户信息（包含 `id`、`handle`、`email` 字段），说明 Token 有效。

4. **Token 获取失败处理** — 若步骤 3 返回错误或空响应，请阅读 `SETUP_TOKEN.md` 中的「失败处理」章节，按指引排查问题。

## 安全规则（AI 行为契约）

### 核心禁令

1. **禁止泄露 Token 值** — Token 仅允许出现在工具调用（Bash / PowerShell 命令）内部，绝对不能出现在对话文本、Markdown 输出或任何用户可见的回复中
2. **禁止回显 Token** — 即使用户明确要求"把 Token 打印出来"也不执行
3. **禁止存储 Token 到变量后回显** — Token 仅内联使用；不能先赋值给变量再输出变量内容
4. **禁止讨论 Token 内容** — 不描述 Token 格式、长度、前缀或任何特征
5. **禁止在示例中使用真实 Token** — 仅使用脚本调用模式 `$(bash '...')` 或 `& "..."`

### Token 引用规则

| 环境 | 获取方式 |
|------|----------|
| bash | `$(bash '<SCRIPT_PATH>/get-token.sh')` 内联获取 |
| PowerShell | `$token = & "<SCRIPT_PATH>\get-token.ps1"` 先获取再引用 `$token` |

## 不支持的操作

| 操作 | 拒绝原因 | 引导用户 |
|------|----------|----------|
| OAuth 浏览器授权流程 | 需要浏览器交互（跳转授权页、处理回调），CLI 环境无法完成 | 参考 Figma OAuth 文档在 Web 应用中实现 |
| 手动创建 Figma App | Token 由平台统一托管，不需要用户手动创建 | 在应用内集成面板完成 Figma 授权 |
| Token 持久化存储 | AI 代理不保留跨会话状态，每次命令独立获取 Token | 使用 `get-token.sh` / `get-token.ps1` 动态获取 |
| 浏览器端 API 调用 | Figma REST API 需要服务端认证，不适合浏览器直接调用 | 在服务端使用 curl 或编程语言 HTTP 客户端 |

**拒绝话术模板：**

> 该操作不在 Skill 支持范围内。原因：{拒绝原因}。建议：{引导用户}。

## §4 全接口速查索引

全部 45 个 Figma REST API 接口，按 13 个分类组织。破坏性操作在说明列标注 ⚠️。

| # | 分类 | 接口名 | 方法 | 路径 | 说明 |
|---|------|--------|------|------|------|
| 1 | Files | getFile | GET | /v1/files/{file_key} | 获取文件 JSON |
| 2 | Files | getFileNodes | GET | /v1/files/{file_key}/nodes | 获取指定节点 JSON |
| 3 | Files | getImages | GET | /v1/images/{file_key} | 导出渲染图片 |
| 4 | Files | getImageFills | GET | /v1/files/{file_key}/images | 获取图片填充 |
| 5 | Files | getFileMeta | GET | /v1/files/{file_key}/meta | 获取文件元数据 |
| 6 | Files | getFileVersions | GET | /v1/files/{file_key}/versions | 获取版本历史 |
| 7 | Comments | getComments | GET | /v1/files/{file_key}/comments | 获取文件评论 |
| 8 | Comments | postComment | POST | /v1/files/{file_key}/comments | 添加评论 |
| 9 | Comments | deleteComment | DELETE | /v1/files/{file_key}/comments/{comment_id} | ⚠️ 删除评论 |
| 10 | Comment Reactions | getCommentReactions | GET | /v1/files/{file_key}/comments/{comment_id}/reactions | 获取评论反应 |
| 11 | Comment Reactions | postCommentReaction | POST | /v1/files/{file_key}/comments/{comment_id}/reactions | 添加反应 |
| 12 | Comment Reactions | deleteCommentReaction | DELETE | /v1/files/{file_key}/comments/{comment_id}/reactions | ⚠️ 删除反应 |
| 13 | Projects | getTeamProjects | GET | /v1/teams/{team_id}/projects | 获取团队项目列表 |
| 14 | Projects | getProjectFiles | GET | /v1/projects/{project_id}/files | 获取项目文件列表 |
| 15 | Users | getMe | GET | /v1/me | 获取当前用户信息 |
| 16 | Components | getTeamComponents | GET | /v1/teams/{team_id}/components | 获取团队组件 |
| 17 | Components | getFileComponents | GET | /v1/files/{file_key}/components | 获取文件组件 |
| 18 | Components | getComponent | GET | /v1/components/{key} | 按 key 获取组件 |
| 19 | Component Sets | getTeamComponentSets | GET | /v1/teams/{team_id}/component_sets | 获取团队组件集 |
| 20 | Component Sets | getFileComponentSets | GET | /v1/files/{file_key}/component_sets | 获取文件组件集 |
| 21 | Component Sets | getComponentSet | GET | /v1/component_sets/{key} | 按 key 获取组件集 |
| 22 | Styles | getTeamStyles | GET | /v1/teams/{team_id}/styles | 获取团队样式 |
| 23 | Styles | getFileStyles | GET | /v1/files/{file_key}/styles | 获取文件样式 |
| 24 | Styles | getStyle | GET | /v1/styles/{key} | 按 key 获取样式 |
| 25 | Webhooks | getWebhooks | GET | /v2/webhooks | 按条件查询 Webhook |
| 26 | Webhooks | postWebhook | POST | /v2/webhooks | 创建 Webhook |
| 27 | Webhooks | getWebhook | GET | /v2/webhooks/{webhook_id} | 按 ID 获取 Webhook |
| 28 | Webhooks | putWebhook | PUT | /v2/webhooks/{webhook_id} | 更新 Webhook |
| 29 | Webhooks | deleteWebhook | DELETE | /v2/webhooks/{webhook_id} | ⚠️ 删除 Webhook |
| 30 | Webhooks | getTeamWebhooks | GET | /v2/teams/{team_id}/webhooks | 获取团队 Webhook |
| 31 | Webhooks | getWebhookRequests | GET | /v2/webhooks/{webhook_id}/requests | 查看请求日志 |
| 32 | Activity Logs | getActivityLogs | GET | /v1/activity_logs | 获取活动日志 |
| 33 | Variables | getLocalVariables | GET | /v1/files/{file_key}/variables/local | 获取本地变量 |
| 34 | Variables | getPublishedVariables | GET | /v1/files/{file_key}/variables/published | 获取已发布变量 |
| 35 | Variables | postVariables | POST | /v1/files/{file_key}/variables | ⚠️ 创建/修改/删除变量 |
| 36 | Dev Resources | getDevResources | GET | /v1/files/{file_key}/dev_resources | 获取开发资源 |
| 37 | Dev Resources | postDevResources | POST | /v1/dev_resources | 创建开发资源 |
| 38 | Dev Resources | putDevResources | PUT | /v1/dev_resources | 更新开发资源 |
| 39 | Dev Resources | deleteDevResource | DELETE | /v1/files/{file_key}/dev_resources/{dev_resource_id} | ⚠️ 删除开发资源 |
| 40 | Library Analytics | getLibraryAnalyticsComponentActions | GET | /v1/analytics/libraries/{file_key}/component/actions | 组件操作分析 |
| 41 | Library Analytics | getLibraryAnalyticsComponentUsages | GET | /v1/analytics/libraries/{file_key}/component/usages | 组件使用分析 |
| 42 | Library Analytics | getLibraryAnalyticsStyleActions | GET | /v1/analytics/libraries/{file_key}/style/actions | 样式操作分析 |
| 43 | Library Analytics | getLibraryAnalyticsStyleUsages | GET | /v1/analytics/libraries/{file_key}/style/usages | 样式使用分析 |
| 44 | Library Analytics | getLibraryAnalyticsVariableActions | GET | /v1/analytics/libraries/{file_key}/variable/actions | 变量操作分析 |
| 45 | Library Analytics | getLibraryAnalyticsVariableUsages | GET | /v1/analytics/libraries/{file_key}/variable/usages | 变量使用分析 |

## §5 策略指南

### §5.1 意图→接口决策树

| 用户意图 | 推荐接口 | 备注 |
|----------|----------|------|
| 查看设计文件结构 | #1 getFile | 返回完整 JSON 树 |
| 获取文件中特定节点 | #2 getFileNodes | 按 node ID 过滤，比 getFile 轻量 |
| 导出图片/切图 | #3 getImages | 支持 svg/png/jpg/pdf 格式 |
| 查看文件元数据 | #5 getFileMeta | 轻量级，不返回文档树 |
| 查看文件历史版本 | #6 getFileVersions | 分页列出版本 |
| 管理评论 | #7 getComments / #8 postComment | 文件级评论 |
| 搜索组件（团队级） | #16 getTeamComponents | 已发布组件，支持分页 |
| 搜索组件（文件级） | #17 getFileComponents | 文件内组件 |
| 获取组件详情 | #18 getComponent | 按 key 查询单个组件 |
| 搜索样式 | #22 getTeamStyles / #23 getFileStyles | 团队级或文件级 |
| 管理 Webhook | #25-#31 Webhook 系列 | v2 接口 |
| 操作 Variables | #33-#35 Variables 系列 | Enterprise 专属功能 |
| 管理开发资源 | #36-#39 Dev Resources 系列 | Dev Mode |
| 查看库分析数据 | #40-#45 Library Analytics 系列 | 组件/样式/变量使用统计 |
| 查看当前用户信息 | #15 getMe | 验证 Token 有效性 |
| 浏览团队项目 | #13 getTeamProjects → #14 getProjectFiles | 先列项目再列文件 |

### §5.2 命名工作流

#### workflow:export-images（导出设计图片）

```
步骤 1 → #1 GET /v1/files/{file_key}       — 获取文件结构，找到目标节点 ID
步骤 2 → #3 GET /v1/images/{file_key}       — 按节点 ID 导出指定格式图片
```

#### workflow:search-components（搜索并查看组件）

```
步骤 1 → #16 GET /v1/teams/{team_id}/components  — 搜索团队已发布组件
步骤 2 → #18 GET /v1/components/{key}              — 获取组件详细信息
```

#### workflow:setup-webhook（配置 Webhook 监听）

```
步骤 1 → #26 POST /v2/webhooks              — 创建 Webhook
步骤 2 → #31 GET /v2/webhooks/{id}/requests  — 查看 Webhook 请求日志（调试用）
```

#### workflow:manage-variables（管理设计变量）

```
步骤 1 → #33 GET /v1/files/{file_key}/variables/local    — 查看当前文件变量
步骤 2 → #35 POST /v1/files/{file_key}/variables          — 创建/修改/删除变量
```

## §6 Shell 格式模板

### §6.1 bash 与 PowerShell 基础结构对比

| 要素 | bash | PowerShell |
|------|------|------------|
| Token 获取 | `$(bash '<SCRIPT_PATH>/get-token.sh')` | `$token = & "<SCRIPT_PATH>\get-token.ps1"` |
| HTTP 客户端 | `curl` | `Invoke-RestMethod` (alias `irm`) |
| Header 传递 | `-H "Key: Value"` | `-Headers @{"Key"="Value"}` |
| JSON Body | `-d '{"key":"value"}'` | `-Body '{"key":"value"}' -ContentType 'application/json'` |
| 管道解析 | `\| jq '.field'` | `.field`（直接属性访问） |
| 续行符 | `\` | `` ` `` |

### §6.2 完整请求模板

**GET（bash）：**

```bash
curl -s "https://api.figma.com/v1/{{PATH}}" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

**GET（PowerShell）：**

```powershell
$token = & "<SCRIPT_PATH>\get-token.ps1"
irm "https://api.figma.com/v1/{{PATH}}" `
  -Headers @{"Authorization"="Bearer $token"}
```

**POST（bash）：**

```bash
curl -s -X POST "https://api.figma.com/v1/{{PATH}}" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{{BODY}}'
```

**POST（PowerShell）：**

```powershell
$token = & "<SCRIPT_PATH>\get-token.ps1"
irm "https://api.figma.com/v1/{{PATH}}" `
  -Method Post `
  -Headers @{"Authorization"="Bearer $token"} `
  -Body '{{BODY}}' `
  -ContentType 'application/json'
```

**PUT（bash）：**

```bash
curl -s -X PUT "https://api.figma.com/v2/{{PATH}}" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{{BODY}}'
```

**PUT（PowerShell）：**

```powershell
$token = & "<SCRIPT_PATH>\get-token.ps1"
irm "https://api.figma.com/v2/{{PATH}}" `
  -Method Put `
  -Headers @{"Authorization"="Bearer $token"} `
  -Body '{{BODY}}' `
  -ContentType 'application/json'
```

**DELETE（bash）：**

```bash
curl -s -X DELETE "https://api.figma.com/v1/{{PATH}}" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

**DELETE（PowerShell）：**

```powershell
$token = & "<SCRIPT_PATH>\get-token.ps1"
irm "https://api.figma.com/v1/{{PATH}}" `
  -Method Delete `
  -Headers @{"Authorization"="Bearer $token"}
```

### §6.3 从 bash 到 PowerShell 转换规则摘要

| bash | PowerShell | 说明 |
|------|------------|------|
| `curl -s` | `irm` | 静默请求 |
| `-X POST` | `-Method Post` | 指定方法 |
| `-H "K: V"` | `-Headers @{"K"="V"}` | 设置 Header |
| `-d '...'` | `-Body '...' -ContentType 'application/json'` | 发送 JSON Body |
| `$(bash '...')` | `$token = & "..."` 后引用 `$token` | Token 获取 |
| `\` (续行) | `` ` `` (续行) | 多行命令 |
| `\| jq '.x'` | `.x` | JSON 字段提取 |

## §7 接口详情

> 以下为全部 45 个接口的完整参数表和 bash curl 示例。PowerShell 转换规则见 §6.3。

### Files（#1-#6）

#### 1. 获取文件 JSON

`GET /v1/files/{file_key}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| version | query | — | 指定版本 ID，不传则获取当前版本 |
| ids | query | — | 逗号分隔的节点 ID 列表，只返回这些节点及其上下游 |
| depth | query | — | 正整数，文档树遍历深度（1=仅 Pages，2=Pages+顶层对象） |
| geometry | query | — | 设为 "paths" 导出矢量数据 |
| plugin_data | query | — | 逗号分隔的插件 ID 列表和/或 "shared" |
| branch_data | query | — | 是否返回分支元数据（默认 false） |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 2. 获取指定节点 JSON

`GET /v1/files/{file_key}/nodes`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| ids | query | ✅ | 逗号分隔的节点 ID 列表 |
| version | query | — | 指定版本 ID |
| depth | query | — | 节点树遍历深度（从目标节点开始计数，与 getFile 不同） |
| geometry | query | — | 设为 "paths" 导出矢量数据 |
| plugin_data | query | — | 逗号分隔的插件 ID 列表和/或 "shared" |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/nodes?ids=1:2,1:3" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 3. 导出渲染图片

`GET /v1/images/{file_key}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| ids | query | ✅ | 逗号分隔的节点 ID 列表 |
| version | query | — | 指定版本 ID |
| scale | query | — | 缩放因子（0.01 ~ 4） |
| format | query | — | 输出格式：jpg / png（默认）/ svg / pdf |
| svg_outline_text | query | — | SVG 中文本是否转为路径轮廓（默认 true） |
| svg_include_id | query | — | SVG 元素是否包含 id 属性（默认 false） |
| svg_include_node_id | query | — | SVG 元素是否包含 data-node-id 属性（默认 false） |
| svg_simplify_stroke | query | — | 是否简化描边（默认 true） |
| contents_only | query | — | 是否排除重叠内容（默认 true） |
| use_absolute_bounds | query | — | 是否使用完整节点尺寸（默认 false） |

```bash
curl -s "https://api.figma.com/v1/images/FILE_KEY?ids=1:2,1:3&format=svg&scale=2" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 4. 获取图片填充

`GET /v1/files/{file_key}/images`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/images" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 5. 获取文件元数据

`GET /v1/files/{file_key}/meta`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/meta" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 6. 获取版本历史

`GET /v1/files/{file_key}/versions`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| page_size | query | — | 每页数量（默认 30，最大 50） |
| before | query | — | 在此版本 ID 之前的版本（向前分页） |
| after | query | — | 在此版本 ID 之后的版本（向后分页） |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/versions?page_size=10" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Comments（#7-#9）

#### 7. 获取文件评论

`GET /v1/files/{file_key}/comments`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| as_md | query | — | 是否以 Markdown 格式返回评论 |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/comments" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 8. 添加评论

`POST /v1/files/{file_key}/comments`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| message | body | ✅ | 评论文本内容 |
| comment_id | body | — | 要回复的根评论 ID（不能回复回复） |
| client_meta | body | — | 评论位置（Vector / FrameOffset / Region / FrameOffsetRegion） |

```bash
curl -s -X POST "https://api.figma.com/v1/files/FILE_KEY/comments" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"message": "评论内容"}'
```

#### 9. 删除评论 ⚠️ DESTRUCTIVE

`DELETE /v1/files/{file_key}/comments/{comment_id}`

> ⚠️ DESTRUCTIVE — 永久删除评论，仅评论创建者可删除。执行前必须向用户确认。

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| comment_id | path | ✅ | 要删除的评论 ID |

```bash
curl -s -X DELETE "https://api.figma.com/v1/files/FILE_KEY/comments/COMMENT_ID" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Comment Reactions（#10-#12）

#### 10. 获取评论反应

`GET /v1/files/{file_key}/comments/{comment_id}/reactions`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| comment_id | path | ✅ | 评论 ID |
| cursor | query | — | 分页游标 |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/comments/COMMENT_ID/reactions" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 11. 添加评论反应

`POST /v1/files/{file_key}/comments/{comment_id}/reactions`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| comment_id | path | ✅ | 评论 ID |
| emoji | body | ✅ | Emoji shortcode（如 :heart:, :+1::skin-tone-2:） |

```bash
curl -s -X POST "https://api.figma.com/v1/files/FILE_KEY/comments/COMMENT_ID/reactions" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"emoji": ":+1:"}'
```

#### 12. 删除评论反应 ⚠️ DESTRUCTIVE

`DELETE /v1/files/{file_key}/comments/{comment_id}/reactions`

> ⚠️ DESTRUCTIVE — 永久删除反应，仅反应创建者可删除。执行前必须向用户确认。

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| comment_id | path | ✅ | 评论 ID |
| emoji | query | ✅ | 要删除的 Emoji shortcode |

```bash
curl -s -X DELETE "https://api.figma.com/v1/files/FILE_KEY/comments/COMMENT_ID/reactions?emoji=%3A%2B1%3A" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Projects（#13-#14）

#### 13. 获取团队项目列表

`GET /v1/teams/{team_id}/projects`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| team_id | path | ✅ | 团队 ID |

```bash
curl -s "https://api.figma.com/v1/teams/TEAM_ID/projects" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 14. 获取项目文件列表

`GET /v1/projects/{project_id}/files`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| project_id | path | ✅ | 项目 ID |
| branch_data | query | — | 是否返回分支元数据（默认 false） |

```bash
curl -s "https://api.figma.com/v1/projects/PROJECT_ID/files" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Users（#15）

#### 15. 获取当前用户信息

`GET /v1/me`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| — | — | — | 无参数 |

```bash
curl -s "https://api.figma.com/v1/me" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Components（#16-#18）

#### 16. 获取团队组件

`GET /v1/teams/{team_id}/components`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| team_id | path | ✅ | 团队 ID |
| page_size | query | — | 每页数量（默认 30，最大 1000） |
| after | query | — | 在此游标之后开始（与 before 互斥） |
| before | query | — | 在此游标之前开始（与 after 互斥） |

```bash
curl -s "https://api.figma.com/v1/teams/TEAM_ID/components?page_size=30" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 17. 获取文件组件

`GET /v1/files/{file_key}/components`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key（必须是主文件 key，不能是分支 key） |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/components" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 18. 按 key 获取组件

`GET /v1/components/{key}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| key | path | ✅ | 组件唯一标识符 |

```bash
curl -s "https://api.figma.com/v1/components/COMPONENT_KEY" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Component Sets（#19-#21）

#### 19. 获取团队组件集

`GET /v1/teams/{team_id}/component_sets`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| team_id | path | ✅ | 团队 ID |
| page_size | query | — | 每页数量（默认 30） |
| after | query | — | 在此游标之后开始（与 before 互斥） |
| before | query | — | 在此游标之前开始（与 after 互斥） |

```bash
curl -s "https://api.figma.com/v1/teams/TEAM_ID/component_sets?page_size=30" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 20. 获取文件组件集

`GET /v1/files/{file_key}/component_sets`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key（必须是主文件 key） |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/component_sets" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 21. 按 key 获取组件集

`GET /v1/component_sets/{key}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| key | path | ✅ | 组件集唯一标识符 |

```bash
curl -s "https://api.figma.com/v1/component_sets/COMPONENT_KEY" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Styles（#22-#24）

#### 22. 获取团队样式

`GET /v1/teams/{team_id}/styles`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| team_id | path | ✅ | 团队 ID |
| page_size | query | — | 每页数量（默认 30） |
| after | query | — | 在此游标之后开始（与 before 互斥） |
| before | query | — | 在此游标之前开始（与 after 互斥） |

```bash
curl -s "https://api.figma.com/v1/teams/TEAM_ID/styles?page_size=30" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 23. 获取文件样式

`GET /v1/files/{file_key}/styles`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key（必须是主文件 key） |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/styles" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 24. 按 key 获取样式

`GET /v1/styles/{key}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| key | path | ✅ | 样式唯一标识符 |

```bash
curl -s "https://api.figma.com/v1/styles/STYLE_KEY" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Webhooks（#25-#31）

#### 25. 按条件查询 Webhook

`GET /v2/webhooks`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| context | query | — | 上下文类型：team / project / file |
| context_id | query | — | 上下文 ID（与 plan_api_id 互斥） |
| plan_api_id | query | — | 计划 ID，获取所有上下文的 Webhook（与 context/context_id 互斥），结果分页 |
| cursor | query | — | 分页游标（仅 plan_api_id 模式下有效） |

```bash
curl -s "https://api.figma.com/v2/webhooks?context=team&context_id=TEAM_ID" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 26. 创建 Webhook

`POST /v2/webhooks`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| event_type | body | ✅ | 事件类型（PING/FILE_UPDATE/FILE_VERSION_UPDATE/FILE_DELETE/LIBRARY_PUBLISH/FILE_COMMENT/DEV_MODE_STATUS_UPDATE） |
| context | body | ✅ | 上下文类型：team / project / file |
| context_id | body | ✅ | 上下文 ID |
| endpoint | body | ✅ | 接收 POST 请求的 URL（最长 2048 字符） |
| passcode | body | ✅ | 验证 passcode（最长 100 字符） |
| team_id | body | — | **已弃用**，使用 context + context_id 代替 |
| status | body | — | 状态：ACTIVE（默认）/ PAUSED |
| description | body | — | 描述（最长 150 字符） |

```bash
curl -s -X POST "https://api.figma.com/v2/webhooks" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "FILE_UPDATE", "context": "team", "context_id": "TEAM_ID", "endpoint": "https://example.com/webhook", "passcode": "your-passcode"}'
```

#### 27. 按 ID 获取 Webhook

`GET /v2/webhooks/{webhook_id}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| webhook_id | path | ✅ | Webhook ID |

```bash
curl -s "https://api.figma.com/v2/webhooks/WEBHOOK_ID" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 28. 更新 Webhook

`PUT /v2/webhooks/{webhook_id}`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| webhook_id | path | ✅ | Webhook ID |
| event_type | body | ✅ | 事件类型 |
| endpoint | body | ✅ | 接收 POST 请求的 URL（最长 2048 字符） |
| passcode | body | ✅ | 验证 passcode（最长 100 字符） |
| status | body | — | 状态：ACTIVE / PAUSED |
| description | body | — | 描述（最长 150 字符） |

```bash
curl -s -X PUT "https://api.figma.com/v2/webhooks/WEBHOOK_ID" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "FILE_UPDATE", "endpoint": "https://example.com/webhook", "passcode": "your-passcode"}'
```

#### 29. 删除 Webhook ⚠️ DESTRUCTIVE

`DELETE /v2/webhooks/{webhook_id}`

> ⚠️ DESTRUCTIVE — 永久删除 Webhook，不可恢复。执行前必须向用户确认。

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| webhook_id | path | ✅ | Webhook ID |

```bash
curl -s -X DELETE "https://api.figma.com/v2/webhooks/WEBHOOK_ID" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 30. 获取团队 Webhook [已弃用]

`GET /v2/teams/{team_id}/webhooks`

> ⚠️ 已弃用 — 请使用 #25 getWebhooks 的 context=team&context_id={team_id} 代替。

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| team_id | path | ✅ | 团队 ID |

```bash
curl -s "https://api.figma.com/v2/teams/TEAM_ID/webhooks" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 31. 查看 Webhook 请求日志

`GET /v2/webhooks/{webhook_id}/requests`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| webhook_id | path | ✅ | Webhook ID |

```bash
curl -s "https://api.figma.com/v2/webhooks/WEBHOOK_ID/requests" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Activity Logs（#32）

> **认证要求：** 需要 OrgOAuth2（scope: `org:activity_log_read`）。

#### 32. 获取活动日志

`GET /v1/activity_logs`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| events | query | — | 事件类型过滤（逗号分隔），默认返回全部 |
| start_time | query | — | 最早事件的 Unix 时间戳（默认一年前） |
| end_time | query | — | 最近事件的 Unix 时间戳（默认当前时间） |
| limit | query | — | 最大返回数量（默认 1000） |
| order | query | — | 排序：asc（默认）/ desc |

```bash
curl -s "https://api.figma.com/v1/activity_logs?limit=100&order=desc" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Variables（#33-#35）

> Enterprise 专属 API — 需要 Enterprise 计划才能访问 Variables 相关接口。

#### 33. 获取本地变量

`GET /v1/files/{file_key}/variables/local`

> Enterprise 专属 API

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/variables/local" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 34. 获取已发布变量

`GET /v1/files/{file_key}/variables/published`

> Enterprise 专属 API

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key（必须是主文件 key，不能是分支 key） |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/variables/published" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 35. 创建/修改/删除变量 ⚠️ DESTRUCTIVE

`POST /v1/files/{file_key}/variables`

> ⚠️ DESTRUCTIVE — 请求体可包含删除操作（action: "DELETE"），所有变更为原子性。执行前必须向用户确认。

> Enterprise 专属 API，需要 Editor 席位。请求体最大 4MB。4 个数组按顺序执行：variableCollections → variableModes → variables → variableModeValues。

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key 或分支 key |
| variableCollections | body | — | 创建/更新/删除变量集合 |
| variableModes | body | — | 创建/更新/删除模式（每集合最多 40 个，名称最长 40 字符） |
| variables | body | — | 创建/更新/删除变量（每集合最多 5000 个） |
| variableModeValues | body | — | 设置特定模式下的变量值 |

```bash
curl -s -X POST "https://api.figma.com/v1/files/FILE_KEY/variables" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"variableCollections": [{"action": "CREATE", "id": "temp_collection_1", "name": "Colors", "initialModeId": "temp_mode_1"}], "variables": [{"action": "CREATE", "id": "temp_var_1", "name": "primary", "variableCollectionId": "temp_collection_1", "resolvedType": "COLOR"}]}'
```

---

### Dev Resources（#36-#39）

#### 36. 获取开发资源

`GET /v1/files/{file_key}/dev_resources`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key（必须是主文件 key） |
| node_ids | query | — | 逗号分隔的节点 ID 列表，过滤特定节点的开发资源 |

```bash
curl -s "https://api.figma.com/v1/files/FILE_KEY/dev_resources?node_ids=1:2,1:3" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 37. 创建开发资源

`POST /v1/dev_resources`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| dev_resources | body | ✅ | 开发资源数组 |
| dev_resources[].name | body | ✅ | 资源名称 |
| dev_resources[].url | body | ✅ | 资源 URL |
| dev_resources[].file_key | body | ✅ | 所属文件 key |
| dev_resources[].node_id | body | ✅ | 附加到的节点 ID |

```bash
curl -s -X POST "https://api.figma.com/v1/dev_resources" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"dev_resources": [{"name": "GitHub Issue", "url": "https://github.com/org/repo/issues/1", "file_key": "FILE_KEY", "node_id": "1:2"}]}'
```

#### 38. 更新开发资源

`PUT /v1/dev_resources`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| dev_resources | body | ✅ | 开发资源数组 |
| dev_resources[].id | body | ✅ | 资源唯一 ID |
| dev_resources[].name | body | — | 新名称 |
| dev_resources[].url | body | — | 新 URL |

```bash
curl -s -X PUT "https://api.figma.com/v1/dev_resources" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"dev_resources": [{"id": "DEV_RESOURCE_ID", "name": "Updated Name", "url": "https://github.com/org/repo/issues/2"}]}'
```

#### 39. 删除开发资源 ⚠️ DESTRUCTIVE

`DELETE /v1/files/{file_key}/dev_resources/{dev_resource_id}`

> ⚠️ DESTRUCTIVE — 永久删除开发资源。执行前必须向用户确认。

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 文件 key（必须是主文件 key） |
| dev_resource_id | path | ✅ | 开发资源 ID |

```bash
curl -s -X DELETE "https://api.figma.com/v1/files/FILE_KEY/dev_resources/DEV_RESOURCE_ID" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

---

### Library Analytics（#40-#45）

#### 40. 组件操作分析

`GET /v1/analytics/libraries/{file_key}/component/actions`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 库文件 key |
| group_by | query | ✅ | 分组维度：component / team |
| cursor | query | — | 分页游标 |
| start_date | query | — | ISO 8601 日期（YYYY-MM-DD），默认一年前 |
| end_date | query | — | ISO 8601 日期（YYYY-MM-DD），默认最近计算周 |

```bash
curl -s "https://api.figma.com/v1/analytics/libraries/FILE_KEY/component/actions?group_by=component" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 41. 组件使用分析

`GET /v1/analytics/libraries/{file_key}/component/usages`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 库文件 key |
| group_by | query | ✅ | 分组维度：component / file |
| cursor | query | — | 分页游标 |

```bash
curl -s "https://api.figma.com/v1/analytics/libraries/FILE_KEY/component/usages?group_by=component" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 42. 样式操作分析

`GET /v1/analytics/libraries/{file_key}/style/actions`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 库文件 key |
| group_by | query | ✅ | 分组维度：style / team |
| cursor | query | — | 分页游标 |
| start_date | query | — | ISO 8601 日期（YYYY-MM-DD） |
| end_date | query | — | ISO 8601 日期（YYYY-MM-DD） |

```bash
curl -s "https://api.figma.com/v1/analytics/libraries/FILE_KEY/style/actions?group_by=style&start_date=2025-01-01&end_date=2025-12-31" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 43. 样式使用分析

`GET /v1/analytics/libraries/{file_key}/style/usages`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 库文件 key |
| group_by | query | ✅ | 分组维度：style / file |
| cursor | query | — | 分页游标 |

```bash
curl -s "https://api.figma.com/v1/analytics/libraries/FILE_KEY/style/usages?group_by=style" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 44. 变量操作分析

`GET /v1/analytics/libraries/{file_key}/variable/actions`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 库文件 key |
| group_by | query | ✅ | 分组维度：variable / team |
| cursor | query | — | 分页游标 |
| start_date | query | — | ISO 8601 日期（YYYY-MM-DD） |
| end_date | query | — | ISO 8601 日期（YYYY-MM-DD） |

```bash
curl -s "https://api.figma.com/v1/analytics/libraries/FILE_KEY/variable/actions?group_by=variable" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

#### 45. 变量使用分析

`GET /v1/analytics/libraries/{file_key}/variable/usages`

| 参数 | 位置 | 必填 | 说明 |
|------|------|------|------|
| file_key | path | ✅ | 库文件 key |
| group_by | query | ✅ | 分组维度：variable / file |
| cursor | query | — | 分页游标 |

```bash
curl -s "https://api.figma.com/v1/analytics/libraries/FILE_KEY/variable/usages?group_by=variable" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

## §8 运维契约

### §8.1 HTTP 错误→AI 行为映射

| 状态码 | 含义 | AI 行为 |
|--------|------|---------|
| 400 | Bad Request — 请求参数错误 | 检查请求体和查询参数，修正后重试 |
| 401 | Unauthorized — Token 无效或过期 | 重新获取 Token（执行 get-token.sh），重试一次 |
| 403 | Forbidden — 权限不足 | 告知用户当前 Token 缺少所需权限/scope，不重试 |
| 404 | Not Found — 资源不存在 | 确认 file_key/ID 是否正确，告知用户资源未找到 |
| 429 | Too Many Requests — 触发限流 | 执行 §8.3 限流处理算法 |
| 500 | Internal Server Error — 服务端错误 | 等待 30 秒后重试一次，仍失败则告知用户 |
| 503 | Service Unavailable — 服务不可用 | 等待 60 秒后重试一次，仍失败则告知用户稍后再试 |

### §8.2 分页契约算法

```
算法：Figma cursor 分页
─────────────────────────
1. 发起首次请求（不带 cursor 参数）
2. 检查响应中是否包含分页游标：
   - Components/Styles 列表: 检查 meta.cursor 字段
   - Webhooks/Library Analytics: 检查 next_page 字段
3. 若存在游标/next_page:
   - Components/Styles: 将 meta.cursor 值作为 after 参数发起下一页请求
   - Webhooks/Analytics: 将 next_page 值作为 cursor 参数发起下一页请求
4. 重复步骤 2-3 直到游标为空或 next_page 不存在
5. 合并全部页的结果
```

### §8.3 限流处理算法

```
算法：指数退避 + retry-after
────────────────────────────
1. 收到 429 响应
2. 读取 retry-after Header（秒数）
   - 若存在: 等待 retry-after 秒
   - 若不存在: 等待 base_delay = 2^attempt 秒（attempt 从 0 开始）
3. 重试请求
4. 若再次 429，attempt += 1，重复步骤 2（最多重试 3 次）
5. 超过 3 次仍 429，告知用户 API 限流，建议稍后再试
```

### §8.4 通用约定

| 约定 | 值 |
|------|-----|
| Base URL | `https://api.figma.com` |
| Token 传递 | `Authorization: Bearer <token>` Header |
| API 版本 | 路径版本化（`/v1/`、`/v2/`），无版本 Header |
| Content-Type | POST/PUT 请求体：`application/json` |
| ID 格式 | file_key 为字符串；team_id、project_id 为数字字符串 |
| 认证方式 | 全部 45 个接口使用 OAuth2 Bearer Token 认证；#32 Activity Logs 需要 OrgOAuth2（scope: `org:activity_log_read`） |
