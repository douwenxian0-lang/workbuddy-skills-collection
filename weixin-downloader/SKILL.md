---
name: weixin-downloader
description: Download WeChat official account articles (mp.weixin.qq.com) with full text extraction, image download, completeness check, and auto-reorganize to flat {title} folders. Use when the user provides WeChat article URLs and wants to download content, save articles for offline reading, batch-download WeChat posts, extract text+images from WeChat links, check download completeness, or reorganize downloaded articles. Handles standard (rich_media_content) and share-type (share_content_page) templates with multi-strategy text extraction. Parallel image download with dual User-Agent fallback. Triggers: "download this WeChat article", "batch download these WeChat links", "save this WeChat post", "get images from this WeChat article", "check if all WeChat articles downloaded", "reorganize WeChat images", any request involving mp.weixin.qq.com URLs plus download/extract/save intent.
---

# WeChat Article Downloader

Three-mode workflow: download, check completeness, redo incomplete.

## One Command: Full Workflow

```bash
python scripts/download_articles.py -f urls.txt --flat E:\微信推文图片
```

This downloads text, downloads images, and reorganizes to `{title}\{序号}.{ext}` format.

## Three Modes

### 1. Download (default)
```bash
# Full: text + images + auto-reorganize
python scripts/download_articles.py -f urls.txt --flat E:\微信推文图片

# Text only (fast validation)
python scripts/download_articles.py -f urls.txt --text-only

# Without reorganization
python scripts/download_articles.py -f urls.txt -o C:\weixin_articles
```

### 2. Check completeness
```bash
python scripts/download_articles.py --check C:\weixin_articles
```
Reports: which articles are incomplete, how many images missing per article.

### 3. Redo incomplete downloads
```bash
python scripts/download_articles.py --redo C:\weixin_articles --flat E:\微信推文图片
```
Finds incompletes, re-fetches HTML, downloads missing images (existing files skipped), then reorganizes.

## Recommended Workflow for New Batches

```bash
# Step 1: Save URLs to a file
# (user provides URLs, put them in urls.txt)

# Step 2: Download + reorganize (one step)
python scripts/download_articles.py -f urls.txt --flat E:\微信推文图片

# Step 3: Verify
python scripts/download_articles.py --check E:\微信推文图片
```

## For Existing Downloads

```bash
# Check what's incomplete
python scripts/download_articles.py --check C:\weixin_articles

# Fix + reorganize
python scripts/download_articles.py --redo C:\weixin_articles --flat E:\微信推文图片
```

## Output Formats

**Working directory** (`--out`):
```
{out_dir}/
  _summary.json           # batch stats
  {article_id}/
    data.json             # metadata + content + image URLs
    {title}.md            # Markdown with text and image links
    images/
      001_abc123.jpg
      002_def456.png
```

**Flat directory** (`--flat`):
```
{flat_dir}/
  {article_title}_{url_hash}/
    img_001.jpg
    img_002.png
    README.md
  ...
```
Folder suffix = md5(source_url)[:8] for uniqueness across same-title articles.
README.md contains title, source URL, and image stats.

## Text Extraction Strategy (4 tiers)

1. `js_content` div — standard `rich_media_content` pages
2. `var desc` / `msg_desc` — share page primary text
3. `og:description` meta — short description fallback
4. `js_article` tag-to-tag — last resort for Vue.js share pages

## Image Download

- 8-thread parallel, dual UA fallback (Chrome -> iPhone MicroMessenger)
- Existing files >100 bytes are skipped (resume safe)
- Output extension matches `wx_fmt` in URL (jpg/png/webp/gif)
- SSL CERT_NONE for mixed CDN certs

## Known Limitations

- **CAPTCHA**: Text extraction fails, images lost on re-fetch. Retry later.
- **Pure galleries**: 0 chars is normal if article has no text in static HTML
- **Title conflicts**: Articles with same title share one folder in --flat mode (last wins)

## Dependencies

- `scrapling` (pip install scrapling) — for fetching WeChat HTML
- Python 3.8+, standard library only
