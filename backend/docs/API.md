# LSM 项目 API 文档

**版本**: 3.2.2  
**最后更新**: 2026-03-26  
**生成方式**: Swagger + 手动补充

---

## 📚 目录

1. [认证 API](#认证-api)
2. [服务器 API](#服务器-api)
3. [GPU API](#gpu-api)
4. [任务 API](#任务-api)
5. [用户 API](#用户-api)
6. [监控 API](#监控-api)
7. [导出 API](#导出-api)
8. [缓存 API](#缓存-api)
9. [邮件通知 API](#邮件通知-api)
10. [集群 API](#集群-api)
11. [集群预约 API](#集群预约-api)

---

## 认证 API

### POST /api/auth/register

注册新用户

**请求体**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "username": "string",
      "email": "string"
    },
    "token": "string"
  }
}
```

---

### POST /api/auth/login

用户登录

**请求体**:
```json
{
  "email": "string",
  "password": "string"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "username": "string",
      "email": "string"
    },
    "token": "string",
    "refreshToken": "string"
  }
}
```

---

### POST /api/auth/refresh

刷新访问令牌

**请求体**:
```json
{
  "refreshToken": "string"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "string",
    "refreshToken": "string"
  }
}
```

---

### POST /api/auth/2fa/enable

启用双因素认证

**请求头**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "data": {
    "secret": "string",
    "qrCode": "string"
  }
}
```

---

### POST /api/auth/2fa/verify

验证双因素认证码

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "code": "string"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "verified": true
  }
}
```

---

## 服务器 API

### GET /api/servers

获取所有服务器列表

**查询参数**:
- `page` (可选): 页码，默认 1
- `limit` (可选): 每页数量，默认 10
- `status` (可选): 状态过滤 (online/offline/maintenance)

**响应**:
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "number",
        "name": "string",
        "hostname": "string",
        "ip": "string",
        "status": "string",
        "cpu": "number",
        "memory": "number",
        "disk": "number",
        "gpus": []
      }
    ],
    "total": "number",
    "page": "number",
    "pages": "number"
  }
}
```

---

### POST /api/servers

创建新服务器

**请求体**:
```json
{
  "name": "string",
  "hostname": "string",
  "ip": "string",
  "port": "number",
  "username": "string",
  "password": "string",
  "gpus": [
    {
      "name": "string",
      "memory": "number"
    }
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "server": {
      "id": "number",
      "name": "string",
      "status": "string"
    }
  }
}
```

---

### PUT /api/servers/:id

更新服务器信息

**路径参数**: `id` - 服务器 ID

**请求体**:
```json
{
  "name": "string",
  "status": "string",
  "cpu": "number",
  "memory": "number",
  "disk": "number"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "server": {
      "id": "number",
      "name": "string"
    }
  }
}
```

---

### DELETE /api/servers/:id

删除服务器

**路径参数**: `id` - 服务器 ID

**响应**:
```json
{
  "success": true,
  "message": "Server deleted successfully"
}
```

---

## GPU API

### GET /api/gpus

获取所有 GPU 列表

**查询参数**:
- `status` (可选): 状态过滤 (available/allocated/maintenance)
- `serverId` (可选): 服务器 ID 过滤

**响应**:
```json
{
  "success": true,
  "data": {
    "gpus": [
      {
        "id": "number",
        "name": "string",
        "memory": "number",
        "status": "string",
        "serverId": "number",
        "allocatedTo": "number"
      }
    ],
    "total": "number"
  }
}
```

---

### POST /api/gpu/allocate

分配 GPU

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "userId": "number",
  "gpuId": "number",
  "duration": "number",
  "purpose": "string"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "allocation": {
      "id": "number",
      "gpuId": "number",
      "userId": "number",
      "startTime": "string",
      "endTime": "string"
    }
  }
}
```

---

### POST /api/gpu/release/:id

释放 GPU

**路径参数**: `id` - 分配 ID

**请求头**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "message": "GPU released successfully"
}
```

---

## 任务 API

### GET /api/tasks

获取所有任务列表

**查询参数**:
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `status` (可选): 状态过滤 (pending/running/completed/failed/cancelled)
- `priority` (可选): 优先级过滤 (high/medium/low)
- `userId` (可选): 用户 ID 过滤

**响应**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "number",
        "name": "string",
        "description": "string",
        "status": "string",
        "priority": "string",
        "userId": "number",
        "serverId": "number",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ],
    "total": "number",
    "page": "number",
    "pages": "number"
  }
}
```

---

### POST /api/tasks

创建新任务

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "name": "string",
  "description": "string",
  "priority": "string",
  "serverId": "number",
  "gpuId": "number",
  "script": "string",
  "parameters": {}
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "task": {
      "id": "number",
      "name": "string",
      "status": "string"
    }
  }
}
```

