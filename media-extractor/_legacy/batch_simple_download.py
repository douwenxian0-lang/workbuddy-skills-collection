#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量下载微信文章图片（简化版）
不依赖标题提取，直接用 URL hash 作为目录名
"""

import subprocess
import sys
from pathlib import Path

# 23 个微信文章链接
URLS = [
    "https://mp.weixin.qq.com/s/P_a3EKdoEyJjHOfaYC5ehA",
    "https://mp.weixin.qq.com/s/LL5eOTFMFlDMp_hfy-fUtA",
    "https://mp.weixin.qq.com/s/ROyH4VcJjvivtOQTpUSyWQ",
    "https://mp.weixin.qq.com/s/nEu6gix8pRJ2OeUm-0OLag",
    "https://mp.weixin.qq.com/s/4nc23-r6UFRqqCB2fiH0mQ",
    "https://mp.weixin.qq.com/s/VUfUjXtWxdG3kXK6QxOjuQ",
    "https://mp.weixin.qq.com/s/NwNIisfm7BJ9sZc9i9Smsg",
    "https://mp.weixin.qq.com/s/ppE9Ov0lv4YEcdG0-Cm_jA",
    "https://mp.weixin.qq.com/s/rtVcNNWBmcHPDdoXD3-gFA",
    "https://mp.weixin.qq.com/s/aG6q8VhCRCpl7scJ2TvARw",
    "https://mp.weixin.qq.com/s/9RItvpVI1LMG0nqmvkhGgQ",
    "https://mp.weixin.qq.com/s/zhu-ZaVd1F1tifsxmJ5cAw",
    "https://mp.weixin.qq.com/s/j6IE2aRqIBIbqBrbwo09oQ",
    "https://mp.weixin.qq.com/s/yZ4flpYh-DntLmTqS0I2mw",
    "https://mp.weixin.qq.com/s/pE_3Mza7SO5XTXjUK0FeQQ",
    "https://mp.weixin.qq.com/s/Sv0DC7_N3B9dB738T_ra6Q",
    "https://mp.weixin.qq.com/s/_44o6e-7xeCZpO-Un2FD9w",
    "https://mp.weixin.qq.com/s/dNtgdqiSuU9WlUDMGYIlig",
    "https://mp.weixin.qq.com/s/JLRYbL_lrMQtFdkCiRXGdQ",
    "https://mp.weixin.qq.com/s/LUbtnstf0WPJpI8RWel72g",
    "https://mp.weixin.qq.com/s/nEUPOnb1yKHQgnIUIaB8mg",
    "https://mp.weixin.qq.com/s/uIaMasPkqV5pQT8Hv7-DXw",
    "https://mp.weixin.qq.com/s/vP9NGbxIXlrzG9Bmg2vFpA",
]

# 输出目录
OUTPUT_DIR = r"E:\微信推文图片"

# 下载器路径
DOWNLOADER_PATH = Path(__file__).parent / "simple_download.py"

def main():
    print("[批量下载] 开始处理")
    print(f"  共 {len(URLS)} 个链接")
    print(f"  输出目录: {OUTPUT_DIR}")
    print(f"  去重: 已启用（基于 URL 归一化 + MD5）")
    print()
    
    success_count = 0
    fail_count = 0
    
    for i, url in enumerate(URLS, 1):
        print(f"[{i}/{len(URLS)}] 处理中: {url[:60]}...")
        
        try:
            result = subprocess.run(
                ["python", str(DOWNLOADER_PATH), url, OUTPUT_DIR],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=180
            )
            
            output = result.stdout + result.stderr
            
            if "完成" in output and "张图片" in output:
                import re
                match = re.search(r'成功下载 (\d+)/(\d+) 张图片', output)
                if match:
                    count = int(match.group(1))
                    total = int(match.group(2))
                    print(f"    [成功] 下载 {count}/{total} 张图片")
                    success_count += 1
                else:
                    print(f"    [成功]")
                    success_count += 1
            else:
                print(f"    [失败]")
                print(f"    {output[-300:]}")
                fail_count += 1
                
        except subprocess.TimeoutExpired:
            print(f"    [超时]")
            fail_count += 1
        except Exception as e:
            print(f"    [异常]: {e}")
            fail_count += 1
        
        print()
    
    print("[任务完成]")
    print(f"  成功: {success_count}")
    print(f"  失败: {fail_count}")
    print(f"  总计: {len(URLS)}")
    print()
    print(f"  输出目录: {OUTPUT_DIR}\\微信公众号\\")

if __name__ == "__main__":
    main()
