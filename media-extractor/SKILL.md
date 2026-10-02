---
name: media-extractor
description: 翠鸟 · 全平台素材提取器（历史 GUI 工具集）。微信推文图片下载已由 wechat-download 技能（wxdl.py）取代，本技能仅保留 GUI 入口与历史脚本归档。
user_invocable: true
---

# media-extractor · 翠鸟（已整合）

> **⚠️ 微信推文图片下载请用新技能 `wechat-download`（wxdl.py）** —— 单脚本、并发、断点续传、支持图片消息类推文，输出格式与本项目一致。

## 现状
- 所有历史脚本（GUI、web 服务、3 版下载器、batch 系列、日志、图标、空目录）已归档至 `_legacy/`
- 标准输出格式（`<标题文件夹>/001.ext + README.md + urls.txt + .article_id.txt`）由 wechat-download 技能继承

## _legacy 中仍可用的入口
- `wechat_gui.py` — GUI 拖拽入口（tkinterdnd2，需 Python 3.12 + 桌面环境）
- `web_app.py` + `start_web.bat` — 网页版
- `extract_browser.py` — 旧浏览器引擎（已弃用）
- 小红书/抖音/B站等多平台提取引擎也在此目录，尚未整合进新技能

## 历史踩坑记录（已固化进 wechat-download）
- 图片消息类推文：`<title>` 为空、正文 `<img>` 极少，图片全在 JS 的 `cdn_url:` 字段
- 标题在 `window.msg_title = window.title = '...'` 链式赋值里
- 系统代理对 mp.weixin.qq.com / mmbiz.qpic.cn 常返回 502，必须直连
- 小红书/抖音反爬强，需浏览器辅助；B站有公开 API 可直接调用
