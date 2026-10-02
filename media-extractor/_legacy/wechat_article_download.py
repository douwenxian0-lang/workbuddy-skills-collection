#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""微信公众号推文图片下载器（QClaw media-extractor 标准格式）

输出结构（与 QClaw 时代下载器一致）：
    E:\\微信推文图片\\<文章标题>\\
        001.jpeg / 002.png / 003.gif ...  （按文中出现顺序编号，保留原始格式）
        README.md          （标题、来源、下载统计）
        urls.txt           （标题 + 来源 + 原始图片 URL 列表）
        .article_id.txt    （文章 ID）

用法: python wechat_article_download.py <文章URL> <输出根目录>
支持普通推文（data-src）和图片消息类推文（cdn_url）。
"""
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
    "Accept-Language": "zh-CN,zh;q=0.9",
}

EXT_MAP = {"jpeg": "jpeg", "jpg": "jpeg", "png": "png", "gif": "gif", "svg": "svg", "webp": "webp"}

# 微信为国内站点，绕过系统代理直连（代理对 mp.weixin.qq.com 常返回 502）
SESSION = requests.Session()
SESSION.trust_env = False
SESSION.headers.update(HEADERS)


def get_html(url: str) -> str:
    r = SESSION.get(url, timeout=30)
    r.encoding = "utf-8"
    r.raise_for_status()
    return r.text


def get_title(html: str) -> str:
    # 图片消息类页面 <title> 为空，标题在 window.msg_title = window.title = '...' 链式赋值里
    for pat in (
        r"window\.msg_title\s*=\s*window\.title\s*=\s*'(.*?)'",
        r"var msg_title = '(.*?)'",
        r'property="og:title" content="(.*?)"',
        r"<title>(.*?)</title>",
    ):
        m = re.search(pat, html, re.S)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return "未知标题"


def extract_image_urls(html: str) -> list:
    """按文档顺序提取全部图片 URL（data-src / cdn_url / src），全局去重"""
    found = []
    for pat in (
        r'data-src="(https?://[^"]+)"',
        r"cdn_url:\s*'(https?://[^']+)'",
        r'src="(https?://mmbiz\.qpic\.cn/[^"]+)"',
        r"background-image:\s*url\((https?://mmbiz\.qpic\.cn/[^)]+)\)",
    ):
        for m in re.finditer(pat, html):
            found.append((m.start(), m.group(1).replace("&amp;", "&")))
    found.sort(key=lambda x: x[0])
    seen, uniq = set(), []
    for _, u in found:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def download(url: str, path: Path) -> int:
    r = SESSION.get(url, timeout=60, stream=True)
    r.raise_for_status()
    data = r.content
    path.write_bytes(data)
    return len(data)


def main():
    if len(sys.argv) < 3:
        print("Usage: python wechat_article_download.py <URL> <out_root>")
        sys.exit(1)
    url = sys.argv[1].strip()
    out_root = Path(sys.argv[2])

    html = get_html(url)
    title = get_title(html)
    safe_title = re.sub(r'[\\/:*?"<>|\r\n]', "_", title).strip() or "未知标题"
    article_id = url.rstrip("/").split("/s/")[-1].split("?")[0]

    urls = extract_image_urls(html)
    print(f"标题: {title}")
    print(f"文章ID: {article_id}")
    print(f"图片数: {len(urls)}")

    article_dir = out_root / safe_title
    article_dir.mkdir(parents=True, exist_ok=True)

    saved, skipped, failed = 0, 0, 0
    downloaded_list = []
    for i, u in enumerate(urls, 1):
        m = re.search(r"wx_fmt=(\w+)", u)
        ext = EXT_MAP.get((m.group(1).lower() if m else "jpeg"), "jpeg")
        path = article_dir / f"{i:03d}.{ext}"
        try:
            size = download(u, path)
            if size < 500:
                path.unlink()
                skipped += 1
                print(f"[{i}/{len(urls)}] SKIP 太小({size}B)")
            else:
                saved += 1
                downloaded_list.append(u)
                print(f"[{i}/{len(urls)}] OK {path.name} ({size // 1024} KB)")
        except Exception as e:
            failed += 1
            print(f"[{i}/{len(urls)}] FAIL {e}")
        time.sleep(0.3)

    # README.md
    (article_dir / "README.md").write_text(
        f"# {title}\n\n"
        f"Source: {url}\n\n"
        f"Images: {saved} saved, {skipped} skipped, {failed} failed\n",
        encoding="utf-8",
    )
    # urls.txt
    with open(article_dir / "urls.txt", "w", encoding="utf-8") as f:
        f.write(f"Title: {title}\nSource: {url}\n\n")
        for i, u in enumerate(downloaded_list, 1):
            f.write(f"{i}. {u}\n")
    # .article_id.txt
    (article_dir / ".article_id.txt").write_text(article_id, encoding="utf-8")

    print(f"\n完成: {saved} saved / {skipped} skipped / {failed} failed -> {article_dir}")


if __name__ == "__main__":
    main()
