#!/usr/bin/env python3
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from playwright.sync_api import sync_playwright

url = 'https://mp.weixin.qq.com/s/oMq_g8s8nmdW5CPCY-LfRA'

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe', headless=True)
    page = browser.new_page()
    page.goto(url, wait_until='networkidle', timeout=30000)
    page.wait_for_selector('#js_content', timeout=20000)
    
    # 分步调试
    r1 = page.evaluate('''() => {
        const imgs = document.querySelectorAll('#js_content img');
        return {count: imgs.length};
    }''')
    print(f'#js_content img: {r1}')
    
    r2 = page.evaluate('''() => {
        const imgs = document.querySelectorAll('img.swiper_item_img');
        return {count: imgs.length};
    }''')
    print(f'swiper_item_img: {r2}')
    
    r3 = page.evaluate('''() => {
        const imgs = document.querySelectorAll('.swiper_item_img');
        return {count: imgs.length, tags: Array.from(imgs).map(el => el.tagName)};
    }''')
    print(f'.swiper_item_img: {r3}')
    
    # 直接找所有包含mmbiz的img
    r4 = page.evaluate('''() => {
        const allImgs = document.querySelectorAll('img');
        const mmbiz = [];
        allImgs.forEach(img => {
            if ((img.src || '').includes('mmbiz.qpic.cn')) {
                mmbiz.push({src: img.src.substring(0, 80), cls: img.className});
            }
        });
        return {total: allImgs.length, mmbizCount: mmbiz.length, mmbiz: mmbiz.slice(0, 5)};
    }''')
    print(f'\n所有img中mmbiz: {json.dumps(r4, ensure_ascii=False)}')
    
    browser.close()
