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
    
    # 检查 swiper_item_img 是否在soup中
    swiper_imgs = soup.select('img.swiper_item_img')
    print(f'BeautifulSoup 找到 swiper_item_img: {len(swiper_imgs)}')
    
    # 检查整个页面所有 img.mmbiz
    all_mmbiz = soup.find_all('img', src=re.compile('mmbiz.qpic.cn'))
    print(f'BeautifulSoup 找到 mmbiz img: {len(all_mmbiz)}')
    
    # 用JS直接提取swiper图片URL并返回
    urls = page.evaluate('''() => {
        const imgs = document.querySelectorAll('img.swiper_item_img');
        const result = [];
        const seen = new Set();
        imgs.forEach(img => {
            const src = img.src || '';
            if (src.includes('mmbiz.qpic.cn') && !seen.has(src)) {
                seen.add(src);
                result.push(src);
            }
        });
        return result;
    }''')
    print(f'\nJS找到 swiper 图片: {len(urls)}')
    for u in urls:
        print(f'  {u[:120]}')
    
    browser.close()
