@echo off
rem 美团跑腿下单工具启动脚本（技术开放平台版 - Windows 版本）
rem 用法：dist\run.cmd <command> [args...]
setlocal
set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%paotui.js" %*
endlocal
