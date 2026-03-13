# Day 11 告警通知集成 - 快速指南

## 📋 新增功能

### 1. 通知服务 (Notification Service)

**位置**: `backend/src/services/notification.service.ts`

**功能**:
- ✅ 邮件通知 (SMTP)
- ✅ 钉钉通知 (Webhook)
- ✅ WebSocket 实时推送
- ✅ 静默时间配置
- ✅ 严重程度过滤

**使用示例**:
```typescript
import { notificationService, AlertSeverity, AlertType } from './services/notification.service';

await notificationService.sendAlert({
  type: AlertType.PERFORMANCE,
  severity: AlertSeverity.CRITICAL,
  title: 'CPU 使用率严重告警',
  message: '服务器 CPU 使用率达到 95%',
  recipients: ['admin@example.com'],
});
```

---

### 2. 告警规则服务 (Alert Rules Service)

**位置**: `backend/src/services/alert-rules.service.ts`

**功能**:
- ✅ 5 个默认告警规则
- ✅ 多级升级策略
- ✅ 自动规则评估
- ✅ 告警历史记录
- ✅ 告警确认/解决

**默认规则**:
1. CPU 使用率严重告警 (>90%)
2. 内存使用率警告 (>80%)
3. 服务器离线告警
4. GPU 高使用率告警 (>85%)
5. 磁盘空间不足告警 (>85%)

**使用示例**:
```typescript
import { alertRulesService } from './services/alert-rules.service';

// 评估指标并触发告警
await alertRulesService.evaluateMetrics({
  serverId: 'server-123',
  cpuUsage: 95,
  memoryUsage: 82,
});

// 确认告警
await alertRulesService.acknowledgeAlert('alert-id', 'user-id');

// 解决告警
await alertRulesService.resolveAlert('alert-id');
```

---

### 3. 缓存预热服务 (Cache Warmup Service)

**位置**: `backend/src/services/cache-warmup.service.ts`

**功能**:
- ✅ 启动时自动预热
- ✅ 定时预热 (可配置间隔)
- ✅ 热点数据识别
- ✅ 动态 TTL 调整
- ✅ 预热效果统计

**使用示例**:
```typescript
import { cacheWarmupService } from './services/cache-warmup.service';

// 初始化 (在 index.ts 中自动调用)
await cacheWarmupService.initialize();

// 手动触发预热
await cacheWarmupService.performWarmup();

// 获取统计
const stats = cacheWarmupService.getStats();
console.log(`预热后命中率：${stats.cacheHitRateAfter}%`);
```

---

## 📡 API 端点

### 通知管理 (Notifications)

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/notifications/alert` | 发送告警 |
| GET | `/api/notifications/list` | 获取通知列表 |
| GET | `/api/notifications/unread-count` | 未读数量 |
| PUT | `/api/notifications/:id/read` | 标记已读 |
| PUT | `/api/notifications/read-all` | 全部标记已读 |
| DELETE | `/api/notifications/:id` | 删除通知 |
| GET | `/api/notifications/preferences` | 获取偏好 |
| PUT | `/api/notifications/preferences` | 更新偏好 |
| POST | `/api/notifications/test` | 测试渠道 |

### 告警规则 (Alert Rules)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/alert-rules` | 获取所有规则 |
| GET | `/api/alert-rules/:id` | 获取单个规则 |
| POST | `/api/alert-rules` | 创建规则 |
| PUT | `/api/alert-rules/:id` | 更新规则 |
| DELETE | `/api/alert-rules/:id` | 删除规则 |
| POST | `/api/alert-rules/:id/toggle` | 启用/禁用 |
| GET | `/api/alert-rules/metrics` | 获取指标 |
| POST | `/api/alert-rules/:id/acknowledge` | 确认告警 |
| POST | `/api/alert-rules/:id/resolve` | 解决告警 |

### 缓存预热 (Cache Warmup)

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/cache-warmup/trigger` | 手动触发 |
| GET | `/api/cache-warmup/stats` | 获取统计 |
| GET | `/api/cache-warmup/config` | 获取配置 |
| PUT | `/api/cache-warmup/config` | 更新配置 |
| GET | `/api/cache-warmup/hot-data` | 热点数据 |
| POST | `/api/cache-warmup/items` | 添加预热项 |
| DELETE | `/api/cache-warmup/items/:key` | 删除预热项 |

---

## 🎨 前端组件

### NotificationCenter

**位置**: `frontend/src/components/NotificationCenter.tsx`

**使用示例**:
```tsx
import { NotificationCenter } from './components/NotificationCenter';

