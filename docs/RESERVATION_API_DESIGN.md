# LSM 服务器预约功能 API 设计文档

**版本**: 1.0.0  
**创建日期**: 2026-03-15  
**状态**: 设计中  
**基础 URL**: `http://localhost:4000/api`

---

## 📚 目录

1. [概述](#概述)
2. [认证授权](#认证授权)
3. [数据模型](#数据模型)
4. [API 接口定义](#api-接口定义)
   - [预约管理](#1-预约管理)
   - [资源查询](#2-资源查询)
   - [审批管理](#3-审批管理)
   - [统计分析](#4-统计分析)
5. [TypeScript 类型定义](#typescript-类型定义)
6. [错误码定义](#错误码定义)
7. [业务规则](#业务规则)
8. [附录](#附录)

---

## 概述

### 功能说明

服务器预约功能允许用户提前预约实验室服务器资源，支持：
- 按时间段预约服务器
- 资源可用性查询
- 预约冲突检测
- 审批流程（可选）
- 使用统计分析

### 设计原则

- **RESTful 风格**: 遵循 REST 架构设计
- **统一响应格式**: 与现有 API 保持一致
- **幂等性**: 关键操作支持幂等
- **版本控制**: 通过 URL 路径控制版本

### 响应格式

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
  "error": "错误描述",
  "code": "ERROR_CODE"
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

---

## 认证授权

### 认证方式

所有接口均需 JWT Token 认证：

```
Authorization: Bearer <token>
```

### 权限矩阵

| 接口 | USER | MANAGER | ADMIN |
|------|:----:|:-------:|:-----:|
| `POST /api/reservations` | ✅ | ✅ | ✅ |
| `GET /api/reservations` | ✅ (自己) | ✅ (本组) | ✅ (全部) |
| `GET /api/reservations/:id` | ✅ (自己) | ✅ (本组) | ✅ (全部) |
| `PUT /api/reservations/:id` | ✅ (自己) | ✅ (本组) | ✅ (全部) |
| `DELETE /api/reservations/:id` | ✅ (自己) | ✅ (本组) | ✅ (全部) |
| `GET /api/reservations/availability` | ✅ | ✅ | ✅ |
| `GET /api/reservations/calendar` | ✅ | ✅ | ✅ |
| `GET /api/reservations/servers/:id/slots` | ✅ | ✅ | ✅ |
| `POST /api/reservations/:id/approve` | ❌ | ✅ | ✅ |
| `POST /api/reservations/:id/reject` | ❌ | ✅ | ✅ |
| `GET /api/reservations/statistics` | ❌ | ✅ | ✅ |

---

## 数据模型

### 预约状态

| 状态 | 说明 |
|------|------|
| `PENDING` | 待审批（需要审批流程时） |
| `APPROVED` | 已批准 |
| `REJECTED` | 已拒绝 |
| `ACTIVE` | 进行中 |
| `COMPLETED` | 已完成 |
| `CANCELLED` | 已取消 |
| `EXPIRED` | 已过期 |

### 预约优先级

| 优先级 | 数值 | 说明 |
|--------|------|------|
| 低 | 1 | 普通预约 |
| 中 | 5 | 重要预约 |
| 高 | 10 | 紧急预约 |

---

## API 接口定义

### 1. 预约管理

#### 1.1 创建预约

**端点**: `POST /api/reservations`  
**权限**: 已认证用户

**请求体**:

```json
{
  "serverId": "uuid",
  "title": "模型训练任务",
  "description": "ResNet50 模型训练，预计需要 24 小时",
  "startTime": "2026-03-16T09:00:00.000Z",
  "endTime": "2026-03-17T09:00:00.000Z",
  "priority": 5,
  "gpuCount": 2,
  "minMemory": 40,
  "notes": "需要 A100 GPU"
}
```

**请求参数说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `serverId` | string | 否 | 指定服务器 ID，不指定则自动分配 |
| `title` | string | 是 | 预约标题，1-100 字符 |
| `description` | string | 否 | 详细描述，最多 500 字符 |
| `startTime` | string | 是 | 开始时间 (ISO 8601) |
| `endTime` | string | 是 | 结束时间 (ISO 8601) |
| `priority` | number | 否 | 优先级 1-10，默认 1 |
| `gpuCount` | number | 否 | 需要的 GPU 数量，默认 1 |
| `minMemory` | number | 否 | GPU 最小显存 (GB)，默认 0 |
| `notes` | string | 否 | 备注信息 |

**成功响应 (201)**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "serverId": "660e8400-e29b-41d4-a716-446655440001",
    "serverName": "GPU-Server-01",
    "userId": "770e8400-e29b-41d4-a716-446655440002",
    "userName": "testuser",
    "title": "模型训练任务",
    "description": "ResNet50 模型训练，预计需要 24 小时",
    "startTime": "2026-03-16T09:00:00.000Z",
    "endTime": "2026-03-17T09:00:00.000Z",
    "priority": 5,
    "gpuCount": 2,
    "allocatedGpus": [
      {
        "id": "gpu-001",
        "model": "NVIDIA A100",
        "memory": 40
      },
      {
        "id": "gpu-002",
        "model": "NVIDIA A100",
        "memory": 40
      }
    ],
    "status": "APPROVED",
    "requiresApproval": false,
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z"
  }
}
```

**错误响应**:

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | `VAL_001` | 参数验证失败 |
| 400 | `RES_003` | 时间冲突，资源已被预约 |
| 400 | `RES_004` | 时间范围无效（开始时间 >= 结束时间） |
| 400 | `RES_005` | 预约时间超出允许范围 |
| 404 | `RES_001` | 指定的服务器不存在 |
| 409 | `RES_006` | 资源不足，无法满足需求 |

---

#### 1.2 查询预约列表

**端点**: `GET /api/reservations`  
**权限**: 已认证用户

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `status` | string | 否 | 筛选状态：PENDING, APPROVED, ACTIVE, COMPLETED, CANCELLED |
| `serverId` | string | 否 | 按服务器筛选 |
| `startTime` | string | 否 | 开始时间范围起点 (ISO 8601) |
| `endTime` | string | 否 | 开始时间范围终点 (ISO 8601) |
| `page` | number | 否 | 页码，默认 1 |
| `limit` | number | 否 | 每页数量，默认 20，最大 100 |
| `sort` | string | 否 | 排序字段：startTime, createdAt, priority，默认 startTime |
| `order` | string | 否 | 排序方向：asc, desc，默认 asc |

**请求示例**:

```
GET /api/reservations?status=APPROVED&startTime=2026-03-15T00:00:00Z&endTime=2026-03-20T00:00:00Z&page=1&limit=20
```

**成功响应 (200)**:

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "serverId": "660e8400-e29b-41d4-a716-446655440001",
      "serverName": "GPU-Server-01",
      "userId": "770e8400-e29b-41d4-a716-446655440002",
      "userName": "testuser",
      "title": "模型训练任务",
      "startTime": "2026-03-16T09:00:00.000Z",
      "endTime": "2026-03-17T09:00:00.000Z",
      "priority": 5,
      "gpuCount": 2,
      "status": "APPROVED",
      "createdAt": "2026-03-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

---

#### 1.3 查询预约详情

**端点**: `GET /api/reservations/:id`  
**权限**: 已认证用户（仅可查看自己的预约，管理员可查看全部）

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 预约 UUID |

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "serverId": "660e8400-e29b-41d4-a716-446655440001",
    "server": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "GPU-Server-01",
      "hostname": "gpu01.lab.local",
      "ipAddress": "192.168.1.100",
      "status": "ONLINE"
    },
    "userId": "770e8400-e29b-41d4-a716-446655440002",
    "user": {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "username": "testuser",
      "email": "test@example.com"
    },
    "title": "模型训练任务",
    "description": "ResNet50 模型训练，预计需要 24 小时",
    "startTime": "2026-03-16T09:00:00.000Z",
    "endTime": "2026-03-17T09:00:00.000Z",
    "priority": 5,
    "gpuCount": 2,
    "allocatedGpus": [
      {
        "id": "gpu-001",
        "model": "NVIDIA A100",
        "memory": 40,
        "status": "ALLOCATED"
      },
      {
        "id": "gpu-002",
        "model": "NVIDIA A100",
        "memory": 40,
        "status": "ALLOCATED"
      }
    ],
    "status": "APPROVED",
    "requiresApproval": false,
    "approvalInfo": null,
    "notes": "需要 A100 GPU",
    "createdAt": "2026-03-15T10:00:00.000Z",
    "updatedAt": "2026-03-15T10:00:00.000Z"
  }
}
```

**错误响应 (404)**:

```json
{
  "success": false,
  "error": "预约不存在",
  "code": "RES_001"
}
```

---

#### 1.4 更新预约

**端点**: `PUT /api/reservations/:id`  
**权限**: 已认证用户（仅可更新自己的预约）

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 预约 UUID |

**请求体**（所有字段可选）:

```json
{
  "title": "模型训练任务 - 更新",
  "description": "更新后的描述",
  "startTime": "2026-03-16T10:00:00.000Z",
  "endTime": "2026-03-17T10:00:00.000Z",
  "priority": 8,
  "gpuCount": 4,
  "notes": "更新备注"
}
```

**业务规则**:
- 仅可更新状态为 `PENDING` 或 `APPROVED` 的预约
- 更新时间范围时需重新检查冲突
- 已开始 (`ACTIVE`) 的预约不可修改

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "模型训练任务 - 更新",
    "description": "更新后的描述",
    "startTime": "2026-03-16T10:00:00.000Z",
    "endTime": "2026-03-17T10:00:00.000Z",
    "priority": 8,
    "gpuCount": 4,
    "status": "APPROVED",
    "updatedAt": "2026-03-15T12:00:00.000Z"
  }
}
```

**错误响应**:

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | `RES_007` | 预约已开始，无法修改 |
| 400 | `RES_003` | 时间冲突 |
| 403 | `AUTH_004` | 无权限修改此预约 |
| 404 | `RES_001` | 预约不存在 |
| 409 | `RES_006` | 资源不足 |

---

#### 1.5 取消预约

**端点**: `DELETE /api/reservations/:id`  
**权限**: 已认证用户（仅可取消自己的预约）

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 预约 UUID |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `reason` | string | 否 | 取消原因 |

**业务规则**:
- 状态为 `COMPLETED` 或 `CANCELLED` 的预约不可取消
- 已开始 (`ACTIVE`) 的预约取消需管理员权限

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CANCELLED",
    "cancelledAt": "2026-03-15T14:00:00.000Z",
    "cancelledBy": "770e8400-e29b-41d4-a716-446655440002",
    "cancelReason": "任务已提前完成"
  }
}
```

**错误响应**:

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | `RES_008` | 预约已完成，无法取消 |
| 400 | `RES_009` | 预约已取消 |
| 403 | `AUTH_004` | 无权限取消此预约 |
| 403 | `AUTH_005` | 正在进行的预约需要管理员权限取消 |
| 404 | `RES_001` | 预约不存在 |

---

### 2. 资源查询

#### 2.1 查询可用资源

**端点**: `GET /api/reservations/availability`  
**权限**: 已认证用户

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `startTime` | string | 是 | 开始时间 (ISO 8601) |
| `endTime` | string | 是 | 结束时间 (ISO 8601) |
| `gpuCount` | number | 否 | 需要的 GPU 数量，默认 1 |
| `minMemory` | number | 否 | GPU 最小显存 (GB)，默认 0 |
| `gpuModel` | string | 否 | GPU 型号筛选 |

**请求示例**:

```
GET /api/reservations/availability?startTime=2026-03-16T09:00:00Z&endTime=2026-03-17T09:00:00Z&gpuCount=2&minMemory=40
```

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "available": true,
    "servers": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "name": "GPU-Server-01",
        "hostname": "gpu01.lab.local",
        "status": "ONLINE",
        "availableGpus": [
          {
            "id": "gpu-001",
            "model": "NVIDIA A100",
            "memory": 40,
            "status": "AVAILABLE"
          },
          {
            "id": "gpu-002",
            "model": "NVIDIA A100",
            "memory": 40,
            "status": "AVAILABLE"
          },
          {
            "id": "gpu-003",
            "model": "NVIDIA A100",
            "memory": 40,
            "status": "AVAILABLE"
          }
        ],
        "availableGpuCount": 3
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440002",
        "name": "GPU-Server-02",
        "hostname": "gpu02.lab.local",
        "status": "ONLINE",
        "availableGpus": [
          {
            "id": "gpu-004",
            "model": "NVIDIA V100",
            "memory": 32,
            "status": "AVAILABLE"
          }
        ],
        "availableGpuCount": 1
      }
    ],
    "totalAvailableGpus": 4,
    "sufficient": true
  }
}
```

---

#### 2.2 获取日历数据

**端点**: `GET /api/reservations/calendar`  
**权限**: 已认证用户

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `serverId` | string | 否 | 指定服务器，不指定则返回全部 |
| `start` | string | 是 | 日历起始日期 (YYYY-MM-DD) |
| `end` | string | 是 | 日历结束日期 (YYYY-MM-DD) |
| `view` | string | 否 | 视图模式：month, week, day，默认 month |

**请求示例**:

```
GET /api/reservations/calendar?serverId=660e8400-e29b-41d4-a716-446655440001&start=2026-03-01&end=2026-03-31
```

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "serverId": "660e8400-e29b-41d4-a716-446655440001",
    "serverName": "GPU-Server-01",
    "range": {
      "start": "2026-03-01",
      "end": "2026-03-31"
    },
    "reservations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "模型训练任务",
        "startTime": "2026-03-16T09:00:00.000Z",
        "endTime": "2026-03-17T09:00:00.000Z",
        "status": "APPROVED",
        "gpuCount": 2,
        "userId": "770e8400-e29b-41d4-a716-446655440002",
        "userName": "testuser",
        "color": "#4CAF50"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "title": "模型推理服务",
        "startTime": "2026-03-20T14:00:00.000Z",
        "endTime": "2026-03-20T18:00:00.000Z",
        "status": "APPROVED",
        "gpuCount": 1,
        "userId": "770e8400-e29b-41d4-a716-446655440004",
        "userName": "user2",
        "color": "#2196F3"
      }
    ],
    "utilization": {
      "totalHours": 744,
      "reservedHours": 28,
      "utilizationRate": 3.76
    }
  }
}
```

---

#### 2.3 获取服务器时间槽

**端点**: `GET /api/reservations/servers/:id/slots`  
**权限**: 已认证用户

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 服务器 UUID |

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `date` | string | 是 | 查询日期 (YYYY-MM-DD) |
| `slotDuration` | number | 否 | 时间槽粒度（分钟），默认 60，可选 30, 60, 120 |

**请求示例**:

```
GET /api/reservations/servers/660e8400-e29b-41d4-a716-446655440001/slots?date=2026-03-16&slotDuration=60
```

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "serverId": "660e8400-e29b-41d4-a716-446655440001",
    "serverName": "GPU-Server-01",
    "date": "2026-03-16",
    "slotDuration": 60,
    "totalGpus": 4,
    "slots": [
      {
        "startTime": "2026-03-16T00:00:00.000Z",
        "endTime": "2026-03-16T01:00:00.000Z",
        "availableGpus": 4,
        "status": "AVAILABLE"
      },
      {
        "startTime": "2026-03-16T01:00:00.000Z",
        "endTime": "2026-03-16T02:00:00.000Z",
        "availableGpus": 4,
        "status": "AVAILABLE"
      },
      // ... 其他时间槽 ...
      {
        "startTime": "2026-03-16T09:00:00.000Z",
        "endTime": "2026-03-16T10:00:00.000Z",
        "availableGpus": 2,
        "status": "PARTIAL",
        "reservations": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "title": "模型训练任务",
            "gpuCount": 2,
            "userName": "testuser"
          }
        ]
      },
      // ... 更多时间槽 ...
      {
        "startTime": "2026-03-16T23:00:00.000Z",
        "endTime": "2026-03-17T00:00:00.000Z",
        "availableGpus": 4,
        "status": "AVAILABLE"
      }
    ],
    "workingHours": {
      "start": "00:00",
      "end": "23:59"
    }
  }
}
```

---

### 3. 审批管理

#### 3.1 批准预约

**端点**: `POST /api/reservations/:id/approve`  
**权限**: MANAGER, ADMIN

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 预约 UUID |

**请求体**:

```json
{
  "notes": "审批通过，已确认资源充足"
}
```

**业务规则**:
- 仅可批准状态为 `PENDING` 的预约
- 批准后状态变为 `APPROVED`

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "APPROVED",
    "approvalInfo": {
      "approvedBy": "880e8400-e29b-41d4-a716-446655440003",
      "approverName": "admin",
      "approvedAt": "2026-03-15T14:00:00.000Z",
      "notes": "审批通过，已确认资源充足"
    },
    "updatedAt": "2026-03-15T14:00:00.000Z"
  }
}
```

