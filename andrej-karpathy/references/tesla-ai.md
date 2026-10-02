# Tesla AI 技术笔记

基于 Tesla AI Day 2021/2022 公开内容整理

---

## 技术架构

### 核心组件

1. **FSD Computer (Hardware 3.0)**
   - 2× Tesla 自研芯片
   - 144 TOPS 算力
   - 冗余设计（任一芯片可独立运行）

2. **感知系统**
   - 8 个摄像头，360° 覆盖
   - 无激光雷达、无毫米波雷达（纯视觉路线）
   - BEV (Bird's Eye View) 统一表示

3. **神经网络架构**
   - ResNet backbone 特征提取
   - Transformer 跨摄像头融合
   - 3D 空间重建

---

## 关键技术

### Occupancy Network

**问题**：传统物体检测依赖预定义类别，无法处理"未知物体"

**方案**：
- 预测每个 3D 体素是否被占用
- 不依赖物体分类
- 泛化能力强（路障、碎片都能识别）

### Vector Lane

**问题**：传统车道线检测是像素级分割，连续性差

**方案**：
- 直接预测车道线的几何参数
- 用向量表示（起点、方向、曲率）
- 输出可直接用于规划

### Auto-Labeling

**自动化标注系统**：
- 用高精度离线模型生成 label
- 新数据无需人工标注
- 规模效应：数据越多 → 模型越好 → 自动标注越准

---

## 训练基础设施

| 指标 | 数据 |
|------|------|
| GPU 集群 | 6000+ NVIDIA A100 |
| 训练数据量 | 1PB+ |
| 日训练样本 | 100万+ |

---

## 设计理念

1. **First Principles Thinking**
   - 不跟随行业惯例（如激光雷达）
   - 从"人类靠眼睛开车"出发
   - 用视觉解决问题

2. **End-to-End 学习**
   - 早期版本模块化（感知→预测→规划）
   - 新版本偏向端到端
   - 减少模块间的 hand-designed 接口

3. **Simulation Systems**
   - 神经网络渲染场景
   - 自动生成边缘案例
   - Real + Sim 混合训练

---

## 关键洞察

> "The problem is not how to detect objects; the problem is how to drive."
> — Karpathy 引用，强调任务导向

- 纯视觉可行（人类证据）
- 数据规模比架构更重要（数据驱动立场）
- 端到端是方向（简化系统）

---

## 离职后

Karpathy 于 2022 年离开 Tesla，创办 Eureka Labs（AI 教育公司），专注：
- AI 辅助教育
- 大模型教育应用
- 降低 AI 学习门槛

---

## 参考

- [Tesla AI Day 2021](https://www.youtube.com/watch?v=j0z4FweCy4M)
- [Tesla AI Day 2022](https://www.youtube.com/watch?v=ODSJsviD_4Y)
- Karahta 博客: https://karpathy.ai