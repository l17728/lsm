# Day 14 快速参考卡

## 🚀 新功能速览

### 1. WebSocket 实时通知深化

#### 通知类型 (20+)
```
告警类：ALERT_CPU, ALERT_MEMORY, ALERT_GPU, ALERT_TEMP, ALERT_SERVER_OFFLINE
任务类：TASK_CREATED, TASK_STARTED, TASK_COMPLETED, TASK_FAILED, TASK_CANCELLED
系统类：SYSTEM_MAINTENANCE, SYSTEM_UPDATE, SYSTEM_RESTART
批量类：BATCH_STARTED, BATCH_PROGRESS, BATCH_COMPLETED, BATCH_FAILED
用户类：USER_LOGIN, USER_LOGOUT, USER_KICKED
```

#### 严重性级别
```
CRITICAL  → 紧急 (URGENT)
WARNING   → 高 (HIGH)
INFO      → 普通 (NORMAL)
SUCCESS   → 普通 (NORMAL)
```

#### API 端点
```bash
GET  /api/notification-history/history        # 获取历史
GET  /api/notification-history/unread-count   # 未读数量
GET  /api/notification-history/stats          # 统计
PUT  /api/notification-history/:id/read       # 标记已读
PUT  /api/notification-history/read-all       # 全部已读
DELETE /api/notification-history/:id          # 删除
DELETE /api/notification-history/bulk         # 批量删除
```

#### 使用示例
```typescript
// 发送告警
await webSocketNotificationService.sendAlert({
  type: NotificationType.ALERT_CPU,
  severity: NotificationSeverity.WARNING,
  title: '高 CPU 使用率',
  message: '服务器 CPU 使用率超过 90%',
  metadata: { serverId: 'xxx', usage: 92.5 },
});

// 发送批量进度
await webSocketNotificationService.sendBatchProgress(userId, {
  batchId: 'batch-123',
  operation: '导出服务器数据',
  total: 1000,
  completed: 500,
  progress: 50.0,
  status: 'running',
});
```

---

### 2. 读写分离方案

#### 环境变量
```bash
DATABASE_URL=postgresql://user:pass@primary:5432/lsm
DATABASE_REPLICA_URLS=postgresql://user:pass@replica1:5432/lsm
ENABLE_READ_REPLICA=true
READ_QUERY_THRESHOLD=100
```

#### 使用示例
```typescript
// 写操作 → 主库
const server = await db.write(() =>
  prisma.server.create({ data: { name: 'test' } })
);

// 读操作 → 从库 (轮询)
const servers = await db.read(() =>
  prisma.server.findMany()
);

// 关键读 → 主库 (强一致)
const data = await db.getClient('read', true)
  .server.findUnique({ where: { id } });

// 事务 → 主库
await db.transaction(async (tx) => {
  await tx.user.create({...});
});
```

#### 监控命令
```bash
# 查看复制状态
SELECT * FROM pg_stat_replication;

# 查看复制延迟
SELECT client_addr, 
       (pg_current_wal_lsn() - replay_lsn) as lag_bytes
FROM pg_stat_replication;
```

---

### 3. 消息队列集成

#### 队列类型
```
email      - 邮件发送队列
export     - 导出任务队列
background - 后台任务队列
```

#### 使用示例
```typescript
// 添加任务
const jobId = await queue.addJob('email', 'send', {
  to: 'user@example.com',
  subject: 'Test',
  body: 'Hello',
}, { priority: 1, maxRetries: 3 });

// 处理队列
await queue.processQueue('email', async (job) => {
  await emailService.send(job.payload);
}, 3); // 3 个并发

// 查看统计
const stats = await queue.getQueueStats('email');
// { pending: 5, processing: 2, completed: 100, failed: 1 }
```

#### Redis 命令
```bash
# 查看队列长度
XLEN queue:email

# 查看队列消息
XRANGE queue:email - + COUNT 10

# 查看死信
XRANGE queue:email:dead - +

# 查看消费者组
XINFO GROUPS queue:email
```

---

## 📊 监控指标

### WebSocket 通知
- 推送延迟：<100ms
- 历史查询：<300ms
- 保存时间：<200ms

### 读写分离
- 主库写入：<50ms
- 从库读取：<30ms
- 复制延迟：<100ms
- 故障切换：<30s

### 消息队列
- 入队时间：<10ms
- 处理延迟：<100ms
- 并发能力：1500/s

### 水平扩展
- 多实例：3+
- QPS 提升：~2.8x
- 故障恢复：<1min

---

## 🔧 常用命令

### Docker 操作
```bash
# 启动完整环境
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f backend-1

# 重启服务
docker-compose restart backend-1

# 停止所有
docker-compose down
```

### 数据库操作
```bash
# 进入主库
docker exec -it lsm-db-primary psql -U lsm_user -d lsm

# 进入从库
docker exec -it lsm-db-replica-1 psql -U lsm_user -d lsm

# 查看连接
SELECT * FROM pg_stat_activity;

# 查看锁
SELECT * FROM pg_locks;

# 查看慢查询
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC;
```

