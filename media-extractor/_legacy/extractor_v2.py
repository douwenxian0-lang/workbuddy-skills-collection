# -*- coding: utf-8 -*-
"""
翠鸟 v2 — 全平台素材提取器（调用 multi-platform-crawler）
替代原 extract_browser.py（Playwright 方案），改为纯 Python + requests 方案
支持：微信公众号 | 小红书 | 今日头条 | B站 | 抖音 | 微信视频号 | 通用网页
"""

import sys
import os
import io
import json
import pathlib

# ── 强制 UTF-8 输出 ──
if sys.stdout and hasattr(sys.stdout, 'buffer'):
    if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'buffer'):
    if sys.stderr.encoding and sys.stderr.encoding.lower() != 'utf-8':
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# ── 添加 multi-platform-crawler 到搜索路径 ──
# 翠鸟 skill 在 ~/.qclaw/skills/media-extractor/
# multi-platform-crawler 在 ~/.openclaw/workspace/skills/multi-platform-crawler/
_SCRIPT_DIR = pathlib.Path(__file__).parent
_MPC_CANDIDATES = [
    _SCRIPT_DIR.parent.parent / "openclaw" / "workspace" / "skills" / "multi-platform-crawler",
    _SCRIPT_DIR.parent / "multi-platform-crawler",
    pathlib.Path.home() / ".openclaw" / "workspace" / "skills" / "multi-platform-crawler",
]

for _candidate in _MPC_CANDIDATES:
    if _candidate.is_dir() and (_candidate / "crawler.py").exists():
        sys.path.insert(0, str(_candidate))
        print(f"[翠鸟 v2] 找到爬虫引擎: {_candidate}")
        break
else:
    print("[翠鸟 v2] 错误: 找不到 multi-platform-crawler，请确认已安装该技能")
    sys.exit(1)

from crawler import CrawlerFactory, crawl_single


def main():
    if len(sys.argv) < 3:
        print("用法: python extractor_v2.py <URL> <输出目录>")
        print("  URL       — 支持微信公众号/小红书/头条/B站/抖音/视频号/通用网页")
        print("  输出目录  — 内容保存位置")
        sys.exit(1)

    url = sys.argv[1].strip()
    out_dir = pathlib.Path(sys.argv[2])

    if not url.startswith("http"):
        print("[翠鸟 v2] 错误: URL 格式不正确")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)

    # 检测平台
    platform_name = "未知"
    try:
        crawler = CrawlerFactory.create_crawler(url)
        platform_name = crawler.PLATFORM_NAME
    except Exception as e:
        print(f"[翠鸟 v2] 平台检测异常: {e}")

    print(f"[翠鸟 v2] 平台: {platform_name}")
    print(f"[翠鸟 v2] 链接: {url}")
    print(f"[翠鸟 v2] 输出: {out_dir}")

    # 调用爬虫
    try:
        result, md_path = crawl_single(url, out_dir)
    except Exception as e:
        import traceback
        print(f"[翠鸟 v2] 爬取异常: {e}")
        print(traceback.format_exc())
        sys.exit(1)

    # 输出结果
    if md_path:
        title = result.get("title", "")
        image_count = len(result.get("images", []))
        video_count = len(result.get("videos", []))
        print(f"[翠鸟 v2] 提取成功!")
        print(f"[翠鸟 v2] 标题: {title}")
        print(f"[翠鸟 v2] 图片: {image_count} 张")
        print(f"[翠鸟 v2] 视频: {video_count} 个")
        print(f"[翠鸟 v2] 文件: {md_path}")
        sys.exit(0)
    else:
        note = result.get("status_note", "未知错误")
        print(f"[翠鸟 v2] 提取失败: {note}")
        sys.exit(1)


if __name__ == "__main__":
    main()
