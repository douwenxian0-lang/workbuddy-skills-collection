# Token 初始化

> `get-token.sh` / `get-token.ps1` 与本文件位于同一目录下。
> 执行前将 `<SCRIPT_PATH>` 替换为本文件所在目录的绝对路径。

## 重要：每条命令都要内联获取 Token

由于每次命令执行都是独立的 shell 进程，`export` 设置的环境变量**不会**传递到下一条命令。
因此，**不要**分两步（先 export 再 curl），而是在每条 API 调用命令中内联获取 token：

### macOS / Linux — 使用方式

```bash
# ✅ 正确：内联获取 token，直接用于 curl
curl -s "https://api.figma.com/v1/me" \
  -H "Authorization: Bearer $(bash '<SCRIPT_PATH>/get-token.sh')"
```

```bash
# ❌ 错误：export 在下一条命令中无效
export FIGMA_TOKEN=$(bash '<SCRIPT_PATH>/get-token.sh')
# 下一条 execute_command 中 $FIGMA_TOKEN 为空！
```

### Windows (PowerShell) — 使用方式

```powershell
# ✅ 正确：内联获取 token
$token = & "<SCRIPT_PATH>\get-token.ps1"
irm "https://api.figma.com/v1/me" -Headers @{"Authorization"="Bearer $token"}
```

## 失败处理

如果脚本输出 `ERROR` 或返回空值：
- 用户尚未在**应用内集成面板**中完成 Figma 授权
- 请提示用户：在集成面板中点击 Figma → 完成授权，然后重试
- **不要**引导用户去 figma.com 手动创建 Integration，Token 由平台统一托管
