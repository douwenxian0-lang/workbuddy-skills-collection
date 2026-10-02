# Token 初始化

> `get-token.sh` / `get-token.ps1` 与本文件位于同一目录下。
> 执行前将 `<SCRIPT_PATH>` 替换为本文件所在目录的绝对路径。

## 重要：每条 curl 命令中必须内联获取 Token

由于每次命令执行都是独立的 shell 进程，`export` 无法跨命令传递环境变量。
因此**每条 curl 命令都必须内联调用 `get-token.sh` 获取 Token**。

### macOS / Linux — 使用方式

```bash
# ✅ 每条 curl 命令中内联获取 Token（正确方式）
curl -X POST "https://i.weread.qq.com/api/agent/gateway" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')" \
  -H "Content-Type: application/json" \
  -d '{"api_name": "/store/search", "keyword": "三体", "count": 10, "skill_version": "1.0.3"}'
```

### Windows (PowerShell) — 使用方式

```powershell
# ✅ 每条 curl 命令中内联获取 Token（正确方式）
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$token = & "<SCRIPT_PATH>\get-token.ps1"
curl.exe -X POST "https://i.weread.qq.com/api/agent/gateway" -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d '{\"api_name\": \"/store/search\", \"keyword\": \"三体\", \"count\": 10, \"skill_version\": \"1.0.3\"}'
```

## 失败处理

如果脚本输出 `ERROR` 或返回空值：
- 用户尚未在**应用内集成面板**中完成微信读书授权
- 请提示用户：在集成面板中点击微信读书 → 完成授权，然后重试
- 不要引导用户手动去网页获取 Key
