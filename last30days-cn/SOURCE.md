# 来源

- 仓库：https://github.com/Jesseovo/last30days-skill-cn（v4.0.0-cn，2k⭐，上游 mvanhorn/last30days-skill 66.6k⭐）
- 安装日期：2026-11-05
- 安装方式：tarball 抽核心（SKILL.md + scripts/ + hooks/ + _README），跳过 tests/（162→核心文件）
- 运行检查：`last30days.py --hot --hot-limit 8` 实测 6 平台热榜全通（微博/百度/抖音/头条/B站/知乎），纯标准库零依赖
- 定位：中文互联网 30 天研究 + 全网热榜；已接入热点日报定时任务（替代 wewrite hotspots 主通道）
- 可选增强：WEIBO_COOKIE/ZHIHU_COOKIE 等 env 可解锁更多源；--global 支持 X/YouTube/HN/Reddit/GitHub
