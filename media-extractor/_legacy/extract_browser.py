# -*- coding: utf-8 -*-
"""Wechat article image extractor v7 - Fixed URL dedup for same image at different sizes."""
import sys, os, re, hashlib, time
from urllib.parse import urlparse, unquote

# URL-level skip keywords
URL_SKIP = ('qr_code','qrcode','weapp','miniprogram','favicon')
# Filename-level skip keywords
FN_SKIP = ('cover','banner','avatar','head','profile','logo','icon',
           'qr','qrcode','poster','placeholder','loading','spinner','favicon')
# Specific filenames to always skip
SKIP_NAMES = {'01.jpg','01.png','01.webp','01.jpeg','thumb.jpg','thumb.png',
              'icon_app.png','icon_android.png','icon_ios.png','mp_header.jpg'}
SMALL_KB = 10

IMG_EXTENSIONS = ('.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff')

# ── Known garbage URL patterns (微信内部组件/永远404) ──────────────────────
GARBAGE_PATTERNS = [
    re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*\.png[_\$]', re.I),
    re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*\.(gif|jpg|jpeg|webp)_', re.I),
    re.compile(r'arrow_down_regular\.svg', re.I),
    re.compile(r'refresh_regular\.svg', re.I),
    re.compile(r'wxopensdk\.js', re.I),
    re.compile(r'pic_blank\.gif', re.I),
]
KNOWN_SMALL = {
    'f5d316c8-e902-44fe-80a1-5320cb32d508.png',
    '1c1526b5-99ba-49a3-9a82-5750bb722c63.png',
    'ad530d26-e227-4123-a070-cf5939d96d03.png',
    '321b820e-8d8a-4083-8e0f-40b2b01fc8ef.png',
    '8f4c69e9-a78b-4c26-a4ce-affa1c47366d.png',
    '3c0a6519-c7ac-424b-9d1e-6096a089e49b.png',
    '680acf97-edcd-4bff-877b-52652c7a0f8a.png',
    '46f802c6-de67-45f3-966a-3d634fafa935.png',
    'eb336270-6883-4391-8e4c-4c26230baa2e.svg',
}


def _is_garbage_url(url):
    if not url:
        return False
    fname = os.path.basename(url.split('?')[0].split('&')[0])
    if fname.lower() in KNOWN_SMALL:
        return True
    for pat in GARBAGE_PATTERNS:
        if pat.search(fname):
            return True
    cleaned = _clean_image_url(url)
    if cleaned != url:
        cleaned_fname = os.path.basename(cleaned.split('?')[0].split('&')[0])
        for pat in GARBAGE_PATTERNS:
            if pat.search(cleaned_fname):
                return True
    return False


def should_skip(url, fname, size=0):
    u, fn, kb = url.lower(), fname.lower(), size/1024
    if fn in SKIP_NAMES:
        return True
    if any(k in u for k in URL_SKIP):
        return True
    if any(k in fn for k in FN_SKIP):
        return True
    if kb > 0 and kb < SMALL_KB:
        return True
    return False


def _is_verified_page(html):
    if not html:
        return True
    bad_patterns = [
        '环境异常', '验证中心', '请在微信客户端', '操作频繁',
        'invalid request', '过于频繁', '网页停止访问',
        '投诉反馈', '帐号异常', '安全验证', '人机验证',
        '访问过于频繁', '系统检测', 'anti-spider',
    ]
    for p in bad_patterns:
        if p in html:
            return True
    if len(html) < 800:
        return True
    captcha_markers = ['verify_code', 'captcha_img', 'verify_slide', 'tcaptcha']
    for m in captcha_markers:
        if m in html.lower():
            return True
    return False


def _clean_image_url(url):
    if not url:
        return url
    for suffix in ('.wx_card_root', '.wx_card_root_common', '.common_buytogether_root'):
        idx = url.find(suffix)
        if idx > 0:
            url = url[:idx]
    for marker in (');', '):', '}.', '} '):
        idx = url.find(marker)
        if idx > 0:
            url = url[:idx]
            break
    url = url.rstrip('_"\' +&<>)')
    return url