**错误响应**:

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | `RES_010` | 预约状态不允许审批 |
| 403 | `AUTH_004` | 无审批权限 |
| 404 | `RES_001` | 预约不存在 |

---

#### 3.2 拒绝预约

**端点**: `POST /api/reservations/:id/reject`  
**权限**: MANAGER, ADMIN

**路径参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | string | 预约 UUID |

**请求体**:

```json
{
  "reason": "资源已被更高优先级任务占用"
}
```

**业务规则**:
- 仅可拒绝状态为 `PENDING` 的预约
- 拒绝后状态变为 `REJECTED`

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "REJECTED",
    "rejectionInfo": {
      "rejectedBy": "880e8400-e29b-41d4-a716-446655440003",
      "rejecterName": "admin",
      "rejectedAt": "2026-03-15T14:00:00.000Z",
      "reason": "资源已被更高优先级任务占用"
    },
    "updatedAt": "2026-03-15T14:00:00.000Z"
  }
}
```

**错误响应**:

| 状态码 | code | 说明 |
|--------|------|------|
| 400 | `RES_010` | 预约状态不允许审批 |
| 400 | `VAL_002` | 拒绝原因为必填项 |
| 403 | `AUTH_004` | 无审批权限 |
| 404 | `RES_001` | 预约不存在 |

---

### 4. 统计分析

#### 4.1 使用统计

**端点**: `GET /api/reservations/statistics`  
**权限**: MANAGER, ADMIN

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `period` | string | 否 | 统计周期：day, week, month, year，默认 month |
| `start` | string | 否 | 自定义起始日期 (YYYY-MM-DD) |
| `end` | string | 否 | 自定义结束日期 (YYYY-MM-DD) |
| `serverId` | string | 否 | 按服务器筛选 |

**请求示例**:

```
GET /api/reservations/statistics?period=month&start=2026-03-01&end=2026-03-31
```

**成功响应 (200)**:

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-03-01",
      "end": "2026-03-31"
    },
    "summary": {
      "totalReservations": 156,
      "approvedReservations": 142,
      "rejectedReservations": 8,
      "cancelledReservations": 6,
      "totalHours": 1872,
      "avgDuration": 12,
      "peakUtilization": 85.5,
      "avgUtilization": 62.3
    },
    "byStatus": {
      "PENDING": 5,
      "APPROVED": 20,
      "ACTIVE": 3,
      "COMPLETED": 122,
      "CANCELLED": 4,
      "REJECTED": 2
    },
    "byServer": [
      {
        "serverId": "660e8400-e29b-41d4-a716-446655440001",
        "serverName": "GPU-Server-01",
        "totalReservations": 45,
        "totalHours": 540,
        "utilizationRate": 75.2
      },
      {
        "serverId": "660e8400-e29b-41d4-a716-446655440002",
        "serverName": "GPU-Server-02",
        "totalReservations": 38,
        "totalHours": 456,
        "utilizationRate": 63.5
      }
    ],
    "byUser": [
      {
        "userId": "770e8400-e29b-41d4-a716-446655440002",
        "userName": "testuser",
        "totalReservations": 25,
        "totalHours": 300
      }
    ],
    "byGpuModel": [
      {
        "model": "NVIDIA A100",
        "totalReservations": 98,
        "totalHours": 1176
      },
      {
        "model": "NVIDIA V100",
        "totalReservations": 58,
        "totalHours": 696
      }
    ],
    "trend": [
      {
        "date": "2026-03-01",
        "reservations": 5,
        "hours": 60
      },
      {
        "date": "2026-03-02",
        "reservations": 8,
        "hours": 96
      }
      // ... 更多数据点 ...
    ]
  }
}
```

