# Software 2.0 完整解析

## 原文

Karpathy 于 2017 年发表博客 "Software 2.0"，核心论点：

**Software 1.0**（传统）：
- 程序员用 Python/C++/Java 编写明确指令
- 逻辑清晰、可审查、可调试
- 规模受限于人的认知能力

**Software 2.0**（神经网络）：
- 程序员定义目标函数（loss）和数据
- 优化器（SGD/Adam）在参数空间搜索解
- 程序"涌现"而非"编写"
- 规模受限于算力和数据

## 核心论证

1. **代码量迁移**：神经网络权重正在取代传统代码
   - Tesla Autopilot 的大部分"代码"是神经网络权重
   - 搜索排序、推荐系统已在迁移

2. **新工具链**：
   - IDE → TensorBoard / W&B
   - 编译器 → 训练管道
   - 版本控制 → checkpoint 管理
   - 调试 → 数据诊断 + 超参搜索

3. **优势**：
   - 能解决人写不出规则的问题（视觉/语音/翻译）
   - 维护成本更低（更新数据而非重写逻辑）
   - 随数据量增长自动变强

4. **挑战**：
   - 不可解释性
   - 难以调试
   - 对抗样本脆弱性
   - 部署开销大

## 影响

- 概念被广泛引用，推动"数据驱动"范式
- 预言了后续 LLM 的爆发（GPT 系列就是 Software 2.0 的典型）
- 引发关于 AI 安全和可解释性的讨论

## 关键引述

> "The Software 2.0 stack is still in its infancy, but it will dominate the future."
> — Andrej Karpathy, 2017
