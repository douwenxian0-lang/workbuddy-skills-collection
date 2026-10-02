---
name: kdocs
description: "操作金山文档（WPS 云文档 / Kdocs / 365.kdocs.cn / www.kdocs.cn）云文档的官方 Skill。核心能力覆盖云端新建、读取、编辑、搜索、分享、整理在线文档（智能文档、Word、Excel、PDF、PPT、演示文稿、智能表格、多维表格）及个人知识库。当用户的任务涉及云文档操作时使用，包括但不限于：写周报/日报/工作汇报、处理合同/发票、创建报名表/登记表、网页剪藏、接龙转表格、信息收集、文档总结与内容生成、改写仿写、翻译、AI PPT生成、PDF拆分导出、标签分类归档、收藏管理、碎片笔记整理、表格美化、回收站还原、知识库管理。"
homepage: https://www.kdocs.cn/latest
version: 1.5.7
metadata: {"openclaw":{"category":"kdocs","tokenUrl":"https://www.kdocs.cn/latest","emoji":"📝"},"keywords":["金山文档","金山表格","金山收藏","WPS","WPS文档","云文档","在线文档","kdocs","WPS云文档","接龙转表格","接龙","群接龙","报名表","信息收集","收集表","登记表","网页剪藏","剪藏","保存网页","网页保存到文档","保存文章","收藏文章","总结","帮我总结","帮我整理","帮我写","帮我翻译","帮我做PPT","翻译文档 - 做PPT - 生成PPT - 培训课件 - 方案展示 - 项目展示","文档总结","内容生成","改写","仿写","翻译","文档翻译","AI PPT","PPT","演示文稿","幻灯片","PDF","拆分PDF","导出PDF","Word","Excel","表格","Markdown","碎片整理","笔记整理","表格优化","文档处理","文件处理","办公助手","文档助手","周报","日报","工作汇报","合同","发票"],"file_types":["pdf","doc","docx","xlsx","xls","pptx","ppt","otl","ksheet","dbt","form","jpg","jpeg","png","bmp","gif","webp","url","md","txt","html"],"category":"productivity"}
---

# 金山文档 Skill 使用指南

金山文档 Skill 提供了一套完整的在线文档操作工具，支持创建、查询、读取、编辑、分享、移动多种类型的在线文档。

## 严格规则

### 禁止（NEVER）

- 禁止将 Token 明文出现在对话、日志、命令输出、代码注释或任何文件中；不得写入 `.env` 或环境变量；仅允许存放在 `mcporter` 的 `kdocs-qclaw` 配置中
- 上传写入等接口需传入的 `content_base64` 可能非常大（编码后 >1 MB），禁止在对话中逐 token 生成 Base64 字符串，用脚本完成文件读取、编码和传参

### 必须（MUST）

- 不可逆操作（delete/close 类）执行前必须向用户确认
- 写操作完成后必须用独立读取请求验证实际结果（不信任 `code: 0`）
- 创建云文档文件并验证通过后，必须向用户展示可访问链接。若响应包含 `data.link_url` 则直接展示；若响应无链接时，调用 `get_file_link` 获取并展示。
- 调用工具前必须先阅读对应的 `references/` 详细参考文档，禁止仅凭指南（guide）的概要说明直接拼装调用；参数细节（类型、可选值、约束）以工具参考文档为准

---

## 保持最新版本

首次使用或间隔超过 24 小时后，确认 Skill 是否为最新版本。

从本文件 frontmatter 的 `version` 读取本地版本号，调用远端比对：

```bash
mcporter call kdocs-qclaw.check_skill_update version=<本地版本号>
```

- 返回 `update_available: false` → 已是最新
- 返回 `update_available: true` → 从 `instruction` 中提取 zip 下载链接（格式 `https://...kdocs.zip`），下载解压替换当前 Skill 目录；更新后保留 mcporter 中的 Token 配置

---

## 认证配置

**配置名绑定**：所有 `mcporter` 操作只能使用 `kdocs-qclaw` 配置名（`mcporter call kdocs-qclaw ...`）。即使存在其他名称配置也禁止使用。