---

## TypeScript 类型定义

```typescript
// ==================== 枚举类型 ====================

/**
 * 预约状态
 */
export enum ReservationStatus {
  PENDING = 'PENDING',       // 待审批
  APPROVED = 'APPROVED',     // 已批准
  REJECTED = 'REJECTED',     // 已拒绝
  ACTIVE = 'ACTIVE',         // 进行中
  COMPLETED = 'COMPLETED',   // 已完成
  CANCELLED = 'CANCELLED',   // 已取消
  EXPIRED = 'EXPIRED'        // 已过期
}

/**
 * 时间槽状态
 */
export enum SlotStatus {
  AVAILABLE = 'AVAILABLE',   // 完全可用
  PARTIAL = 'PARTIAL',       // 部分可用
  FULL = 'FULL'             // 已满
}

/**
 * 统计周期
 */
export enum StatisticsPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year'
}

// ==================== 基础类型 ====================

/**
 * 预约创建请求
 */
export interface CreateReservationRequest {
  serverId?: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  priority?: number;
  gpuCount?: number;
  minMemory?: number;
  notes?: string;
}

/**
 * 预约更新请求
 */
export interface UpdateReservationRequest {
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  priority?: number;
  gpuCount?: number;
  notes?: string;
}

/**
 * 预约查询参数
 */
export interface ReservationQueryParams {
  status?: ReservationStatus;
  serverId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  limit?: number;
  sort?: 'startTime' | 'createdAt' | 'priority';
  order?: 'asc' | 'desc';
}

/**
 * 预约实体
 */
export interface Reservation {
  id: string;
  serverId: string;
  serverName: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  priority: number;
  gpuCount: number;
  allocatedGpus?: AllocatedGpu[];
  status: ReservationStatus;
  requiresApproval: boolean;
  approvalInfo?: ApprovalInfo;
  rejectionInfo?: RejectionInfo;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelReason?: string;
}

/**
 * 预约详情（包含关联信息）
 */
export interface ReservationDetail extends Reservation {
  server: ServerInfo;
  user: UserInfo;
}

/**
 * 已分配 GPU
 */
export interface AllocatedGpu {
  id: string;
  model: string;
  memory: number;
  status?: string;
}

/**
 * 服务器简要信息
 */
export interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  status: string;
}

/**
 * 用户简要信息
 */
export interface UserInfo {
  id: string;
  username: string;
  email: string;
}

/**
 * 审批信息
 */
export interface ApprovalInfo {
  approvedBy: string;
  approverName: string;
  approvedAt: string;
  notes?: string;
}

/**
 * 拒绝信息
 */
export interface RejectionInfo {
  rejectedBy: string;
  rejecterName: string;
  rejectedAt: string;
  reason: string;
}

// ==================== 资源查询类型 ====================

/**
 * 可用性查询参数
 */
export interface AvailabilityQueryParams {
  startTime: string;
  endTime: string;
  gpuCount?: number;
  minMemory?: number;
  gpuModel?: string;
}

/**
 * 可用性查询结果
 */
export interface AvailabilityResult {
  available: boolean;
  servers: AvailableServer[];
  totalAvailableGpus: number;
  sufficient: boolean;
}

/**
 * 可用服务器
 */
export interface AvailableServer {
  id: string;
  name: string;
  hostname: string;
  status: string;
  availableGpus: AvailableGpu[];
  availableGpuCount: number;
}

/**
 * 可用 GPU
 */
export interface AvailableGpu {
  id: string;
  model: string;
  memory: number;
  status: string;
}

/**
 * 日历查询参数
 */
export interface CalendarQueryParams {
  serverId?: string;
  start: string;
  end: string;
  view?: 'month' | 'week' | 'day';
}

/**
 * 日历数据
 */
export interface CalendarData {
  serverId?: string;
  serverName?: string;
  range: {
    start: string;
    end: string;
  };
  reservations: CalendarReservation[];
  utilization: {
    totalHours: number;
    reservedHours: number;
    utilizationRate: number;
  };
}

/**
 * 日历预约项
 */
export interface CalendarReservation {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  gpuCount: number;
  userId: string;
  userName: string;
  color: string;
}

/**
 * 时间槽查询参数
 */
export interface SlotQueryParams {
  date: string;
  slotDuration?: 30 | 60 | 120;
}

/**
 * 时间槽数据
 */
export interface SlotData {
  serverId: string;
  serverName: string;
  date: string;
  slotDuration: number;
  totalGpus: number;
  slots: TimeSlot[];
  workingHours: {
    start: string;
    end: string;
  };
}

/**
 * 时间槽
 */
export interface TimeSlot {
  startTime: string;
  endTime: string;
  availableGpus: number;
  status: SlotStatus;
  reservations?: SlotReservation[];
}

/**
 * 时间槽中的预约
 */
export interface SlotReservation {
  id: string;
  title: string;
  gpuCount: number;
  userName: string;
}

// ==================== 统计类型 ====================

/**
 * 统计查询参数
 */
export interface StatisticsQueryParams {
  period?: StatisticsPeriod;
  start?: string;
  end?: string;
  serverId?: string;
}

/**
 * 统计数据
 */
export interface StatisticsData {
  period: {
    start: string;
    end: string;
  };
  summary: StatisticsSummary;
  byStatus: Record<ReservationStatus, number>;
  byServer: ServerStatistics[];
  byUser: UserStatistics[];
  byGpuModel: GpuModelStatistics[];
  trend: TrendData[];
}

/**
 * 统计摘要
 */
export interface StatisticsSummary {
  totalReservations: number;
  approvedReservations: number;
  rejectedReservations: number;
  cancelledReservations: number;
  totalHours: number;
  avgDuration: number;
  peakUtilization: number;
  avgUtilization: number;
}

/**
 * 服务器统计
 */
export interface ServerStatistics {
  serverId: string;
  serverName: string;
  totalReservations: number;
  totalHours: number;
  utilizationRate: number;
}

/**
 * 用户统计
 */
export interface UserStatistics {
  userId: string;
  userName: string;
  totalReservations: number;
  totalHours: number;
}

/**
 * GPU 型号统计
 */
export interface GpuModelStatistics {
  model: string;
  totalReservations: number;
  totalHours: number;
}

/**
 * 趋势数据
 */
export interface TrendData {
  date: string;
  reservations: number;
  hours: number;
}

// ==================== 审批类型 ====================

/**
 * 审批请求
 */
export interface ApprovalRequest {
  notes?: string;
}

/**
 * 拒绝请求
 */
export interface RejectionRequest {
  reason: string;
}

// ==================== API 响应类型 ====================

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * API 响应
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}
```