def _filter_image_url(url):
    if not url or len(url) < 20:
        return False
    try:
        if not url.startswith('http'):
            return False
        url = _clean_image_url(url)
        clean = url.split('?')[0].split('&')[0]
        parsed = urlparse(clean)
        path_lower = parsed.path.lower()
        has_img_ext = any(path_lower.endswith(e) for e in IMG_EXTENSIONS)
        is_mmbiz = 'mmbiz' in url
        is_wx_res = 'res.wx.qq.com' in url or 'file.wx.qq.com' in url
        if _is_garbage_url(url):
            return False
        return has_img_ext or is_mmbiz or is_wx_res
    except Exception:
        return False


def download_file(session, url, ref, out_path):
    try:
        r = session.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Referer': ref,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        }, timeout=60, stream=True)
        if r.status_code != 200:
            return False, 'HTTP %s' % r.status_code
        data = b''.join(r.iter_content(65536))
        if len(data) < 512:
            return False, 'Too small (%d bytes)' % len(data)
        with open(out_path, 'wb') as f:
            f.write(data)
        return True, None
    except Exception as e:
        return False, str(e)


# ── HTTP extraction ──────────────────────────────────────────────────────────

def extract_with_requests(url, output_dir, retries=2):
    import requests
    header_sets = [
        {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        },
        {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        },
    ]

    for attempt in range(retries + 1):
        session = requests.Session()
        session.trust_env = False
        session.proxies = {'http': None, 'https': None}
        session.headers.update(header_sets[attempt % len(header_sets)])

        print('Fetching (HTTP #%d): %s' % (attempt + 1, url))
        try:
            r = session.get(url, timeout=45)
        except Exception as e:
            if attempt < retries:
                print('  Retry: %s' % str(e))
                time.sleep(2)
                continue
            return 0, 0, None, '请求失败: %s' % str(e)

        if r.status_code != 200:
            if attempt < retries:
                print('  Retry: HTTP %d' % r.status_code)
                time.sleep(2)
                continue
            return 0, 0, None, 'HTTP %d' % r.status_code

        html = r.text
        print('HTML: %d bytes' % len(html))

        if _is_verified_page(html):
            if attempt < retries:
                print('  Retry: verified/captcha page detected')
                time.sleep(3)
                continue
            return 0, 0, None, '微信验证拦截'

        saved, skipped, save_dir, title = extract_from_html(html, url, output_dir, session)
        if saved > 0 or title:
            return saved, skipped, save_dir, title
        if attempt < retries:
            print('  Retry: no images found')
            time.sleep(2)
            continue

    return 0, 0, None, '提取失败'


# ── Playwright extraction (fixed anti-detection + URL dedup) ──────────────────

