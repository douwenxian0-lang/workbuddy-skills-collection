#!/usr/bin/env python3
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

url = 'https://mp.weixin.qq.com/s/oMq_g8s8nmdW5CPCY-LfRA'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    page = browser.new_page()
    page.goto(url, wait_until='networkidle', timeout=30000)
    page.wait_for_selector('#js_content', timeout=20000)
    
    html = page.content()
    soup = BeautifulSoup(html, 'html.parser')
    
    content = soup.select_one('#js_content')
    if content:
        imgs = content.find_all('img')
        print(f'#js_content 内 img 数量: {len(imgs)}')
        for i, img in enumerate(imgs[:15]):
            ds = img.get('data-src') or ''
            sr = img.get('src') or ''
            cls = img.get('class', [])
            print(f'  [{i}] class={cls}')
            print(f'      data-src={ds[:100] if ds else "(空)"}')
            print(f'      src={sr[:100] if sr else "(空)"}')
            print()
    else:
        print('#js_content 未找到!')
        
        # 检查页面里所有img
        all_imgs = soup.find_all('img')
        print(f'页面总 img: {len(all_imgs)}')
        for i, img in enumerate(all_imgs[:10]):
            sr = img.get('src') or ''
            print(f'  [{i}] src={sr[:80]}')
    
    browser.close()
