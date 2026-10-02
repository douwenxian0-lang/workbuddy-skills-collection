#!/usr/bin/env python3
"""api_push.py — 当 git 协议推不上去时，走 GitHub REST API 发布提交。

用途：`git push` 反复报 `Recv failure: Connection was reset` /
`Failed to connect to github.com:443` / 无限挂起，但 `gh api` 依然通畅时，
用 API 直接构造 tree / commit 并移动分支引用，完全绕开 git 传输协议。

用法:
    python api_push.py <仓库绝对路径> <owner> <repo> [分支名=main]

产物：远程分支被更新为与本地 HEAD 内容完全一致的提交。
      若 GitHub 接受原样元数据，提交 SHA 会与本地 HEAD **完全相同**
      （前提是提交信息、作者/提交者、日期都不变）。
"""
import base64
import json
import subprocess
import sys
import time


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    repo_dir, owner, repo = sys.argv[1], sys.argv[2], sys.argv[3]
    branch = sys.argv[4] if len(sys.argv) > 4 else "main"

    def git(*args, binary=False, check=True):
        r = subprocess.run(["git", "-c", "core.quotepath=false"] + list(args),
                           cwd=repo_dir, capture_output=True)
        if check and r.returncode != 0:
            sys.exit("git failed: %s\n%s" % (args, r.stderr.decode("utf-8", "replace")))
        return r.stdout if binary else r.stdout.decode("utf-8", "replace")

    def api(method, path, body=None, tries=4):
        for attempt in range(1, tries + 1):
            cmd = ["gh", "api", "--method", method, path]
            if body is not None:
                cmd += ["--input", "-"]
            r = subprocess.run(cmd, cwd=repo_dir, capture_output=True,
                               input=json.dumps(body).encode() if body is not None else None)
            if r.returncode == 0:
                out = r.stdout.decode("utf-8", "replace").strip()
                return json.loads(out) if out else {}
            err = (r.stderr.decode("utf-8", "replace").strip().splitlines() or ["?"])[-1]
            print("   [retry %d/%d] %s %s -> %s" % (attempt, tries, method, path, err))
            time.sleep(3 * attempt)
        sys.exit("api failed permanently: %s %s" % (method, path))

    head = git("rev-parse", "HEAD").strip()
    ref = api("GET", "/repos/%s/%s/git/ref/heads/%s" % (owner, repo, branch))
    remote_sha = ref["object"]["sha"]
    if remote_sha == head:
        print("远程已是最新，无需操作")
        return
    if git("cat-file", "-t", remote_sha, check=False).strip() != "commit":
        print("提示：远程 %s 的提交对象本地不存在，无法比对，直接以本地为基准" % remote_sha[:7])

    # 变更集合
    raw = git("diff", "--name-status", "-z", "-M", remote_sha, head, binary=True)
    parts = raw.split(b"\x00")
    changes, i = [], 0
    while i < len(parts):
        st = parts[i].decode()
        if not st:
            i += 1
            continue
        if st[0] in "RC":
            changes += [(parts[i + 1].decode("utf-8"), None),
                        (None, parts[i + 2].decode("utf-8"))]
            i += 3
        elif st[0] == "A":
            changes.append((None, parts[i + 1].decode("utf-8")))
            i += 2
        elif st[0] == "D":
            changes.append((parts[i + 1].decode("utf-8"), None))
            i += 2
        else:
            p = parts[i + 1].decode("utf-8")
            changes.append((p, p))
            i += 2
    print("变更条目:", len(changes))

    base_tree = api("GET", "/repos/%s/%s/git/commits/%s" % (owner, repo, remote_sha))["tree"]["sha"]
    entries = []
    for old, new in changes:
        if old:
            entries.append({"path": old, "mode": "100644", "type": "blob", "sha": None})
        if new:
            ls = git("ls-tree", head, "--", new).strip()
            mode = ls.split()[0] if ls else "100644"
            content = base64.b64encode(git("show", "%s:%s" % (head, new), binary=True)).decode()
            blob = api("POST", "/repos/%s/%s/git/blobs" % (owner, repo),
                       {"content": content, "encoding": "base64"})
            entries.append({"path": new, "mode": mode, "type": "blob", "sha": blob["sha"]})
    tree = api("POST", "/repos/%s/%s/git/trees" % (owner, repo),
               {"base_tree": base_tree, "tree": entries})
    print("新 tree:", tree["sha"])

    # 用本地提交的“精确字节”重建，尽量让 SHA 一致
    raw_commit = git("cat-file", "commit", head)
    header, message = raw_commit.split("\n\n", 1)
    name = git("show", "-s", "--format=%an", head).strip()
    email = git("show", "-s", "--format=%ae", head).strip()
    adate = git("show", "-s", "--format=%aI", head).strip()
    cdate = git("show", "-s", "--format=%cI", head).strip()
    commit = api("POST", "/repos/%s/%s/git/commits" % (owner, repo), {
        "message": message,
        "tree": tree["sha"],
        "parents": [remote_sha],
        "author": {"name": name, "email": email, "date": adate},
        "committer": {"name": name, "email": email, "date": cdate},
    })
    print("新提交:", commit["sha"])
    if commit["sha"] != head:
        print("  注意：SHA 与本地 %s 不同（GitHub 可能规范化了日期/换行），内容一致但需要 --force 推送" % head[:7])

    api("PATCH", "/repos/%s/%s/git/refs/heads/%s" % (owner, repo, branch),
        {"sha": commit["sha"], "force": True})
    print("远程 %s ->" % branch,
          api("GET", "/repos/%s/%s/git/ref/heads/%s" % (owner, repo, branch))["object"]["sha"])


if __name__ == "__main__":
    main()
