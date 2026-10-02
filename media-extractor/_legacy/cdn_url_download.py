#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""下载微信图片消息类推文的全部图片（从页面 JS 的 cdn_url 数据提取）"""
import io
import re
import sys
import time
from pathlib import Path

import requests

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://mp.weixin.qq.com/",
}

URL = "https://mp.weixin.qq.com/s/VlueS8Y8-Chsv93-DIFufg"
OUT = Path(r"E:\微信推文图片")

html = Path(r"C:\Users\Administrator\WorkBuddy\2026-09-28-21-47-35\_wx_page.html").read_text(encoding="utf-8")

# 标题
m = re.search(r"var msg_title = '(.*?)'", html) or re.search(r"msg_title\s*=\s*['\"](.*?)['\"]", html)
title = m.group(1).strip() if m else "微信文章"
title = re.sub(r'[\\/:*?"<>|]', "_", title)
print("标题:", title)

# 图片列表：cdn_url 字段（图片消息类）+ img 标签 data-src/src 兜底
urls = re.findall(r"cdn_url:\s*'(.*?)'", html)
urls += re.findall(r'data-src="(.*?)"', html)
urls += re.findall(r'src="(https?://mmbiz\.qpic\.cn/.*?)"', html)
urls = [u.replace("&amp;", "&") for u in urls if u.startswith("http")]
seen = set()
uniq = []
for u in urls:
    if u not in seen:
        seen.add(u)
        uniq.append(u)
print(f"共找到 {len(uniq)} 张图片")

OUT.mkdir(parents=True, exist_ok=True)
ok = 0
for i, u in enumerate(uniq, 1):
    fmt = "png"
    m2 = re.search(r"wx_fmt=(\w+)", u)
    if m2:
        fmt = m2.group(1)
    ext = {"jpeg": "jpg", "svg": "svg", "gif": "gif", "png": "png", "jpg": "jpg"}.get(fmt, "jpg")
    path = OUT / f"{i:03d}.{ext}"
    try:
        r = requests.get(u, headers=HEADERS, timeout=60, stream=True)
        if r.status_code == 200 and len(r.content) > 500:
            path.write_bytes(r.content)
            ok += 1
            print(f"[{i}/{len(uniq)}] OK {path.name} ({len(r.content)//1024} KB)")
        else:
            print(f"[{i}/{len(uniq)}] FAIL status={r.status_code} size={len(r.content)}")
    except Exception as e:
        print(f"[{i}/{len(uniq)}] ERROR {e}")
    time.sleep(0.3)

print(f"\n完成: {ok}/{len(uniq)} 张 -> {OUT}")