| 场景 | 操作 |
|------|------|
| 首次设置 | 运行 `bash scripts/setup.sh` 自动注册 mcporter 并拉起授权 |
| Token 过期（400006） | 运行获取脚本重新获取 → Linux/macOS: `bash scripts/get-token.sh` · Windows+Node: `node scripts/get-token.js` · Windows 无 Node: `powershell -ExecutionPolicy Bypass -File scripts\get-token.ps1` |
| 验证 | 调用任意读取工具（如 `search_files`），`code: 0` 即成功 |

Token 仅存放在 mcporter 的 `kdocs-qclaw` 配置中，禁止写入 `.env` 或环境变量。

脚本失败时的手动获取流程、旧配置迁移、setup.sh 详细说明见 `references/auth.md`。

---

## 调用格式

根据运行环境选择对应方式：

- **MCP function call**（Cursor / Claude Code 等客户端）：直接构造 JSON，无需处理引号或转义：
  ```json
  {"name": "otl.insert_content", "arguments": {"file_id": "xxx", "content": "hello", "format": "markdown", "mode": "append"}}
  {"name": "read_file", "arguments": {"file_id": "xxx", "format": "markdown"}}
  ```
- **mcporter CLI**：`mcporter call` 按首个 `.` 拆分 `服务名.工具名`，工具名含点号时须分开传递以防截断：
  ```
  mcporter call kdocs-qclaw "otl.insert_content" file_id=xxx
  mcporter call kdocs-qclaw search_files keyword=test type=all
  ```
  - **数组/对象参数**：`key=value` 无法表达数组或对象，须用 `--args` 传 JSON
  - **值含空格或特殊字符**：值需引号包裹使其成为单个参数，如 `name="项目 周报.otl"`
  - **bash**：`--args` 用单引号包裹 JSON 即可：`--args '{"include_elements":["all"]}'`
  - **PowerShell**：单引号内的双引号会被吞掉，须用反斜杠转义：`--args '{\"include_elements\":[\"all\"]}'`


以下工具不可逆，调用前必须向用户确认（详细约束见各工具参考文档的「操作约束」区）：

`otl.block_delete`、`dbsheet.delete_sheet`、`kwiki.close_knowledge_view`、`sheet.delete_sheets`、`sheet.delete_range_data`、`dbsheet.delete_view`、`dbsheet.delete_fields`、`cancel_share`、`kwiki.delete_item`、`sheet.delete_protection_ranges`、`dbsheet.delete_records`、`sheet.delete_data_validations`、`sheet.delete_conditional_format_rules`、`sheet.delete_float_images`、`sheet.delete_filters`、`dbsheet.sheet_batch_delete`、`dbsheet.permission_delete_roles_async`

---

## 能力范围

### 操作域路由

Agent 首先判定用户请求的操作域：

| 操作域 | 触发场景 | 路由 |
|--------|---------|------|
| 创建/写入 | 新建并写入、上传本地文件、新建空白文档 | **见下方「创建/写入」** |
| 局部更新 | 改块/改段/改单元格，已有目标文档上的修改 | 按「支持的文档类型」→ 对应 reference 中的写入/更新类工具 |
| 类型专属能力 | 条件格式、导出转换、翻译、PDF 拆分、幻灯片主题、数据校验 | 按「支持的文档类型」→ 对应 reference 中的专属功能章节 | 读取 | 读取/提取/导出文档内容 | `read_file`（传 url 或 file_id，详见 `references/drive/read_and_download.md`）；没有则先「定位文件」 |
| 读取 | 读取/提取/导出文档内容 | `read_file`（传 url 或 file_id，详见 `references/drive/read_and_download.md`）；没有则先「定位文件」 |
| 定位文件 | 搜索/按链接找文件/浏览目录 | **必读** `references/file-locating-guide.md` |
| 文件管理 | 移动/重命名/分享/标签/收藏/回收站 | → `references/drive.md` |
| AI 生成 | AI 做PPT/生成演示文稿 | → `references/aippt.md` |
| 知识库 | 知识库空间/导入/整理 | → `references/kwiki.md` |

### 支持的文档类型