---

### POST /api/tasks/:id/cancel

取消任务

**路径参数**: `id` - 任务 ID

**请求头**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "message": "Task cancelled successfully"
}
```

---

### GET /api/tasks/:id/logs

获取任务日志

**路径参数**: `id` - 任务 ID

**响应**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "timestamp": "string",
        "level": "string",
        "message": "string"
      }
    ]
  }
}
```

---

## 用户 API

### GET /api/users

获取所有用户列表

**查询参数**:
- `page` (可选): 页码
- `limit` (可选): 每页数量
- `role` (可选): 角色过滤 (admin/user/guest)

**响应**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "number",
        "username": "string",
        "email": "string",
        "role": "string",
        "twoFactorEnabled": "boolean",
        "createdAt": "string"
      }
    ],
    "total": "number",
    "page": "number",
    "pages": "number"
  }
}
```

---

### PUT /api/users/:id/role

更新用户角色

**路径参数**: `id` - 用户 ID

**请求体**:
```json
{
  "role": "string"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "role": "string"
    }
  }
}
```

---

## 监控 API

### GET /health

健康检查端点

**响应**:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-13T14:00:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": "5ms"
    },
    "redis": {
      "status": "healthy",
      "responseTime": "1ms"
    },
    "disk": {
      "status": "healthy",
      "usage": "45%"
    },
    "memory": {
      "status": "healthy",
      "usage": "62%"
    }
  }
}
```

---

### GET /metrics

Prometheus 格式监控指标

**响应类型**: `text/plain; version=0.0.4`

**示例**:
```prometheus
# HELP lsm_app_uptime_seconds Application uptime in seconds
# TYPE lsm_app_uptime_seconds counter
lsm_app_uptime_seconds 86400

# HELP lsm_app_memory_usage_bytes Application memory usage
# TYPE lsm_app_memory_usage_bytes gauge
lsm_app_memory_usage_bytes 52428800

# HELP lsm_db_users_total Total number of users
# TYPE lsm_db_users_total gauge
lsm_db_users_total 150

# HELP lsm_cache_hits_total Total cache hits
# TYPE lsm_cache_hits_total counter
lsm_cache_hits_total 12450

# HELP lsm_cache_misses_total Total cache misses
# TYPE lsm_cache_misses_total counter
lsm_cache_misses_total 1823

# HELP lsm_cache_hit_rate_percent Cache hit rate percentage
# TYPE lsm_cache_hit_rate_percent gauge
lsm_cache_hit_rate_percent 87.2
```

---

### GET /api/metrics/app

应用监控指标 (JSON 格式)

**响应**:
```json
{
  "success": true,
  "data": {
    "uptime": 86400,
    "memory": {
      "rss": 52428800,
      "heapUsed": 41943040,
      "heapTotal": 62914560
    },
    "requests": {
      "total": 15234,
      "perMinute": 127
    },
    "errors": {
      "total": 23,
      "rate": 0.15
    }
  }
}
```

---

### GET /api/metrics/database

数据库监控指标

