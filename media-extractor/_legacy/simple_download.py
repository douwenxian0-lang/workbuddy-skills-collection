#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化版微信图片下载器
不依赖标题提取，直接用 URL hash 作为目录名
"""

import sys
import io
import os
import re
import time
import hashlib
import requests
from pathlib import Path
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# 强制 UTF-8 输出
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# 请求头
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://mp.weixin.qq.com/",
}

def get_html(url: str, timeout: int = 30) -> str:
    """获取页面 HTML"""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.encoding = resp.apparent_encoding or "utf-8"
        return resp.text
    except Exception as e:
        print(f"    [错误] 获取页面失败: {e}")
        return ""

def extract_images_from_wechat(html: str, base_url: str) -> list:
    """从微信文章 HTML 中提取所有图片 URL"""
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
    try:
        headers = HEADERS.copy()
        headers["Referer"] = "https://mp.weixin.qq.com/"
        
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
        print("Usage: python simple_download.py <URL> <output_dir>")
        sys.exit(1)
    
    url = sys.argv[1].strip()
    output_dir = Path(sys.argv[2])
    
    print(f"[简化版] 处理: {url[:60]}...")
    
    # 获取 HTML
    html = get_html(url)
    if not html:
        print("  [失败] 无法获取页面")
        sys.exit(1)
    
    # 提取图片 URL
    image_urls = extract_images_from_wechat(html, url)
    print(f"  找到 {len(image_urls)} 张图片")
    
    if not image_urls:
        print("  [警告] 未找到图片")
        sys.exit(0)
    
    # 用 URL hash 作为目录名（不依赖标题）
    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    article_dir = output_dir / "微信公众号" / url_hash
    images_dir = article_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    # 下载图片
    downloaded = set()
    success_count = 0
    
    for i, img_url in enumerate(image_urls, 1):
        normalized = normalize_wechat_image_url(img_url)
        if normalized in downloaded:
            continue
        
        ext = "jpg"
        if "png" in img_url:
            ext = "png"
        elif "gif" in img_url:
            ext = "gif"
        
        filename = f"{i:03d}_{hashlib.md5(normalized.encode()).hexdigest()[:8]}.{ext}"
        save_path = images_dir / filename
        
        if save_path.exists():
            success_count += 1
            downloaded.add(normalized)
            continue
        
        print(f"    [{i}/{len(image_urls)}] 下载: {img_url[-40:]}...")
        if download_image(img_url, save_path):
            success_count += 1
            downloaded.add(normalized)
            time.sleep(0.3)
    
    # 生成 Markdown（不含标题，因为提取不到）
    md_path = article_dir / f"wechat_{url_hash}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# 微信文章\n\n")
        f.write(f"- **URL**: {url}\n")
        f.write(f"- **下载时间**: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"- **图片数量**: {success_count}\n")
        f.write("\n---\n\n")
        for img_file in sorted(images_dir.iterdir()):
            if img_file.is_file():
                f.write(f"![image](images/{img_file.name})\n")
    
    print(f"[完成] {success_count}/{len(image_urls)} 张图片")
    print(f"  目录: {article_dir}")
    sys.exit(0)

if __name__ == "__main__":
    main()