| 类型 | 别名 | 文件后缀 | 说明 | 详细参考 |
|------|------|----------|------|----------|
| **智能文档** 首选 | ap | .otl | 排版美观，支持丰富组件 | `references/otl.md` — 页面、文本、标题、待办等元素操作 |
| 表格 | et / Excel | .xlsx | 数据表格专用 | `references/sheet.md` — 工作表管理、范围数据获取、批量更新 |
| PDF文档 | pdf | .pdf | PDF 文档专用 | `references/pdf.md` — PDF 创建与内容读取 |
| 文字文档 | wps / Word | .docx | 传统格式 | `references/wps.md` — Word 文档创建与内容操作 |
| 演示文稿 | wpp | .pptx | PPT 文档专用 | `references/wpp.md` — 幻灯片主题字体和配色设置、下载和导出 |
| 智能表格 | as | .ksheet | 结构化表格，支持多视图、字段管理 | `references/sheet.md` — 工作表管理、范围数据获取、批量更新 |
| 多维表格 | db / dbsheet | .dbt | 多数据表、丰富字段类型与视图（表格/看板/甘特等） | `references/dbsheet.md` — 支持数据表/视图/字段/记录的完整增删改查，含表单视图、父子记录、分享协作、高级权限与 Webhook |
| 智能表单 | form | .form | 轻量表单草稿创建、题目配置、发布与查询 | `references/form.md` — 草稿创建/更新/发布与表单信息查询 |

### 高频流程指引

#### 创建/写入

| 用户意图 | 工具 | 适用后缀 |
|----------|------|----------|
| 对话中已有要写的内容 | `create_file_with_content` | .otl .docx .pdf .xlsx .ksheet .dbt |
| 上传本地已有文件 | `upload_file` | .doc .docx .xls .xlsx .ppt .pptx .pdf .md .txt |
| 新建空白文档（不写内容） | `create_file` | .doc .docx .otl .dbt .xlsx .xls .ksheet .pptx .ppt |
| AI 生成 PPT | `aippt.execute` | .pptx |

后缀不确定时默认 `.otl`。指定文件夹时先按 `references/file-locating-guide.md` 取 `drive_id`、`parent_id`。

选定工具后，阅读 `references/drive/create_and_upload.md` 对应章节获取参数约束（`aippt.execute` 见 `references/aippt.md`）。

#### 搜索定位文档

工具说明：`search_files(keyword="关键词", type="all", page_size=20)`，获取 `file_id`、`drive_id` 供后续链路使用。
详细参数与返回结构见 `references/drive/search.md`。

### 更多操作流程

| 流程 | 说明 | 详细参考 |
|------|------|---------|
| AI 生成演示文稿（全文） | aippt.execute 单接口全文生成链路：支持 html（两次调用 + follow_up）和 basic（一次调用，经典简约模式）两种模式，覆盖主题/文档场景 | `references/workflows/aippt-full-text.md` |
| AI 单页生成幻灯片 | aippt.execute 单接口单页生成幻灯片：HTML 布局模式，一次调用完成，可通过 wpp.import_slides 插入到已有演示文稿 | `references/workflows/aippt-single-page.md` |
| 网页剪藏 | 抓取网页内容并自动保存为智能文档 | `references/workflows/web-scrape.md` |
| 搜索-读取-汇报撰写 | 搜索多份文档、提取信息、汇总撰写新报告 | `references/workflows/search-read-report.md` |
| 定期读取与播报 | 定期读取指定文档，提取关键信息生成摘要 | `references/workflows/periodic-read-summary.md` |
| 智能分类整理 | 列出目录，按内容或指定维度分类创建文件夹并归档 | `references/workflows/smart-classify.md` |
| 精准搜索与风险排查 | 在特定目录批量搜索文档，逐一读取分析，汇总到新文档 | `references/workflows/precise-search-analysis.md` |
| 云文档导入幻灯片 | 将外部 PPTX 文件中的指定幻灯片导入到已有演示文稿中 | `references/workflows/import-slides.md` |
| 接龙转表格 | 识别接龙文本内容，自动提取并转为在线表格 | `references/workflows/jielong-to-table.md` |
| 信息收集表单生成 | 根据用户需求自动设计并创建信息收集表格 | `references/workflows/form-generator.md` |
| 知识智能整理 | 对知识库中的零散内容进行智能化整理和结构化重组 | `references/workflows/knowledge-format.md` |
| 知识一键存入 | 将各类内容（网页、文件、文本）一键保存到知识库 | `references/workflows/knowledge-save.md` |
| 表格美化与数据规范 | 读取表格数据，进行格式美化、数据规范化和样式调整，并通过条件格式、数据校验、区域权限固化规则 | `references/workflows/table-beautify.md` |

