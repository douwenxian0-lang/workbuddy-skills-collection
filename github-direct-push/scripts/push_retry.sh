#!/bin/bash
# push_retry.sh — 受限网络下带自动重试的 GitHub 推送
# 用法: push_retry.sh <仓库绝对路径> <远程名> <分支> [凭据文件] [最多尝试次数]
# 说明: 直连(绕过代理) + HTTP/1.1 + 显式凭据文件，失败自动重试。
set -u

REPO="${1:?仓库路径必填}"
REMOTE="${2:-origin}"
BRANCH="${3:-main}"
CREDS="${4:-$TEMP/gh_creds}"
MAXTRY="${5:-6}"

# 凭据文件不存在时自动用 gh 生成
if [ ! -f "$CREDS" ]; then
  TOKEN=$(gh auth token) || { echo "无法获取 gh token，请先 gh auth login"; exit 1; }
  printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$CREDS"
  chmod 600 "$CREDS"
  echo "已生成凭据文件: $CREDS"
fi

cd "$REPO" || exit 1
LOG="$TEMP/push_retry.log"
: > "$LOG"

pkill -f git-remote-https 2>/dev/null
sleep 2

for i in $(seq 1 "$MAXTRY"); do
  echo "===== 第 $i 次尝试 $(date +%H:%M:%S) =====" >> "$LOG"
  env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    GIT_TERMINAL_PROMPT=0 \
    git -c credential.helper="store --file=$CREDS" \
        -c http.proxy= -c https.proxy= \
        -c http.version=HTTP/1.1 \
        -c http.lowSpeedLimit=0 \
        -c http.lowSpeedTime=999999 \
        push --force --progress "$REMOTE" "$BRANCH" >> "$LOG" 2>&1
  rc=$?
  echo "attempt_exit=$rc" >> "$LOG"
  if [ $rc -eq 0 ]; then
    echo "RESULT_SUCCESS (第 $i 次)" >> "$LOG"
    echo "推送成功，日志: $LOG"
    exit 0
  fi
  sleep 8
done

echo "RESULT_FAILED_ALL_ATTEMPTS" >> "$LOG"
echo "全部 $MAXTRY 次尝试失败，请查看 $LOG"
exit 1