**响应**:
```json
{
  "success": true,
  "data": {
    "users": 150,
    "servers": 12,
    "tasks": {
      "total": 523,
      "pending": 15,
      "running": 8,
      "completed": 485,
      "failed": 12,
      "cancelled": 3
    },
    "gpus": {
      "total": 48,
      "available": 22,
      "allocated": 24,
      "maintenance": 2
    }
  }
}
```

---

### GET /api/metrics/cache

缓存监控指标

**响应**:
```json
{
  "success": true,
  "data": {
    "hits": 12450,
    "misses": 1823,
    "hitRate": 87.2,
    "size": 45219840,
    "keys": 1247,
    "avgLatency": 0.9
  }
}
```

---

## 导出 API

### GET /api/export/servers

导出服务器数据 (CSV)

**查询参数**:
- `format` (可选): 导出格式 (csv)，默认 csv

**响应头**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="servers-2026-03-13.csv"
```

**响应体**: CSV 格式数据

---

### GET /api/export/tasks

导出任务数据 (CSV)

**查询参数**:
- `format` (可选): 导出格式 (csv)
- `status` (可选): 状态过滤
- `startDate` (可选): 开始日期
- `endDate` (可选): 结束日期

**响应头**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="tasks-2026-03-13.csv"
```

---

### GET /api/export/gpus

导出 GPU 数据 (Excel)

**查询参数**:
- `format` (可选): 导出格式 (xlsx)
- `status` (可选): 状态过滤

**响应头**:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="gpus-2026-03-13.xlsx"
```

---

### GET /api/export/users

导出用户数据 (Excel)

**查询参数**:
- `format` (可选): 导出格式 (xlsx)
- `role` (可选): 角色过滤

**响应头**:
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="users-2026-03-13.xlsx"
```

---

## 缓存 API

### POST /api/cache/warm

预热缓存

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "keys": ["userList", "serverList", "gpuList"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "warmed": 3,
    "failed": 0
  }
}
```

---

### DELETE /api/cache/clear

清除缓存

**请求头**: `Authorization: Bearer <token>`

**查询参数**:
- `pattern` (可选): 缓存键模式，默认 "*"

**响应**:
```json
{
  "success": true,
  "data": {
    "cleared": 1247
  }
}
```

---

### GET /api/cache/stats

获取缓存统计

**响应**:
```json
{
  "success": true,
  "data": {
    "hits": 12450,
    "misses": 1823,
    "hitRate": 87.2,
    "size": 45219840,
    "keys": 1247,
    "avgLatency": 0.9,
    "ttlConfig": {
      "userSession": 604800,
      "serverMetrics": 600,
      "gpuStatus": 120,
      "userList": 1800,
      "serverList": 900,
      "taskList": 300,
      "gpuList": 600
    }
  }
}
```

---

## 邮件通知 API

### GET /api/notifications/email/queue

获取邮件队列状态

**请求头**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "data": {
    "pending": 5,
    "processing": 2,
    "failed": 0,
    "completed": 1247
  }
}
```

---

### POST /api/notifications/email/test

发送测试邮件

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "to": "string",
  "subject": "string",
  "template": "string",
  "data": {}
}
```

**响应**:
```json
{
  "success": true,
  "message": "Test email sent successfully"
}
```

---

### GET /api/notifications/email/templates

获取邮件模板列表

**请求头**: `Authorization: Bearer <token>`

**响应**:
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "name": "task_assigned",
        "subject": "新任务分配通知",
        "description": "任务分配时发送的通知"
      },
      {
        "name": "gpu_allocated",
        "subject": "GPU 分配成功通知",
        "description": "GPU 分配成功后发送的通知"
      },
      {
        "name": "system_alert",
        "subject": "系统告警通知",
        "description": "系统资源告警时发送的通知"
      }
    ]
  }
}
```

---

## 集群 API

### GET /api/clusters

获取所有集群列表

