---
name: tencentmap-webservice-skill
version: 1.0.0
description: "tencentmap-webservice-skill。 当开发者需要通过 HTTP 接口集成地理编码、地点搜索、路线规划、天气查询、IP 定位等位置服务时，此技能提供完整的 API 调用指导。适用场景：(1) 地址与坐标互转 (2) 地点搜索与周边 POI 查询 (3) 关键词输入提示与自动补全 (4) 沿途搜索 (5) 路线规划（驾车/步行/骑行/电动车/公交）(6) 距离矩阵与批量距离计算 (7) IP 定位 (8) 天气查询 (9) 智能地址解析 (10) 坐标系转换 (11) 行政区划查询。不包含地图渲染和前端可视化，仅提供 HTTP JSON 数据接口。当用户提到地理编码、地址转坐标、逆地址解析、POI 搜索、路线规划、距离矩阵、批量距离、天气查询、IP 定位、坐标转换、行政区划、输入提示、自动补全、WebService API 时触发。"
---

# 腾讯位置服务 WebService API

腾讯位置服务 WebService API 是基于 HTTPS/HTTP 协议的数据接口，支持任何编程语言通过 HTTP 请求调用。

## 🔧 环境与认证

### ⚡ 强制初始化（每次加载 Skill 必须执行）

**进入本 Skill 后，在执行任何用户操作之前，必须先完成 Token 获取。不得跳过此步骤。**

#### 执行步骤

1. **调用 Token 获取脚本**（根据当前操作系统，`SKILL_DIR` 为本 skill 根目录）：
   - macOS/Linux：
     ```bash
     TOKEN=$(bash "${SKILL_DIR}/get-token.sh")
     ```
   - Windows：
     ```powershell
     $token = & "${SKILL_DIR}\\get-token.ps1"
     ```

2. **将获取到的 token 用于后续 API 调用**，作为 `key` 参数传入（腾讯地图 API 使用 `key` 参数而非 `Authorization` header）。

3. **仅当脚本执行失败（exit code ≠ 0）时**，回退检查环境变量 `TMAP_WEBSERVICE_KEY` 或对话上下文中的 Key。

#### 🚫 禁止行为

- ❌ **禁止**跳过脚本直接询问用户手动输入 Key（除非脚本失败）
- ❌ **禁止**使用之前会话中缓存的 token 值
- ❌ **禁止**将 token 明文输出到终端

### Token 使用方式

| 通道 | 使用方式 |
|------|----------|
| REST API | URL 参数 `key=${TOKEN}` |

> ⚠️ Token 有效期 **长期有效**，每次调用脚本都会获取最新有效 token。若 API 返回 110/190/199 等 Key 相关错误码，重新执行脚本获取新 key。

---

## 基本信息

- **Base URL**: `https://apis.map.qq.com`
- **请求方式**: GET
- **返回格式**: JSON
- **Key 获取**: https://lbs.qq.com/dev/console/key/manage

## 关键注意事项

- **坐标格式**: 统一使用 `纬度,经度` 顺序（不是经度,纬度）
- **坐标系**: GCJ-02（国测局坐标系），GPS 原始坐标需先转换
- **Key 参数**: 所有接口都需要 `key` 参数
- **配额限制**: 每个 Key 有免费额度和 QPS 限制

## 触发条件

当用户表达以下任一意图时触发：

- 将地址转为坐标，或将坐标转为地址
- 搜索地点、POI、周边商家
- 使用关键词输入提示或自动补全
- 规划路线（驾车、步行、骑行、电动车、公交等）
- 批量计算距离或生成距离矩阵
- 查询天气信息
- 根据 IP 获取位置
- 从非结构化文本提取地址
- 在不同坐标系之间互转
- 查询行政区划信息
- 包含"地理编码"、"搜索"、"路线"、"天气"、"定位"、"坐标"、"距离矩阵"等关键词

## 前置检查：API Key

