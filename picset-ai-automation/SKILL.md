---
name: picset-ai-automation
description: Picset AI 网页版自动化 - 上传产品图、选择风格、生成设计、下载结果。支持单张图片和批量处理。
agent_created: true
---

# Picset AI 自动化技能

## 功能

自动化操作 Picset AI (https://picsetai.cn/) 网页版，完成：
1. **上传产品图片**
2. **选择生成模式** (主图/详情图)
3. **选择风格** (3:4竖版/1:1方版/16:9横版)
4. **选择质量** (2K高清/4K超清)
5. **生成 AI 设计**
6. **下载结果**

## 使用方法

### 快速开始

```bash
# 单张图片处理
python picset_ai_full_flow.py --image ./images/product.jpg

# 批量处理
python picset_ai_full_flow.py --folder ./images

# 交互模式
python picset_ai_full_flow.py --interactive
```

### 参数选项

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--image` | 单张图片路径 | - |
| `--folder` | 图片文件夹（批量） | - |
| `--mode` | 主图/详情图 | 主图 |
| `--style` | 3:4 竖版/1:1 方版/16:9 横版 | 3:4 竖版 |
| `--quality` | 2K 高清/4K 超清 | 2K 高清 |
| `--count` | 1 张/4 张 | 1 张 |
| `--headless` | 无头模式（不显示浏览器） | False |

### 示例

```bash
# 主图模式
python picset_ai_full_flow.py --image photo.jpg --mode 主图 --style 3:4 竖版

# 详情图模式
python picset_ai_full_flow.py --image photo.jpg --mode 详情图 --quality 4K 超清

# 批量处理 10 张图片
python picset_ai_full_flow.py --folder ./product_images --style 1:1 方版

# 无头模式（后台运行）
python picset_ai_full_flow.py --image photo.jpg --headless
```

## 脚本位置

```
C:\Users\Administrator\WorkBuddy\Claw\picset_ai_full_flow.py
```

## 依赖

```bash
pip install playwright
playwright install chromium
```

## 工作流程

```
┌─────────────┐
│  打开页面   │ → https://picsetai.cn/studio-genesis
└──────┬──────┘
       ▼
┌─────────────┐
│  上传图片    │ → input[type=file]
└──────┬──────┘
       ▼
┌─────────────┐
│  选择模式    │ → 主图 / 详情图
└──────┬──────┘
       ▼
┌─────────────┐
│  选择风格    │ → 3:4 竖版 / 1:1 方版 / 16:9 横版
└──────┬──────┘
       ▼
┌─────────────┐
│  选择质量    │ → 2K 高清 / 4K 超清
└──────┬──────┘
       ▼
┌─────────────┐
│  点击生成    │ → "分析产品" 按钮
└──────┬──────┘
       ▼
┌─────────────┐
│  等待完成    │ → 轮询检测下载按钮
└──────┬──────┘
       ▼
┌─────────────┐
│  下载结果    │ → 保存到 downloads/
└─────────────┘
```

## 注意事项

1. **首次运行**需要安装 Chromium 浏览器
2. **批量处理**会自动为每张图片创建新页面
3. **生成时间**取决于服务器负载，通常 30-60 秒
4. **下载目录**默认为 `./downloads`

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 浏览器无法启动 | `playwright install chromium` |
| 上传失败 | 检查图片格式（支持 jpg/png/webp） |
| 生成超时 | 增加 `--timeout` 参数或手动检查页面 |
