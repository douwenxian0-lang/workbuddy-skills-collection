@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5678 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul
echo done