---

## 错误速查

| 错误特征 | 原因 | 处理方式 |
|----------|------|----------|
| `400006` / 鉴权失败 | Token 过期或未配置 | 先运行 get-token 脚本重新获取；脚本失败则引导用户手动获取（见「认证配置」章节） |
| `429001` / 限频 | 请求过于频繁，响应含**限频恢复时间** | 立即停止命令调用，直到达到恢复时间；禁止立即重试、换参、换子命令连续请求 |
| `429002` / 熔断 | 多因短时间内连续触发 `429001` ，响应含**熔断持续时间** | 熔断时长内零请求，期满再试；重新规划任务避免请求过频 |
| 工具找不到 | 未注册 MCP 服务 | 运行 `bash scripts/setup.sh` 重新注册（mcporter 环境），或检查客户端 MCP 配置 |
| `mcporter` 未找到 | 运行环境缺少 mcporter | 默认不会改动系统环境（不执行全局安装）；可先手动安装后重试，或显式使用 `bash scripts/setup.sh --auto-install-mcporter` / `bash scripts/get-token.sh --auto-install-mcporter`（PowerShell: `-AutoInstallMcporter`） |
| `.env` 迁移后其他配置丢失 | 脚本会整文件删除 `.env` | 新流程仅移除 `KINGSOFT_DOCS_TOKEN` 键并保留其他键；若 `.env` 仅含该键会直接删除空 `.env` |
| 搜索无结果 | 关键词过精确 / 索引延迟 | 缩短关键词 / 等待 3-5 秒重试 |
| 读取内容为空 | 文件无内容或格式不支持 | 确认文件非空且后缀正确 |
| `read_file` 不支持 .csv | CSV 格式不支持 | 勿对 .csv 调用 `read_file`，建议用户转为 .xlsx 后用 `read_file` 或 `sheet.*` 读取 |
| 创建文件失败 | 文件名后缀不正确 | 检查后缀：`.otl` / `.docx` / `.xlsx` / `.ksheet` / `.dbt` / `.pdf` / `.pptx` |
| 移动文件失败 | 目标文件夹不存在 | 先搜索确认或创建文件夹 |
| `conflict` / `lock` / 并发写入冲突 | 多个写操作同时修改同一资源（知识库节点、多维表记录等）导致锁竞争 | 指数退避重试（2s → 4s → 8s，最多 3 次）；批量写入场景改为串行逐条执行；详见 kwiki / dbsheet 各 reference「错误速查表」 |
| HTTP 5xx / 超时 | 服务端故障 | 等 3 秒重试 1 次 |
| 验证不通过（回读值与预期不符） | 写入未生效或延迟 | 等 2 秒重新验证，仍不通过则报告用户 |
| `setup.sh` 执行失败 / 安装报错 | 当前版本可能已不兼容 | 执行上方「保持最新版本」流程 |
| MCP 接口返回未知错误码（非 5xx、非 400006、非 429001/429002、非工具不存在） | Skill 版本过旧导致接口不兼容 | 执行上方「保持最新版本」流程 |
| 错误信息含 `version`、`incompatible`、`not_supported`、`deprecated` 等版本关键词 | Skill 或 API 版本不兼容 | 执行上方「保持最新版本」流程 |
| 工具调用失败且原因不明 | 可能是 Skill 版本过旧 | 执行上方「保持最新版本」流程 |
| 工具调用失败需判断是否可重试 | 不同工具幂等性不同 | 查看该工具参考文档「操作约束」区的幂等性说明，幂等工具可安全重试，非幂等工具须先确认状态 |

---

## 安全约束

- 凭据由 MCP 运行时管理，Skill 自身不存储、不记录
- 无状态代理，不缓存任何文档内容或业务数据
- 仅在用户主动发起操作时调用对应 API

