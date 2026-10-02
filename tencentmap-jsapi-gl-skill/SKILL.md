---
name: tencentmap-jsapi-gl-skill
description: 腾讯地图 JavaScript GL（JSAPI GL）开发与地图页面生成技能。适用于普通用户或开发者提出的各类地图需求，包括“帮我生成地图/做一个地图/生成地图网页/生成地图 HTML 文件/生成某个城市或地区的地图/做一个可交互地图/在地图上标点/展示门店或位置/画路线/展示轨迹/生成热力图/行政区划地图/区域边界图/3D地图/地图可视化”等自然语言请求。也适用于编写、审查或调试使用腾讯地图 API 的代码，涉及地图初始化、点标记、信息窗体、覆盖物、图层控制、事件交互、控件、地点搜索、路线规划、地址解析、IP定位、行政区划、几何计算、热力图、轨迹图、区域图、三维模型展示和性能优化等任务。当用户提及腾讯地图、地图生成、地图HTML、交互式地图、地图可视化、JSAPI、JSAPI GL 或相关地图开发需求时自动触发。
version: 1.0.5
---

# 腾讯地图JSAPI GL开发技能

帮助用户使用腾讯地图 JavaScript API GL 进行地图功能开发，包含基础地图功能和数据可视化功能。

## 目录结构

### API 文档

- **JS API 参考文档**: `references/jsapigl/docs/` (21个md文件)
  - 概述.md - API总览和索引
  - 地图.md - 地图核心类和配置
  - 点标记.md - 标注点相关API
  - 矢量图形.md - 折线、多边形、圆形、矩形、椭圆形等矢量图形
  - 文本标记.md - 文本标注API
  - DOM覆盖物.md - 自定义DOM覆盖物
  - 信息窗体.md - 信息窗口API
  - 点聚合.md - 点聚合功能
  - 控件.md - 地图控件
  - 自定义图层.md - 自定义栅格/矢量图层
  - 事件.md - 地图事件系统
  - 基础类.md - LatLng、Point等基础类
  - 室内图.md - 室内地图功能
  - 附加库：地图工具.md - 几何编辑器、测量工具
  - 附加库：几何计算库.md - 距离、面积计算
  - 附加库：服务类库.md - 地点搜索、路线规划等
  - 附加库：地图视角附加库.md - 观察者视角
  - 附加库：模型库.md - GLTF/3DTiles模型
  - 附加库：天气图层.md - 气象图层
  - 附加库：矢量数据图层.md - GeoJSON/MVT图层
  - 环境检测.md - 浏览器环境检测

- **可视化参考文档**: `references/visualization/docs/` (15个md文件)
  - 参考手册.md - 可视化API总览
  - 弧线图.md - 3D弧线/流向图
  - 散点图.md - 3D散点图
  - 热力图.md - 经典热力图
  - 蜂窝热力图.md - 蜂窝聚合热力图
  - 网格热力图.md - 网格聚合热力图
  - 轨迹图.md - 轨迹展示
  - 区域图.md - 区域轮廓图
  - 管道图.md - 3D管道图
  - 辐射圈.md - 辐射圈效果
  - 围墙面.md - 围墙面效果
  - 水晶体.md - 3D水晶体效果
  - 行政区划.md - 行政区划展示
  - 事件.md - 可视化事件系统
  - 基础类.md - 可视化基础类

### 示例代码

- **JS API Demos**: `references/jsapigl/demos/` (129个html文件)
  - 按功能分类：地图操作、点标记、文本标记、点聚合、折线、多边形、控件、信息窗口、服务类、个性化地图、几何计算、模型库、应用工具、自定义覆盖物、城市漫游等

- **可视化 Demos**: `references/visualization/demos/` (44个html文件)
  - 按图层类型分类：弧线图、散点图、热力图、轨迹图、蜂窝图、区域图、水晶体等

## 前置检查：API Key

**在用户需要生成地图代码时，必须先判断 Key 情况：**

1. 检查用户是否已提供 API Key（环境变量 `TMAP_JSAPI_KEY` 或对话中显式给出）
2. 如果**用户已提供 Key**，直接使用用户 Key 生成代码（情况 B），无需提示
3. 如果**未检测到 Key**，使用默认安全配置生成代码（情况 A），**同时必须提示用户**：