---

## 错误码定义

### 错误码表

| 错误码 | HTTP 状态码 | 说明 | 解决方案 |
|--------|:-----------:|------|----------|
| `AUTH_001` | 401 | Token 缺失 | 添加 Authorization 头 |
| `AUTH_002` | 401 | Token 无效 | 检查 Token 格式 |
| `AUTH_003` | 401 | Token 过期 | 重新登录获取新 Token |
| `AUTH_004` | 403 | 权限不足 | 联系管理员提升权限 |
| `AUTH_005` | 403 | 需要更高权限 | 使用管理员账户操作 |
| `VAL_001` | 400 | 参数验证失败 | 检查请求参数格式 |
| `VAL_002` | 400 | 必填字段缺失 | 补充必填字段 |
| `VAL_003` | 400 | 字段格式错误 | 检查字段格式（如日期） |
| `VAL_004` | 400 | 字段值超出范围 | 检查字段值范围 |
| `RES_001` | 404 | 资源不存在 | 检查资源 ID |
| `RES_002` | 409 | 资源已存在 | 使用不同的标识符 |
| `RES_003` | 400 | 时间冲突 | 选择其他时间段 |
| `RES_004` | 400 | 时间范围无效 | 检查开始和结束时间 |
| `RES_005` | 400 | 预约时间超出允许范围 | 调整预约时间 |
| `RES_006` | 409 | 资源不足 | 减少资源需求或选择其他时间 |
| `RES_007` | 400 | 预约已开始，无法修改 | 联系管理员 |
| `RES_008` | 400 | 预约已完成，无法取消 | 创建新的预约 |
| `RES_009` | 400 | 预约已取消 | - |
| `RES_010` | 400 | 预约状态不允许操作 | 检查预约当前状态 |
| `SYS_001` | 500 | 数据库错误 | 联系技术支持 |
| `SYS_002` | 503 | 服务不可用 | 稍后重试 |

