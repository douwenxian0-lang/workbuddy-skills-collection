# -*- coding: utf-8 -*-
"""Re-download 4 failed articles + check all folders for duplicate images."""
import sys, os, hashlib, time
sys.path.insert(0, r'C:\Users\Administrator\.qclaw\skills\media-extractor')
from extract_browser import extract_article

urls = [
    "https://mp.weixin.qq.com/s/4SbI1i2CZJrslF0WkQ54_w",
    "https://mp.weixin.qq.com/s/NKhuXPWiZbCcYdfjQJVhAQ",
    "https://mp.weixin.qq.com/s/QAuqlDw-_fW7OtwsUm9APQ",
    "https://mp.weixin.qq.com/s/5hattqxjk131Ly7TIs7CLA",
]

output_dir = r"E:\微信推文图片"

for i, url in enumerate(urls, 1):
    short = url.split("/")[-1][:12]
    print(f"\n[{i}/4] {short} ...")
    try:
        saved, skipped, save_dir, title = extract_article(url, output_dir)
        folder = os.path.basename(save_dir)
        print(f"    Title: {title.encode('ascii','replace').decode('ascii')}")
        print(f"    Folder: {folder.encode('ascii','replace').decode('ascii')}")
        print(f"    Saved: {saved}  Skipped: {skipped}")
    except Exception as e:
        print(f"    ERROR: {e}")
    time.sleep(3)

# Now check ALL folders for duplicate images (same MD5, different filenames)
print("\n\n=== Checking for duplicate images ===")
exts = ('.jpg', '.jpeg', '.png', '.gif', '.webp')
for d in sorted(os.listdir(output_dir)):
    full = os.path.join(output_dir, d)
    if not os.path.isdir(full):
        continue
    files = [x for x in os.listdir(full) if x.lower().endswith(exts)]
    if not files:
        continue
    # Compute MD5 for each image
    md5_map = {}
    for f in files:
        fp = os.path.join(full, f)
        try:
            md5 = hashlib.md5(open(fp, 'rb').read()).hexdigest()[:8]
        except:
            md5 = "err"
        if md5 not in md5_map:
            md5_map[md5] = []
        md5_map[md5].append(f)
    # Find duplicates
    dups = {k: v for k, v in md5_map.items() if len(v) > 1}
    if dups:
        dup_count = sum(len(v) - 1 for v in dups.values())
        dname = d.encode('ascii', 'replace').decode('ascii')
        print(f"\n[{dname}] {len(files)} imgs, {dup_count} duplicates:")
        for md5, flist in dups.items():
            print(f"  MD5:{md5} -> {flist}")
    else:
        dname = d.encode('ascii', 'replace').decode('ascii')
        print(f"[{dname}] {len(files)} imgs, no duplicates")
