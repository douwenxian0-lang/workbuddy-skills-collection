# -*- coding: utf-8 -*-
"""继续批量提取剩余10篇微信文章"""
import sys, os, time
sys.path.insert(0, os.path.dirname(__file__))
from extract_browser import extract_article

urls = [
    "https://mp.weixin.qq.com/s/vb1kf-Z3asml4Bs9sO6ofA",
    "https://mp.weixin.qq.com/s/pbjWYUOetW6WQtmeT9QlkQ",
    "https://mp.weixin.qq.com/s/vhlxtW89_KqjDcitx0lAYg",
    "https://mp.weixin.qq.com/s/QE9oWsDotnnNY6reqMCqRg",
    "https://mp.weixin.qq.com/s/843PZ5hpevYF1GnwX7hHlw",
    "https://mp.weixin.qq.com/s/8_3xIcSXlyhoQybt6OdrAw",
    "https://mp.weixin.qq.com/s/YD9i18kXCR-OLZe0DmmYsg",
    "https://mp.weixin.qq.com/s/KIHVYrkkXZQrU0auhtB9KQ",
    "https://mp.weixin.qq.com/s/sjbTE7YkU3ZmWXen9D-dbw",
    "https://mp.weixin.qq.com/s/dafXGkETF3Ejhq7iGtirLg",
    "https://mp.weixin.qq.com/s/Xp5eYI0eV58kR4sCDfQxDw",
]

output_dir = r"E:\微信推文图片"
os.makedirs(output_dir, exist_ok=True)

ok, fail = 0, 0
for i, url in enumerate(urls, 1):
    short = url.split("/")[-1][:12]
    print(f"\n[{i}/11] {short} ...")
    try:
        saved, skipped, save_dir, title = extract_article(url, output_dir)
        folder = os.path.basename(save_dir)
        t = title.encode('ascii','replace').decode('ascii')
        f = folder.encode('ascii','replace').decode('ascii')
        print(f"    Title: {t}")
        print(f"    Folder: {f}")
        print(f"    Saved: {saved}  Skipped: {skipped}")
        if saved > 0:
            ok += 1
        else:
            fail += 1
    except Exception as e:
        print(f"    ERROR: {e}")
        fail += 1
    time.sleep(3)

print(f"\n=== DONE: {ok} OK, {fail} failed ===")
