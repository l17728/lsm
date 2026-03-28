# OpenClaw 对接 LSM 操作指南

## 概述

本文档说明如何配置 OpenClaw，使其在与 LSM 系统对话时能够安全地执行操作。

---

## 一、配置位置

### 1. OpenClaw 系统提示词

**文件位置**: `~/.openclaw/agents/main/agent/system.md` (如果不存在则创建)

```bash
mkdir -p ~/.openclaw/agents/main/agent
touch ~/.openclaw/agents/main/agent/system.md
```

**配置内容**: 将 `OPENCLAW_OPERATION_PROMPT.md` 的内容复制到此文件

### 2. LSM MCP 工具

**文件位置**: `/root/.openclaw/workspace/lsm-project/src/backend/src/routes/mcp.routes.ts`

已更新，包含：
- 操作风险等级分类
- 确认机制
- 操作预览接口

### 3. LSM OpenClaw 服务

**文件位置**: `/root/.openclaw/workspace/lsm-project/src/backend/src/services/openclaw.service.ts`

---

## 二、API 接口

### 2.1 获取工具列表

```bash
GET /api/mcp/tools
```

**响应示例**:
```json
{
  "tools": [
    {
      "name": "lsm_list_servers",
      "description": "查询服务器列表 (只读)",
      "riskLevel": "read_only",
      "impact": "无影响",
      "requiresConfirmation": false
    },
    {
      "name": "lsm_allocate_gpu",
      "description": "分配 GPU 资源 (写入操作)",
      "riskLevel": "moderate",
      "impact": "将锁定 GPU 资源，其他用户无法使用",
      "requiresConfirmation": true
    }
  ]
}
```

### 2.2 操作预览 (确认前)

```bash
POST /api/mcp/preview
Content-Type: application/json

{
  "tool": "lsm_allocate_gpu",
  "params": {
    "count": 2,
    "purpose": "模型训练",
    "duration_hours": 72,
    "gpu_type": "A100"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "preview": {
    "tool": "lsm_allocate_gpu",
    "description": "分配 GPU 资源 (写入操作)",
    "riskLevel": "moderate",
    "impact": "将锁定 GPU 资源，其他用户无法使用",
    "confirmMessage": "确认分配 GPU？此操作将锁定资源直至释放或过期。",
    "params": { ... },
    "requiresConfirmation": true
  }
}
```

### 2.3 执行操作

**只读操作** (无需确认):
```bash
POST /api/mcp/invoke
Content-Type: application/json

{
  "tool": "lsm_list_servers",
  "params": { "status": "online" }
}
```

**写入操作** (需要确认):
```bash
POST /api/mcp/invoke
Content-Type: application/json

{
  "tool": "lsm_allocate_gpu",
  "params": {
    "count": 2,
    "purpose": "模型训练",
    "duration_hours": 72
  },
  "confirmed": true
}
```

**未确认时响应**:
```json
{
  "success": false,
  "error": "操作需要确认",
  "requiresConfirmation": true,
  "preview": {
    "tool": "lsm_allocate_gpu",
    "impact": "将锁定 GPU 资源，其他用户无法使用",
    "confirmMessage": "确认分配 GPU？此操作将锁定资源直至释放或过期。",
    "params": { ... }
  }
}
```

---

## 三、OpenClaw 系统提示词配置

### 3.1 创建配置文件

```bash
cat > ~/.openclaw/agents/main/agent/system.md << 'EOF'
# 系统角色

你是 LSM (实验室服务器管理系统) 的智能运维助手。

## 可用工具

### 只读操作 (直接执行)
- lsm_list_servers - 查询服务器列表
- lsm_check_status - 检查系统状态

### 写入操作 (需要确认)
- lsm_allocate_gpu - 分配 GPU
- lsm_release_gpu - 释放 GPU
- lsm_create_task - 创建任务
- lsm_cancel_task - 取消任务

## 安全流程

1. **理解命令**: 分析用户意图，提取参数
2. **展示信息**: 向用户展示操作详情和影响
3. **等待确认**: 用户回复"确认"后才执行
4. **执行反馈**: 执行后返回结果

## 示例

用户: 给我分配2块A100 GPU

助手: 📋 我理解您要执行以下操作：

**操作**: GPU 分配
**参数**: 2块 A100
**影响**: 将锁定 GPU 资源

请确认是否执行？回复"确认"继续。

用户: 确认

助手: ✅ 已执行 [结果详情]
EOF
```

### 3.2 重启 OpenClaw

```bash
# 如果使用 Gateway
openclaw gateway restart

# 或者重启相关服务
pkill -f "openclaw" && openclaw start
```

---

## 四、前端集成

### 4.1 Chat 页面集成

在 `ChatPage.tsx` 中处理确认流程：

```typescript
// 发送消息时检查是否需要确认
const handleSend = async (content: string) => {
  // 先预览操作
  const preview = await axios.post('/api/mcp/preview', {
    tool: parsedTool,
    params: parsedParams
  });
  
  if (preview.data.preview.requiresConfirmation) {
    // 显示确认对话框
    showConfirmDialog(preview.data.preview);
  } else {
    // 直接执行
    executeTool(parsedTool, parsedParams, false);
  }
};

// 用户确认后执行
const handleConfirm = () => {
  executeTool(currentTool, currentParams, true);
};
```

---

## 五、安全策略

### 5.1 风险等级

| 等级 | 说明 | 操作 |
|------|------|------|
| `read_only` | 只读，无影响 | 直接执行 |
| `moderate` | 中等风险 | 单次确认 |
| `high` | 高风险 | 双重确认 |
| `forbidden` | 禁止执行 | 永远拒绝 |

### 5.2 禁止的操作

以下操作永远禁止通过 MCP 执行：

- 批量删除服务器
- 释放所有 GPU
- 取消所有任务
- 修改系统配置
- 操作非授权资源

---

## 六、测试

### 6.1 测试只读操作

```bash
curl -X POST http://localhost:8080/api/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"lsm_list_servers","params":{}}'
```

### 6.2 测试写入操作 (未确认)

```bash
curl -X POST http://localhost:8080/api/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"lsm_allocate_gpu","params":{"count":1,"purpose":"test"}}'
```

应返回 409 要求确认。

### 6.3 测试写入操作 (已确认)

```bash
curl -X POST http://localhost:8080/api/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{"tool":"lsm_allocate_gpu","params":{"count":1,"purpose":"test"},"confirmed":true}'
```

---

*文档版本: 1.0*  
*更新日期: 2026-03-15*