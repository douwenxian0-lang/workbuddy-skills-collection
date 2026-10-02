#!/usr/bin/env python3
import sys, io, json
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
    
    # 检查所有子标签，不只是img
    if content:
        # 查找所有可能包含图片的标签
        all_tags = content.find_all(['img', 'mp-common-mpimage', 'mp-image', 'section', 'div'])
        print(f'#js_content 内相关标签数: {len(all_tags)}')
        
        for tag in all_tags[:20]:
            tn = tag.name
            attrs = {k:v for k,v in tag.attrs.items() if k not in ['class','style']}
            print(f'  <{tn}> attrs={attrs}')
            if tag.get('src') or tag.get('data-src'):
                print(f'      src={tag.get("src","")[:80]}  data-src={tag.get("data-src","")[:80]}')
        
        # 直接看原始HTML片段（前3000字符）
        raw = str(content)[:5000]
        print('\n--- 原始HTML前5000字符 ---')
        print(raw)
    
    browser.close()
