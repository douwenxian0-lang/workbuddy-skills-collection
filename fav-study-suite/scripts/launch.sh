#!/bin/bash
# 启动收藏学习套件组件: ./launch.sh douyin|bilimind|status
case "$1" in
  douyin)
    cmd //c start "" "C:\Users\Administrator\Desktop\收藏学习台.lnk" ; echo "抖音收藏学习台启动中, 浏览器开 http://127.0.0.1:8765" ;;
  bilimind)
    cmd //c start "" "C:\Users\Administrator\Tools\bilibili-rag\start.bat" ; echo "BiliMind 启动中, 浏览器开 http://127.0.0.1:8000" ;;
  status)
    echo "--- 收藏学习台 ---"; tasklist //FI "IMAGENAME eq DouyinFavStudy*" 2>/dev/null | grep -i douyin || echo 未运行
    curl -s -o /dev/null -w "BiliMind API: http://127.0.0.1:8000 -> %{http_code}\n" --max-time 3 http://127.0.0.1:8000/api/health 2>/dev/null || echo "BiliMind 未运行"
    echo "--- VidBee ---"; tasklist 2>/dev/null | grep -i vidbee | head -1 || echo 未运行 ;;
  *) echo "用法: launch.sh douyin|bilimind|status" ;;
esac
