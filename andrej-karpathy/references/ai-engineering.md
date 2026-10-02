# AI 工程方法论 — Karpathy 实践指南

## "A Recipe for Training Neural Networks" 核心要点

### 1. 不要从复杂架构开始

> "I've seen many people rush to complicated architectures / crazy losses / huge models when things don't work."
> — 先用最简单的架构验证可行性

**原则**：
- 先用 Logistic Regression 或小模型
- 确保训练流程正确
- 再逐步增加复杂度

### 2. Overfit a Single Batch First

**步骤**：
- 取一个 mini-batch（如 32 样本）
- 让模型完全拟合这个 batch（accuracy = 100%）
- 如果做不到，说明模型容量不够或代码有 bug

**目的**：验证代码正确性和模型基本能力

### 3. 亲自看数据

> "I am personally a strong believer that anyone who is writing code to train neural networks should spend at least a few hours actually looking at the data."

**做法**：
- 打印样本、可视化输入
- 找出边缘案例、异常值
- 理解数据分布

### 4. 数据增强的艺术

- 在测试集上表现不好？先加数据增强
- 不要"过度增强"（扭曲到语义丢失）
- 增强应该是人类仍能识别的程度

### 5. 调试技巧

| 问题 | 诊断方法 |
|------|----------|
| 训练不收敛 | 检查 loss 初始化值，调 learning rate |
| 验证集比训练集好 | 数据泄漏？检查 split |
| 精度不提升 | 检查 loss 是否下降，label 是否正确 |
| 训练集过拟合 | 加正则化/dropout/数据增强 |

### 6. Human-in-the-Loop

AI 系统设计的核心原则：
- 人类监督是必需的
- 系统应该支持快速干预
- 反馈循环要短

---

## Tesla AI 实战原则

从 Tesla AI Day 和公开演讲提炼：

### 端到端架构

- 从原始摄像头像素到方向盘控制信号
- 不依赖中间模块（"感知-预测-规划"拆分在简化）
- 神经网络直接学习驾驶策略

### 数据为王

- 超过 1PB 的训练数据
- 从真实驾驶中采集
- Simulation + Real 混合训练

### Shadow Mode

- 新功能先在"影子模式"运行
- 不干预实际驾驶，只记录"会做什么"
- 与人类驾驶对比，评估效果

---

## 实用建议清单

**训练前**：
- 确认数据分布合理
- 检查 label 正确率
- 设定合理 baseline

**训练中**：
- 监控 loss 曲线
- 检查 gradient 分布
- 验证集定期评估

**训练后**：
- 测试集分析
- 找出失败案例
- 反馈到数据采集