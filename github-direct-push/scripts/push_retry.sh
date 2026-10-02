#!/bin/bash
# push_retry.sh — 受限网络下带自动重试的 GitHub 推送
# 用法: push_retry.sh <仓库绝对路径> <远程名> <分支> [凭据文件] [最多尝试次数] [单次超时秒数]
# 说明: 直连(绕过代理) + HTTP/1.1 + 显式凭据文件，失败自动重试。
#       单次尝试带硬超时 —— git 在连接被掐断后会无限期挂起（进程 CPU 长期不动、
#       连接停在 CLOSE_WAIT），不设超时就会一直卡住。
set -u

REPO="${1:?仓库路径必填}"
REMOTE="${2:-origin}"
BRANCH="${3:-main}"
CREDS="${4:-$TEMP/gh_creds}"
MAXTRY="${5:-8}"
ATTEMPT_TIMEOUT="${6:-150}"
LOG="${TMPDIR:-/tmp}/push_retry.log"

# 凭据文件不存在时自动用 gh 生成
if [ ! -f "$CREDS" ]; then
  TOKEN=$(gh auth token) || { echo "无法获取 gh token，请先 gh auth login"; exit 1; }
  printf 'https://x-access-token:%s@github.com\n' "$TOKEN" > "$CREDS"
  chmod 600 "$CREDS"
  echo "已生成凭据文件: $CREDS"
fi

cd "$REPO" || exit 1
: > "$LOG"

for i in $(seq 1 "$MAXTRY"); do
  pkill -f git-remote-https 2>/dev/null
  sleep 2
  echo "===== 第 $i 次尝试 $(date +%H:%M:%S) =====" >> "$LOG"
  timeout --foreground "$ATTEMPT_TIMEOUT" \
    env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
      GIT_TERMINAL_PROMPT=0 \
      git -c credential.helper="store --file=$CREDS" \
          -c http.proxy= -c https.proxy= \
          -c http.version=HTTP/1.1 \
          -c http.lowSpeedLimit=1000 \
          -c http.lowSpeedTime=30 \
          push --force --progress "$REMOTE" "$BRANCH" >> "$LOG" 2>&1
  rc=$?
  echo "attempt_exit=$rc" >> "$LOG"
  if [ $rc -eq 0 ]; then
    echo "RESULT_SUCCESS (第 $i 次)" >> "$LOG"
    echo "推送成功，日志: $LOG"
    exit 0
  fi
  if [ $rc -eq 124 ] || [ $rc -eq 137 ]; then
    echo "  (第 $i 次超时 ${ATTEMPT_TIMEOUT}s，已强制结束)" >> "$LOG"
  fi
  sleep 6
done

echo "RESULT_FAILED_ALL_ATTEMPTS" >> "$LOG"
echo "全部 $MAXTRY 次尝试失败，请查看 $LOG"
exit 1
