---
name: github-direct-push
description: 代理/网络受限环境下把大型本地仓库推送到 GitHub 的完整排查与推送流程。git fetch/clone/push 报 502、CLOSE_WAIT 卡死、invalid index-pack output、Empty reply from server 时使用。含嵌套 .git 与超长路径等 Windows 坑的处理。
user_invocable: true
agent_created: true
---

# github-direct-push（受限网络下推送大仓库到 GitHub）

## 一句话
先判定是"代理坏"还是"认证坏"，再决定走直连还是补凭据；大仓库用 `推送重试循环` 兜住抖动。

## 三步定位法（按顺序，别跳）

### 第 1 步：分清代理 vs 直连
```bash
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" https://api.github.com      # 走代理
timeout 40 env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  curl -sS --noproxy '*' -o /dev/null -w "%{http_code} %{time_total}s\n" https://github.com
```
- 代理返回 **502 / CONNECT tunnel failed** → 代理坏了，后续 git 全部加 `env -u http_proxy ...` + `-c http.proxy= -c https.proxy=`
- `api.github.com` 通而 `github.com` 不通 → 典型代理选择性拦截，同样走直连
- 直连也慢/抖 → 正常，上传方向通常仍很快（实测 3.8 MiB/s），下载方向可能只有 ~95 KiB/s

### 第 2 步：确认 git 是 HTTP/2 挂了还是认证挂了
```bash
U="https://github.com/<owner>/<repo>.git/info/refs"
curl -sS --noproxy '*' -o /dev/null -w "upload-pack  %{http_code} %{time_total}s\n" "$U?service=git-upload-pack"
curl -sS --noproxy '*' -o /dev/null -w "receive-pack %{http_code} %{time_total}s\n" "$U?service=git-receive-pack"
```
- `receive-pack` 返回 **401 且很快（<1s）** → 端点是好的，问题在**认证**
- `git ls-remote` 报 `Empty reply from server` → 加 `-c http.version=HTTP/1.1` 通常立刻恢复
- `git ls-remote` 报 `CONNECT tunnel failed, response 502` → 还是代理，回到第 1 步

### 第 3 步：绕过 git 的 credential helper，用凭据文件
`git config credential.helper` 若为 `!gh auth git-credential` 这类 shell 调用，在沙箱/非交互环境可能挂起，表现为进程 CPU 恒为 0、连接停在 `CLOSE_WAIT`。

```bash
TOKEN=$(gh auth token)
printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$TMP/gh_creds"
chmod 600 "$TMP/gh_creds"
# 用 -c credential.helper="store --file=<abs path>" 指定，用完后 rm 掉
```
**认证格式必须是 Basic（`-u x-access-token:$TOKEN`），Bearer 会 401。**

## 标准推送命令（可直接抄）
```bash
cd <repo>
timeout --foreground 120 \
  env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    GIT_TERMINAL_PROMPT=0 \
    git -c credential.helper="store --file=$TMP/gh_creds" \
        -c http.proxy= -c https.proxy= \
        -c http.version=HTTP/1.1 \
        -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=30 \
        push --force --progress origin main
```

### ⚠️ 必须给单次尝试套 `timeout`（最关键的教训）
连接被 GitHub 掐断后，git **不会退出，而是无限期挂起**：进程还活着、CPU 恒 0.1s、连接停在 `CLOSE_WAIT`、日志不再增长。实测挂过 **15 分钟以上**。

**绝对不要用 `-c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999` 去"防止超时"——那恰好关掉了唯一的自动脱困机制。** 正确做法是反过来：
- 设一个真实的低速阈值 `lowSpeedLimit=1000` + `lowSpeedTime=30`（30 秒低于 1 KiB/s 就自己断）
- 外层再套硬超时 `timeout --foreground 120`
- `--foreground` 不能省，否则 git 收不到中断信号

正常一次上传 80 MiB 只要 20 秒左右，所以 120 秒超时绰绰有余；跑满 120 秒 = 已经卡死，杀掉重试。

失败点几乎都在收尾的第二次连接（`curl 28 Failed to connect` / `curl 35 Recv failure` / `remote end hung up unexpectedly`），**此时前 15 个对象其实已经写进远程了，重试会很快**。用重试循环（见 `scripts/push_retry.sh`）跑 3~8 次基本必成。

## 备用通道：git 协议彻底不通时走 REST API（`scripts/api_push.py`）

如果 `api.github.com`（或 `gh api`）通、但 `git push` 连续 5 次以上都失败，**不要再死磕重试**——直接用 GitHub REST API 发布提交，完全绕开 git 传输协议。

原理：手动构造 `blob → tree(base_tree + 变更) → commit(parents=[远程sha]) → PATCH ref`。
只需要传输**变更的文件**，比推整个 pack 还省。

```bash
python scripts/api_push.py <仓库绝对路径> <owner> <repo> [分支=main]
```

实测：8 轮 git push 全败（含 3 次 120 秒超时）的场景下，API 通道一次通过。

### 让远程 SHA 和本地完全一致的小技巧
GitHub 会**原样保留**你传的作者/提交者日期（含 `+0800` 时区）和提交信息，所以只要元数据一致，它算出的 SHA 就和本地一模一样。

唯一的坑是**提交信息结尾的换行**：`git log --format=%B` 会多带一个换行，直接用它会算出不同 SHA。正确做法是从 `git cat-file commit <sha>` 里取第一个空行之后的**精确字节**：