### 错误响应示例

```json
{
  "success": false,
  "error": "时间冲突，资源已被预约",
  "code": "RES_003",
  "details": {
    "conflictReservations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "模型训练任务",
        "startTime": "2026-03-16T08:00:00.000Z",
        "endTime": "2026-03-17T08:00:00.000Z"
      }
    ]
  }
}
```

---

## 业务规则

### 预约时间规则

1. **最小预约时长**: 30 分钟
2. **最大预约时长**: 7 天
3. **提前预约时间**: 最少提前 1 小时，最多提前 30 天
4. **预约时间粒度**: 15 分钟对齐

### 冲突检测规则

1. 同一服务器的时间段不能重叠（当 GPU 数量需求超过可用数量时）
2. 同一用户同一时间段只能有一个进行中的预约
3. 维护中的服务器不接受新预约

### 状态流转规则

```
                    ┌──────────────┐
                    │   PENDING   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
       ┌───────────┐ ┌───────────┐ ┌───────────┐
       │ APPROVED  │ │ REJECTED  │ │ CANCELLED │
       └─────┬─────┘ └───────────┘ └───────────┘
             │
             │ (到达开始时间)
             ▼
       ┌───────────┐
       │   ACTIVE  │
       └─────┬─────┘
             │
    ┌────────┼────────┐
    │        │        │
    ▼        ▼        ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ COMPLETED │ │ CANCELLED │ │  EXPIRED  │
└───────────┘ └───────────┘ └───────────┘
```