**查询参数**:
- `status` (可选): 状态过滤 (AVAILABLE/ALLOCATED/RESERVED/MAINTENANCE)
- `type` (可选): 类型过滤 (COMPUTE/TRAINING/INFERENCE/GENERAL/CUSTOM)

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "code": "string",
      "description": "string",
      "type": "string",
      "status": "string",
      "tags": ["string"],
      "totalServers": "number",
      "totalGpus": "number",
      "totalCpuCores": "number",
      "totalMemory": "number",
      "assignee": {
        "id": "string",
        "username": "string",
        "email": "string"
      },
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

---

### GET /api/clusters/stats

获取集群统计信息

**响应**:
```json
{
  "success": true,
  "data": {
    "total": "number",
    "byStatus": {
      "available": "number",
      "allocated": "number",
      "reserved": "number",
      "maintenance": "number"
    },
    "resources": {
      "totalServers": "number",
      "totalGpus": "number",
      "totalCpuCores": "number",
      "totalMemory": "number"
    }
  }
}
```

---

### POST /api/clusters

创建新集群

**请求头**: `Authorization: Bearer <token>`

**权限**: SUPER_ADMIN

**请求体**:
```json
{
  "name": "string",
  "code": "string",
  "description": "string",
  "type": "string",
  "tags": ["string"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "code": "string",
    "status": "AVAILABLE"
  }
}
```

---

### PUT /api/clusters/:id

更新集群信息

**路径参数**: `id` - 集群 ID

**请求头**: `Authorization: Bearer <token>`

**请求体**:
```json
{
  "name": "string",
  "description": "string",
  "type": "string",
  "status": "string"
}
```

---

### DELETE /api/clusters/:id

删除集群

**路径参数**: `id` - 集群 ID

**权限**: SUPER_ADMIN

---

### POST /api/clusters/:clusterId/servers

向集群添加服务器

**路径参数**: `clusterId` - 集群 ID

**请求体**:
```json
{
  "serverId": "string",
  "priority": "number",
  "role": "string"
}
```

---

### DELETE /api/clusters/:clusterId/servers/:serverId

从集群移除服务器

---

## 集群预约 API

### GET /api/cluster-reservations

获取所有预约列表

**查询参数**:
- `status` (可选): 状态过滤 (PENDING/APPROVED/REJECTED/ACTIVE/COMPLETED/CANCELLED)
- `clusterId` (可选): 集群 ID 过滤
- `userId` (可选): 用户 ID 过滤
- `startTime` (可选): 开始时间过滤
- `endTime` (可选): 结束时间过滤

**权限**: MANAGER+

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "clusterId": "string",
      "userId": "string",
      "startTime": "string",
      "endTime": "string",
      "purpose": "string",
      "status": "string",
      "queuePosition": "number",
      "cluster": {
        "id": "string",
        "name": "string",
        "code": "string"
      },
      "user": {
        "id": "string",
        "username": "string",
        "email": "string"
      },
      "createdAt": "string"
    }
  ]
}
```

---

### GET /api/cluster-reservations/my

获取当前用户的预约列表

**权限**: MANAGER+

---

### GET /api/cluster-reservations/pending

获取待审批的预约列表

**权限**: SUPER_ADMIN

---

### POST /api/cluster-reservations

创建预约申请

**请求头**: `Authorization: Bearer <token>`

**权限**: MANAGER+

**请求体**:
```json
{
  "clusterId": "string",
  "startTime": "string (ISO 8601)",
  "endTime": "string (ISO 8601)",
  "purpose": "string",
  "teamId": "string (可选)"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "PENDING",
    "queuePosition": "number | null"
  }
}
```

**说明**:
- 预约需要 SUPER_ADMIN 审批
- 如果时间有冲突，自动进入等待队列并分配 `queuePosition`

---

### PUT /api/cluster-reservations/:id/approve

审批通过预约

**路径参数**: `id` - 预约 ID

**权限**: SUPER_ADMIN

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "APPROVED",
    "approvedBy": "string",
    "approvedAt": "string"
  }
}
```

---

### PUT /api/cluster-reservations/:id/reject

拒绝预约

**路径参数**: `id` - 预约 ID

**权限**: SUPER_ADMIN

