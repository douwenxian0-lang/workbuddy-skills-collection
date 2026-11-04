---
name: open-webui
description: 启动/管理本机 Open WebUI（127.0.0.1:8080）——开源本地大模型聊天界面，自动对接 Ollama 与 OpenAI 兼容端点，支持知识库/RAG、多模型切换、会话管理。触发词：Open WebUI、openwebui、本地模型界面、本地大模型UI、聊天界面、网页聊天、知识库问答、私有部署界面、模型切换界面。
---

# Open WebUI 服务管理

本机已装 Open WebUI v0.13.0（uv tool，Python 3.12 独立环境，可执行文件在 `~/.local/bin/open-webui`）。

## 启动 / 停止 / 状态

```bash
open-webui serve --port 8080        # 启动（首次启动建库约 1-2 分钟）
curl -s http://127.0.0.1:8080/health # 健康检查（200=就绪）
# 停止：taskkill //F //IM open-webui.exe（或找到对应 python 进程）
```

- 浏览器访问 `http://127.0.0.1:8080`
- 首次打开需注册一个本地管理员账号（数据全在本机）
- 模型来源：自动探测 Ollama（127.0.0.1:11434，本机有 qwen3:8b / qwen2.5-coder:7b）；云端 OpenAI 兼容端点在 Settings → Connections 添加（如 DeepSeek base_url `https://api.deepseek.com/v1`）

## 常用运维

| 场景 | 动作 |
|---|---|
| 用户说「打开 Open WebUI / 聊天界面」 | 确认健康检查 200 后提示访问地址；没起就先启动并等就绪 |
| 模型列表空 | 检查 Ollama 是否运行：`curl http://127.0.0.1:11434/api/version` |
| 升级 | `uv tool upgrade open-webui`（数据在 `~/.open-webui/`，升级不丢） |
| 端口冲突 | 换 `--port 8081` |

## 与 Odysseus 的分工

两者都可用：Open WebUI 强在知识库/RAG（喂私有资料做问答）、社区生态；Odysseus 强在 Compare 盲测、Cookbook 硬件配型、Agent 沙箱。用户没指定时：资料问答 → Open WebUI；模型对比/研究 → Odysseus。

## 安全

服务只绑 127.0.0.1，勿改监听 0.0.0.0 暴露局域网；管理账号密码勿写入任何日志或对话。