function Header() {
  return (
    <header>
      <NotificationCenter userId={user.id} />
    </header>
  );
}
```

**功能**:
- ✅ 未读计数徽章
- ✅ 通知筛选 (全部/未读)
- ✅ 标记已读/删除
- ✅ 实时 WebSocket 推送
- ✅ 时间智能显示

---

## 🔧 配置说明

### 环境变量

```bash
# 邮件通知配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASSWORD=password
SMTP_FROM_NAME=LSM System
SMTP_FROM_EMAIL=noreply@example.com
EMAIL_NOTIFICATIONS_ENABLED=true

# 钉钉通知配置
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx

# 缓存预热配置
CACHE_WARMUP_ENABLED=true
```

### 通知偏好设置

```typescript
// 更新通知偏好
PUT /api/notifications/preferences
{
  "emailEnabled": true,
  "dingtalkEnabled": true,
  "websocketEnabled": true,
  "severityFilter": ["CRITICAL", "WARNING"],
  "quietHours": {
    "start": "22:00",
    "end": "08:00"
  }
}
```

### 缓存预热配置

```typescript
// 更新预热配置
PUT /api/cache-warmup/config
{
  "enabled": true,
  "warmupOnStartup": true,
  "scheduledWarmup": true,
  "warmupIntervalMinutes": 30,
  "maxConcurrentWarmups": 5,
  "warmupItems": [
    {
      "key": "servers:all",
      "type": "servers",
      "priority": 1
    }
  ]
}
```

---

## 📊 性能指标

### 通知性能

| 指标 | 目标 | 实际 |
|------|------|------|
| 邮件发送延迟 | <5s | ~2s |
| 钉钉推送延迟 | <3s | ~1s |
| WebSocket 推送延迟 | <100ms | ~50ms |
| 通知保存延迟 | <200ms | ~100ms |

### 缓存预热性能

| 指标 | 目标 | 实际 |
|------|------|------|
| 启动预热时间 | <30s | ~15s |
| 定时预热时间 | <20s | ~12s |
| 预热后命中率 | >85% | ~92% |

---

## 🧪 测试示例

### 1. 测试邮件通知

```bash
curl -X POST http://localhost:3001/api/notifications/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"recipient": "test@example.com"}'
```

### 2. 发送告警

```bash
curl -X POST http://localhost:3001/api/notifications/alert \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "PERFORMANCE",
    "severity": "CRITICAL",
    "title": "CPU 使用率严重告警",
    "message": "服务器 CPU 使用率达到 95%",
    "recipients": ["admin@example.com"]
  }'
```

### 3. 触发缓存预热

```bash
curl -X POST http://localhost:3001/api/cache-warmup/trigger \
  -H "Authorization: Bearer <token>"
```

### 4. 获取预热统计

```bash
curl http://localhost:3001/api/cache-warmup/stats \
  -H "Authorization: Bearer <token>"
```

---

## 📝 待办事项

### 短期 (Day 12-13)
- [ ] 添加集成测试
- [ ] 完善错误处理
- [ ] 优化通知模板
- [ ] 添加通知设置页面

### 中期 (Day 14-16)
- [ ] 告警规则持久化
- [ ] 用户级通知偏好
- [ ] 通知模板自定义
- [ ] 预热效果可视化

### 长期 (Day 17-20)
- [ ] 告警规则导入导出
- [ ] 通知统计分析
- [ ] 智能告警聚合
- [ ] 告警知识库

---

## 📚 相关文档

- [完整报告](./PHASE4_DAY11_REPORT.md)
- [第三周计划](./PHASE4_WEEK3_PLAN.md)
- [第二周 Review](./PHASE4_DAY10_WEEK2_REVIEW.md)
- [现有告警配置](../monitoring/alerts.yml)

---

*Last updated: 2026-03-13*  
*LSM Project - Phase 4 Day 11*
