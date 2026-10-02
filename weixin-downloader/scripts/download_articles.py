# -*- coding: utf-8 -*-
"""
WeChat Article Downloader - extracts text and images from mp.weixin.qq.com articles.

Three modes:
  1. DOWNLOAD: python download_articles.py -f urls.txt
     Downloads text + images. Add --flat E:\dir to auto-reorganize after download.

  2. CHECK: python download_articles.py --check WORK_DIR
     Scans for incomplete downloads, reports what's missing.

  3. REDO: python download_articles.py --redo WORK_DIR
     Finds incomplete articles and re-downloads their images. Existing files kept.

Quick workflow:
  python download_articles.py -f urls.txt --flat OUTPUT_DIR
  python download_articles.py --check weixin_articles
  python download_articles.py --redo weixin_articles --flat OUTPUT_DIR

Output per article: {out_dir}/{article_id}/data.json + {title}.md + images/*.jpg
Flat output: {flat_dir}/{title}/{001}.{ext}
"""
import json, os, re, sys, ssl, time, urllib.request, hashlib, argparse, traceback, shutil
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
THREADS = 8
DEFAULT_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'weixin_articles')
FIXED_DIR = r"E:\微信推文图片"

def clean_entities(s):
    s = s.replace('\\x0a', '\n').replace('\\n', '\n').replace('\\/', '/')
    for e, r in [('&amp;', '&'), ('&lt;', '<'), ('&gt;', '>'), ('&nbsp;', ' '), ('&quot;', '"')]:
        s = s.replace(e, r)
    return s

def extract_title(html):
    for pat in [
        r'var\s+msg_title\s*=\s*"([^"]*)"',
        r'og:title"\s+content="([^"]*)"',
        r'<title>([^<]+)</title>',
        r'"rich_media_title"\s*:\s*"([^"]*)"',
    ]:
        m = re.search(pat, html, re.I)
        if m and m.group(1).strip():
            return clean_entities(m.group(1).strip())
    return ''

def extract_account(html):
    m = re.search(r'var\s+nickname\s*=\s*"([^"]*)"', html)
    return m.group(1).strip() if m else ''

def extract_content(html):
    pos = html.find('id="js_content"')
    if pos >= 0:
        tag_end = html.find('>', pos)
        if tag_end >= 0:
            for marker in ['<div id="js_pc_qr_code"', '<div id="js_share_layer"',
                            '</div>\n<script', '</div>\r\n<script', '</div> <script']:
                ep = html.find(marker, tag_end + 1)
                if ep > tag_end:
                    chunk = html[tag_end + 1:ep]
                    chunk = re.sub(r'<script[^>]*>.*?</script>', '', chunk, flags=re.DOTALL)
                    chunk = re.sub(r'<style[^>]*>.*?</style>', '', chunk, flags=re.DOTALL)
                    text = ' '.join(t.strip() for t in re.findall(r'>([^<]{3,})<', chunk) if t.strip())
                    text = clean_entities(text)
                    text = re.sub(r'\s+', ' ', text).strip()
                    if len(text) > 30:
                        return text

    for pat in [r'var\s+desc\s*=\s*"([^"]*)"', r"var\s+desc\s*=\s*'([^']*)'",
                r'var\s+msg_desc\s*=\s*"([^"]*)"']:
        m = re.search(pat, html, re.I | re.DOTALL)
        if m and m.group(1).strip():
            d = clean_entities(m.group(1).strip())
            if len(d) > 30:
                return d

    m = re.search(r'og:description"\s+content="([^"]*)"', html, re.I)
    if m and m.group(1).strip():
        d = clean_entities(m.group(1).strip())
        if len(d) > 10:
            return d

    pos = html.find('id="js_article"')
    if pos >= 0:
        tag_end = html.find('>', pos)
        if tag_end >= 0:
            ep = html.find('<script', tag_end + 1)
            if ep < 0:
                ep = min(len(html), tag_end + 50001)
            chunk = html[tag_end + 1:ep]
            chunk = re.sub(r'<script[^>]*>.*?</script>', '', chunk, flags=re.DOTALL)
            chunk = re.sub(r'<style[^>]*>.*?</style>', '', chunk, flags=re.DOTALL)
            text = '\n'.join(
                t.strip() for t in re.findall(r'>([^<]{3,})<', chunk)
                if t.strip() and not t.strip().startswith('//')
            )
            text = clean_entities(text)
            text = re.sub(r'\n{3,}', '\n\n', text).strip()
            if len(text) > 20:
                return text
    return ''

