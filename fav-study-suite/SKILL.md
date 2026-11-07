# 收藏学习台套件 · Fav Study Suite

把「收藏夹吃灰」问题在三大平台上一站式解决：**抖音收藏 → 学习笔记，B站收藏 → RAG 知识库**，下载能力由 VidBee 提供。

## 套件组成（本机已安装）

| 组件 | 位置 | 平台 | 用途 |
|---|---|---|---|
| 收藏学习台 (douyin-fav-study) v1.0.5 | `%LOCALAPPDATA%\Programs\DouyinFavStudy` | 抖音 | 收藏视频/图文 → 本机转写 → AI 提炼 → 学习网站 + Obsidian md |
| BiliMind (bilibili-rag) | `C:\Users\Administrator\Tools\bilibili-rag` | B站 | 收藏夹 → 语音转写 → 向量库 → 对话问答、溯源 |
| VidBee v2.3.0 | `%LOCALAPPDATA%\Programs\VidBee` | 500+ 站点 | 万能视频下载 + 内置 ffmpeg/yt-dlp（两个工具共用其 ffmpeg） |

## 启动方式

- **收藏学习台**：桌面「收藏学习台」双击启动，浏览器开 `http://127.0.0.1:8765`
- **BiliMind**：双击 `C:\Users\Administrator\Tools\bilibili-rag\start.bat`，浏览器开 `http://127.0.0.1:8000`
  （前端 build 存在时用其页面；否则 API + Swagger 文档 `http://127.0.0.1:8000/docs`）

## 必填配置（首次使用前）

1. **收藏学习台**：设置页选服务商填 Key（推荐 DeepSeek，便宜中文好；免费可选智谱 GLM/硅基流动）
2. **BiliMind**：编辑 `Tools\bilibili-rag\.env`
   - `OPENAI_API_KEY` → DeepSeek Key（LLM 问答）
   - `DASHSCOPE_API_KEY` → 阿里云百炼 Key（语音转写 paraformer-v2 + 向量 text-embedding-v4，有免费额度）

## 同类工具对比（2026-11-07 选型记录）

### 抖音方向
| 工具 | 结论 |
|---|---|
| **douyin-fav-study (50⭐)** ✅ 已装 | 全流程最完整：下载+本机 faster-whisper 转写+AI 提炼+测验/Anki/知识图谱/周报；Windows 一键安装包；md 可进 Obsidian |
| 其他抖音收藏工具 | 无同等成熟度的开源竞品（多为数据采集向，如 xhs_douyin_content 抓创作者数据，与本需求不符） |

### B站方向
| 工具 | ⭐ | 结论 |
|---|---|---|
| **bilibili-rag / BiliMind (1358⭐)** ✅ 已装 | Apache-2.0，收藏夹→转写→ChromaDB→RAG 问答，可溯源、导出 md；支持多 P；本地部署不吃积分 |
| BilibiliDown (5359⭐) | 纯下载器，无笔记/知识库层；下载能力已被 VidBee 覆盖，不装 |
| mybili (710⭐) | 收藏夹备份防失效，无 AI/笔记；如担心 B站视频被删可后补 |
| bili-fav-sniffer (136⭐) | 定时下载收藏夹新视频，下载向；不装 |
| bilibili-fav-extractor (0⭐) | 提取+AI分类+HTML笔记，但零星、无社区验证；被 BiliMind 覆盖 |

### 其他平台
| 工具 | ⭐ | 结论 |
|---|---|---|
| kankan-shoucang (57⭐) | 小红书收藏本地化+OCR+分类，思路好但 **macOS 专属**，本机 Windows 装不了；替代思路：小红书收藏导出后走 Obsidian 人工归档 |
| gogoga-fav-sync / bilibili-obsidian-daily-sync (0⭐) | Obsidian 插件同步 B站收藏，轻量但零星；BiliMind 已覆盖核心诉求 |

### 总结选型逻辑
- 笔记深读/测验/复习 → 收藏学习台（抖音）
- 长视频检索/问答/知识库 → BiliMind（B站）
- 万能下载兜底 → VidBee（B站/YouTube/抖音链接也能下）

## 技能用法（AI 触发）

- 用户说「帮我同步抖音收藏 / 处理一条抖音视频链接」→ 启动收藏学习台，引导粘贴链接或配 Key
- 用户说「B站收藏夹做成知识库 / 问B站收藏里的内容」→ 启动 start.bat，扫码登录后同步收藏夹
- 用户说「下载某个视频」→ 用 VidBee 内置 yt-dlp：`C:\Users\Administrator\AppData\Local\Programs\VidBee\resources\resources\yt-dlp.exe`

## 来源
- https://github.com/yuanshengbo8-sketch/douyin-fav-study (PolyForm Noncommercial，个人学习可用)
- https://github.com/via007/bilibili-rag (Apache-2.0)