### 审批规则

1. **需要审批的场景**:
   - 预约时长超过 48 小时
   - GPU 数量需求超过 4 个
   - 优先级为高（10）
   - 指定服务器处于维护状态

2. **自动审批**:
   - 普通用户预约时长 ≤ 24 小时
   - GPU 需求 ≤ 2 个
   - 优先级 ≤ 5

---

## 附录

### A. 请求示例

#### 创建预约
```bash
curl -X POST http://localhost:4000/api/reservations \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "660e8400-e29b-41d4-a716-446655440001",
    "title": "模型训练任务",
    "description": "ResNet50 模型训练",
    "startTime": "2026-03-16T09:00:00.000Z",
    "endTime": "2026-03-17T09:00:00.000Z",
    "priority": 5,
    "gpuCount": 2,
    "minMemory": 40
  }'
```

#### 查询可用资源
```bash
curl -X GET "http://localhost:4000/api/reservations/availability?startTime=2026-03-16T09:00:00Z&endTime=2026-03-17T09:00:00Z&gpuCount=2&minMemory=40" \
  -H "Authorization: Bearer <token>"
```

#### 获取日历数据
```bash
curl -X GET "http://localhost:4000/api/reservations/calendar?start=2026-03-01&end=2026-03-31" \
  -H "Authorization: Bearer <token>"
```

