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
    
    # 测试完整提取逻辑
    result = page.evaluate('''() => {
        const result = [];
        const seen = new Set();
        
        // 方法1
        document.querySelectorAll('#js_content img, .rich_media_content img').forEach(img => {
            let src = img.getAttribute('data-src') || img.src || '';
            if (src.startsWith('http') && !seen.has(src)) {
                const cls = (img.className || '').toString();
                if (!cls.match(/avatar|reward|qr_code|loading/)) {
                    seen.add(src);
                    result.push({url: src, alt: img.alt || '', method: 1});
                }
            }
        });
        
        console.log('方法1找到:', result.length);
        
        // 方法2
        if (result.length === 0) {
            const swiperImgs = document.querySelectorAll('img.swiper_item_img');
            console.log('swiper_item_img 数量:', swiperImgs.length);
            swiperImgs.forEach(img => {
                const src = img.src || '';
                console.log('swiper src:', src.substring(0, 80));
                if (src.includes('mmbiz.qpic.cn') && !seen.has(src)) {
                    let cleanSrc = src;
                    // 简单处理：直接用原src
                    if (!seen.has(cleanSrc)) {
                        seen.add(cleanSrc);
                        result.push({url: cleanSrc, alt: '', method: 2});
                    }
                }
            });
        }
        
        return {count: result.length, urls: result.map(r => r.url.substring(0, 100))};
    }''')
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    browser.close()
