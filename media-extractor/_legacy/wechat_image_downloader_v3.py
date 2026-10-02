#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信文章图片下载器 v3 (xbrowser 版)
使用 xbrowser 渲染 JavaScript，正确提取标题和图片
"""

import sys
import io
import os
import re
import time
import hashlib
import subprocess
import json
from pathlib import Path

# 强制 UTF-8 输出
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

XB_PATH = "D:/Program Files/QClaw/v0.2.22.518/resources/openclaw/config/skills/xbrowser/scripts/xb.cjs"

def xb_run(args: list, timeout: int = 60) -> dict:
    """调用 xbrowser CLI"""
    cmd = ["node", XB_PATH] + args
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    try:
        return json.loads(result.stdout)
    except:
        return {"ok": False, "error": result.stdout + result.stderr}

def get_html_via_xbrowser(url: str, timeout: int = 60) -> str:
    """使用 xbrowser 获取渲染后的 HTML"""
    # 打开页面
    resp = xb_run(["run", "--browser", "default", "open", url], timeout=30)
    if not resp.get("ok"):
        print(f"    [错误] 打开页面失败: {resp.get('error', '未知错误')}")
        return ""
    
    # 等待加载
    time.sleep(5)
    
    # 获取 HTML
    resp = xb_run(["run", "--browser", "default", "eval", "document.documentElement.outerHTML"], timeout=30)
    if resp.get("ok"):
        return resp.get("result", "")
    
    return ""

def extract_title_via_xbrowser(url: str) -> str:
    """使用 xbrowser 提取标题"""
    # 打开页面
    resp = xb_run(["run", "--browser", "default", "open", url], timeout=30)
    if not resp.get("ok"):
        return "untitled"
    
    # 等待加载
    time.sleep(5)
    
    # 尝试多种选择器提取标题
    js_selectors = [
        "document.querySelector('h1.rich_media_title')?.innerText?.trim()",
        "document.querySelector('#activity-name')?.innerText?.trim()",
        "document.title",
        "document.querySelector('meta[property=\"og:title\"]')?.content",
    ]
    
    for js in js_selectors:
        resp = xb_run(["run", "--browser", "default", "eval", js], timeout=10)
        if resp.get("ok"):
            title = resp.get("result", "").strip()
            if title and title != "untitled":
                # 移除 " - 微信公众号" 后缀
                title = re.sub(r'\s*-\s*微信公众号\s*$', '', title)
                return title
    
    return "untitled"

def extract_images_from_html(html: str, base_url: str) -> list:
    """从 HTML 中提取所有图片 URL"""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "html.parser")
    images = []
    
    # 微信文章的图片主要在 #js_content 内
    content_div = soup.find(id="js_content")
    if not content_div:
        img_tags = soup.find_all("img")
    else:
        img_tags = content_div.find_all("img")
    
    for img in img_tags:
        src = (img.get("data-src") or 
                img.get("src") or 
                img.get("data-url") or 
                "")
        
        if not src:
            continue
        
        if "mmbiz.qpic.cn" not in src and not src.startswith("http"):
            continue
        
        if not src.startswith("http"):
            from urllib.parse import urljoin
            src = urljoin(base_url, src)
        
        if src not in images:
            images.append(src)
    
    return images

def download_image(url: str, save_path: Path, timeout: int = 60) -> bool:
    """下载单张图片"""
    import requests
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://mp.weixin.qq.com/",
        }
        resp = requests.get(url, headers=headers, timeout=timeout, stream=True)
        if resp.status_code == 200:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            with open(save_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
            return True
    except Exception as e:
        print(f"    [下载失败] {url[:60]}... - {e}")
    return False

def normalize_wechat_image_url(url: str) -> str:
    """归一化微信图片 URL（用于去重）"""
    match = re.match(r"(https?://mmbiz\.qpic\.cn/(mmbiz_jpg|mmbiz_png|mmbiz_gif|mmbiz)/[^/?]+)", url)
    if match:
        return match.group(1)
    return url

def main():
    if len(sys.argv) < 3:
        print("Usage: python wechat_image_downloader_v3.py <URL> <output_dir>")
        sys.exit(1)
    
    url = sys.argv[1].strip()
    output_dir = Path(sys.argv[2])
    
    print("[微信图片下载器 v3] 开始处理")
    print(f"  URL: {url[:80]}...")
    print(f"  输出: {output_dir}")
    print()
    
    # 初始化 xbrowser
    print("  [0/5] 初始化浏览器...")
    resp = xb_run(["init"], timeout=30)
    if not resp.get("ok"):
        print("  [失败] xbrowser 初始化失败")
        sys.exit(1)
    
    # 提取标题（通过 xbrowser 渲染 JS）
    print("  [1/5] 提取文章标题...")
    title = extract_title_via_xbrowser(url)
    title = re.sub(r'[<>:"/\\|?*]', '_', title)[:100] or "untitled"
    print(f"  标题: {title}")
    
    # 获取渲染后的 HTML
    print("  [2/5] 获取页面 HTML...")
    html = get_html_via_xbrowser(url)
    if not html:
        print("  [失败] 无法获取页面内容")
        sys.exit(1)
    
    # 提取图片 URL
    print("  [3/5] 提取图片 URL...")
    image_urls = extract_images_from_html(html, url)
    print(f"  找到 {len(image_urls)} 张图片")
    
    if not image_urls:
        print("  [警告] 未找到任何图片")
        sys.exit(0)
    
    # 创建输出目录
    article_dir = output_dir / "微信公众号" / title
    images_dir = article_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    # 下载图片（带去重）
    print(f"  [4/5] 下载图片到 {images_dir}...")
    downloaded = set()
    success_count = 0
    
    for i, img_url in enumerate(image_urls, 1):
        normalized = normalize_wechat_image_url(img_url)
        if normalized in downloaded:
            print(f"    [{i}/{len(image_urls)}] 跳过（已下载）：{normalized[-40:]}...")
            continue
        
        ext = "jpg"
        if "png" in img_url:
            ext = "png"
        elif "gif" in img_url:
            ext = "gif"
        filename = f"{i:03d}_{hashlib.md5(normalized.encode()).hexdigest()[:8]}.{ext}"
        save_path = images_dir / filename
        
        if save_path.exists():
            print(f"    [{i}/{len(image_urls)}] 跳过（已存在）：{filename}")
            success_count += 1
            downloaded.add(normalized)
            continue
        
        print(f"    [{i}/{len(image_urls)}] 下载中：{img_url[-50:]}...")
        if download_image(img_url, save_path):
            success_count += 1
            downloaded.add(normalized)
            time.sleep(0.3)
        else:
            print(f"    [{i}/{len(image_urls)}] 下载失败")
    
    # 生成 Markdown 文件
    print("  [5/5] 生成 Markdown 文件...")
    md_path = article_dir / f"【微信公众号】-{title}-{time.strftime('%Y%m%d_%H%M%S')}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n")
        f.write(f"- **爬取时间**: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **所属平台**: 微信公众号\n")
        f.write(f"- **作品标题**: {title}\n")
        f.write(f"- **原文链接**: {url}\n")
        f.write("\n---\n\n")
        f.write("## 本地图片列表\n\n")
        for img_file in sorted(images_dir.iterdir()):
            if img_file.is_file():
                rel_path = Path("images") / img_file.name
                f.write(f"![{img_file.name}]({rel_path})\n")
    
    print()
    print(f"[完成] 成功下载 {success_count}/{len(image_urls)} 张图片")
    print(f"  目录: {article_dir}")
    print(f"  MD文件: {md_path.name}")
    sys.exit(0)

if __name__ == "__main__":
    main()