def extract_with_playwright(url, output_dir, retries=2):
    from playwright.sync_api import sync_playwright

    for attempt in range(retries + 1):
        print('Fetching (Browser #%d): %s' % (attempt + 1, url))
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                    args=[
                        '--no-proxy-server',
                        '--disable-blink-features=AutomationControlled',
                        '--disable-dev-shm-usage',
                        '--no-first-run',
                        '--no-service-autorun',
                        '--password-store=basic',
                        '--disable-browser-side-navigation',
                        '--disable-features=IsolateOrigins,site-per-process',
                        '--disable-web-security',
                    ]
                )

                context = browser.new_context(
                    user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                    locale='zh-CN',
                    timezone_id='Asia/Shanghai',
                    viewport={'width': 1920, 'height': 1080},
                    extra_http_headers={
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate, br',
                    },
                    permissions=['geolocation'],
                )

                context.route('**/*google-analytics*', lambda route: route.abort())
                context.route('**/*baidu.com*', lambda route: route.abort())
                context.route('**/*qq.com/wap SafeBro*', lambda route: route.abort())

                page = context.new_page()

                page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                    Object.defineProperty(navigator, 'languages', {get: () => ['zh-CN', 'zh', 'en']});
                    window.chrome = { runtime: {} };
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                """)

                try:
                    page.goto(url, wait_until='domcontentloaded', timeout=45000)
                except Exception as e:
                    print('  Navigation error (continuing anyway): %s' % str(e))

                try:
                    page.wait_for_selector('#js_content, .rich_media_content, .app', timeout=12000)
                except Exception:
                    pass
                page.wait_for_timeout(3000)

                html = page.content()
                print('  HTML (browser): %d bytes' % len(html))

                if _is_verified_page(html):
                    page.close()
                    context.close()
                    browser.close()
                    if attempt < retries:
                        print('  Retry: verified page detected')
                        time.sleep(5)
                        continue
                    return 0, 0, None, '浏览器也被拦截'

                # ── Extract images with URL dedup (same image at different sizes) ──
                # Key fix: normalize mmbiz URLs by removing size parameter, dedup by base URL
                img_urls = page.evaluate('''() => {
                    // Track URLs by their "base" path (without size parameter)
                    // mmbiz URLs: https://mmbiz.qpic.cn/xxx/{size}?wx_fmt=jpeg
                    // Same image at different sizes has different {size} numbers
                    // We normalize by replacing size with 0 and dedup by normalized URL
                    
                    const urlMap = new Map(); // normalizedUrl -> {originalUrl, size}
                    
                    const normalizeMmbiz = (url) => {
                        // Extract size from path: /640? /0? /300?
                        const m = url.match(/\\/([0-9]+)(?:\\?|$)/);
                        if (m) {
                            const size = parseInt(m[1], 10);
                            // Normalize: replace size with 0
                            const normalized = url.replace(/\\/([0-9]+)(?:\\?|$)/, '/0?');
                            return {normalized, size, isOriginal: size === 0};
                        }
                        return {normalized: url, size: 999999, isOriginal: false};
                    };
                    
                    const add = (url) => {
                        if (!url) return;
                        if (url.includes('qr_code') || url.includes('qrcode') || url.includes('weapp') || url.includes('favicon')) return;
                        
                        const {normalized, size, isOriginal} = normalizeMmbiz(url);
                        
                        if (urlMap.has(normalized)) {
                            const existing = urlMap.get(normalized);
                            // Prefer original (size=0) or higher size
                            // size=0 means original quality (best)
                            const existingSize = existing.isOriginal ? Infinity : existing.size;
                            const newSize = isOriginal ? Infinity : size;
                            if (newSize > existingSize) {
                                urlMap.set(normalized, {originalUrl: url, size, isOriginal});
                            }
                        } else {
                            urlMap.set(normalized, {originalUrl: url, size, isOriginal});
                        }
                    };

                    // 1. data-src (most common)
                    document.querySelectorAll('img[data-src]').forEach(el => add(el.dataset.src));

                    // 2. data-url
                    document.querySelectorAll('[data-url]').forEach(el => {
                        const u = el.dataset.url;
                        if (u && u.includes('mmbiz')) add(u);
                        const bg = window.getComputedStyle(el).backgroundImage;
                        const m = bg.match(/url\\(['"]?(https?:\\/[^)'"]+)/);
                        if (m) add(m[1]);
                    });

                    // 3. data-original / data-lazy-src
                    document.querySelectorAll('[data-original], [data-lazy-src]').forEach(el => {
                        const u = el.dataset.original || el.dataset.lazySrc;
                        if (u) add(u);
                    });

                    // 4. src attributes in article content
                    document.querySelectorAll('#js_content img, .rich_media_content img').forEach(el => {
                        const src = el.src || '';
                        if (src && (src.includes('mmbiz') || /\\.(jpg|jpeg|png|gif|webp)$/i.test(src))) add(src);
                    });

                    // 5. Style background-image in article
                    document.querySelectorAll('#js_content [style*="background"], .rich_media_content [style*="background"]').forEach(el => {
                        const bg = window.getComputedStyle(el).backgroundImage;
                        const m = bg.match(/url\\(['"]?(https?:\\/[^)'"]+)/);
                        if (m) add(m[1]);
                    });

                    // 6. figure / picture elements
                    document.querySelectorAll('figure img, picture source').forEach(el => {
                        const src = el.src || el.getAttribute('srcset') || '';
                        const m = src.match(/(https?:[/][^\\s,"']+)/);
                        if (m) add(m[1]);
                    });

                    // Return deduped URLs (prefer highest quality version)
                    const results = [];
                    for (const [normalized, entry] of urlMap) {
                        results.push(entry.originalUrl);
                    }
                    return results;
                }''')

                print('  Found %d image URLs (deduped from potential duplicates)' % len(img_urls))

                # Also try innerHTML regex as backup (but apply same dedup logic)
                inner_html_urls = _extract_urls_from_html(html)
                for u in inner_html_urls:
                    if u not in img_urls:
                        # Check if this is a duplicate of an already-added URL
                        normalized = _normalize_mmbiz_url(u)
                        is_dup = any(_normalize_mmbiz_url(existing) == normalized for existing in img_urls)
                        if not is_dup:
                            img_urls.append(u)
                print('  Total after HTML regex merge: %d' % len(img_urls))

                # ── Get title ──
                title = page.title()
                if not title:
                    for pat in [r'var\s+msg_title\s*=\s*[\'"](.*?)[\'"]',
                                r'<h1[^>]*class="rich_media_title"[^>]*>(.*?)</h1>',
                                r'<title>(.*?)</title>']:
                        m = re.search(pat, html, re.DOTALL)
                        if m:
                            t = m.group(1).strip()
                            if t:
                                title = t
                                break
                title = re.sub(r'&[a-zA-Z]+;', '', title).strip()
                print('  Title: %s' % title.encode('ascii', 'replace').decode('ascii'))

                page.close()
                context.close()
                browser.close()

                import requests
                session = requests.Session()
                session.trust_env = False
                session.proxies = {'http': None, 'https': None}
                session.headers.update({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'zh-CN,zh;q=0.9',
                })

                saved, skipped, save_dir, title = download_images(img_urls, url, output_dir, title, session)
                if saved > 0 or title:
                    return saved, skipped, save_dir, title
                if attempt < retries:
                    time.sleep(3)
                    continue

        except ImportError:
            return 0, 0, None, 'Playwright not installed'
        except Exception as e:
            print('  Browser error: %s' % str(e))
            if attempt < retries:
                time.sleep(3)
                continue

    return 0, 0, None, '浏览器提取全部失败'


# ── URL normalization for dedup ─────────────────────────────────────────────

def _normalize_mmbiz_url(url):
    """Normalize mmbiz URL by removing size parameter for dedup."""
    if not url or 'mmbiz' not in url:
        return url
    # Replace /640? /0? /300? with /0?
    return re.sub(r'/([0-9]+)(?:\?|$)', '/0?', url)


# ── HTML extraction (HTTP mode) ─────────────────────────────────────────────

def _extract_urls_from_html(html):
    """Extract image URLs from raw HTML text using all known patterns."""
    img_urls = []
    seen_normalized = set()

    patterns = [
        r'data-src="(https?://[^"]+)"',
        r'data-w-src="(https?://[^"]+)"',
        r"JsDecode\(['\"]( *https?://[^'\"]+)['\"]\)",
        r'cdn_url(?:_\w+)?:\s*[\'"]( *https?://[^"\']+)[\'"]',
        r'["\'](https?://mmbiz\.qpic\.cn[^"\']{20,})["\']',
        r'["\'](https?://mmbiz\.qlogo\.cn[^"\']{20,})["\']',
        r'data-url="(https?://[^"]+)"',
        r'data-original="(https?://[^"]+)"',
        r'data-lazy-src="(https?://[^"]+)"',
        r'background-image:\s*url\(["\']?(https?://[^"\');]+)["\']?\)',
        r'style="[^"]*background[^"]*:\s*url\(["\']?(https?://[^"\');]+)["\']?\)',
        r'data-srcset="([^"]+)"',
        r'<img[^>]+src="(https?://[^"]+)"',
        r'(https?://res\.wx\.qq\.com[^"\'<>\s]{20,})',
        r'(https?://file\.wx\.qq\.com[^"\'<>\s]{20,})',
    ]

    for pat in patterns:
        for m in re.finditer(pat, html, re.DOTALL):
            u = m.group(1).strip()
            if _filter_image_url(u):
                # Dedup by normalized URL
                normalized = _normalize_mmbiz_url(u)
                if normalized not in seen_normalized:
                    seen_normalized.add(normalized)
                    img_urls.append(u)

    # Parse srcset manually
    for m in re.finditer(r'data-srcset="([^"]+)"', html):
        srcset = m.group(1)
        for part in srcset.split(','):
            part = part.strip().split()[0]
            if _filter_image_url(part):
                normalized = _normalize_mmbiz_url(part)
                if normalized not in seen_normalized:
                    seen_normalized.add(normalized)
                    img_urls.append(part)

    return img_urls


def extract_from_html(html, url, output_dir, session):
    """Extract images from raw HTML content (HTTP mode)."""
    title = ''
    for pat in [r'var\s+msg_title\s*=\s*[\'"](.*?)[\'"]',
                r'var\s+ct\s*=\s*[\'"](.*?)[\'"]',
                r'property=["\']og:title["\'][^>]*content=["\'](.*?)["\']',
                r'content=["\'](.*?)["\'][^>]*property=["\']og:title["\']',
                r'<h1[^>]*class="rich_media_title"[^>]*>(.*?)</h1>',
                r'<title>(.*?)</title>']:
        m = re.search(pat, html, re.DOTALL)
        if m:
            t = m.group(1).strip()
            if t:
                title = t
                break
    title = re.sub(r'&[a-zA-Z]+;', '', title).strip()
    print('Title: %s' % title.encode('ascii', 'replace').decode('ascii'))

    img_urls = _extract_urls_from_html(html)
    print('Found %d image URLs' % len(img_urls))
    return download_images(img_urls, url, output_dir, title, session)


# ── MD5 dedup ───────────────────────────────────────────────────────────────

def _build_global_md5_index(output_dir):
    """Scan all existing images across ALL subfolders for cross-folder dedup."""
    global_md5 = set()
    try:
        for folder_name in os.listdir(output_dir):
            folder_path = os.path.join(output_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue
            for fn in os.listdir(folder_path):
                if fn.lower().endswith(('.jpg','.jpeg','.png','.gif','.webp')):
                    try:
                        fp = os.path.join(folder_path, fn)
                        global_md5.add(hashlib.md5(open(fp, 'rb').read()).hexdigest())
                    except Exception:
                        pass
    except Exception:
        pass
    if global_md5:
        print('Global dedup: %d existing images indexed' % len(global_md5))
    return global_md5


# ── Download images ───────────────────────────────────────────────────────────

def download_images(img_urls, url, output_dir, title, session):
    """Download images and save to disk."""
    safe = re.sub(r'[<>:"|?*\\/\r\n]', '_', title)[:40].strip() or 'article'
    url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
    folder = '%s_%s' % (safe, url_hash)
    save_dir = os.path.join(output_dir, folder)

    if not img_urls:
        print('No images found, skipping folder creation.')
        return 0, 0, None, title

    os.makedirs(save_dir, exist_ok=True)
    print('Save dir: %s' % save_dir.encode('ascii', 'replace').decode('ascii'))

    seen_md5 = _build_global_md5_index(output_dir)
    saved, skipped, failed = 0, 0, 0

    for i, img_url in enumerate(img_urls, 1):
        parsed = urlparse(img_url.split('?')[0])
        fname_raw = unquote(os.path.basename(parsed.path))
        if not fname_raw or '.' not in fname_raw:
            fname_raw = 'img_%03d.jpg' % i
        fname = re.sub(r'[^\w\-.]', '_', fname_raw)[:80]
        if not os.path.splitext(fname)[1]:
            fname += '.jpg'

        n = 1
        fpath = os.path.join(save_dir, fname)
        while os.path.exists(fpath):
            base, ext = os.path.splitext(fname)
            fname = '%s_%d%s' % (base, n, ext)
            fpath = os.path.join(save_dir, fname)
            n += 1

        if _is_garbage_url(img_url):
            skipped += 1
            print('  [%d] SKIP (garbage): %s' % (i, fname))
            continue

        ok, err = download_file(session, img_url, url, fpath)
        if not ok:
            failed += 1
            print('  [%d] FAIL: %s (%s)' % (i, fname, err))
            continue

        sz = os.path.getsize(fpath)
        if should_skip(img_url, fname, sz):
            os.remove(fpath)
            skipped += 1
            print('  [%d] SKIP: %s (%dKB)' % (i, fname, sz//1024))
            continue

        try:
            md5 = hashlib.md5(open(fpath, 'rb').read()).hexdigest()
        except Exception:
            md5 = None

        if md5 and md5 in seen_md5:
            os.remove(fpath)
            skipped += 1
            print('  [%d] SKIP (dup): %s' % (i, fname))
            continue
        if md5:
            seen_md5.add(md5)
        saved += 1
        print('  [%d] OK: %s (%dKB)' % (i, fname, sz//1024))

    md_path = os.path.join(save_dir, 'README.md')
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write('# %s\n\n' % title)
        f.write('Source: %s\n\n' % url)
        f.write('Images: %d saved, %d skipped, %d failed\n' % (saved, skipped, failed))

    print('\nDone: %d saved, %d skipped, %d failed | %s' % (saved, skipped, failed, save_dir.encode('ascii', 'replace').decode('ascii')))
    return saved, skipped, save_dir, title


# ── Main entry ───────────────────────────────────────────────────────────────

def _get_title_from_browser(url):
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',
                args=['--no-proxy-server', '--disable-blink-features=AutomationControlled']
            )
            context = browser.new_context(
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                locale='zh-CN',
                viewport={'width': 1920, 'height': 1080},
            )
            context.set_default_timeout(30000)
            page = context.new_page()
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            page.goto(url, wait_until='domcontentloaded', timeout=30000)
            page.wait_for_timeout(3000)
            t = page.title()
            page.close()
            context.close()
            browser.close()
            return t or ''
    except Exception as e:
        print('Browser title fetch failed: %s' % str(e))
        return ''


def extract_article(url, output_dir):
    import hashlib as _hm, re as _re, os as _os

    saved, skipped, save_dir, title = extract_with_requests(url, output_dir)

    if saved > 0 and not title:
        real_title = _get_title_from_browser(url)
        if real_title:
            title = real_title
            url_hash = _hm.md5(url.encode()).hexdigest()[:8]
            safe = _re.sub(r'[<>:"`|?*\\/\r\n]', '_', title)[:40].strip() or 'article'
            new_folder = '%s_%s' % (safe, url_hash)
            new_path = _os.path.join(output_dir, new_folder)
            if save_dir and save_dir != new_path and _os.path.exists(save_dir):
                _os.rename(save_dir, new_path)
                save_dir = new_path
                print('Folder renamed: %s' % new_folder)
        return saved, skipped, save_dir, title

    if saved > 0:
        return saved, skipped, save_dir, title

    print('HTTP mode found 0 images, switching to browser mode...')
    return extract_with_playwright(url, output_dir)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python extract_browser.py <url> <output_dir>')
        sys.exit(1)
    url = sys.argv[1]
    out_dir = sys.argv[2]
    os.makedirs(out_dir, exist_ok=True)
    extract_article(url, out_dir)