> ⚠️ 当前使用默认配置生成，该地图页面**仅能在 QClaw 内预览**。
>
> 如需**个人开发使用**（部署到自己的网站/应用），请注册自己的 API Key：
>
> 1. 前往 [Key 管理控制台](https://lbs.qq.com/dev/console/key/manage) 注册并创建 Key
> 2. 为 Key 开启 **WebService** 功能
> 3. 通过以下任一方式提供 Key：
>    - **推荐**：设置环境变量 `TMAP_JSAPI_KEY=你的Key`
>    - 或在对话中直接告诉我你的 Key
>
> 获取 Key 后告诉我，我会帮你重新生成带 Key 的代码。

## 工作流程

### 1. 理解用户需求

当用户询问腾讯地图API相关问题时：
- 明确用户需要的功能类型（基础地图/可视化）
- 确定具体要使用的类或功能
- **检查用户是否提供了 API Key**：如果用户没有显式提供 key，则地图需要加入 `_TMapSecurityConfig` 安全配置（见下方模板说明），并提示用户限 QClaw 预览

### 2. 查询 API 文档

在 `references/jsapigl/docs/` 或 `references/visualization/docs/` 中查找相关API文档：
- 搜索关键词（如"点标记"、"热力图"）
- 阅读对应类的说明、配置参数、方法

### 3. 查找示例代码

在对应 demos 目录中查找示例：
- JS API示例：`references/jsapigl/demos/`
- 可视化示例：`references/visualization/demos/`
- 示例命名格式：`功能分类_具体示例.html`

### 4. 提供解决方案

根据文档和示例，为用户提供：
- API接口说明
- 代码示例
- 注意事项和最佳实践

## 使用示例

**用户问题**: "如何在地图上添加标记点？"

**执行流程**:
1. 读取 `references/jsapigl/docs/点标记.md` 了解 MultiMarker API
2. 查看 `references/jsapigl/demos/` 中的点标记相关示例
3. 提供完整的代码示例和说明

**用户问题**: "怎么画一个热力图？"

**执行流程**:
1. 读取 `references/visualization/docs/热力图.md` 了解 Heat API
2. 查看 `references/visualization/demos/` 中的热力图示例
3. 说明数据格式和配置选项


## 快速开始模板

### 判断用户是否提供了 API Key

生成代码时，需要根据用户是否提供了自己的 API Key 来决定模板：

**情况 A - 用户未提供 Key（使用默认安全配置，仅限 QClaw 内预览）**：
当用户没有显式提供 API Key 时，必须在 `<head>` 中引入 `_TMapSecurityConfig` 配置脚本，脚本加载 URL 中不填 key 参数。**生成代码后，⚠️ 必须提示用户：该地图页面仅能在 QClaw 内预览，如需个人开发使用，请注册 Key（见"前置检查：API Key"章节）。**

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>腾讯地图示例</title>
    <script type="text/javascript">
      window._TMapSecurityConfig = {
        serviceHost: "https://lbsproxy.qclaw.qq.com/aizone/qclaw/v1/tmapService",
      };
    </script>
    <script src="https://map.qq.com/api/gljs?v=3"></script>
    <!-- 如需可视化功能，添加: &libraries=visualization -->
</head>
<body>
    <div id="map" style="width:100%;height:500px;"></div>
    <script>
        var map = new TMap.Map("map", {
            zoom: 12,
            center: new TMap.LatLng(39.984104, 116.307503)
        });
    </script>
</body>
</html>
```

**情况 B - 用户提供了自己的 Key**：
当用户显式提供了 API Key 时，不需要 `_TMapSecurityConfig`，直接使用用户提供的 key：

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>腾讯地图示例</title>
    <script src="https://map.qq.com/api/gljs?v=3&key=用户提供的KEY"></script>
    <!-- 如需可视化功能，添加: &libraries=visualization -->
</head>
<body>
    <div id="map" style="width:100%;height:500px;"></div>
    <script>
        var map = new TMap.Map("map", {
            zoom: 12,
            center: new TMap.LatLng(39.984104, 116.307503)
        });
    </script>
</body>
</html>
```

可视化图层示例（热力图）：

```javascript
// 未提供 key 时，页面加载方式：
// <script type="text/javascript">
//   window._TMapSecurityConfig = {
//     serviceHost: "https://lbsproxy.qclaw.qq.com/aizone/qclaw/v1/tmapService ",
//   };
// </script>
// <script src="https://map.qq.com/api/gljs?v=1.beta&libraries=visualization"></script>

// 提供了 key 时：
// <script src="https://map.qq.com/api/gljs?v=1.beta&libraries=visualization&key=用户提供的KEY"></script>

var heat = new TMap.visualization.Heat({
    radius: 50,
    height: 100,
    gradientColor: {
        0: '#13B06A',
        0.4: '#13B06A', 
        0.8: '#E9AB1D',
        0.9: '#E9AB1D',
        1: '#E05649'
    }
}).addTo(map);

heat.setData([
    { lat: 39.984104, lng: 116.307503, count: 100 },
    { lat: 39.984504, lng: 116.307803, count: 80 }
]);
```

## 注意事项

### JS API GL

1. **API Key**: 
   - 如果用户**提供了**自己的 API Key，直接使用，不添加 `_TMapSecurityConfig`
   - 如果用户**未提供** API Key，则必须在 `<head>` 中引入 `_TMapSecurityConfig` 安全配置脚本，脚本 src 中不填 key 参数，并提示用户该页面仅能在 QClaw 内预览，如需个人开发请注册 Key（参考"前置检查：API Key"章节）
2. **版本**: 当前为 GL 版本，支持3D地图和WebGL渲染
3. **浏览器兼容**: 现代浏览器，IE11+（需polyfill）
4. **坐标系**: 使用 gcj02 坐标系
5. **地图创建（重要）**: 地图创建的容器一定要有固定宽高，尤其是flex布局下
6. **API使用（重要）**: 所有功能的API调用都必须使用文档中出现的接口、属性、事件，不能自己编造；
7. **API传参（重要）**: 所有的API传入参数必须严格遵守api文档中说明的格式，如果不确定就去看看对应demo，包括demo中的数据格式；
8. **附加库的使用**: 使用附加库需要在API加载URL中添加 `libraries` 参数

| 附加库 | libraries 值 | 命名空间 | 说明 |
|--------|-------------|----------|------|
| 地图工具 | `tools` | `TMap.tools` | 几何编辑器、测量工具 |
| 几何计算库 | `geometry` | `TMap.geometry` | 距离/面积计算、几何关系判断 |
| 服务类库 | `service` | `TMap.service` | 地点搜索、路线规划、行政区划等 |
| 地图视角附加库 | `view` | `TMap` (扩展方法) | 观察者视角操作地图 |
| 模型库 | `model` | `TMap.model` | GLTF/3DTiles/3DMarker 模型 |
| 天气图层 | `weather` | `TMap.weather` | 云图、温度图等气象图层 |
| 矢量数据图层 | `vector` | `TMap.vector` | GeoJSON/MVT 矢量数据图层 |
| 可视化库 | `visualization` | `TMap.visualization` | 可视化API的能力 |

**使用示例**：
```html
<!-- 未提供 key 时： -->
<script type="text/javascript">
  window._TMapSecurityConfig = {
    serviceHost: "https://lbsproxy.qclaw.qq.com/aizone/qclaw/v1/tmapService",
  };
</script>
<script src="https://map.qq.com/api/gljs?v=1&libraries=tools,geometry,service,model"></script>

<!-- 提供了 key 时： -->
<script src="https://map.qq.com/api/gljs?v=1&libraries=tools,geometry,service,model&key=用户提供的KEY"></script>
```

### 可视化 API

1. **数据格式**: 可视化图层需要特定格式的数据输入
2. **性能**: 大数据量时注意性能优化
3. **层级**: 可视化图层可以设置显示层级
4. **事件**: 支持点击、悬停等交互事件
5. **API使用（重要）**: 所有功能的API调用都必须使用文档中出现的接口、属性、事件，不能自己编造
6. **API传参（重要）**: 所有的API传入参数必须严格遵守api文档中说明的格式，如果不确定就去看看对应demo，包括demo中的数据格式；


## 最佳实践

1. **模块化加载**: 使用模块化方式按需加载API
2. **错误处理**: 添加地图加载失败的处理逻辑
3. **内存管理**: 及时销毁不需要的图层和覆盖物
4. **性能优化**: 大数据集使用聚合或抽稀
