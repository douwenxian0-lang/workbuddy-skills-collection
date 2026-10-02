#!/usr/bin/env python3
"""
微信公众号文章批量提取器（带图片下载）
使用系统已安装的 Chrome 浏览器
每篇文章一个文件夹，图片按顺序命名
"""

import sys
import json
import re
import os
import socket
import time
import io
import hashlib
import requests
from urllib.parse import urlparse, urlsplit

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
OUTPUT_DIR = r"E:\11111_重抓"

def validate_url(url):
    """验证 URL 安全性"""
    if not url or not isinstance(url, str):
        return False, "URL 不能为空"
    url = url.strip()
    if not url.startswith(('http://', 'https://')):
        return False, "仅支持 HTTP/HTTPS 协议"
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ""
        if not hostname:
            return False, "无法解析主机名"
        blocked_hosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']
        for blocked in blocked_hosts:
            if hostname == blocked or hostname.startswith(blocked):
                return False, f"禁止访问内网地址: {hostname}"
        blocked_prefixes = [f'10.'] + [f'172.{i}.' for i in range(16, 32)] + ['192.168.']
        for prefix in blocked_prefixes:
            if hostname.startswith(prefix):
                return False, f"禁止访问内网地址: {hostname}"
        try:
            resolved_ip = socket.getaddrinfo(hostname, None)[0][4][0]
            for prefix in blocked_prefixes:
                if resolved_ip.startswith(prefix) or resolved_ip.startswith(('127.', '0.')):
                    return False, f"域名解析到内网地址: {hostname} -> {resolved_ip}"
        except socket.gaierror:
            return False, f"无法解析域名: {hostname}"
        return True, None
    except Exception as e:
        return False, f"URL 解析错误: {str(e)}"

def clean_text(text):
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def sanitize_filename(name, max_len=60):
    """清理文件名，用于文件夹名"""
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    name = name.strip('. ')
    # 限制长度，保留空间给图片编号
    return name[:max_len] if len(name) > max_len else name

def get_file_extension(url):
    """从 URL 获取文件扩展名"""
    path = urlsplit(url).path
    ext = os.path.splitext(path)[1].lower()
    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']:
        return ext
    return '.jpg'  # 默认 jpg

def download_image(url, filepath, headers):
    """下载单张图片"""
    try:
        response = requests.get(url, headers=headers, timeout=30, stream=True)
        response.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"    [图片下载失败] {url[:50]}... - {e}")
        return False

def extract_article(page, url):
    """提取单篇文章内容"""
    try:
        page.goto(url, wait_until='networkidle', timeout=30000)
        page.wait_for_selector('#js_content, .rich_media_content', timeout=20000)
        html = page.content()
        soup = BeautifulSoup(html, 'html.parser')

        # 提取元数据
        metadata = {}
        title = ""
        title_elem = soup.select_one('#activity_name, .rich_media_title, h1')
        if title_elem:
            title = clean_text(title_elem.get_text())
        metadata['title'] = title

        account = ""
        account_elem = soup.select_one('#js_name, .profile_nickname, .rich_media_meta_nickname')
        if account_elem:
            account = clean_text(account_elem.get_text())
        metadata['account'] = account

        author = ""
        author_elem = soup.select_one('#js_author_name, .rich_media_meta_text')
        if author_elem:
            author = clean_text(author_elem.get_text())
        metadata['author'] = author

        publish_time = ""
        time_elem = soup.select_one('#publish_time, .rich_media_meta_text em')
        if time_elem:
            publish_time = clean_text(time_elem.get_text())
        metadata['publish_time'] = publish_time

        description = ""
        meta_desc = soup.find('meta', {'name': 'description'})
        if meta_desc:
            description = meta_desc.get('content', '')
        metadata['description'] = description
        metadata['source_url'] = url

        # 提取正文
        content = ""
        content_elem = soup.select_one('#js_content, .rich_media_content')
        if content_elem:
            for script in content_elem(['script', 'style', 'iframe']):
                script.decompose()
            paragraphs = []
            for p in content_elem.find_all(['p', 'section']):
                text = clean_text(p.get_text())
                if text and len(text) > 5:
                    paragraphs.append(text)
            content = '\n\n'.join(paragraphs)

        # 提取图片 - 使用JS直接从DOM提取（支持普通图文+图片消息类型）
        images = []
        try:
            img_list = page.evaluate('''() => {
                const result = [];
                const seen = new Set();
                
                // 方法1: 普通图文 - js_content 里的 img (data-src 或 src)
                document.querySelectorAll('#js_content img, .rich_media_content img').forEach(img => {
                    let src = img.getAttribute('data-src') || img.src || '';
                    if (src.startsWith('http') && !seen.has(src)) {
                        const cls = (img.className || '').toString();
                        if (!cls.match(/avatar|reward|qr_code|loading/)) {
                            seen.add(src);
                            result.push({url: src, alt: img.alt || ''});
                        }
                    }
                });
                
                // 方法2: 图片消息类型 - swiper_item_img 容器内的 img
                if (result.length === 0) {
                    document.querySelectorAll('.swiper_item_img img, [class*=swiper] img').forEach(img => {
                        const src = img.src || '';
                        if (src.includes('mmbiz.qpic.cn') && !seen.has(src)) {
                            seen.add(src);
                            result.push({url: src, alt: ''});
                        }
                    });
                }
                
                return result;
            }''')
            if img_list:
                for item in img_list:
                    images.append(item)
        except Exception as e:
            print(f"    [图片提取警告] JS提取失败: {e}, 回退到BeautifulSoup")
            for img in soup.select('#js_content img, .rich_media_content img'):
                src = img.get('data-src') or img.get('src')
                if src and src.startswith('http'):
                    images.append({'url': src, 'alt': img.get('alt', '')})

        return {
            'success': True,
            'metadata': metadata,
            'content': content,
            'images': images
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'url': url
        }