### Redis 操作
```bash
# 进入 Redis
docker exec -it lsm-redis redis-cli

# 查看所有 key
KEYS *

# 查看队列
XLEN queue:email
XRANGE queue:email - + COUNT 10

# 查看内存
INFO memory

# 清空数据库 (慎用!)
FLUSHDB
```

### 应用操作
```bash
# 运行迁移
npx prisma migrate deploy

# 生成客户端
npx prisma generate

# 查看健康
curl http://localhost/health

# 查看统计
curl http://localhost/api/monitoring/stats
```

---

## 🚨 故障排查

### WebSocket 连接问题
```bash
# 1. 检查 WebSocket 服务
curl http://localhost/api/websocket/online-users

# 2. 检查 Redis 连接
docker exec lsm-redis redis-cli ping

# 3. 查看日志
docker logs lsm-backend-1 | grep WebSocket
```

### 读写分离问题
```bash
# 1. 检查主从状态
docker exec lsm-db-primary psql -U lsm_user -c \
  "SELECT * FROM pg_stat_replication;"

# 2. 检查复制延迟
docker exec lsm-db-replica-1 psql -U lsm_user -c \
  "SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();"

# 3. 临时禁用读写分离
# 设置 ENABLE_READ_REPLICA=false
```

### 消息队列问题
```bash
# 1. 检查 Redis 连接
docker exec lsm-redis redis-cli ping

# 2. 查看队列积压
docker exec lsm-redis redis-cli XLEN queue:email

# 3. 查看死信
docker exec lsm-redis redis-cli XRANGE queue:email:dead - +

# 4. 清理死信
docker exec lsm-redis redis-cli DEL queue:email:dead
```

### 负载均衡问题
```bash
# 1. 检查 Nginx 配置
docker exec lsm-nginx nginx -t

# 2. 查看 Nginx 日志
docker logs lsm-nginx

# 3. 检查后端健康
curl http://backend-1:3001/health
curl http://backend-2:3002/health
curl http://backend-3:3003/health

# 4. 重新加载 Nginx 配置
docker exec lsm-nginx nginx -s reload
```

---

## 📈 性能优化

### 数据库优化
```sql
-- 添加索引
CREATE INDEX CONCURRENTLY idx_notification_history_user_read 
ON notification_history (user_id, is_read, created_at DESC);

-- 分析表
ANALYZE notification_history;

-- 清理旧数据
DELETE FROM notification_history 
WHERE created_at < NOW() - INTERVAL '30 days'
AND is_read = true;
```

### Redis 优化
```bash
# 设置内存限制
CONFIG SET maxmemory 256mb

# 设置淘汰策略
CONFIG SET maxmemory-policy allkeys-lru

# 查看慢查询
SLOWLOG GET 10

# 设置慢查询阈值
CONFIG SET slowlog-log-slower-than 10000
```

### 应用优化
```typescript
// 批量操作
await Promise.all(notifications.map(n => 
  notificationHistoryService.saveNotification(userId, n)
));

// 缓存热点数据
const cached = await cache.get('notification:stats:' + userId);
if (cached) return cached;

// 分页查询
const result = await prisma.notificationHistory.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' },
});
```

---

## 🎯 最佳实践

### 通知使用
1. ✅ 重要通知使用 CRITICAL/WARNING 级别
2. ✅ 批量操作实时推送进度
3. ✅ 定期清理已读通知 (30 天)
4. ✅ 避免频繁推送 INFO 级别通知

### 读写分离
1. ✅ 写操作必须使用主库
2. ✅ 关键读操作使用主库保证一致性
3. ✅ 普通读操作使用从库提升性能
4. ✅ 监控复制延迟及时调整

### 消息队列
1. ✅ 设置合理的重试次数 (3-5 次)
2. ✅ 重要任务设置较高优先级
3. ✅ 定期检查死信队列
4. ✅ 监控队列长度避免积压

### 水平扩展
1. ✅ 保持应用无状态
2. ✅ 使用 Redis 共享会话
3. ✅ 配置健康检查
4. ✅ 设置合理的超时和重试

---

## 📝 检查清单

### 每日检查
- [ ] 检查系统健康状态
- [ ] 查看未读通知数量
- [ ] 检查队列积压情况
- [ ] 查看复制延迟
- [ ] 检查错误日志

### 每周检查
- [ ] 清理 30 天前通知
- [ ] 分析慢查询
- [ ] 检查死信队列
- [ ] 性能指标 review
- [ ] 容量规划评估

### 每月检查
- [ ] 数据库备份验证
- [ ] 故障转移演练
- [ ] 性能基准测试
- [ ] 安全审计
- [ ] 文档更新

---

*Last Updated: 2026-03-14*  
*LSM Project - Phase 4: Production Deployment & Feature Enhancement*
