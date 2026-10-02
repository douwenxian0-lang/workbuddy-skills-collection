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
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  GIT_TERMINAL_PROMPT=0 \
  git -c credential.helper="store --file=$TMP/gh_creds" \
      -c http.proxy= -c https.proxy= \
      -c http.version=HTTP/1.1 \
      -c http.lowSpeedLimit=0 -c http.lowSpeedTime=999999 \
      push --force --progress origin main
```

大仓库务必包一层**重试循环**（见 `scripts/push_retry.sh`）。单次 80 MiB 上传实测约 20 秒，失败点几乎都在收尾的第二次连接（`curl 28 Failed to connect` / `remote end hung up unexpectedly`），重试 1~3 次基本必成。

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
用容错模式跳过，坏文件会留在 `git status` 里但不阻塞：
```bash
git add -A --ignore-errors 2> add_err.txt
grep -c "^error:" add_err.txt          # 看跳过了几个
```

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
