#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""按需拉取 agency-agents-zh 的单个角色文件到本地。

用法: python fetch_agent.py <角色目录>/<文件名.md> [输出目录]
例:   python fetch_agent.py marketing/小红书运营专家.md
角色路径在 AGENT-LIST.md 里查（22 个部门目录）。
"""
import sys, subprocess, os, urllib.parse

REPO = "jnMetaCode/agency-agents-zh"

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    path = sys.argv[1].strip("/")
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "agents")
    os.makedirs(out_dir, exist_ok=True)
    url = f"https://raw.githubusercontent.com/{REPO}/HEAD/{urllib.parse.quote(path)}"
    dest = os.path.join(out_dir, os.path.basename(path))
    for cmd in (["curl", "-sL", "--noproxy", "*", "-m", "40", url, "-o", dest],):
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode == 0 and os.path.getsize(dest) > 100:
            print("OK", dest, os.path.getsize(dest), "B"); return
    # 直连失败走 gh api 兜底
    r = subprocess.run(["gh", "api", f"repos/{REPO}/contents/{urllib.parse.quote(path)}",
                        "--jq", ".content"], capture_output=True, text=True)
    if r.returncode == 0:
        import base64
        open(dest, "wb").write(base64.b64decode(r.stdout))
        print("OK(gh)", dest, os.path.getsize(dest), "B"); return
    print("FAIL", path, r.stderr[:200]); sys.exit(1)

if __name__ == "__main__":
    main()