def extract_image_urls(html):
    full = set(re.findall(r"https?://mmbiz\.qpic\.cn/[^\"'\\\s<>]+", html))
    proto = set(re.findall(r"//mmbiz\.qpic\.cn/[^\"'\\\s<>]+", html))
    raw = sorted(full | {'https:' + u for u in proto})
    return [u for u in raw if 'pic_blank' not in u and not u.endswith('.js') and 'htmledition' not in u]

def sanitize_filename(name):
    return re.sub(r'[\\/*?:"<>|\x00-\x1f]', '', name)[:80].strip()

def sanitize_title(name):
    name = re.sub(r'[\n\r]', '', name)
    name = re.sub(r'[\\/*?:"<>|\t]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    if not name:
        name = '(untitled)'
    return name[:80]

def download_image(url, path, timeout=15):
    agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.42',
    ]
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    for ua in agents:
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': ua, 'Referer': 'https://mp.weixin.qq.com/',
            })
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                data = resp.read()
                if len(data) < 100:
                    continue
                with open(path, 'wb') as f:
                    f.write(data)
                return True
        except Exception:
            continue
    return False

def parallel_download(task_list, threads=THREADS):
    results = {}
    def _dl(args):
        u, p = args
        if os.path.exists(p) and os.path.getsize(p) > 100:
            return p, True
        return p, download_image(u, p)
    with ThreadPoolExecutor(max_workers=threads) as executor:
        futures = {executor.submit(_dl, (u, p)): (u, p) for u, p in task_list}
        for future in as_completed(futures):
            try:
                path, ok = future.result()
                results[path] = ok
            except Exception:
                pass
    return results

