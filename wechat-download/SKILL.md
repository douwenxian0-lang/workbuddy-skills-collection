---
name: wechat-download
description: 微信公众号推文图片一键下载器（wxdl）。用户给微信文章链接要下载图片/素材时使用。支持普通推文和图片消息类推文，批量、并发、断点续传、魔数校验格式。
user_invocable: true
agent_created: true
---

# wechat-download · wxdl（微信推文图片下载）

## 一句话
`python wxdl.py <URL...> [输出根目录]` → 自动建 `<输出根>/<文章标题>/`，序号图片 + README.md + urls.txt + .article_id.txt。

## 用法
```bash
PY="C:/Users/Administrator/.workbuddy/binaries/python/envs/default/Scripts/python.exe"
"$PY" "C:/Users/Administrator/.workbuddy/skills/wechat-download/wxdl.py" "https://mp.weixin.qq.com/s/xxxx" "E:/微信推文图片"
```
- 多篇批量：多个 URL 空格分隔，或传一个含链接的 txt
- 输出根目录缺省 `E:\微信推文图片`（用户惯例位置）
- 失败重跑同一条命令即自动续传（已下载文件跳过）

## 依赖
requests + Pillow（托管 venv `~/.workbuddy/binaries/python/envs/default` 已装；缺则 `python -m pip install requests Pillow`。无 Pillow 时感知去重自动降级为仅 MD5 去重）

## 关键决策（踩坑结晶，勿删）
1. **必须直连**：`session.trust_env = False`。系统代理对 mp.weixin.qq.com / mmbiz.qpic.cn 常返回 502 或连接超时，直连即恢复。
2. **图片消息类推文**（`<title>` 为空、正文 `<img>` 极少）：图片全在页面 JS 的 `cdn_url:` 字段里，必须一并提取；只抓 data-src 会漏到只剩 1 张。
3. **标题提取**：图片消息类页面标题在 `window.msg_title = window.title = '...'` 链式赋值，`<title>` 和 `<h1>` 都取不到；按 msg_title 链式 → var msg_title → og:title → <title> 顺序兜底。
4. **格式校验用魔数**（89 50 4E 47=png / FF D8 FF=jpeg / GIF87a|89a=gif），wx_fmt 参数不可靠。
5. **输出格式对齐 QClaw media-extractor 惯例**：文件夹以文章标题命名，图片 001.ext 起编号，README.md 记统计，urls.txt 留原始链接溯源，.article_id.txt 存文章 ID。
6. **两级去重都必须有**：① MD5 内容去重——很多文章同一张图出现两次（正文 img + JS 数据块），URL 不同字节相同；② 感知去重（aHash 16x16=256bit，阈值 10）——同一张照片被以不同分辨率/格式嵌两次（如 1080×1440 与 1280×960），MD5 必不同但视觉相同，保留分辨率更高的一张。实测距离双峰分布：同图 0~7，不同图 ≥24，阈值 10 极安全。去重后重新编号 001..N，README 报 "N duplicates removed"。
7. **URL 清洗**：cdn_url 里的链接带 JS 转义 `\x26` 和多重实体 `&amp;amp;`，统一清洗为 `&`，否则溯源链接是脏的。
8. 图片 <500B 视为无效跳过；下载重试 2 次退避；6 线程并发。
9. **变量遮蔽警示**：process_article 里文章 URL 变量名为 `url`，遍历图片时循环变量切勿也叫 `url`，否则 README/urls.txt 的 Source 会被最后一张图的 URL 覆盖（已踩坑修复）。

## 输出结构
```
E:\微信推文图片\<文章标题>\
├── 001.jpeg / 002.png / 003.gif ...
├── README.md          # 标题 + Source + 统计
├── urls.txt           # Title/Source + 原始图片 URL 编号列表
└── .article_id.txt    # 文章 ID
```

## 边界
- 仅支持微信公众号文章（mp.weixin.qq.com）；小红书/抖音有反爬，不在此技能范围。
- 需要登录/被删除/仅群发的文章抓不到正文，会返回"未知标题"或 0 图。
