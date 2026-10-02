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
    
    # 用JS直接提取图片URL，绕过HTML解析问题
    result = page.evaluate('''() => {
        const content = document.querySelector('#js_content');
        if (!content) return { error: 'no content' };
        
        // 方法1: 查找所有img标签的data-src和src
        const imgs = content.querySelectorAll('img');
        const imgData = [];
        imgs.forEach((img, i) => {
            imgData.push({
                idx: i,
                dataSrc: img.getAttribute('data-src'),
                src: img.getAttribute('src'),
                outerHTML: img.outerHTML.substring(0, 300)
            });
        });
        
        // 方法2: 查找背景图
        const allEls = content.querySelectorAll('*');
        const bgImgs = [];
        allEls.forEach(el => {
            const bg = getComputedStyle(el).backgroundImage;
            if (bg && bg !== 'none' && bg.includes('url(')) {
                bgImgs.push({ tag: el.tagName, class: el.className, bg: bg.substring(0, 150) });
            }
        });
        
        // 方法3: 检查是否有 mp-image 或自定义组件
        const customTags = [];
        content.querySelectorAll('*').forEach(el => {
            if (el.tagName.startsWith('MP-') || el.tagName.includes('-IMAGE') || el.tagName.includes('-image')) {
                customTags.push({
                    tag: el.tagName,
                    src: el.getAttribute('src'),
                    dataSrc: el.getAttribute('data-src'),
                    outerHTML: el.outerHTML.substring(0, 300)
                });
            }
        });
        
        return {
            imgCount: imgs.length,
            imgs: imgData.slice(0, 10),
            bgImgCount: bgImgs.length,
            bgImgs: bgImgs.slice(0, 5),
            customTagCount: customTags.length,
            customTags: customTags.slice(0, 10),
            contentInnerHTML_length: content.innerHTML.length
        };
    }''')
    
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    browser.close()
