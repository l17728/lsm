# LSM API 文档 (API Documentation)

**版本**: 3.0.0  
**最后更新**: 2026-03-13  
**状态**: 生产就绪  
**基础 URL**: `http://localhost:4000/api` (开发环境)

---

## 📚 目录

1. [概述](#概述)
2. [认证和授权](#认证和授权)
3. [API 端点](#api-端点)
4. [错误码和异常处理](#错误码和异常处理)
5. [请求/响应示例](#请求响应示例)
6. [版本变更说明](#版本变更说明)

---

## 概述

### API 风格

- **架构**: RESTful API
- **数据格式**: JSON
- **字符编码**: UTF-8
- **认证方式**: JWT Bearer Token

### 响应格式

所有 API 响应遵循统一格式：

#### 成功响应
```json
{
  "success": true,
  "data": { ... }
}
```

#### 错误响应
```json
{
  "success": false,
  "error": "错误信息"
}
```

#### 分页响应
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### 通用响应头

| 头字段 | 说明 |
|--------|------|
| `Content-Type` | `application/json; charset=utf-8` |
| `X-RateLimit-Limit` | 每小时请求限制 |
| `X-RateLimit-Remaining` | 剩余请求数 |
| `X-RateLimit-Reset` | 限制重置时间戳 |

---

## 认证和授权

### JWT 认证

#### 获取 Token

**端点**: `POST /api/auth/login`

**请求**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "username": "testuser",
      "email": "test@example.com",
      "role": "USER"
    }
  }
}
```

#### 使用 Token

在所有需要认证的请求中，添加 `Authorization` 头：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 用户角色权限

| 端点 | USER | MANAGER | ADMIN |
|------|------|---------|-------|
| `/api/auth/*` | ✅ | ✅ | ✅ |
| `GET /api/servers` | ✅ | ✅ | ✅ |
| `POST /api/servers` | ❌ | ❌ | ✅ |
| `PUT /api/servers/:id` | ❌ | ✅ | ✅ |
| `DELETE /api/servers/:id` | ❌ | ❌ | ✅ |
| `GET /api/tasks` | ✅ | ✅ | ✅ |
| `POST /api/tasks` | ✅ | ✅ | ✅ |
| `GET /api/tasks/all` | ❌ | ❌ | ✅ |
| `GET /api/users` | ❌ | ❌ | ✅ |

### Token 过期处理

Token 默认有效期为 15 分钟。过期后会收到 `401 Unauthorized` 响应。

**错误响应**:
```json
{
  "success": false,
  "error": "Token expired"
}
```

**解决方案**: 重新登录获取新 Token。

---

## API 端点

### 认证模块 (Auth)

#### 1. 注册新用户

**端点**: `POST /api/auth/register`  
**权限**: 公开

**请求体**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "securepassword123"
}
```

**验证规则**:
- `username`: 3-30 个字符
- `email`: 有效的邮箱格式
- `password`: 至少 6 个字符

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "USER",
    "createdAt": "2026-03-13T10:00:00.000Z"
  }
}
```

**错误响应 (400)**:
```json
{
  "success": false,
  "error": "Username already exists"
}
```

---

#### 2. 用户登录

**端点**: `POST /api/auth/login`  
**权限**: 公开

**请求体**:
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "username": "testuser",
      "email": "test@example.com",
      "role": "USER"
    }
  }
}
```

**错误响应 (401)**:
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

#### 3. 用户登出

**端点**: `POST /api/auth/logout`  
**权限**: 已认证用户

**请求头**:
```
Authorization: Bearer <token>
```

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### 4. 获取当前用户信息

**端点**: `GET /api/auth/me`  
**权限**: 已认证用户

**请求头**:
```
Authorization: Bearer <token>
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "testuser",
    "email": "test@example.com",
    "role": "USER",
    "createdAt": "2026-03-13T10:00:00.000Z",
    "lastLogin": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 5. 修改密码

**端点**: `PUT /api/auth/password`  
**权限**: 已认证用户

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "oldPassword": "oldpassword123",
  "newPassword": "newpassword456"
}
```

**验证规则**:
- `oldPassword`: 当前密码
- `newPassword`: 至少 6 个字符

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**错误响应 (400)**:
```json
{
  "success": false,
  "error": "Current password is incorrect"
}
```

---

#### 6. 获取所有用户 (管理员)

**端点**: `GET /api/auth/users`  
**权限**: ADMIN

**请求头**:
```
Authorization: Bearer <token>
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "role": "ADMIN",
      "createdAt": "2026-03-01T10:00:00.000Z"
    },
    {
      "id": "uuid",
      "username": "user1",
      "email": "user1@example.com",
      "role": "USER",
      "createdAt": "2026-03-02T10:00:00.000Z"
    }
  ]
}
```

**错误响应 (403)**:
```json
{
  "success": false,
  "error": "Admin access required"
}
```

---

#### 7. 更新用户角色 (管理员)

**端点**: `PUT /api/auth/users/:id/role`  
**权限**: ADMIN

**路径参数**:
- `id`: 用户 UUID

**请求体**:
```json
{
  "role": "MANAGER"
}
```

**可选角色**:
- `ADMIN` - 管理员
- `MANAGER` - 管理员
- `USER` - 普通用户

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "user1",
    "email": "user1@example.com",
    "role": "MANAGER",
    "updatedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 8. 删除用户 (管理员)

**端点**: `DELETE /api/auth/users/:id`  
**权限**: ADMIN

**路径参数**:
- `id`: 用户 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

### 服务器管理模块 (Servers)

#### 1. 获取所有服务器

**端点**: `GET /api/servers`  
**权限**: 已认证用户

**查询参数**:
- `status`: 筛选状态 (可选)
  - `ONLINE`
  - `OFFLINE`
  - `MAINTENANCE`
  - `ERROR`

**请求示例**:
```
GET /api/servers?status=ONLINE
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "GPU-Server-01",
      "hostname": "gpu01.lab.local",
      "ipAddress": "192.168.1.100",
      "cpuCores": 32,
      "totalMemory": 128,
      "gpuCount": 4,
      "status": "ONLINE",
      "createdAt": "2026-03-01T10:00:00.000Z",
      "updatedAt": "2026-03-13T10:00:00.000Z"
    }
  ]
}
```

---

#### 2. 获取服务器统计

**端点**: `GET /api/servers/stats`  
**权限**: 已认证用户

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "totalServers": 10,
    "onlineServers": 8,
    "offlineServers": 1,
    "maintenanceServers": 1,
    "totalGpus": 40,
    "availableGpus": 25,
    "allocatedGpus": 15
  }
}
```

---

#### 3. 获取可用服务器

**端点**: `GET /api/servers/available`  
**权限**: 已认证用户

**说明**: 返回在线且有可用 GPU 的服务器

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "GPU-Server-01",
      "hostname": "gpu01.lab.local",
      "availableGpus": 3
    }
  ]
}
```

---

#### 4. 获取单个服务器

**端点**: `GET /api/servers/:id`  
**权限**: 已认证用户

**路径参数**:
- `id`: 服务器 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "GPU-Server-01",
    "hostname": "gpu01.lab.local",
    "ipAddress": "192.168.1.100",
    "cpuCores": 32,
    "totalMemory": 128,
    "gpuCount": 4,
    "status": "ONLINE",
    "gpus": [
      {
        "id": "uuid",
        "model": "NVIDIA A100",
        "memory": 40,
        "status": "AVAILABLE"
      }
    ],
    "createdAt": "2026-03-01T10:00:00.000Z"
  }
}
```

**错误响应 (404)**:
```json
{
  "success": false,
  "error": "Server not found"
}
```

---

#### 5. 创建服务器

**端点**: `POST /api/servers`  
**权限**: ADMIN

**请求体**:
```json
{
  "name": "GPU-Server-02",
  "hostname": "gpu02.lab.local",
  "ipAddress": "192.168.1.101",
  "cpuCores": 64,
  "totalMemory": 256,
  "gpuCount": 8,
  "gpus": [
    {
      "model": "NVIDIA A100",
      "memory": 80
    }
  ]
}
```

**验证规则**:
- `name`: 必填
- `hostname`: 必填
- `ipAddress`: 必填，有效的 IP 地址
- `cpuCores`: 必填，≥1
- `totalMemory`: 必填，≥1 (GB)

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "GPU-Server-02",
    "hostname": "gpu02.lab.local",
    "ipAddress": "192.168.1.101",
    "cpuCores": 64,
    "totalMemory": 256,
    "gpuCount": 8,
    "status": "OFFLINE",
    "createdAt": "2026-03-13T10:00:00.000Z"
  }
}
```

---

#### 6. 更新服务器

**端点**: `PUT /api/servers/:id`  
**权限**: MANAGER, ADMIN

**路径参数**:
- `id`: 服务器 UUID

**请求体** (所有字段可选):
```json
{
  "name": "GPU-Server-02-Updated",
  "hostname": "gpu02-new.lab.local",
  "ipAddress": "192.168.1.102",
  "cpuCores": 64,
  "totalMemory": 512,
  "status": "ONLINE"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "GPU-Server-02-Updated",
    "hostname": "gpu02-new.lab.local",
    "ipAddress": "192.168.1.102",
    "cpuCores": 64,
    "totalMemory": 512,
    "gpuCount": 8,
    "status": "ONLINE",
    "updatedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 7. 更新服务器状态

**端点**: `PATCH /api/servers/:id/status`  
**权限**: MANAGER, ADMIN

**路径参数**:
- `id`: 服务器 UUID

**请求体**:
```json
{
  "status": "ONLINE"
}
```

**可选状态**:
- `ONLINE` - 在线
- `OFFLINE` - 离线
- `MAINTENANCE` - 维护中
- `ERROR` - 错误

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "GPU-Server-01",
    "status": "ONLINE",
    "updatedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 8. 删除服务器

**端点**: `DELETE /api/servers/:id`  
**权限**: ADMIN

**路径参数**:
- `id`: 服务器 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "Server deleted successfully"
}
```

---

#### 9. 获取服务器指标

**端点**: `GET /api/servers/:id/metrics`  
**权限**: 已认证用户

**路径参数**:
- `id`: 服务器 UUID

**查询参数**:
- `startTime`: 开始时间 (ISO 8601, 可选)
- `endTime`: 结束时间 (ISO 8601, 可选)

**请求示例**:
```
GET /api/servers/uuid/metrics?startTime=2026-03-13T00:00:00Z&endTime=2026-03-13T23:59:59Z
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "cpuUsage": [
      { "timestamp": "2026-03-13T10:00:00Z", "value": 45.2 },
      { "timestamp": "2026-03-13T11:00:00Z", "value": 52.1 }
    ],
    "memoryUsage": [
      { "timestamp": "2026-03-13T10:00:00Z", "value": 68.5 },
      { "timestamp": "2026-03-13T11:00:00Z", "value": 72.3 }
    ],
    "gpuUsage": [
      { "timestamp": "2026-03-13T10:00:00Z", "value": 85.0 },
      { "timestamp": "2026-03-13T11:00:00Z", "value": 90.2 }
    ]
  }
}
```

---

### GPU 管理模块 (GPUs)

#### 1. 获取所有 GPU

**端点**: `GET /api/gpus`  
**权限**: 已认证用户

**查询参数**:
- `status`: 筛选状态 (可选)
  - `AVAILABLE` - 可用
  - `ALLOCATED` - 已分配
- `serverId`: 按服务器筛选 (可选)
- `minMemory`: 最小显存 (可选)

**请求示例**:
```
GET /api/gpus?status=AVAILABLE&minMemory=40
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "serverId": "uuid",
      "serverName": "GPU-Server-01",
      "model": "NVIDIA A100",
      "memory": 40,
      "status": "AVAILABLE",
      "allocatedTo": null,
      "allocatedAt": null
    }
  ]
}
```

---

#### 2. 分配 GPU

**端点**: `POST /api/gpu/allocate`  
**权限**: 已认证用户

**请求体** (所有字段可选):
```json
{
  "minMemory": 40,
  "model": "NVIDIA A100"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "gpuId": "uuid",
    "serverId": "uuid",
    "serverName": "GPU-Server-01",
    "gpuModel": "NVIDIA A100",
    "memory": 40,
    "allocatedTo": "uuid",
    "allocatedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

**错误响应 (400)**:
```json
{
  "success": false,
  "error": "No available GPUs matching criteria"
}
```

---

#### 3. 释放 GPU

**端点**: `POST /api/gpu/release/:id`  
**权限**: 已认证用户

**路径参数**:
- `id`: GPU 分配记录 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "gpuId": "uuid",
    "status": "AVAILABLE",
    "releasedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

**错误响应 (404)**:
```json
{
  "success": false,
  "error": "GPU allocation not found"
}
```

---

#### 4. 获取我的 GPU 分配

**端点**: `GET /api/gpu/my-allocations`  
**权限**: 已认证用户

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "gpuId": "uuid",
      "serverName": "GPU-Server-01",
      "gpuModel": "NVIDIA A100",
      "memory": 40,
      "allocatedAt": "2026-03-13T10:00:00.000Z"
    }
  ]
}
```

---

### 任务管理模块 (Tasks)

#### 1. 获取我的任务

**端点**: `GET /api/tasks`  
**权限**: 已认证用户

**查询参数**:
- `status`: 筛选状态 (可选)
  - `PENDING` - 待处理
  - `RUNNING` - 运行中
  - `COMPLETED` - 已完成
  - `FAILED` - 已失败
  - `CANCELLED` - 已取消
- `limit`: 返回数量限制 (可选，默认 50)

**请求示例**:
```
GET /api/tasks?status=PENDING&limit=20
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "模型训练",
      "description": "训练深度学习模型",
      "priority": 8,
      "status": "PENDING",
      "userId": "uuid",
      "createdAt": "2026-03-13T10:00:00.000Z",
      "scheduledAt": null,
      "startedAt": null,
      "completedAt": null
    }
  ]
}
```

---

#### 2. 获取任务统计

**端点**: `GET /api/tasks/stats`  
**权限**: 已认证用户

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "totalTasks": 50,
    "pendingTasks": 5,
    "runningTasks": 3,
    "completedTasks": 40,
    "failedTasks": 2,
    "cancelledTasks": 0
  }
}
```

---

#### 3. 获取所有任务 (管理员)

**端点**: `GET /api/tasks/all`  
**权限**: ADMIN

**查询参数**:
- `status`: 筛选状态 (可选)
- `limit`: 返回数量限制 (可选，默认 100)

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "模型训练",
      "status": "RUNNING",
      "userId": "uuid",
      "userName": "user1",
      "priority": 8,
      "createdAt": "2026-03-13T10:00:00.000Z"
    }
  ]
}
```

**错误响应 (403)**:
```json
{
  "success": false,
  "error": "Admin access required"
}
```

---

#### 4. 获取待处理任务

**端点**: `GET /api/tasks/pending`  
**权限**: 已认证用户

**说明**: 供调度器使用，返回所有待处理任务

**成功响应 (200)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "模型训练",
      "priority": 8,
      "scheduledAt": null,
      "createdAt": "2026-03-13T10:00:00.000Z"
    }
  ]
}
```

---

#### 5. 获取单个任务

**端点**: `GET /api/tasks/:id`  
**权限**: 已认证用户

**路径参数**:
- `id`: 任务 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模型训练",
    "description": "训练深度学习模型",
    "priority": 8,
    "status": "RUNNING",
    "userId": "uuid",
    "userName": "testuser",
    "createdAt": "2026-03-13T10:00:00.000Z",
    "startedAt": "2026-03-13T11:00:00.000Z",
    "completedAt": null,
    "result": null
  }
}
```

**错误响应 (404)**:
```json
{
  "success": false,
  "error": "Task not found"
}
```

---

#### 6. 创建任务

**端点**: `POST /api/tasks`  
**权限**: 已认证用户

**请求体**:
```json
{
  "name": "模型训练",
  "description": "训练深度学习模型",
  "priority": 8,
  "scheduledAt": "2026-03-14T10:00:00.000Z"
}
```

**验证规则**:
- `name`: 必填，1-100 字符
- `description`: 可选
- `priority`: 可选，0-10
- `scheduledAt`: 可选，ISO 8601 格式

**成功响应 (201)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模型训练",
    "description": "训练深度学习模型",
    "priority": 8,
    "status": "PENDING",
    "userId": "uuid",
    "createdAt": "2026-03-13T12:00:00.000Z",
    "scheduledAt": "2026-03-14T10:00:00.000Z"
  }
}
```

---

#### 7. 更新任务

**端点**: `PUT /api/tasks/:id`  
**权限**: 任务创建者

**路径参数**:
- `id`: 任务 UUID

**请求体** (所有字段可选):
```json
{
  "name": "模型训练 - 更新",
  "description": "更新后的描述",
  "priority": 9,
  "scheduledAt": "2026-03-15T10:00:00.000Z"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模型训练 - 更新",
    "description": "更新后的描述",
    "priority": 9,
    "status": "PENDING",
    "updatedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 8. 取消任务

**端点**: `POST /api/tasks/:id/cancel`  
**权限**: 任务创建者

**路径参数**:
- `id`: 任务 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模型训练",
    "status": "CANCELLED",
    "cancelledAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 9. 删除任务

**端点**: `DELETE /api/tasks/:id`  
**权限**: 任务创建者

**路径参数**:
- `id`: 任务 UUID

**成功响应 (200)**:
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

---

#### 10. 完成任务 (内部使用)

**端点**: `POST /api/tasks/:id/complete`  
**权限**: 调度器服务

**路径参数**:
- `id`: 任务 UUID

**请求体**:
```json
{
  "result": "任务执行成功"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模型训练",
    "status": "COMPLETED",
    "result": "任务执行成功",
    "completedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

#### 11. 失败任务 (内部使用)

**端点**: `POST /api/tasks/:id/fail`  
**权限**: 调度器服务

**路径参数**:
- `id`: 任务 UUID

**请求体**:
```json
{
  "error": "执行失败：资源不足"
}
```

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "模型训练",
    "status": "FAILED",
    "error": "执行失败：资源不足",
    "failedAt": "2026-03-13T12:00:00.000Z"
  }
}
```

---

### 监控模块 (Monitoring)

#### 1. 系统健康检查

**端点**: `GET /api/health`  
**权限**: 公开

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "redis": "connected",
    "uptime": 86400,
    "timestamp": "2026-03-13T12:00:00.000Z"
  }
}
```

**错误响应 (503)**:
```json
{
  "success": false,
  "error": "Service unhealthy",
  "data": {
    "database": "disconnected",
    "redis": "connected"
  }
}
```

---

#### 2. 获取系统指标

**端点**: `GET /api/metrics`  
**权限**: 已认证用户

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "cpu": {
      "usage": 45.2,
      "cores": 32
    },
    "memory": {
      "used": 8.5,
      "total": 16,
      "usage": 53.1
    },
    "disk": {
      "used": 120,
      "total": 500,
      "usage": 24.0
    },
    "network": {
      "rxBytes": 1024000,
      "txBytes": 512000
    }
  }
}
```

---

#### 3. 获取缓存统计

**端点**: `GET /api/cache/stats`  
**权限**: 已认证用户

**成功响应 (200)**:
```json
{
  "success": true,
  "data": {
    "hits": 15000,
    "misses": 2000,
    "hitRate": 88.24,
    "keys": 150,
    "memoryUsage": "256MB"
  }
}
```

---

### 数据导出模块 (Export)

#### 1. 导出服务器数据

**端点**: `GET /api/export/servers`  
**权限**: 已认证用户

**查询参数**:
- `format`: 导出格式 (可选，默认 csv)
  - `csv`
  - `excel`

**请求示例**:
```
GET /api/export/servers?format=excel
```

**成功响应**: 文件下载

---

#### 2. 导出任务数据

**端点**: `GET /api/export/tasks`  
**权限**: 已认证用户

**查询参数**:
- `format`: 导出格式 (可选，默认 csv)
  - `csv`
  - `excel`
- `status`: 筛选状态 (可选)

**请求示例**:
```
GET /api/export/tasks?format=csv&status=COMPLETED
```

**成功响应**: 文件下载

---

---

## 错误码和异常处理

### HTTP 状态码

| 状态码 | 说明 | 常见场景 |
|--------|------|---------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或 Token 过期 |
| 403 | Forbidden | 权限不足 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 (如用户名已存在) |
| 429 | Too Many Requests | 请求频率超限 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务不可用 |

### 错误响应格式

```json
{
  "success": false,
  "error": "错误描述信息",
  "code": "错误代码",
  "details": {
    "field": "具体字段错误信息"
  }
}
```

### 常见错误代码

| 错误代码 | 说明 | 解决方案 |
|---------|------|---------|
| `AUTH_001` | Token 缺失 | 添加 Authorization 头 |
| `AUTH_002` | Token 无效 | 检查 Token 格式 |
| `AUTH_003` | Token 过期 | 重新登录获取新 Token |
| `AUTH_004` | 权限不足 | 联系管理员提升权限 |
| `VAL_001` | 参数验证失败 | 检查请求参数格式 |
| `VAL_002` | 必填字段缺失 | 补充必填字段 |
| `RES_001` | 资源不存在 | 检查资源 ID |
| `RES_002` | 资源已存在 | 使用不同的标识符 |
| `SYS_001` | 数据库错误 | 联系技术支持 |
| `SYS_002` | 服务不可用 | 稍后重试 |

### 异常处理建议

#### 客户端处理

```javascript
async function apiRequest(url, options) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      // 处理错误
      switch (response.status) {
        case 401:
          // Token 过期，重新登录
          redirectToLogin();
          break;
        case 403:
          // 权限不足
          showPermissionDenied();
          break;
        case 404:
          // 资源不存在
          showNotFound();
          break;
        case 429:
          // 请求超限，等待后重试
          await sleep(1000);
          return apiRequest(url, options);
        default:
          // 其他错误
          showError(data.error);
      }
      throw new Error(data.error);
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}
```

---

## 请求/响应示例

### 完整流程示例

#### 1. 注册并登录

```bash
# 注册
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# 登录
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# 响应
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "username": "testuser",
      "email": "test@example.com",
      "role": "USER"
    }
  }
}
```

#### 2. 创建服务器 (管理员)

```bash
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:4000/api/servers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "GPU-Server-01",
    "hostname": "gpu01.lab.local",
    "ipAddress": "192.168.1.100",
    "cpuCores": 32,
    "totalMemory": 128,
    "gpuCount": 4
  }'
```

#### 3. 分配 GPU

```bash
curl -X POST http://localhost:4000/api/gpu/allocate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "minMemory": 40
  }'
```

#### 4. 创建任务

```bash
curl -X POST http://localhost:4000/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "模型训练",
    "description": "训练深度学习模型",
    "priority": 8
  }'
```

#### 5. 查看任务列表

```bash
curl -X GET "http://localhost:4000/api/tasks?status=PENDING" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 版本变更说明

### v3.0.0 (2026-03-13)

#### 新增功能
- ✅ 完整的用户管理 API
- ✅ GPU 分配和释放 API
- ✅ 任务调度系统 API
- ✅ 系统监控和健康检查 API
- ✅ 数据导出功能 (CSV/Excel)
- ✅ Redis 缓存层
- ✅ 邮件通知系统

#### 改进优化
- ✅ 统一响应格式
- ✅ 增强的错误处理
- ✅ 改进的认证中间件
- ✅ 优化的数据库查询
- ✅ 添加请求验证

#### API 变更
- 🔄 `/api/servers` 添加统计端点
- 🔄 `/api/tasks` 添加批量操作
- 🔄 所有端点添加权限控制

#### 安全增强
- ✅ JWT Token 过期处理
- ✅ 速率限制
- ✅ 输入验证
- ✅ SQL 注入防护
- ✅ XSS 防护

---

### v2.0.0 (2026-03-06)

#### 新增功能
- ✅ 双因素认证 (2FA)
- ✅ 审计日志
- ✅ 用户偏好设置

#### API 变更
- 🔄 认证流程重构
- 🔄 添加 2FA 相关端点

---

### v1.0.0 (2026-03-01)

#### 初始版本
- ✅ 基础认证系统
- ✅ 服务器管理
- ✅ GPU 管理
- ✅ 任务管理

---

## 附录

### A. 速率限制

| 端点类型 | 限制 | 时间窗口 |
|---------|------|---------|
| 认证端点 | 10 次/分钟 | 1 分钟 |
| 普通端点 | 100 次/分钟 | 1 分钟 |
| 导出端点 | 5 次/分钟 | 1 分钟 |

### B. 分页参数

| 参数 | 说明 | 默认值 | 最大值 |
|------|------|--------|--------|
| `page` | 页码 | 1 | - |
| `limit` | 每页数量 | 20 | 100 |

### C. 时间格式

所有时间字段使用 ISO 8601 格式：
```
YYYY-MM-DDTHH:mm:ss.sssZ
```

示例：`2026-03-13T10:00:00.000Z`

### D. Swagger/OpenAPI

访问交互式 API 文档：
```
http://localhost:4000/api-docs
```

---

**文档版本**: 3.0.0  
**创建日期**: 2026-03-13  
**维护者**: LSM 后端开发团队  
**API 版本**: v3.0.0  
**最后更新**: 2026-03-13
