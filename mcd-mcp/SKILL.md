---
name: mcd-mcp
version: 1.0.0
description: 麦当劳 MCP Server — 优惠券自动领取、积分商城兑换、门店查询、菜单查询、营养数据、下单购买、活动日历的一站式 AI 助手
---

# 麦当劳 MCP 技能

接入麦当劳中国开放平台 MCP Server，通过 AI 实现优惠券自动领取、积分商城兑换、门店菜单查询、下单购买和活动日历查询。

## 🔧 环境与认证

### ⚡ 强制初始化（每次加载 Skill 必须执行）

**进入本 Skill 后，在执行任何操作之前，必须先完成 Token 获取。**

#### 执行步骤

1. **调用 Token 获取脚本**（根据当前操作系统，`SKILL_DIR` 为本 skill 根目录）：
   - macOS/Linux：
     ```bash
     TOKEN=$(bash "${SKILL_DIR}/get-token.sh")
     ```
   - Windows：
     ```powershell
     $token = & "${SKILL_DIR}\get-token.ps1"
     ```

2. **将 Token 配置到 MCP 连接**：
   - 检查 `~/.mcporter/mcporter.json` 是否已配置 `mcd-mcp` server
   - 如未配置，执行以下命令写入：
     ```bash
     # macOS/Linux
     node -e "
     const fs=require('fs'),p=require('path'),os=require('os');
     const cfgPath=p.join(os.homedir(),'.mcporter','mcporter.json');
     let cfg={mcpServers:{}};
     try{cfg=JSON.parse(fs.readFileSync(cfgPath,'utf-8'))}catch(e){}
     if(!cfg.mcpServers) cfg.mcpServers={};
     cfg.mcpServers['mcd-mcp']={
       type:'streamablehttp',
       url:'https://mcp.mcd.cn/mcp-servers/mcd-mcp',
       headers:{Authorization:'Bearer '+process.argv[1]}
     };
     require('fs').mkdirSync(p.dirname(cfgPath),{recursive:true});
     fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2));
     " "$(bash ${SKILL_DIR}/get-token.sh)"
     ```
   - 如已配置但 Token 过期，更新 Authorization header

3. **仅当脚本执行失败（exit code ≠ 0）时**，回退到手动配置流程。

#### 🚫 禁止行为

- ❌ **禁止**跳过脚本直接询问用户手动输入 Token（除非脚本失败）
- ❌ **禁止**使用之前会话中缓存的 token 值
- ❌ **禁止**将 token 明文输出到终端

### Token 配置方式

| 方式 | 说明 |
|------|------|
| **自动**（推荐） | `$(bash get-token.sh)` 获取 → 写入 `mcporter.json` |
| **手动留档** | 访问 [麦当劳 MCP 平台](https://open.mcd.cn/mcp) → 控制台 → 激活获取 |

> ⚠️ Token 有效期 **长期有效**。若 MCP 返回 401，重新执行脚本获取新 Token。

---

### Token 获取（手动留档）

1. 访问 [麦当劳 MCP 平台](https://open.mcd.cn/mcp) → 右上角【登录】→ 手机号验证登录
2. 登录后点击右上角【控制台】→ 点击【激活】按钮申请 MCP Token
3. 同意服务条款后，页面显示 Token，一键复制

### MCP 连接配置

在 QClaw 的 MCP Server 配置中添加：

```json
{
  "mcpServers": {
    "mcd-mcp": {
      "type": "streamablehttp",
      "url": "https://mcp.mcd.cn/mcp-servers/mcd-mcp",
      "headers": {
        "Authorization": "Bearer ${TOKEN}"
      }
    }
  }
}
```

- **接入地址**: `https://mcp.mcd.cn/mcp-servers/mcd-mcp`
- **传输协议**: Streamable HTTP
- **认证方式**: `Authorization: Bearer <MCP Token>`
- **速率限制**: 600 次请求/分钟
- **MCP 协议版本**: 2025-06-18

---

## 可用工具（Tools）

共 23 个工具，按业务场景分组：

### 🍔 点餐相关

| 工具 | 功能 |
|------|------|
| `list-nutrition-foods` | 获取餐品营养成分（热量、蛋白质、脂肪等） |
| `delivery-query-addresses` | 查询已保存的配送地址列表 |
| `delivery-create-address` | 新增配送地址 |
| `delivery-query-stores` | 外送场景查可配送门店 |
| `query-meal-assistance` | 企业团餐场景查助餐服务 |
| `query-nearby-stores` | 查询附近麦当劳餐厅（到店/得来速） |
| `query-store-coupons` | 查当前门店可用的优惠券 |
| `query-meals` | 查门店在售菜单 |
| `query-meal-detail` | 查餐品详情（套餐组成等） |
| `calculate-price` | 计算订单金额（含优惠、配送费） |
| `create-order` | 创建订单（返回支付链接） |
| `query-order` | 查询订单详情与状态 |

### 📅 活动与日历

| 工具 | 功能 |
|------|------|
| `campaign-calendar` | 查询麦当劳中国当月营销活动日历 |

### 🏪 麦麦省优惠券

| 工具 | 功能 |
|------|------|
| `available-coupons` | 查询当前可领取的麦麦省优惠券列表 |
| `auto-bind-coupons` | 一键自动领取所有可用优惠券 |
| `query-my-coupons` | 查询用户已持有的可用优惠券 |

### 🛍️ 积分商城（麦麦商城）

| 工具 | 功能 |
|------|------|
| `query-my-account` | 查询积分账户（可用、累计、即将过期积分） |
| `mall-points-products` | 查询积分可兑换商品列表（虚拟券） |
| `mall-product-detail` | 查看某积分商品的详细信息 |
| `mall-create-order` | 积分兑换虚拟商品下单 |
| `mall-create-order-physical` | 积分兑换实物商品下单 |
| `mall-order-list` | 查询商城订单列表（近一年） |
| `mall-order-detail` | 查询商城订单详情 |

### ⚙️ 通用工具

| 工具 | 功能 |
|------|------|
| `now-time-info` | 获取当前日期和时间信息 |

---

## When to Use

用户提到以下任意意图时触发：

- 麦当劳、麦乐送、麦麦省、优惠券、领券
- 积分商城、麦麦商城、积分兑换
- 麦当劳菜单、麦当劳热量、营养查询
- 附近麦当劳、麦当劳外卖、麦当劳配送
- 麦当劳活动、麦当劳优惠

## When NOT to Use

- 非麦当劳相关的问题
- 餐厅评价、投诉建议

## 注意事项

- 下单是**真实消费操作**，需用户确认后再执行
- Token 需妥善保管，避免泄露
- 超出 600 次/分钟请求会返回 429 错误
- 如遇错误码，参考 [麦当劳 MCP 官方文档](https://open.mcd.cn/mcp/doc)