**请求体**:
```json
{
  "reason": "string"
}
```

---

### PUT /api/cluster-reservations/:id/cancel

取消预约

**路径参数**: `id` - 预约 ID

**权限**: 预约所有者

---

### PUT /api/cluster-reservations/:id/release

提前释放资源

**路径参数**: `id` - 预约 ID

**权限**: 预约所有者

---

### GET /api/cluster-reservations/recommend-time-slots

🤖 **AI 智能推荐最佳预约时间段**

**查询参数**:
- `clusterId` (必填): 集群 ID
- `duration` (必填): 时长（分钟）
- `preferredStartTime` (可选): 首选开始时间 (ISO 8601)
- `preferredEndTime` (可选): 首选结束时间 (ISO 8601)

**权限**: MANAGER+

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "startTime": "string (ISO 8601)",
      "endTime": "string (ISO 8601)",
      "score": "number (0-100)",
      "confidence": "number (0-1)",
      "reasons": ["string"],
      "queuePosition": "number | null"
    }
  ]
}
```

**推荐理由示例**:
- `"无时间冲突"`
- `"避开高峰时段"`
- `"工作日时段"`
- `"上午时段效率较高"`
- `"时长与历史使用模式匹配"`
- `"需排队等待"`

**评分维度**:
1. **时间邻近度** (25分): 越近越好，但非立即
2. **避开高峰** (20分): 非高峰时段加分
3. **工作日偏好** (15分): 工作日加分
4. **上午偏好** (15分): 9-12AM 加分
5. **时长匹配** (10分): 与历史使用模式匹配加分
6. **无冲突** (15分): 无时间冲突加分

**置信度**:
- 基于历史数据量和波动性计算
- 数据量 >= 30 条且稳定: 0.85
- 数据量不足或波动大: 0.65

**使用示例**:
```javascript
// 获取 2 小时预约的 AI 推荐
const response = await fetch(
  '/api/cluster-reservations/recommend-time-slots?' +
  'clusterId=cluster-1&duration=120'
);

// 带首选时间范围
const response = await fetch(
  '/api/cluster-reservations/recommend-time-slots?' +
  'clusterId=cluster-1&duration=120' +
  '&preferredStartTime=2026-03-27T09:00:00Z' +
  '&preferredEndTime=2026-03-27T18:00:00Z'
);
```

---

## 错误响应格式

所有 API 错误统一返回以下格式:

```json
{
  "success": false,
  "error": {
    "code": "ERR_CODE",
    "message": "用户友好的错误信息",
    "details": {},
    "timestamp": "2026-03-13T14:00:00Z"
  }
}
```

### 常见错误码

| 错误码 | HTTP 状态码 | 说明 |
|--------|-----------|------|
| ERR_UNAUTHORIZED | 401 | 未授权访问 |
| ERR_FORBIDDEN | 403 | 禁止访问 |
| ERR_NOT_FOUND | 404 | 资源不存在 |
| ERR_VALIDATION | 400 | 参数验证失败 |
| ERR_CONFLICT | 409 | 资源冲突 |
| ERR_RATE_LIMIT | 429 | 请求频率超限 |
| ERR_INTERNAL | 500 | 服务器内部错误 |

---

## 速率限制

| 端点类型 | 限制 | 时间窗口 |
|---------|------|---------|
| 认证端点 | 10 请求 | 1 分钟/IP |
| API 端点 | 100 请求 | 1 分钟/IP |
| 导出端点 | 5 请求 | 1 分钟/用户 |
| 监控端点 | 不限 | - |

---

## 认证方式

所有需要认证的端点使用 JWT Bearer Token:

```
Authorization: Bearer <your_jwt_token>
```

### Token 获取

1. 调用 `/api/auth/login` 获取访问令牌
2. 在请求头中携带令牌
3. 令牌过期时间：15 分钟
4. 使用刷新令牌可获取新令牌

---

**文档版本**: 3.2.2  
**最后更新**: 2026-03-26  
**维护者**: 后端开发团队
