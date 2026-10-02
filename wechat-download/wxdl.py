#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""wxdl · 微信推文图片一键下载器（wechat-download 技能核心）

特性:
  - 支持普通推文(data-src) + 图片消息类推文(cdn_url + background-image)
  - 多链接批量: 多个 URL 用空格分隔，或传入含链接的 txt 文件路径
  - 并发下载(6线程) + 失败自动重试(2次退避)
  - 魔数校验真实图片格式(不轻信 wx_fmt)，自动纠正扩展名
  - 断点续传: 已存在且有效的文件自动跳过
  - trust_env=False 直连，绕过系统代理对微信域名的 502 拦截
  - 输出与 QClaw media-extractor 格式一致:
      <输出根目录>/<文章标题>/001.ext... + README.md + urls.txt + .article_id.txt

用法:
  python wxdl.py <URL> [URL2 URL3 ... | 链接文件.txt] [输出根目录]
  输出根目录缺省为 E:\\微信推文图片
"""
import concurrent.futures as cf
import io
import re
import sys
import time
from pathlib import Path

import requests

if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DEFAULT_OUT = r"E:\微信推文图片"

S = requests.Session()
S.trust_env = False  # 微信为国内站点，直连；系统代理会 502
S.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://mp.weixin.qq.com/",
    "Accept-Language": "zh-CN,zh;q=0.9",
})

IMG_PATTERNS = (
    r'data-src="(https?://mmbiz\.qpic\.cn/[^"]+)"',
    r"cdn_url:\s*'(https?://mmbiz\.qpic\.cn/[^']+)'",
    r'src="(https?://mmbiz\.qpic\.cn/[^"]+)"',
    r"url\((https?://mmbiz\.qpic\.cn/[^)]+)\)",
)


def sniff_ext(data: bytes, fallback: str) -> str:
    """魔数判断真实格式，比 wx_fmt 可靠"""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return fallback


def get_html(url: str) -> str:
    """抓文章页；微信偶发弹验证页（无 js_content/msg_title），自动重试"""
    last = ""
    for attempt in range(3):
        try:
            r = S.get(url, timeout=30)
            r.raise_for_status()
            r.encoding = "utf-8"
            last = r.text
            if "js_content" in last or "msg_title" in last:
                return last
        except Exception:
            pass
        time.sleep(2 * (attempt + 1))
    return last


def get_title(html: str) -> str:
    for pat in (
        r"window\.msg_title\s*=\s*window\.title\s*=\s*'(.*?)'",
        r"var msg_title = '(.*?)'",
        r'property="og:title" content="(.*?)"',
        r"<title>(.*?)</title>",
    ):
        m = re.search(pat, html, re.S)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return "未知标题"


def normalize_url(u: str) -> str:
    """清洗 JS 转义与 HTML 实体：\\x26 → &，&amp;amp; → &"""
    u = u.replace("\\x26", "&")
    u = re.sub(r"&(?:amp;)+", "&", u)
    return u


def extract_images(html: str) -> list:
    found = []
    for pat in IMG_PATTERNS:
        for m in re.finditer(pat, html):
            found.append((m.start(), normalize_url(m.group(1))))
    found.sort(key=lambda x: x[0])
    seen, uniq = set(), []
    for _, u in found:
        if u not in seen:
            seen.add(u)
            uniq.append(u)
    return uniq


def valid_file(p: Path) -> bool:
    return p.is_file() and p.stat().st_size > 500


def md5_of(p: Path) -> str:
    import hashlib
    h = hashlib.md5()
    h.update(p.read_bytes())
    return h.hexdigest()


def adir_glob(path: Path):
    """按序号前缀(001)匹配目录下已存在的文件"""
    return path.parent.glob(f"{path.stem}.*")


def ahash(path: Path, size: int = 16):
    """16x16 平均感知哈希（256bit），用于识别同图不同分辨率的近似重复。Pillow 缺失返回 None"""
    try:
        from PIL import Image
    except ImportError:
        return None
    try:
        im = Image.open(path)
        px = list(im.convert("L").resize((size, size), Image.LANCZOS).getdata())
        avg = sum(px) / len(px)
        return "".join("1" if v > avg else "0" for v in px)
    except Exception:
        return None


PHASH_THRESHOLD = 10  # 256bit aHash；实测同图不同分辨率距离 0~7，不同图 ≥24，取 10 居中


def perceptual_dedupe(kept, removed_counter):
    """近似重复（同图不同分辨率/格式，MD5 必不同）按感知哈希去重，保留分辨率更高的一张"""
    kept2 = []  # [{h, url, path, pixels}]
    removed = 0
    for url, path in kept:
        h = ahash(path)
        try:
            from PIL import Image
            with Image.open(path) as im:
                pixels = im.width * im.height
        except Exception:
            pixels = 0
        dup_of, best = None, PHASH_THRESHOLD + 1
        if h is not None:
            for k in kept2:
                if k["h"] is None:
                    continue
                d = sum(a != b for a, b in zip(h, k["h"]))
                if d < best:
                    best, dup_of = d, k
        if dup_of is not None:
            removed_counter["phash"] += 1
            removed += 1
            if pixels > dup_of["pixels"]:  # 新图分辨率更高 → 换掉旧图
                dup_of["path"].unlink()
                dup_of.update(h=h, url=url, path=path, pixels=pixels)
            else:
                path.unlink()
        else:
            kept2.append({"h": h, "url": url, "path": path, "pixels": pixels})
    return [(k["url"], k["path"]) for k in kept2], removed


def dedupe_and_rename(results, adir: Path):
    """按内容 MD5 去重（URL 不同但图片相同），去重后重新编号 001..N。
    返回 (保留列表[(new_idx, url, path)], 去重数, 无效数, 失败列表)"""
    kept, dropped_dup, dropped_bad, failed = [], 0, 0, []
    seen_hash = set()
    for idx, url, path, status, info in sorted(results):
        if status == "fail":
            failed.append((idx, url, info))
            continue
        if status == "skip" or not valid_file(path):
            if path and path.exists():
                path.unlink()
            dropped_bad += 1
            continue
        h = md5_of(path)
        if h in seen_hash:
            path.unlink()
            dropped_dup += 1
            continue
        seen_hash.add(h)
        kept.append((url, path))
    # 感知去重：同图不同分辨率（MD5 不同但视觉相同）
    kept, removed_phash = perceptual_dedupe(kept, {"phash": 0})
    dropped_dup += removed_phash
    # 两阶段重命名，避免编号冲突
    tmp_names = []
    for i, (img_url, path) in enumerate(kept, 1):
        tmp = adir / f"~ren_{i:03d}_{path.name}"
        path.rename(tmp)
        tmp_names.append((i, img_url, tmp, path.suffix))
    for i, img_url, tmp, suffix in tmp_names:
        tmp.rename(adir / f"{i:03d}{suffix}")
    return kept, dropped_dup, dropped_bad, failed


def fetch(idx: int, url: str, path: Path, retries: int = 2):
    # 断点续传：按序号前缀匹配已存在文件（扩展名可能已被魔数纠正）
    for existing in adir_glob(path):
        if valid_file(existing):
            return idx, url, existing, "resume", 0
    for attempt in range(retries + 1):
        try:
            r = S.get(url, timeout=60)
            r.raise_for_status()
            data = r.content
            if len(data) < 500:
                return idx, url, None, "skip", len(data)
            ext = sniff_ext(data, "jpeg")
            path = path.with_suffix(f".{ext}")
            path.write_bytes(data)
            return idx, url, path, "ok", len(data)
        except Exception as e:
            if attempt == retries:
                return idx, url, None, "fail", str(e)
            time.sleep(1.5 * (attempt + 1))
    return idx, url, None, "fail", "unreachable"


def process_article(url: str, out_root: Path):
    print(f"\n{'=' * 60}\n文章: {url}")
    html = get_html(url)
    title = get_title(html)
    safe_title = re.sub(r'[\\/:*?"<>|\r\n]', "_", title).strip() or "未知标题"
    article_id = url.rstrip("/").split("/s/")[-1].split("?")[0]
    urls = extract_images(html)
    print(f"标题: {title} | 图片: {len(urls)} 张")

    adir = out_root / safe_title
    adir.mkdir(parents=True, exist_ok=True)

    tasks = [(i, u, adir / f"{i:03d}.img") for i, u in enumerate(urls, 1)]
    results, failed = [], []
    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(fetch, i, u, p) for i, u, p in tasks]
        for f in cf.as_completed(futs):
            results.append(f.result())
    results.sort()

    kept, dropped_dup, dropped_bad, failed = dedupe_and_rename(results, adir)
    lines_urls = []
    for i, (img_url, path) in enumerate(kept, 1):
        print(f"  [{i}/{len(kept)}] KEEP {path.name}")
        lines_urls.append(f"{i}. {img_url}")

    (adir / "README.md").write_text(
        f"# {title}\n\nSource: {url}\n\n"
        f"Images: {len(kept)} saved, {dropped_dup} duplicates removed, {dropped_bad} skipped, {len(failed)} failed\n",
        encoding="utf-8",
    )
    (adir / "urls.txt").write_text(
        f"Title: {title}\nSource: {url}\n\n" + "\n".join(lines_urls) + ("\n" if lines_urls else ""),
        encoding="utf-8",
    )
    (adir / ".article_id.txt").write_text(article_id, encoding="utf-8")
    print(f"完成: {len(kept)}/{len(urls)} (去重 {dropped_dup} 张, 跳过 {dropped_bad}, 失败 {len(failed)}) -> {adir}")
    return [f[0] for f in failed]


def main():
    args = [a.strip() for a in sys.argv[1:] if a.strip()]
    if not args:
        print(__doc__)
        sys.exit(1)
    out_root = Path(args[-1]) if not args[-1].lower().startswith(("http", "file")) and Path(args[-1]).suffix.lower() != ".txt" else Path(DEFAULT_OUT)
    if not out_root.name or args[-1] == str(out_root):
        pass
    # 若最后一个参数不是 URL/txt，则视为输出目录；否则用默认
    urls_arg = args
    if len(args) >= 2 and not args[-1].lower().startswith("http") and not args[-1].lower().endswith(".txt"):
        out_root = Path(args[-1])
        urls_arg = args[:-1]
    elif args[-1].lower().endswith(".txt") and Path(args[-1]).is_file():
        pass
    else:
        out_root = Path(DEFAULT_OUT)
        urls_arg = args

    urls = []
    for a in urls_arg:
        p = Path(a)
        if p.suffix.lower() == ".txt" and p.is_file():
            urls += [l.strip() for l in p.read_text(encoding="utf-8").splitlines() if re.match(r"https?://", l.strip())]
        elif a.lower().startswith("http"):
            urls.append(a)
    urls = list(dict.fromkeys(urls))
    if not urls:
        print("未识别到有效 URL")
        sys.exit(1)

    print(f"共 {len(urls)} 篇文章 -> {out_root}")
    all_failed = {}
    for u in urls:
        try:
            f = process_article(u, out_root)
            if f:
                all_failed[u] = f
        except Exception as e:
            all_failed[u] = [str(e)]
            print(f"  文章级失败: {e}")

    if all_failed:
        print("\n[提醒] 以下文章存在失败项，可重跑本命令自动续传:")
        for u, f in all_failed.items():
            print(f"  {u} -> {f}")
        sys.exit(2)


if __name__ == "__main__":
    main()