```python
header, message = subprocess.run(["git","cat-file","commit",sha],
                                 capture_output=True).stdout.decode().split("\n\n", 1)
```

用这份 message 建提交，实测 SHA 与本地 `HEAD` 逐位相符 → 本地/远程 0/0 同步，不需要事后 `--force`。
若仍不一致，内容也一定正确（那只是分支引用指向另一个等值提交），下次推送用 `--force` 即可。

### API 通道收尾
- API 创建的是**等值提交**，远程历史干净，不需要额外清理
- 校验方式与 git 推送相同：拉远程 tree 逐条比对 blob 集合，差集必须为 0
- 本地 `refs/remotes/origin/main` 不会自动更新，SHA 一致时用
  `git update-ref refs/remotes/origin/main <sha>` 手动对齐

## 判断"真卡住"还是"在算"
```bash
tasklist //FI "IMAGENAME eq git-remote-https.exe"
netstat -ano | grep -E "\s<PID>$"     # CLOSE_WAIT 且 CPU 不涨 = 卡死
```
配合 PowerShell 采样（**输出重定向到文件再用 Read 读**，本机 PowerShell 工具直接返回常为空）：
```powershell
Get-Process git,git-remote-https | ForEach-Object { "$($_.Id) CPU=$([math]::Round($_.CPU,1)) WS=$([math]::Round($_.WorkingSet64/1MB,1))MB" } | Out-File $env:TEMP\probe.txt
```
CPU 两次采样都不变（如恒 0.1s）→ 卡死，别等，杀掉重来。

## Windows 专属坑

### 坑 1：嵌套 `.git` 变成空壳 gitlink
子目录里有自己的 `.git` 时，git 只提交一个指针（mode 160000），**内容根本不会上传**，GitHub 上显示为点不进去的空目录。

处理（临时移开 + 清索引）：
```bash
# 1) 备份索引里的 gitlink 记录
git ls-files -s | awk '$1=="160000"{print $2, $4}' > gitlinks.txt
# 2) in-place 改名（不跨盘移动，最安全）
for g in $(find . -mindepth 2 -maxdepth 3 -name ".git"); do mv "$g" "$g.__hold"; done
# 3) 关键：索引里还是 gitlink，必须清掉，否则 git add 报 "is in submodule"
for s in $(awk '{print $2}' gitlinks.txt); do git rm --cached -q "$s"; done
# 4) .gitignore 加 **/.git.__hold/  防止把仓库元数据本身提交进去（gstack/.git 有 8M，multica 15M）
git add -A
# 5) 推完后恢复
for g in $(find . -mindepth 2 -maxdepth 3 -name ".git.__hold"); do mv "$g" "${g%.__hold}"; done
```
只要不动原来的 `.git` 内容，恢复后 `git -C <sub> rev-parse --short HEAD` 应与原 gitlink SHA 完全一致，可用来验收。

### 坑 2：`git add` 被超长路径生成的非法文件名卡死
Windows MAX_PATH 截断会产生**结尾带点号**的文件名，`git add` 直接 `fatal: adding files failed`。
先用容错模式跳过，坏文件会留在 `git status` 里但不阻塞：
```bash
git add -A --ignore-errors 2> add_err.txt
grep -c "^error:" add_err.txt          # 看跳过了几个
```
**但不要就此放过**——这些文件其实能修好并纳管：用 `\\?\` 扩展路径重命名即可（`os.path.abspath` 会把结尾点号吃掉，必须手工拼路径）。完整做法见 `repair-mangled-filenames` 技能。

### 坑 3：`core.quotepath` 导致路径比对全错
对比文件清单时中文路径会被引号+八进制转义，务必加 `-c core.quotepath=false`：
```bash
git -c core.quotepath=false ls-tree -r --name-only <commit>
```

## 无共同祖先时怎么"备份"远程（不能 fetch 也能备份）
fetch/clone 挂掉时不要死磕（远程 66 MB 实测龟速）。**直接用 API 在远程原地建分支**，秒级完成、零传输：
```bash
OLD=$(gh api repos/<owner>/<repo>/git/refs/heads/main --jq '.object.sha')
gh api -X POST repos/<owner>/<repo>/git/refs \
  -f ref="refs/heads/legacy-$(date +%Y-%m)" -f sha="$OLD"
```
之后 `push --force` 覆盖 main，旧内容仍留在 `legacy-*` 分支上可追溯。

## 交付前校验（必做）
```bash
gh api "repos/<owner>/<repo>/git/trees/main?recursive=1" --paginate \
  | python -c "import sys,json;d=json.load(sys.stdin);print(len([i for p in (d if isinstance(d,list) else [d]) for i in p['tree'] if i['type']=='blob']))"
```
把远程 blob 数与本地 `git ls-tree -r --name-only HEAD | wc -l` 比，再逐条做集合差。**差集为 0 才算成功**。

## 收尾清单
- [ ] `rm -f` 凭据文件
- [ ] `git branch -D <临时测试分支>`（推送前用空提交建的小分支验通路）
- [ ] `rm -f .git/objects/pack/tmp_pack_*`（中断的 fetch 会留几十 MB 垃圾）
- [ ] 恢复嵌套 `.git` 并逐一核对 SHA
- [ ] 告知用户远程旧提交已被 `legacy-*` 分支保住
