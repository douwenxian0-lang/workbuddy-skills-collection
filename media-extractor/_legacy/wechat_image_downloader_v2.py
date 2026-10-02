#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
微信文章图片下载器 v2
直接提取并下载微信文章中的所有图片
修复：移除所有 emoji，避免 Windows GBK 编码错误
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
from urllib.parse import urljoin, urlparse

# 强制 UTF-8 输出
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'buffer'):
    if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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
        print("    [警告] 未找到 #js_content，尝试全局搜索图片...")
        img_tags = soup.find_all("img")
    else:
        img_tags = content_div.find_all("img")
    
    for img in img_tags:
        # 微信图片有多个可能的属性
        src = (img.get("data-src") or 
                img.get("src") or 
                img.get("data-url") or 
                "")
        
        if not src:
            continue
        
        # 过滤无效的图片（如透明像素、表情等）
        if "mmbiz.qpic.cn" not in src and not src.startswith("http"):
            continue
        
        # 转为绝对 URL
        if not src.startswith("http"):
            src = urljoin(base_url, src)
        
        if src not in images:
            images.append(src)
    
    return images

def download_image(url: str, save_path: Path, timeout: int = 60) -> bool:
    """下载单张图片"""
    try:
        # 微信图片需要特定的 Referer
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
    # 去掉尺寸参数，只保留 hash 部分
    match = re.match(r"(https?://mmbiz\.qpic\.cn/(mmbiz_jpg|mmbiz_png|mmbiz_gif|mmbiz)/[^/?]+)", url)
    if match:
        return match.group(1)
    return url

def main():
    if len(sys.argv) < 3:
        print("Usage: python wechat_image_downloader.py <URL> <output_dir>")
        sys.exit(1)
    
    url = sys.argv[1].strip()
    output_dir = Path(sys.argv[2])
    
    print("[微信图片下载器] 开始处理")
    print(f"  URL: {url[:80]}...")
    print(f"  输出: {output_dir}")
    print()
    
    # 获取 HTML
    print("  [1/4] 获取文章页面...")
    html = get_html(url)
    if not html:
        print("  [失败] 无法获取页面内容")
        sys.exit(1)
    
    # 提取标题（针对微信文章）
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    
    # 方法1: 微信文章专用选择器
    title_selectors = [
        "h1.rich_media_title",
        "#activity-name",
        ".rich_media_title",
        "h1#activity-name",
    ]
    for selector in title_selectors:
        tag = soup.select_one(selector)
        if tag:
            title = tag.get_text(strip=True)
            break
    
    # 方法2: 通用 h1 或 title
    if not title:
        tag = soup.find("h1") or soup.find("title")
        if tag:
            title = tag.get_text(strip=True)
    
    # 移除 " - 微信公众号" 后缀
    title = re.sub(r'\s*-\s*微信公众号\s*$', '', title)
    
    # 清理文件名非法字符
    title = re.sub(r'[<>:"/\\|?*]', '_', title)[:100] or "untitled"
    print(f"  标题: {title}")
    
    # 提取图片 URL
    print("  [2/4] 提取图片 URL...")
    image_urls = extract_images_from_wechat(html, url)
    print(f"  找到 {len(image_urls)} 张图片")
    
    if not image_urls:
        print("  [警告] 未找到任何图片")
        sys.exit(0)
    
    # 创建输出目录
    article_dir = output_dir / "微信公众号" / title
    images_dir = article_dir / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    # 下载图片（带去重）
    print(f"  [3/4] 下载图片到 {images_dir}...")
    downloaded = set()
    success_count = 0
    
    for i, img_url in enumerate(image_urls, 1):
        # 归一化 URL 用于去重
        normalized = normalize_wechat_image_url(img_url)
        if normalized in downloaded:
            print(f"    [{i}/{len(image_urls)}] 跳过（已下载）：{normalized[-40:]}...")
            continue
        
        # 生成文件名
        ext = "jpg"
        if "png" in img_url:
            ext = "png"
        elif "gif" in img_url:
            ext = "gif"
        filename = f"{i:03d}_{hashlib.md5(normalized.encode()).hexdigest()[:8]}.{ext}"
        save_path = images_dir / filename
        
        # 跳过已存在的文件
        if save_path.exists():
            print(f"    [{i}/{len(image_urls)}] 跳过（已存在）：{filename}")
            success_count += 1
            downloaded.add(normalized)
            continue
        
        # 下载
        print(f"    [{i}/{len(image_urls)}] 下载中：{img_url[-50:]}...")
        if download_image(img_url, save_path):
            success_count += 1
            downloaded.add(normalized)
            time.sleep(0.3)  # 限速，防止被封
        else:
            print(f"    [{i}/{len(image_urls)}] 下载失败")
    
    # 生成 Markdown 文件
    print("  [4/4] 生成 Markdown 文件...")
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
