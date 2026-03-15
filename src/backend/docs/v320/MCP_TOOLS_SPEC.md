# LSM v3.2.0 MCP Tools 规范

> OpenClaw Agent 通过 MCP 调用 LSM API，实现自动化运维

## 1. Tools 清单

| Tool | 描述 | 权限 |
|------|------|------|
| `lsm_list_servers` | 查询服务器列表 | READ |
| `lsm_allocate_gpu` | 分配 GPU 资源 | WRITE |
| `lsm_release_gpu` | 释放 GPU 资源 | WRITE |
| `lsm_create_task` | 创建运维任务 | WRITE |
| `lsm_cancel_task` | 取消任务 | WRITE |
| `lsm_check_status` | 检查系统/任务状态 | READ |
| `lsm_scale_cluster` | 集群扩缩容 | ADMIN |
| `lsm_heal_fault` | 故障自愈 | ADMIN |
| `lsm_list_reservations` | 查询预留列表 | READ |
| `lsm_create_reservation` | 创建资源预留 | WRITE |
| `lsm_get_metrics` | 获取监控指标 | READ |
| `lsm_update_config` | 更新配置项 | ADMIN |

## 2. 权限分级

| 级别 | 说明 | 适用场景 |
|------|------|----------|
| READ | 只读操作 | 查询服务器、状态、指标 |
| WRITE | 写入操作 | 资源分配、任务管理、预留创建 |
| ADMIN | 管理操作 | 集群扩缩容、故障恢复、配置更新 |

## 3. Tool 详细规范

### 3.1 lsm_list_servers
查询集群服务器列表。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | 状态过滤: online/offline/maintenance/all |
| region | string | 否 | 区域过滤 |
| limit | int | 否 | 返回数量，默认 50，最大 200 |

**输出:** `{ servers: [{ id, name, status, gpu_count, region }], total }`

### 3.2 lsm_allocate_gpu
分配 GPU 资源。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| count | int | 是 | GPU 数量，1-64 |
| purpose | string | 是 | 用途说明 |
| duration_hours | int | 否 | 租用时长，默认 24h |
| gpu_type | string | 否 | A100/H100/A10/T4，默认 A100 |
| reservation_id | string | 否 | 关联预留 ID |

**输出:** `{ allocation_id, gpu_ids, server_id, expires_at }`

### 3.3 lsm_release_gpu
释放 GPU 资源。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| allocation_id | string | 是 | 分配 ID |
| force | bool | 否 | 强制释放，默认 false |

**输出:** `{ released_at, gpu_ids }`

### 3.4 lsm_create_task
创建运维任务。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_type | string | 是 | deploy/restart/backup/cleanup/custom |
| target | string | 是 | 目标服务器/服务 |
| params | object | 否 | 任务参数 |
| priority | string | 否 | low/normal/high |
| timeout_seconds | int | 否 | 超时时间，默认 3600 |

**输出:** `{ task_id, status, created_at, estimated_duration }`

### 3.5 lsm_cancel_task
取消任务。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | string | 是 | 任务 ID |
| reason | string | 否 | 取消原因 |

**输出:** `{ task_id, status: cancelled, cancelled_at }`

### 3.6 lsm_check_status
检查状态。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| scope | string | 否 | cluster/task/server，默认 cluster |
| target_id | string | 否 | 任务/服务器 ID |

**输出:** `{ scope, status, details: { total_servers, online, offline, maintenance, gpu_utilization } }`

### 3.7 lsm_scale_cluster
集群扩缩容。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | scale_up/scale_down |
| count | int | 是 | 数量 1-10 |
| region | string | 否 | 目标区域 |
| instance_type | string | 否 | 实例类型 |

**输出:** `{ scale_id, action, target_count, status, estimated_completion }`

### 3.8 lsm_heal_fault
故障自愈。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fault_id | string | 是 | 故障/服务器 ID |
| repair_action | string | 否 | restart/reimage/isolate/auto |
| auto_confirm | bool | 否 | 自动确认，默认 false |

**输出:** `{ heal_id, fault_id, diagnosis, action_taken, status }`

### 3.9 lsm_list_reservations
查询预留列表。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 否 | active/expired/pending/all |
| user_id | string | 否 | 用户过滤 |
| limit | int | 否 | 默认 20 |

**输出:** `{ reservations: [{ id, gpu_type, count, start_time, end_time, status }], total }`

### 3.10 lsm_create_reservation
创建资源预留。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| gpu_type | string | 是 | A100/H100/A10/T4 |
| count | int | 是 | GPU 数量 |
| start_time | string | 是 | ISO 8601 时间 |
| end_time | string | 是 | ISO 8601 时间 |
| purpose | string | 否 | 用途说明 |

**输出:** `{ reservation_id, status: pending, created_at }`

### 3.11 lsm_get_metrics
获取监控指标。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| metric_type | string | 否 | gpu_util/memory/network/latency |
| server_id | string | 否 | 服务器 ID |
| time_range | string | 否 | 1h/6h/24h/7d |

**输出:** `{ metric_type, metrics: [{ timestamp, value }], avg, max, min }`

### 3.12 lsm_update_config
更新配置。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| config_key | string | 是 | 配置键 |
| config_value | any | 是 | 配置值 |
| scope | string | 否 | global/server/service |
| target_id | string | 否 | 目标 ID |

**输出:** `{ config_key, previous_value, new_value, scope, updated_at }`

## 5. 错误处理

所有 Tool 调用遵循统一错误响应格式：

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "GPU allocation alloc-xxx not found",
    "details": {}
  }
}
```

**常见错误码:**

| 错误码 | HTTP | 说明 |
|--------|------|------|
| INVALID_PARAMS | 400 | 参数校验失败 |
| UNAUTHORIZED | 401 | 未授权或 Token 过期 |
| FORBIDDEN | 403 | 权限不足（如 WRITE 操作需要 ADMIN） |
| RESOURCE_NOT_FOUND | 404 | 资源不存在 |
| RESOURCE_EXHAUSTED | 429 | GPU 资源耗尽 |
| CONFLICT | 409 | 状态冲突（如任务已运行） |
| INTERNAL_ERROR | 500 | 服务内部错误 |

## 6. 调用示例

```
# 查询在线服务器
User: 查询所有在线服务器
Agent: lsm_list_servers({ "status": "online" })
→ 40 台在线服务器: cn-east(25), cn-west(15)

# 分配 GPU
User: 申请 4 张 A100 用于训练，48 小时
Agent: lsm_allocate_gpu({ "count": 4, "gpu_type": "A100", "purpose": "模型训练", "duration_hours": 48 })
→ allocation_id=alloc-abc123

# 故障自愈
User: 服务器 srv-015 异常，自动修复
Agent: lsm_heal_fault({ "fault_id": "srv-015", "repair_action": "auto" })
→ 重启完成，服务器已恢复

# 集群扩容
User: cn-east 扩容 3 台 GPU 服务器
Agent: lsm_scale_cluster({ "action": "scale_up", "count": 3, "region": "cn-east" })
→ scale_id=scale-def456，预计 10 分钟完成
```

---
*文档版本: v3.2.0 | 更新日期: 2026-03-15*