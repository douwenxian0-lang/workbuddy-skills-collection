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
    
    # 这篇文章可能是"图片消息"类型（封面图+多图），不是普通图文
    # 检查整个页面的图片，不限于js_content
    result = page.evaluate('''() => {
        // 查找页面所有带 mmbiz.qpic.cn 的图片（微信图片CDN）
        const allImgs = [];
        document.querySelectorAll('img').forEach((img, i) => {
            const src = img.src || '';
            const ds = img.getAttribute('data-src') || '';
            if (src.includes('mmbiz.qpic.cn') || ds.includes('mmbiz.qpic.cn')) {
                allImgs.push({
                    idx: i,
                    src: src.substring(0, 150),
                    dataSrc: ds.substring(0, 150),
                    parentClass: img.parentElement?.className,
                    width: img.width,
                    height: img.height,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight
                });
            }
        });
        
        // 也检查是否有图片容器 div 带背景图
        const bgContainers = [];
        document.querySelectorAll('[style*="mmbiz"]').forEach(el => {
            bgContainers.push({
                tag: el.tagName,
                class: el.className?.substring(0, 100),
                style: el.getAttribute('style')?.substring(0, 200)
            });
        });
        
        return {
            weixinImgs: allImgs,
            bgContainers: bgContainers.slice(0, 10),
            totalImgTags: document.querySelectorAll('img').length
        };
    }''')
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    browser.close()