#### 批准预约
```bash
curl -X POST http://localhost:4000/api/reservations/550e8400-e29b-41d4-a716-446655440000/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "审批通过"
  }'
```

### B. 数据库索引建议

```sql
-- 预约表索引
CREATE INDEX idx_reservations_server_id ON reservations(server_id);
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_time_range ON reservations(start_time, end_time);
CREATE INDEX idx_reservations_server_time ON reservations(server_id, start_time, end_time);

-- 复合索引优化查询
CREATE INDEX idx_reservations_query ON reservations(status, server_id, start_time);
```

### C. 缓存策略

| 数据类型 | 缓存时间 | 缓存键模式 |
|----------|----------|------------|
| 可用性查询 | 5 分钟 | `availability:{startTime}:{endTime}:{gpuCount}` |
| 日历数据 | 10 分钟 | `calendar:{serverId}:{start}:{end}` |
| 时间槽数据 | 2 分钟 | `slots:{serverId}:{date}` |
| 统计数据 | 30 分钟 | `stats:{period}:{start}:{end}` |

### D. Webhook 事件

预约状态变更时触发 Webhook 通知：

```json
{
  "event": "reservation.status_changed",
  "timestamp": "2026-03-15T10:00:00.000Z",
  "data": {
    "reservationId": "550e8400-e29b-41d4-a716-446655440000",
    "oldStatus": "PENDING",
    "newStatus": "APPROVED",
    "userId": "770e8400-e29b-41d4-a716-446655440002",
    "serverId": "660e8400-e29b-41d4-a716-446655440001"
  }
}
```

---

**文档版本**: 1.0.0  
**创建日期**: 2026-03-15  
**作者**: LSM 后端开发团队  
**状态**: 设计中