def save_article_with_images(result, folder_path, headers):
    """保存文章内容和图片到文件夹"""
    if not result.get('success'):
        # 保存失败记录
        with open(os.path.join(folder_path, 'FAILED.txt'), 'w', encoding='utf-8') as f:
            f.write(f"提取失败\n\n错误: {result.get('error', '未知错误')}\n")
        return 0, 0

    meta = result.get('metadata', {})
    content = result.get('content', '')
    images = result.get('images', [])

    # 保存 README.md（文字内容）
    readme_path = os.path.join(folder_path, 'README.md')
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(f"# {meta.get('title', '无标题')}\n\n")
        f.write(f"- **公众号**: {meta.get('account', '未知')}\n")
        f.write(f"- **作者**: {meta.get('author', '未知')}\n")
        f.write(f"- **发布时间**: {meta.get('publish_time', '未知')}\n")
        f.write(f"- **原文链接**: {meta.get('source_url', '')}\n")
        if meta.get('description'):
            f.write(f"- **摘要**: {meta['description']}\n")
        f.write(f"- **图片数量**: {len(images)}\n")
        f.write(f"\n---\n\n{content}\n")

    # 下载图片
    downloaded = 0
    failed = 0
    for i, img in enumerate(images, 1):
        img_url = img['url']
        ext = get_file_extension(img_url)
        img_filename = f"img_{i:03d}{ext}"
        img_path = os.path.join(folder_path, img_filename)
        
        print(f"    下载图片 {i}/{len(images)}: {img_filename}", end='')
        if download_image(img_url, img_path, headers):
            downloaded += 1
            print(" ✓")
        else:
            failed += 1
            print(" ✗")
        
        # 图片下载间隔，避免过快
        if i < len(images):
            time.sleep(0.3)

    return downloaded, failed

def main():
    # 去重链接
    urls = []
    seen = set()
    for line in sys.stdin:
        url = line.strip()
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    if not urls:
        # 也可以从命令行参数读取文件
        if len(sys.argv) > 1:
            with open(sys.argv[1], 'r', encoding='utf-8') as f:
                for line in f:
                    url = line.strip()
                    if url and url not in seen:
                        seen.add(url)
                        urls.append(url)

    if not urls:
        print("没有提供链接")
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"共 {len(urls)} 个链接（去重后），输出目录: {OUTPUT_DIR}")

    # 图片下载用的 headers
    img_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
    }

    success_count = 0
    fail_count = 0
    total_images = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
        context = browser.new_context(
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = context.new_page()

        for i, url in enumerate(urls, 1):
            print(f"\n[{i}/{len(urls)}] 正在提取: {url[:60]}...")

            is_valid, error_msg = validate_url(url)
            if not is_valid:
                print(f"  [SKIP] URL invalid: {error_msg}")
                fail_count += 1
                continue

            result = extract_article(page, url)

            if result.get('success'):
                title = result['metadata'].get('title', f'article_{i}')
                folder_name = sanitize_filename(title)
                
                # 避免文件夹名冲突
                folder_path = os.path.join(OUTPUT_DIR, folder_name)
                counter = 1
                while os.path.exists(folder_path):
                    folder_path = os.path.join(OUTPUT_DIR, f"{folder_name}_{counter}")
                    counter += 1
                
                os.makedirs(folder_path, exist_ok=True)
                
                # 保存内容和图片
                downloaded, failed_img = save_article_with_images(result, folder_path, img_headers)
                total_images += downloaded
                
                print(f"  [OK] 已保存到: {os.path.basename(folder_path)}")
                print(f"       图片: {downloaded} 成功, {failed_img} 失败")
                success_count += 1
            else:
                print(f"  [FAIL] Error: {result.get('error', '未知错误')}")
                # 保存失败记录
                fail_folder = os.path.join(OUTPUT_DIR, f"FAILED_{i}")
                os.makedirs(fail_folder, exist_ok=True)
                with open(os.path.join(fail_folder, 'FAILED.txt'), 'w', encoding='utf-8') as f:
                    f.write(f"提取失败\n\n错误: {result.get('error', '未知错误')}\nURL: {url}\n")
                fail_count += 1

            # 文章间隔，避免频繁请求
            if i < len(urls):
                time.sleep(2)

        browser.close()

    print(f"\n========== 完成 ==========")
    print(f"成功: {success_count} | 失败: {fail_count} | 总计: {len(urls)}")
    print(f"下载图片: {total_images} 张")
    print(f"输出目录: {OUTPUT_DIR}")

if __name__ == '__main__':
    main()