def process_article(aid, url, out_dir, text_only=False):
    article_dir = os.path.join(out_dir, aid)
    img_dir = os.path.join(article_dir, 'images')
    os.makedirs(img_dir, exist_ok=True)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    try:
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                         '..', '..', '..', 'scrapling-weixin-downloader', 'src'))
        from scrapling import Fetcher
        fetcher = Fetcher()
    except ImportError:
        print('[ERROR] Scrapling not found. Install: pip install scrapling')
        raise

    resp = fetcher.get(url, timeout=30)
    html = resp.html_content

    if 'wappoc_appmsgcaptcha' in html or 'captcha' in html.lower():
        title = extract_title(html) or ''
        img_urls = extract_image_urls(html)
        page_type = 'captcha'
        print('  [WARN] CAPTCHA page')
    else:
        title = extract_title(html)
        img_urls = extract_image_urls(html)
        page_type = 'share' if 'share_content_page' in html else 'standard'

    account = extract_account(html)
    text = extract_content(html)
    print('  [%s] "%s" | %d chars | %d imgs' % (page_type, title[:35] if title else '???', len(text), len(img_urls)))

    downloaded = 0
    if not text_only and img_urls:
        tasks = []
        for j, img_url in enumerate(img_urls):
            url_hash = hashlib.md5(img_url.encode()).hexdigest()[:12]
            ext = '.jpg'
            for e in ['png', 'webp', 'gif', 'jpeg']:
                if 'wx_fmt=%s' % e in img_url.lower():
                    ext = '.%s' % e
                    break
            fpath = os.path.join(img_dir, '%03d_%s%s' % (j + 1, url_hash, ext))
            tasks.append((img_url, fpath))
        dl_map = parallel_download(tasks)
        downloaded = sum(1 for ok in dl_map.values() if ok)
        img_list = [os.path.basename(p) if dl_map.get(p) else None for p in [t[1] for t in tasks]]
    else:
        img_list = []

    data = {
        'success': True, 'version': '2.0.0', 'page_type': page_type,
        'metadata': {'title': title, 'account': account, 'author': '',
                     'publish_time': '', 'description': '',
                     'source_url': url, 'extracted_at': datetime.now().isoformat()},
        'content': {'text': text, 'html': ''},
        'stats': {'content_chars': len(text),
                  'paragraph_count': text.count('\n') + 1 if text else 0,
                  'image_count': len(img_urls), 'images_downloaded': downloaded},
        'image_urls': img_urls,
        'images': [{'url': u, 'file': f} for u, f in zip(img_urls, img_list)] if img_list else [],
    }
    with open(os.path.join(article_dir, 'data.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    safe_title = sanitize_filename(title) if title else aid
    md_path = os.path.join(article_dir, '%s.md' % safe_title)
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('# %s\n\n- **Account**: %s\n- **URL**: %s\n- **Type**: %s | chars=%d | imgs=%d/%d\n\n---\n\n%s' % (
            title, account, url, page_type, len(text), downloaded, len(img_urls), text))
        if downloaded > 0:
            f.write('\n\n---\n\n## Images (%d/%d)\n\n' % (downloaded, len(img_urls)))
            for item in data['images']:
                if item['file']:
                    f.write('![%s](images/%s)\n\n' % (item['file'][:30], item['file']))

    return {'success': True, 'id': aid, 'title': title, 'chars': len(text),
            'page_type': page_type, 'images_found': len(img_urls), 'images_downloaded': downloaded}

# Reorganize to flat {title}/{N}.ext structure
def reorganize_flat(src_dir, flat_dir):
    os.makedirs(flat_dir, exist_ok=True)
    stats = {'total': 0, 'moved': 0, 'missing': 0, 'images': 0}
    for entry in os.scandir(src_dir):
        if not entry.is_dir():
            continue
        json_path = os.path.join(entry.path, 'data.json')
        if not os.path.exists(json_path):
            continue
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        title = data.get('metadata', {}).get('title', '').strip() or entry.name
        img_count = data.get('stats', {}).get('image_count', 0)
        if img_count == 0:
            continue
        stats['total'] += 1
        src_img = os.path.join(entry.path, 'images')
        if not os.path.isdir(src_img):
            stats['missing'] += 1
            continue
        imgs = sorted(f for f in os.listdir(src_img)
                      if os.path.splitext(f)[1].lower() in ('.jpg','.jpeg','.png','.webp','.gif'))
        if not imgs:
            stats['missing'] += 1
            continue
        # Folder name: {title}_{md5(url)[:8]}
        url = data.get('metadata', {}).get('source_url', '')
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8] if url else hashlib.md5(entry.name.encode()).hexdigest()[:8]
        safe_title = sanitize_title(title)
        dst_dir = os.path.join(flat_dir, '%s_%s' % (safe_title, url_hash))
        os.makedirs(dst_dir, exist_ok=True)
        # Copy images as img_001.jpg, img_002.jpg, ...
        copied = 0
        for i, fname in enumerate(imgs, 1):
            ext = os.path.splitext(fname)[1].lower()
            dst_path = os.path.join(dst_dir, 'img_%03d%s' % (i, ext))
            if not os.path.exists(dst_path):
                shutil.copy2(os.path.join(src_img, fname), dst_path)
                copied += 1
        stats['images'] += copied
        # Write README.md
        downloaded = data.get('stats', {}).get('images_downloaded', len(imgs))
        total_imgs = data.get('stats', {}).get('image_count', len(imgs))
        skipped = max(0, total_imgs - downloaded)
        readme_path = os.path.join(dst_dir, 'README.md')
        readme_text = '# %s\n\nSource: %s\n\nImages: %d saved, %d skipped, 0 failed\n' % (title, url, copied, skipped)
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(readme_text)
    print('Reorganized %d articles -> %s (%d images)' % (stats['total'], flat_dir, stats['images']))
    return stats

# Check for incomplete downloads
def check_dir(src_dir):
    incomplete = []
    for entry in os.scandir(src_dir):
        if not entry.is_dir():
            continue
        json_path = os.path.join(entry.path, 'data.json')
        if not os.path.exists(json_path):
            continue
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        expected = data.get('stats', {}).get('image_count', 0)
        if expected == 0:
            continue
        src_img = os.path.join(entry.path, 'images')
        actual = len([f for f in os.listdir(src_img)
                       if os.path.splitext(f)[1].lower() in ('.jpg','.jpeg','.png','.webp','.gif')]) if os.path.isdir(src_img) else 0
        title = data.get('metadata', {}).get('title', '')[:40]
        if actual < expected:
            incomplete.append({
                'id': entry.name, 'title': title, 'expected': expected,
                'actual': actual, 'missing': expected - actual,
                'url': data.get('metadata', {}).get('source_url', ''),
            })
            print('  INCOMPLETE: %s | "%s" | %d/%d' % (entry.name, title, actual, expected))
    return incomplete

def main():
    parser = argparse.ArgumentParser(description='WeChat Article Downloader')
    parser.add_argument('urls', nargs='*', help='WeChat article URLs')
    parser.add_argument('--file', '-f', help='File with URLs (one per line)')
    parser.add_argument('--out', '-o', default=DEFAULT_OUT, help='Output directory')
    parser.add_argument('--text-only', action='store_true', help='Skip image download')
    parser.add_argument('--batch', '-b', default='auto', help='Batch label')
    parser.add_argument('--name', '-n', default='_summary', help='Summary filename')
    parser.add_argument('--flat', help='Reorganize to flat {title} folders under this dir')
    parser.add_argument('--check', help='Check dir for incomplete downloads (reports only)')
    parser.add_argument('--redo', help='Find incompletes in dir and re-download images')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    # CHECK mode
    if args.check:
        print('Checking: %s' % args.check)
        inc = check_dir(args.check)
        print('\nTotal incomplete: %d / Total missing images: %d' % (
            len(inc), sum(i['missing'] for i in inc)))
        if inc and args.flat:
            urls = [i['url'] for i in inc if i['url']]
            if urls:
                print('\nUse --redo to re-download these %d articles' % len(urls))
        return

    # REDO mode
    if args.redo:
        print('Scanning for incomplete articles in: %s' % args.redo)
        inc = check_dir(args.redo)
        if not inc:
            print('All complete!')
            if args.flat:
                reorganize_flat(args.redo, args.flat)
            return
        print('\nRe-downloading %d incomplete articles...' % len(inc))
        args.urls = [i['url'] for i in inc if i['url']]
        args.file = None
        args.out = args.redo
        args.text_only = False
        if not args.batch or args.batch == 'auto':
            args.batch = 'redo_' + datetime.now().strftime('%Y%m%d_%H%M')
        if not args.name or args.name == '_summary':
            args.name = '_redo_summary'

    # DOWNLOAD mode
    all_urls = list(args.urls)
    if args.file:
        with open(args.file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    all_urls.append(line)
    seen = set()
    unique = []
    for u in all_urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    if len(all_urls) > len(unique):
        print('[INFO] Removed %d duplicate URLs' % (len(all_urls) - len(unique)))

    articles = [(re.search(r'/s/([^?&]+)', u).group(1), u) for u in unique]
    if not articles:
        print('[ERROR] No valid WeChat article URLs found')
        sys.exit(1)

    batch = args.batch if args.batch != 'auto' else datetime.now().strftime('%Y%m%d_%H%M')
    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)
    summary_path = os.path.join(out_dir, '%s.json' % args.name)

    print('=' * 60)
    print('WeChat Downloader: %d articles -> %s' % (len(articles), out_dir))
    print('Text only: %s | Threads: %d' % (args.text_only, THREADS))
    print('=' * 60)

    results, start_time = [], time.time()
    for i, (aid, url) in enumerate(articles, 1):
        print('\n[%d/%d] %s' % (i, len(articles), aid))
        try:
            results.append(process_article(aid, url, out_dir, args.text_only))
        except Exception as e:
            traceback.print_exc()
            results.append({'success': False, 'id': aid, 'error': str(e),
                            'title': '', 'chars': 0, 'images_found': 0, 'images_downloaded': 0})
        time.sleep(0.2)

    elapsed = time.time() - start_time
    ok = sum(1 for r in results if r['success'])
    fail = len(results) - ok
    imgs_dl = sum(r.get('images_downloaded', 0) for r in results)
    imgs_found = sum(r.get('images_found', 0) for r in results)

    print('\n' + '=' * 60)
    print('DONE: %d/%d OK, %d FAIL in %.1fs | Images: %d / %d' % (
        ok, len(results), fail, elapsed, imgs_dl, imgs_found))

    summary = {
        'batch': batch, 'total': len(results), 'ok': ok, 'fail': fail,
        'images_found': imgs_found, 'images_downloaded': imgs_dl,
        'elapsed_seconds': round(elapsed, 1),
        'standard_count': sum(1 for r in results if r.get('page_type') == 'standard'),
        'share_count': sum(1 for r in results if r.get('page_type') == 'share'),
        'results': results, 'timestamp': datetime.now().isoformat(),
    }
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    print('Summary: %s' % summary_path)

    no_text = [r for r in results if r.get('chars', 0) < 10 and r['success']]
    if no_text:
        print('[WARN] %d articles with <10 chars (likely image galleries or captcha)' % len(no_text))

    # Auto-reorganize if --flat specified (always, even if no new images this run)
    if args.flat:
        print('\n--- Reorganizing to %s ---' % args.flat)
        reorganize_flat(out_dir, args.flat)

    sys.exit(0 if fail == 0 else 1)

if __name__ == '__main__':
    main()