**在需要实际调用 API 时（而非仅咨询能力、了解功能），必须先检查 Key：**

1. 如果用户只是询问"有哪些功能"、"支持什么 API"、"能做什么"等咨询类问题，**直接回答，不要求配置 Key**
2. 当用户请求需要**实际发起 API 调用**时（如"查天安门坐标"、"规划路线"），按以下优先级获取 Key：
   - **优先**：通过 `get-token.sh` / `get-token.ps1` 脚本获取 Token（来自 QClaw 集成面板授权）
   - **次选**：检查环境变量 `TMAP_WEBSERVICE_KEY`
   - **兜底**：检查对话上下文中用户是否已给出 Key
3. 如果以上方式都无法获取 Key，提示用户：

> ⚠️ 执行这个操作需要腾讯位置服务 API Key。请按以下步骤配置：
>
> 1. **推荐**：在 QClaw 集成面板中完成腾讯地图授权，Key 将自动注入
> 2. 或前往 [Key 管理控制台](https://lbs.qq.com/dev/console/key/manage) 注册并创建 Key
> 3. 为 Key 开启 **WebService** 功能
> 4. 通过以下任一方式提供 Key：
>    - 设置环境变量 `TMAP_WEBSERVICE_KEY=你的Key`
>    - 或在对话中直接告诉我你的 Key
>
> 获取 Key 后告诉我，我们继续。

4. 确认 Key 存在后，再构造并发起 API 请求，将 Key 作为 `key` 参数传入

---

## 场景判断

收到用户请求后，先判断属于哪个场景：

| 场景 | 用户意图 | 参考文档 |
|------|----------|----------|
| **地址服务** | 地址↔坐标互转、智能地址解析 | `references/api-geocoder.md` |
| **搜索服务** | 地点搜索、周边 POI、沿途搜索、输入提示、行政区划 | `references/api-search.md` |
| **路线服务** | 驾车/步行/骑行/公交路线规划、距离矩阵 | `references/api-direction.md` |
| **定位与天气** | IP 定位、天气查询 | `references/api-location-weather.md` |
| **坐标转换** | 其他坐标系转入腾讯地图坐标系 | `references/api-tools.md` |

### 组合场景处理

如果用户请求包含多个场景，按以下优先级串联调用：

1. **先解决坐标获取**：地址解析 / IP 定位 / 坐标转换 — 确保后续操作有可用坐标
2. **再执行目标操作**：搜索 / 路线规划 / 天气查询 — 使用第一步获取的坐标
3. **最后处理后续操作**：沿途搜索依赖路线结果的 polyline，距离矩阵依赖坐标集合

## 场景一：地址服务

提供地址解析（地址→坐标）、逆地址解析（坐标→地址）、智能地址解析（非结构化文本→结构化地址）三种能力。

- **地址解析**: `GET /ws/geocoder/v1/` — 传入 `address` 参数，建议加 `region` 提高准确性
- **逆地址解析**: `GET /ws/geocoder/v1/` — 传入 `location` 参数（纬度,经度），可用 `get_poi=1` 返回周边 POI
- **智能地址解析**: `GET /ws/geocoder/v1/` — 使用 `smart_address` 参数（非 address），从快递单、聊天记录等文本提取地址和联系人信息。需企业认证开通

> 📖 详细参数、响应格式和示例见 [references/api-geocoder.md](references/api-geocoder.md)

## 场景二：搜索服务

提供地点搜索、沿途搜索、关键词输入提示、行政区划查询四种能力。

- **地点搜索**: `GET /ws/place/v1/search` — 支持 `nearby()`/`region()`/`rectangle()` 边界格式（多边形搜索为独立接口 `/ws/place/v1/search_by_polygon`）
- **沿途搜索**: `GET /ws/place/v1/search` — 使用 `boundary=along(polyline, distance)`，需先获取路线 polyline
- **关键词提示**: `GET /ws/place/v1/suggestion` — 搜索框自动补全
- **行政区划**: 三个子接口 — `GET /ws/district/v1/list`（全部列表）、`/getchildren`（下级区划）、`/search`（关键词搜索）

> 📖 详细参数、响应格式和示例见 [references/api-search.md](references/api-search.md)

## 场景三：路线服务

提供路线规划和批量距离计算能力。

| 出行方式 | 端点 |
|----------|------|
| 驾车 | `GET /ws/direction/v1/driving/` |
| 步行 | `GET /ws/direction/v1/walking/` |
| 骑行 | `GET /ws/direction/v1/bicycling/` |
| 电动车 | `GET /ws/direction/v1/ebicycling/` |
| 公交 | `GET /ws/direction/v1/transit/` |
| 距离矩阵 | `GET /ws/distance/v1/matrix` |

- 所有路线接口需要 `from`（起点）和 `to`（终点），格式 `纬度,经度`
- 驾车支持 `waypoints`（途经点）和 `policy`（策略: LEAST_TIME/PICKUP/TRIP + 偏好: REAL_TRAFFIC/LEAST_FEE/AVOID_HIGHWAY/HIGHWAY_FIRST 等，逗号分隔）
- 驾车 `duration` 单位为**分钟**，距离矩阵 `duration` 单位为**秒**
- 距离矩阵支持 `mode`（driving/walking/bicycling）

> 📖 详细参数、响应格式和示例见 [references/api-direction.md](references/api-direction.md)

## 场景四：定位与天气

提供 IP 定位和天气查询能力。

- **IP 定位**: `GET /ws/location/v1/ip` — 精度到城市级
- **天气查询**: `GET /ws/weather/v1/` — 支持 `adcode` 或 `location` 查询，`type` 参数选 `now`（实况）/`future`（预报）/`hours`（逐小时），通过 `added_fields` 附加 alarm/index/air（逗号分隔）

> 📖 详细参数、响应格式和示例见 [references/api-location-weather.md](references/api-location-weather.md)

## 场景五：坐标转换

`GET /ws/coord/v1/translate` — 将 GPS/百度/搜狗/MapBar 坐标转为腾讯地图坐标系（GCJ-02）。**仅支持单向转入**，不支持反向转出。

> 📖 详细参数和示例见 [references/api-tools.md](references/api-tools.md)

## 错误处理

所有接口返回 JSON 中的 `status` 字段表示业务状态码。完整错误码参考：https://lbs.qq.com/service/webService/webServiceGuide/status

### 常见错误码

| 状态码 | 含义 | 处理建议 |
|--------|------|----------|
| `0` | 成功 | — |
| `110` | 请求来源未被授权 | 检查 Key 的域名白名单或 IP 白名单配置 |
| `111` | 签名验证失败 | 检查签名算法和 Secret Key |
| `112` | IP 未被授权 | 在控制台添加服务器 IP 白名单 |
| `113` | 此功能未被授权 | 在控制台开通对应 API 权限 |
| `120` | QPS 限制（每秒请求量达上限） | 等待 1-2 秒后重试，或合并请求 |
| `121` | 日调用量达上限 | 升级配额或更换 Key |
| `190` | 无效的 Key | 确认 Key 是否已被删除或禁用 |
| `199` | 此 Key 未开启 WebService 功能 | 在控制台为 Key 启用 WebService |

### 参数错误

| 状态码 | 含义 | 处理建议 |
|--------|------|----------|
| `300` | 缺少必要字段 | 检查必填参数是否齐全 |
| `301` | 缺少 key 参数 | 添加 `key` 参数 |
| `306` | 缺少参数 | 检查接口所需的必填参数 |
| `310` | 参数格式错误 | 检查参数类型和格式（如坐标格式） |
| `311` | Key 格式错误 | 检查 Key 是否正确 |
| `320` | 参数数据类型错误 | 检查参数值类型 |
| `326` | 起终点距离过近 | 起终点坐标相同或过近 |
| `332` | 途经点个数超过限制 | 驾车途经点最多 10 个 |
| `333` | 存在无法吸附的坐标点 | 检查坐标是否在可通行道路附近 |
| `347` | 查询无结果 | 尝试放宽搜索条件或更换关键词 |
| `365` | 纬度不能超过 ±90 | 检查坐标值范围 |
| `366` | 经度不能超过 ±180 | 检查坐标值范围 |
| `373` | 起终点距离超长 | 减小起终点距离 |
| `375` | 局域网 IP 无法定位 | IP 定位仅支持公网 IP |
| `396` | 距离矩阵坐标点超限 | 最多 200 个坐标点，起终点数乘积最多 625 |

### 系统错误

| 状态码 | 含义 | 处理建议 |
|--------|------|----------|
| `500` | 后端超时 | 稍后重试 |
| `510` | 后端服务无法连接 | 稍后重试 |
| `520` | 后端服务请求失败 | 稍后重试 |
| `530` | 后端返回数据解析失败 | 稍后重试，若持续出现则联系客服 |

## 最佳实践

1. **地址解析指定 `region`** — 提高准确性，避免跨城市歧义
   ```
   # ✅ 指定城市
   GET /ws/geocoder/v1/?address=中关村大街1号&region=北京&key=${TOKEN}
   # ❌ 不指定城市，可能匹配到其他城市的同名地址
   GET /ws/geocoder/v1/?address=中关村大街1号&key=${TOKEN}
   ```

2. **逆地址解析选择合适的 `policy`** — 根据业务场景获取最相关的地址描述
   ```
   # 到家场景（精确到楼栋）
   GET /ws/geocoder/v1/?location=39.984154,116.307490&get_poi=1&poi_options=policy=2&key=${TOKEN}
   # 出行场景（过滤不易到达 POI）
   GET /ws/geocoder/v1/?location=39.984154,116.307490&get_poi=1&poi_options=policy=3&key=${TOKEN}
   ```

3. **搜索使用 `boundary` 限制范围** — 提高搜索精准度和效率

4. **批量距离计算用距离矩阵替代循环调用** — 显著减少请求次数
   ```python
   # ❌ 错误：循环调用路线接口，N*M 次请求
   for origin in origins:
       for dest in destinations:
           call_direction_api(origin, dest)

   # ✅ 正确：一次距离矩阵请求
   call_distance_matrix(from=";".join(origins), to=";".join(destinations), mode="driving")
   ```

5. **GPS 坐标需先转换** — 通过坐标转换接口转为 GCJ-02 后再调用其他接口
   ```
   # 先转换坐标
   GET /ws/coord/v1/translate?locations=39.984154,116.307490&type=1&key=${TOKEN}
   # 再用转换后的坐标调用搜索/路线等接口
   ```

6. **天气查询优先用经纬度** — 可精确到区县级，比 adcode 更灵活

7. **沿途搜索需先规划路线** — 先获取 polyline，再搜索 POI，不能跳过路线规划步骤

## 文档引用

| 文件 | 说明 |
|------|------|
| [references/api-geocoder.md](references/api-geocoder.md) | 地址解析、逆地址解析、智能地址解析 |
| [references/api-search.md](references/api-search.md) | 地点搜索、沿途搜索、关键词提示、行政区划 |
| [references/api-direction.md](references/api-direction.md) | 路线规划（驾车/步行/骑行/公交）、距离矩阵 |
| [references/api-location-weather.md](references/api-location-weather.md) | IP 定位、天气查询 |
| [references/api-tools.md](references/api-tools.md) | 坐标转换、公共错误码 |

## 相关链接

- [官方文档](https://lbs.qq.com/service/webService/webServiceGuide/webServiceOverview)
- [Key 管理](https://lbs.qq.com/dev/console/key/manage)
- [配额说明](https://lbs.qq.com/dev/console/quotaImprove)
- [状态码说明](https://lbs.qq.com/service/webService/webServiceGuide/status)
