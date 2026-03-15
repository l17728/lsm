# LSM v3.2.0 技术架构设计文档

**版本**: 3.2.0 | **日期**: 2026-03-15 | **状态**: 设计中

---

## 1. 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户接入层                               │
│  [Web 控制台]  [移动 APP]  [API 客户端]                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ WebSocket / HTTP
                    ┌─────────▼─────────┐
                    │    API Gateway    │
                    │  (Express + JWT)  │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                      核心服务层 (Node.js)                        │
│  [REST API] [WebSocket Server] [任务调度器] [业务服务]          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────┼───────────────────────────────────┐
│                     AI Agent 层 (OpenClaw)                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │   三层决策引擎: L1规则 → L2模型 → L3 LLM                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│  MCP Tools: [server_ops] [task_ops] [monitor_ops] [user_ops]   │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  数据层: [PostgreSQL] [Redis] [Prometheus]                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 组件设计

### 2.1 前端 (React + 聊天组件)

```
frontend/src/
├── components/
│   ├── ChatWidget/      # 内嵌聊天组件
│   │   ├── ChatWindow.tsx   # 聊天窗口
│   │   ├── MessageList.tsx  # 消息列表 (Markdown 渲染)
│   │   └── InputBox.tsx     # 输入框 (命令补全)
│   ├── ServerPanel/     # 服务器管理
│   └── Dashboard/       # 仪表盘
└── hooks/
    └── useWebSocket.ts  # WebSocket 连接管理
```

### 2.2 后端 (Node.js + Express)

```
backend/src/
├── routes/              # API 路由
│   ├── servers.ts       # 服务器 CRUD
│   ├── tasks.ts         # 任务管理
│   ├── reservations.ts  # 预约管理
│   └── chat.ts          # Agent 交互
├── services/            # 业务逻辑
├── websocket/           # WebSocket 处理
└── agent/               # Agent 集成
    └── tools/           # MCP Tools 实现
```

### 2.3 Agent 集成 (OpenClaw + MCP)

```typescript
// MCP Tools 暴露 LSM 操作
const mcpTools = {
  server_list: () => Promise<Server[]>,
  server_allocate: (spec: ServerSpec) => Promise<Server>,
  server_release: (id: string) => Promise<void>,
  task_create: (task: TaskSpec) => Promise<Task>,
  monitor_metrics: (serverId: string) => Promise<Metrics>
};
```

---

## 3. 三层决策引擎

```
                    用户请求
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│  L1: 规则引擎                                           │
│  - 预定义规则匹配 (if-then)  │ 响应 <10ms  │ 无LLM调用  │
│  - 适用: 简单查询、状态检查、阈值告警                    │
└───────────────────────────┬─────────────────────────────┘
                            │ 规则匹配失败
                            ▼
┌─────────────────────────────────────────────────────────┐
│  L2: 模型匹配                                           │
│  - 意图识别 + 槽位填充      │ 响应 <100ms │ 本地推理   │
│  - 适用: 结构化操作、参数化命令                          │
└───────────────────────────┬─────────────────────────────┘
                            │ 置信度 < 85%
                            ▼
┌─────────────────────────────────────────────────────────┐
│  L3: LLM 决策                                          │
│  - 大语言模型推理           │ 响应 <3s   │ 复杂理解   │
│  - 适用: 复杂决策、多步骤操作、自然语言理解              │
└─────────────────────────────────────────────────────────┘
```

**决策流程**:
```typescript
async function decide(query: string) {
  const l1 = ruleEngine.match(query);    // 快速路径
  if (l1.matched) return l1.action;
  
  const l2 = modelMatcher.predict(query); // 中等路径
  if (l2.confidence >= 0.85) return l2.action;
  
  return llmEngine.decide(query);         // 慢速路径
}
```

---

## 4. 数据流设计

### 4.1 聊天交互流

```
[用户输入] ──WS──▶ [后端API] ──▶ [Agent服务]
    ▲                   │              │
    │                   │              ▼
    │                   │        [决策引擎]
    │                   │         L1/L2/L3
    │                   │              │
    │                   │              ▼
    │                   │        [MCP Tool]
    │                   │              │
    │                   │              ▼
    │                   │        [数据库操作]
    │                   │              │
    └─────── WS 推送 ───┴──────────────┘
```

### 4.2 MCP Tool 调用

```
Agent                 MCP Tool              LSM Core
  │                      │                     │
  │ "分配GPU服务器"      │                     │
  ├─────────────────────▶│                     │
  │                      │ server_allocate     │
  │                      ├────────────────────▶│
  │                      │                     │ 锁定资源
  │                      │◀────────────────────┤ 返回结果
  │◀─────────────────────┤                     │
  │ "已分配 GPU-001..."  │                     │
```

---

## 5. 安全设计

### 5.1 认证授权

| 机制 | 实现 |
|------|------|
| 认证 | JWT (Access 15min + Refresh 7day) |
| 授权 | RBAC (ADMIN/MANAGER/USER/GUEST) |
| 传输 | TLS 1.3 + WSS |
| Agent | 操作白名单 + 二次确认 + 审计日志 |

### 5.2 RBAC 权限矩阵

| 操作 | ADMIN | MANAGER | USER | GUEST |
|------|:-----:|:-------:|:----:|:-----:|
| 服务器分配 | ✅ | ✅ | ✅ | ❌ |
| 服务器释放 | ✅ | ✅ | 自己 | ❌ |
| 系统配置 | ✅ | ❌ | ❌ | ❌ |
| 审计日志 | ✅ | ✅ | ❌ | ❌ |

---

## 6. 技术选型

### 6.1 核心技术栈

| 组件 | v3.0.x | v3.2.0 | 变更原因 |
|------|--------|--------|---------|
| 后端 | Go + Gin | Node.js + Express | Agent 集成友好 |
| 实时通信 | gRPC | WebSocket | 前端直连简化 |
| Agent | 无 | OpenClaw | 智能交互 |
| 决策 | 规则脚本 | 三层引擎 | 渐进式智能 |

### 6.2 核心依赖

```json
{
  "express": "^4.18", "ws": "^8", "pg": "^8",
  "ioredis": "^5", "jsonwebtoken": "^9",
  "@openclaw/agent-sdk": "^1", "react": "^18"
}
```

### 6.3 部署架构

```yaml
services:
  lsm-backend:
    image: lsm-backend:v3.2.0
    ports: ["4000:4000", "4001:4001"]
    environment:
      - DATABASE_URL=postgresql://...
      - OPENCLAW_AGENT_URL=ws://agent:3000
      
  openclaw-agent:
    image: openclaw/agent:latest
    volumes: ["./tools:/app/tools"]
```

---

## 7. 性能指标

| 指标 | 目标 | 说明 |
|------|------|------|
| L1 响应 | <10ms | 规则匹配 |
| L2 响应 | <100ms | 模型推理 |
| L3 响应 | <3s | LLM 决策 |
| WS 延迟 | <50ms | 消息推送 |
| 并发连接 | 1000+ | WebSocket |

---

## 8. 扩展性

### 8.1 新增 MCP Tool

```typescript
const tool: MCPTool = {
  name: 'reservation_create',
  parameters: { serverId: 'string', startTime: 'date-time', duration: 'number' },
  handler: async (p) => reservationService.create(p)
};
```

### 8.2 新增决策规则

```yaml
rules:
  - name: "status_check"
    pattern: "^(状态|status)"
    action: "server_status"
```

---

*维护者: LSM 架构团队*