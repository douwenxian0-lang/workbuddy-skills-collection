---
name: qibook-mcp
description: "企百科 DataMCP 企业数据查询助手。通过凭证托管自动获取 Token，调用企百科 MCP 工具查询企业工商信息、董监高、股东、受益人、年报等数据。触发词：企百科、qibook、企业数据、DataMCP、企业信息查询、股权查询、股东、董监高、受益人查询。"
homepage: https://datamcp.qibook.com
metadata:
  {
    "openclaw":
      {
        "emoji": "🏢",
        "category": "business",
      },
  }
---

# 企百科 DataMCP

## 概述

通过凭证托管获取 Token → 写入 mcporter credentials 缓存 → mcporter 直接调用。

**前置条件**：用户已在集成面板完成企百科授权。

---

## 🔧 每次调用前：Token 注入

**调用任何工具前必须执行以下命令。** `SKILL_DIR` 为本 skill 根目录。

### macOS / Linux

```bash
TOKEN=$(bash "${SKILL_DIR}/get-token.sh") && export TOKEN && node -e "
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const home=os.homedir();

// ── 写 mcporter.json（只保留基本配置，不含 authType） ──
const mf=path.join(home,'.mcporter','mcporter.json');
let mc={mcpServers:{},imports:[]};
try{mc=JSON.parse(fs.readFileSync(mf,'utf8'));if(!mc.mcpServers)mc.mcpServers={};}catch{}
mc.mcpServers['qibook-mcp']={type:'http',url:'https://datamcp.qibook.com/mcp/basic-ent-tools',headers:{'X-Qibook-Source':'qclaw'},enabled:true,timeout:60};
mc.mcpServers['qibook-mcp'].authType=undefined;
mc.mcpServers['qibook-mcp'].oauthBaseUrl=undefined;
mc.mcpServers['qibook-mcp'].useLocalCallback=undefined;
fs.mkdirSync(path.join(home,'.mcporter'),{recursive:true});
fs.writeFileSync(mf,JSON.stringify(mc,null,2));

// ── 写 credentials.json（mcporter 据此判已授权） ──
const cf=path.join(home,'.mcporter','credentials.json');
let cred={version:1,entries:{}};
try{cred=JSON.parse(fs.readFileSync(cf,'utf8'));if(!cred.entries)cred.entries={};}catch{}
const hash=crypto.createHash('md5').update('https://datamcp.qibook.com/mcp/basic-ent-tools').digest('hex').slice(0,16);
cred.entries['qibook-mcp|'+hash]={serverName:'qibook-mcp',serverUrl:'https://datamcp.qibook.com/mcp/basic-ent-tools',updatedAt:new Date().toISOString(),tokens:{access_token:process.env.TOKEN,refresh_token:'',token_type:'Bearer',expires_in:7776000}};
fs.writeFileSync(cf,JSON.stringify(cred,null,2));
console.log('✅ Token 已注入')
"
```

### Windows (PowerShell)

```powershell
$token = & "${SKILL_DIR}\get-token.ps1"
$home = $env:USERPROFILE
$mcFile = Join-Path $home ".mcporter\mcporter.json"
if (Test-Path $mcFile) { $mc = Get-Content $mcFile -Raw | ConvertFrom-Json } else { $mc = @{ mcpServers = @{}; imports = @() } }
if (-not $mc.mcpServers) { $mc | Add-Member -NotePropertyName mcpServers -NotePropertyValue @{} }
$mc.mcpServers | Add-Member -NotePropertyName 'qibook-mcp' -NotePropertyValue @{
  type='http';url='https://datamcp.qibook.com/mcp/basic-ent-tools';headers=@{'X-Qibook-Source'='qclaw'};enabled=$true;timeout=60
} -Force
$mc | ConvertTo-Json -Depth 10 | Set-Content $mcFile -Encoding UTF8
$credFile = Join-Path $home ".mcporter\credentials.json"
if (Test-Path $credFile) { $cred = Get-Content $credFile -Raw | ConvertFrom-Json } else { $cred = @{ version=1; entries=@{} } }
if (-not $cred.entries) { $cred | Add-Member -NotePropertyName entries -NotePropertyValue @{} }
$hash = [BitConverter]::ToString([Security.Cryptography.MD5]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes("https://datamcp.qibook.com/mcp/basic-ent-tools"))).Replace("-","").Substring(0,16).ToLower()
$cred.entries | Add-Member -NotePropertyName "qibook-mcp|$hash" -NotePropertyValue @{
  serverName='qibook-mcp';serverUrl='https://datamcp.qibook.com/mcp/basic-ent-tools'
  updatedAt=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
  tokens=@{access_token=$token;refresh_token='';token_type='Bearer';expires_in=7776000}
} -Force
$cred | ConvertTo-Json -Depth 10 | Set-Content $credFile -Encoding UTF8
Write-Output '✅ Token 已注入'
```

**失败处理**：`get-token.sh` 失败时提示 `🔑 企百科授权未完成，请在应用内集成面板中完成企百科授权。`，并终止后续调用。

---

## 🚀 调用 MCP 工具

Token 注入后直接用 mcporter：

```bash
# 查看工具
mcporter list qibook-mcp --schema

# 调用工具
mcporter call qibook-mcp.<tool_name> key=value
```

---

## 🔨 工具列表

| 工具 | 说明 | 参数 |
|------|------|------|
| `get_company_info` | 工商信息 | `entname` |
| `fuzzy_search` | 模糊搜索 | `keyword`, `size` |
| `get_company_partner` | 股东出资 | `entname`, `page`, `shaname` |
| `get_pub_shareholder` | 十大股东 | `entname` |
| `get_beneficial_owners` | 受益所有人 | `entname` |
| `get_actual_controller` | 实际控制人 | `entname` |
| `get_branches` | 分支机构 | `entname`, `page` |
| `get_external_investments` | 对外投资 | `entname`, `page` |
| `get_company_employee` | 董监高 | `entname`, `page`, `pername`, `position` |
| `get_company_introduction` | 企业简介 | `entname` |
| `get_annual_reports` | 年报 | `entname`, `year` |
| `get_head_company` | 总公司 | `entname` |
| `get_company_changes` | 工商变更 | `entname`, `page` |
| `get_company_contact` | 联系方式 | `entname` |
| `get_listed_stock` | 上市股票 | `entname` |
| `get_listed_compinfo` | 上市公司资料 | `entname` |
| `get_pub_executive` | 上市公司高管 | `entname` |
| `get_self_disclose_share` | 自主公示股东 | `entname` |
| `scale_classification` | 规模分类 | `entname` |
| `get_history_dynamic` | 历史动态 | `entname` |

---

## 安全规则

1. **禁止泄露 Token**：绝不在文本中显示 Token 值或 credentials.json 内容
2. **每次新会话首次调用前必须先注入 Token**
3. Token 有效期 90 天，过期需重新通过集成面板授权
