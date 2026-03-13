# LSM 运维手册 (Operations Manual)

**版本**: 3.0.0  
**最后更新**: 2026-03-13  
**状态**: 生产就绪  
**维护团队**: DevOps 团队

---

## 📚 目录

1. [系统监控指南](#系统监控指南)
2. [告警配置和处理](#告警配置和处理)
3. [日志管理和分析](#日志管理和分析)
4. [性能优化建议](#性能优化建议)
5. [故障排查流程](#故障排查流程)
6. [日常维护清单](#日常维护清单)

---

## 系统监控指南

### 监控架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   应用服务  │────▶│  Prometheus  │────▶│   Grafana   │
│  (Metrics)  │     │   (采集)     │     │  (展示)     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Alertmanager│
                    │  (告警)      │
                    └──────────────┘
```

### 监控指标

#### 应用指标 (Application Metrics)

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `lsm_app_requests_total` | Counter | 总请求数 | - |
| `lsm_app_request_duration_seconds` | Histogram | 请求耗时 | P95 > 1s |
| `lsm_app_errors_total` | Counter | 错误总数 | 错误率 > 5% |
| `lsm_app_active_connections` | Gauge | 活跃连接数 | > 1000 |

#### 系统指标 (System Metrics)

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `lsm_health_cpu_percent` | Gauge | CPU 使用率 | > 90% |
| `lsm_health_memory_percent` | Gauge | 内存使用率 | > 90% |
| `lsm_health_disk_percent` | Gauge | 磁盘使用率 | > 85% |
| `lsm_health_database` | Gauge | 数据库状态 | 0 = 异常 |
| `lsm_health_redis` | Gauge | Redis 状态 | 0 = 异常 |

#### 缓存指标 (Cache Metrics)

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `lsm_cache_hits_total` | Counter | 缓存命中数 | - |
| `lsm_cache_misses_total` | Counter | 缓存未命中数 | - |
| `lsm_cache_hit_rate_percent` | Gauge | 缓存命中率 | < 80% |
| `lsm_cache_keys_count` | Gauge | 缓存键数量 | > 10000 |

#### 业务指标 (Business Metrics)

| 指标名称 | 类型 | 说明 | 告警阈值 |
|---------|------|------|---------|
| `lsm_tasks_total` | Gauge | 任务总数 | - |
| `lsm_tasks_pending` | Gauge | 待处理任务 | > 100 |
| `lsm_gpus_allocated` | Gauge | 已分配 GPU | > 90% |
| `lsm_users_active` | Gauge | 活跃用户数 | - |

### Prometheus 配置

**配置文件**: `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'lsm-backend'
    static_configs:
      - targets: ['localhost:4000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'alerts.yml'
```

### Grafana 仪表盘

#### 访问仪表盘

1. 访问 `http://localhost:3000`
2. 登录：admin / admin (首次登录后修改密码)
3. 进入 Dashboards → 选择 LSM Dashboard

#### 主要面板

**系统概览**:
- CPU/内存/磁盘使用率
- 服务健康状态
- 请求量和错误率

**性能监控**:
- API 响应时间 (P50, P95, P99)
- 数据库查询时间
- 缓存命中率

**业务监控**:
- 任务执行情况
- GPU 分配状态
- 用户活跃度

### 监控检查清单

#### 每日检查

- [ ] 查看 Grafana 仪表盘
- [ ] 检查告警历史
- [ ] 验证数据完整性
- [ ] 审查异常指标

#### 每周检查

- [ ] 性能趋势分析
- [ ] 容量规划评估
- [ ] 备份验证
- [ ] 日志审查

#### 每月检查

- [ ] 系统健康报告
- [ ] 性能基准测试
- [ ] 安全审计
- [ ] 文档更新

---

## 告警配置和处理

### 告警规则配置

**配置文件**: `monitoring/alerts.yml`

```yaml
groups:
  - name: lsm-alerts
    rules:
      # 高 CPU 使用率
      - alert: HighCPUUsage
        expr: lsm_health_cpu_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高 CPU 使用率"
          description: "CPU 使用率超过 90% 持续 5 分钟 (当前值：{{ $value }}%)"

      # 高内存使用率
      - alert: HighMemoryUsage
        expr: lsm_health_memory_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高内存使用率"
          description: "内存使用率超过 90% 持续 5 分钟 (当前值：{{ $value }}%)"

      # 数据库不可用
      - alert: DatabaseDown
        expr: lsm_health_database == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "数据库不可用"
          description: "数据库连接失败，立即检查！"

      # Redis 不可用
      - alert: RedisDown
        expr: lsm_health_redis == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis 不可用"
          description: "Redis 连接失败，缓存功能失效！"

      # 缓存命中率低
      - alert: LowCacheHitRate
        expr: lsm_cache_hit_rate_percent < 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "缓存命中率低"
          description: "缓存命中率低于 80% (当前值：{{ $value }}%)"

      # 高错误率
      - alert: HighErrorRate
        expr: rate(lsm_app_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高错误率"
          description: "API 错误率超过 5% (当前值：{{ $value | humanizePercentage }})"

      # 待处理任务过多
      - alert: TooManyPendingTasks
        expr: lsm_tasks_pending > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "待处理任务过多"
          description: "待处理任务超过 100 个 (当前值：{{ $value }})"

      # GPU 分配率过高
      - alert: HighGPUAllocation
        expr: lsm_gpus_allocated / lsm_gpus_total > 0.9
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "GPU 分配率过高"
          description: "GPU 分配率超过 90%，考虑扩容"

      # 磁盘空间不足
      - alert: LowDiskSpace
        expr: lsm_health_disk_percent > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "磁盘空间不足"
          description: "磁盘使用率超过 85% (当前值：{{ $value }}%)"

      # 服务宕机
      - alert: ServiceDown
        expr: up{job="lsm-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "LSM 服务宕机"
          description: "后端服务无法访问，立即检查！"
```

### 告警级别定义

| 级别 | 说明 | 响应时间 | 通知方式 |
|------|------|---------|---------|
| **Critical** | 服务中断，立即处理 | 5 分钟内 | 电话 + 短信 + 邮件 |
| **Warning** | 性能下降，尽快处理 | 30 分钟内 | 邮件 + IM |
| **Info** | 信息提示，工作时间处理 | 24 小时内 | 邮件 |

### 通知渠道配置

#### 邮件通知

**Grafana 配置**:

```ini
[smtp]
enabled = true
host = smtp.example.com:587
user = alert@example.com
password = your-password
from_address = alert@example.com
```

**告警联系人**:

```yaml
receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'ops-team@example.com'
        send_resolved: true
```

#### 钉钉通知

**Webhook 配置**:

```yaml
receivers:
  - name: 'dingtalk'
    webhook_configs:
      - url: 'https://oapi.dingtalk.com/robot/send?access_token=YOUR_TOKEN'
        send_resolved: true
```

**钉钉机器人配置**:

1. 进入钉钉群设置
2. 添加机器人 → 自定义
3. 获取 Webhook URL
4. 配置安全设置 (加签或 IP 白名单)

#### 企业微信通知

**Webhook 配置**:

```yaml
receivers:
  - name: 'wechat'
    webhook_configs:
      - url: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY'
        send_resolved: true
```

### 告警处理流程

#### 1. 接收告警

- 收到告警通知
- 确认告警级别
- 记录告警时间

#### 2. 初步评估

- 查看告警详情
- 检查相关指标
- 判断影响范围

#### 3. 问题定位

- 查看日志
- 检查系统状态
- 识别根本原因

#### 4. 问题解决

- 执行修复操作
- 验证修复效果
- 更新告警状态

#### 5. 事后总结

- 记录事故经过
- 分析根本原因
- 制定预防措施

### 告警升级策略

```yaml
# Alertmanager 配置
route:
  receiver: 'default-receiver'
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'critical-receiver'
      group_wait: 10s
      repeat_interval: 1h
    - match:
        severity: warning
      receiver: 'warning-receiver'
      group_wait: 1m
      repeat_interval: 2h

receivers:
  - name: 'default-receiver'
    email_configs:
      - to: 'ops-team@example.com'

  - name: 'critical-receiver'
    email_configs:
      - to: 'ops-team@example.com'
    webhook_configs:
      - url: 'https://hook.example.com/alert'

  - name: 'warning-receiver'
    email_configs:
      - to: 'dev-team@example.com'
```

---

## 日志管理和分析

### 日志架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   应用日志  │────▶│    Filebeat  │────▶│  Elasticsearch│
│  (Winston)  │     │   (采集)     │     │   (存储)     │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │     Kibana   │
                    │   (分析)     │
                    └──────────────┘
```

### 日志级别

| 级别 | 说明 | 使用场景 |
|------|------|---------|
| ERROR | 错误 | 系统错误，需要立即处理 |
| WARN | 警告 | 潜在问题，需要关注 |
| INFO | 信息 | 正常业务操作 |
| DEBUG | 调试 | 开发调试信息 |
| VERBOSE | 详细 | 详细追踪信息 |

### 日志格式

```json
{
  "timestamp": "2026-03-13T10:00:00.000Z",
  "level": "INFO",
  "service": "lsm-backend",
  "message": "User login successful",
  "userId": "uuid",
  "username": "testuser",
  "ip": "192.168.1.100",
  "traceId": "abc123",
  "duration": 125
}
```

### 日志配置

**Winston 配置** (`backend/src/config/logger.ts`):

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'lsm-backend' },
  transports: [
    // 错误日志
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // 所有日志
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

// 开发环境输出到控制台
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
```

### 日志收集

#### Filebeat 配置

```yaml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/lsm-backend/*.log
    json.keys_under_root: true
    json.add_error_key: true
    json.message_key: message

output.elasticsearch:
  hosts: ["localhost:9200"]
  indices:
    - index: "lsm-logs-%{+yyyy.MM.dd}"

logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat.log
```

### 日志分析

#### 常用查询

**查看错误日志**:
```
level: ERROR AND service: lsm-backend
```

**查看特定用户操作**:
```
userId: "uuid" AND level: INFO
```

**查看慢请求**:
```
duration:>1000 AND message: "API request"
```

**查看登录失败**:
```
message: "Login failed" AND level: WARN
```

#### 日志统计

**错误趋势**:
```kibana
GET /lsm-logs-*/_search
{
  "size": 0,
  "aggs": {
    "errors_over_time": {
      "date_histogram": {
        "field": "timestamp",
        "interval": "1h"
      },
      "aggs": {
        "error_count": {
          "filter": {
            "term": {
              "level": "ERROR"
            }
          }
        }
      }
    }
  }
}
```

### 日志保留策略

| 日志类型 | 保留期限 | 存储位置 |
|---------|---------|---------|
| 错误日志 | 90 天 | 热存储 |
| 访问日志 | 30 天 | 热存储 |
| 审计日志 | 365 天 | 冷存储 |
| 调试日志 | 7 天 | 热存储 |

### 日志轮转

**Logrotate 配置** (`/etc/logrotate.d/lsm-backend`):

```conf
/var/log/lsm-backend/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    postrotate
        systemctl reload lsm-backend
    endscript
}
```

---

## 性能优化建议

### 数据库优化

#### 索引优化

```sql
-- 添加常用查询索引
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_gpus_status ON gpus(status);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 复合索引
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_gpus_server_status ON gpus(server_id, status);

-- 分析表统计
ANALYZE tasks;
ANALYZE gpus;
ANALYZE servers;
ANALYZE users;
```

#### 查询优化

```typescript
// ❌ 避免 N+1 查询
const tasks = await prisma.task.findMany({ where: { userId } });
for (const task of tasks) {
  const user = await prisma.user.findUnique({ where: { id: task.userId } });
}

// ✅ 使用 include
const tasks = await prisma.task.findMany({
  where: { userId },
  include: { user: true }
});

// ❌ 避免 SELECT *
const users = await prisma.user.findMany();

// ✅ 只选择需要的字段
const users = await prisma.user.findMany({
  select: { id: true, username: true, email: true }
});
```

#### 连接池优化

```typescript
// Prisma 连接池配置
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

// 连接池参数 (通过 DATABASE_URL)
// postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30
```

### 缓存优化

#### 缓存策略

```typescript
const CACHE_TTL = {
  // 用户相关 (低频访问)
  userSession: 604800,      // 7 天
  userList: 1800,           // 30 分钟
  
  // 服务器相关 (中频访问)
  serverList: 900,          // 15 分钟
  serverMetrics: 600,       // 10 分钟
  
  // GPU 相关 (高频访问)
  gpuList: 600,             // 10 分钟
  gpuStatus: 120,           // 2 分钟
  
  // 任务相关 (实时性要求高)
  taskList: 300,            // 5 分钟
  
  // 监控数据
  monitoringMetrics: 60,    // 1 分钟
};
```

#### 缓存预热

```typescript
// scripts/cache-warm.ts
import { CacheService } from '../src/services/cache.service';

async function warmCache() {
  const cache = new CacheService();
  
  const keys = [
    'userList',
    'serverList',
    'gpuList',
    'taskList'
  ];
  
  for (const key of keys) {
    console.log(`Warming cache: ${key}`);
    await cache.warm(key);
  }
  
  console.log('Cache warming completed');
}

warmCache();
```

#### 缓存监控

```bash
# 查看缓存统计
curl http://localhost:4000/api/cache/stats

# 查看命中率
curl http://localhost:4000/api/metrics/cache

# Prometheus 指标
lsm_cache_hits_total
lsm_cache_misses_total
lsm_cache_hit_rate_percent
```

### 应用优化

#### 异步处理

```typescript
// ❌ 同步处理
const results = [];
for (const item of items) {
  results.push(await processItem(item));
}

// ✅ 并行处理
const results = await Promise.all(
  items.map(item => processItem(item))
);

// ✅ 批量处理 (限制并发)
const results = await pLimit(10)(
  items.map(item => () => processItem(item))
);
```

#### 流式处理

```typescript
// ❌ 一次性加载大量数据
const allData = await prisma.task.findMany();
res.json(allData);

// ✅ 使用分页
const tasks = await prisma.task.findMany({
  skip: (page - 1) * limit,
  take: limit,
});
res.json(tasks);

// ✅ 使用流式响应
const stream = prisma.task.findMany().stream();
for await (const task of stream) {
  res.write(JSON.stringify(task) + '\n');
}
```

### 前端优化

#### 代码分割

```typescript
// 路由级别代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Servers = lazy(() => import('./pages/Servers'));

// 组件级别代码分割
const HeavyComponent = lazy(() => import('./components/HeavyComponent'));
```

#### 资源优化

```bash
# 图片压缩
npm install -g imagemin-cli
imagemin src/images/* --out-dir=dist/images

# 启用 Gzip
# Nginx 配置
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

#### 缓存策略

```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
}

# HTML 不缓存
location ~* \.html$ {
  expires -1;
  add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

## 故障排查流程

### 故障分类

| 类型 | 说明 | 示例 |
|------|------|------|
| P0 - 严重 | 服务完全不可用 | 数据库宕机、服务崩溃 |
| P1 - 高 | 核心功能受损 | 无法登录、GPU 分配失败 |
| P2 - 中 | 部分功能异常 | 邮件发送失败、导出功能异常 |
| P3 - 低 | 轻微问题 | UI 显示问题、性能略慢 |

### 排查流程

#### 1. 问题识别

```bash
# 检查服务状态
systemctl status lsm-backend
docker-compose ps

# 查看最近的错误日志
tail -100 /var/log/lsm-backend/error.log

# 检查系统资源
top -bn1 | head -20
free -h
df -h
```

#### 2. 问题定位

**数据库问题**:
```bash
# 检查数据库连接
pg_isready -h localhost -U lsm

# 查看连接数
psql -U lsm -d lsm -c "SELECT count(*) FROM pg_stat_activity;"

# 查看慢查询
psql -U lsm -d lsm -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

**Redis 问题**:
```bash
# 检查 Redis 连接
redis-cli ping

# 查看 Redis 信息
redis-cli info

# 查看内存使用
redis-cli info memory
```

**应用问题**:
```bash
# 查看应用日志
tail -f /var/log/lsm-backend/combined.log

# 检查进程
ps aux | grep node

# 查看端口占用
lsof -i :4000
```

#### 3. 问题修复

**数据库连接池耗尽**:
```sql
-- 查看当前连接
SELECT * FROM pg_stat_activity;

-- 终止空闲连接
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND query_start < now() - interval '10 minutes';

-- 增加连接数限制 (postgresql.conf)
-- max_connections = 200
```

**内存泄漏**:
```bash
# 重启服务
systemctl restart lsm-backend

# 分析堆内存
node --inspect app.js

# 使用 Chrome DevTools 分析
```

**磁盘空间不足**:
```bash
# 查找大文件
find /var/log -type f -size +100M

# 清理旧日志
find /var/log -name "*.log" -mtime +30 -delete

# 清理 Docker 资源
docker system prune -a
```

#### 4. 验证修复

```bash
# 健康检查
curl http://localhost:4000/api/health

# 功能测试
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/servers

# 性能测试
ab -n 1000 -c 10 http://localhost:4000/api/health
```

### 常见故障处理

#### 故障 1: 服务无法启动

**症状**:
- `systemctl start lsm-backend` 失败
- 端口无法访问

**排查步骤**:
```bash
# 1. 查看错误日志
journalctl -u lsm-backend -n 50

# 2. 检查端口占用
lsof -i :4000

# 3. 检查环境变量
cat /etc/lsm-backend/.env

# 4. 检查数据库连接
pg_isready -h localhost -U lsm

# 5. 手动启动测试
cd /opt/lsm-project/backend
npm run dev
```

**解决方案**:
```bash
# 修复数据库连接
sudo systemctl restart postgresql

# 修复权限
chown -R lsm:lsm /opt/lsm-project

# 重新启动服务
sudo systemctl start lsm-backend
```

#### 故障 2: 数据库连接超时

**症状**:
- API 返回 500 错误
- 日志显示 "Connection timeout"

**排查步骤**:
```bash
# 1. 检查数据库状态
sudo systemctl status postgresql

# 2. 查看连接数
psql -U lsm -d lsm -c "SELECT count(*) FROM pg_stat_activity;"

# 3. 查看锁等待
psql -U lsm -d lsm -c "SELECT * FROM pg_locks WHERE NOT granted;"

# 4. 查看慢查询
psql -U lsm -d lsm -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 5;"
```

**解决方案**:
```sql
-- 终止阻塞查询
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
AND query_start > now() + interval '5 minutes';

-- 优化慢查询
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status);

-- 重启数据库 (最后手段)
sudo systemctl restart postgresql
```

#### 故障 3: Redis 缓存失效

**症状**:
- 缓存命中率低
- 响应时间变慢

**排查步骤**:
```bash
# 1. 检查 Redis 状态
sudo systemctl status redis

# 2. 测试连接
redis-cli ping

# 3. 查看内存
redis-cli info memory

# 4. 查看键数量
redis-cli dbsize

# 5. 查看慢日志
redis-cli slowlog get 10
```

**解决方案**:
```bash
# 清理过期键
redis-cli MEMORY PURGE

# 重启 Redis
sudo systemctl restart redis

# 调整内存限制
redis-cli CONFIG SET maxmemory 4gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 故障 4: 高错误率

**症状**:
- 监控显示错误率 > 5%
- 用户报告功能异常

**排查步骤**:
```bash
# 1. 查看错误日志
grep "ERROR" /var/log/lsm-backend/error.log | tail -50

# 2. 统计错误类型
grep "ERROR" /var/log/lsm-backend/error.log | \
  awk -F'"' '{print $8}' | sort | uniq -c | sort -rn

# 3. 查看最近部署
git log --oneline -10

# 4. 回滚测试
git revert HEAD
```

**解决方案**:
```bash
# 回滚到上一个版本
cd /opt/lsm-project
git revert HEAD
npm run build
sudo systemctl restart lsm-backend

# 或者修复特定问题
# 根据错误日志定位具体代码问题
```

---

## 日常维护清单

### 每日检查

#### 系统健康

- [ ] 检查 Grafana 仪表盘
- [ ] 验证所有服务状态正常
- [ ] 查看告警历史
- [ ] 检查错误日志数量

#### 性能指标

- [ ] API 响应时间 < 200ms
- [ ] 数据库查询时间 < 100ms
- [ ] 缓存命中率 > 80%
- [ ] CPU 使用率 < 80%
- [ ] 内存使用率 < 85%

#### 业务指标

- [ ] 待处理任务数量正常
- [ ] GPU 分配率合理
- [ ] 无异常用户反馈

### 每周检查

#### 系统维护

- [ ] 清理旧日志 (>30 天)
- [ ] 清理临时文件
- [ ] 检查磁盘空间
- [ ] 验证备份完整性

#### 性能分析

- [ ] 分析慢查询日志
- [ ] 审查性能趋势
- [ ] 优化低效查询
- [ ] 调整缓存策略

#### 安全审查

- [ ] 检查安全日志
- [ ] 审查用户权限
- [ ] 更新依赖包
- [ ] 扫描漏洞

### 每月检查

#### 容量规划

- [ ] 评估资源使用趋势
- [ ] 预测容量需求
- [ ] 规划扩容方案
- [ ] 更新容量文档

#### 系统优化

- [ ] 数据库索引优化
- [ ] 应用性能调优
- [ ] 前端资源优化
- [ ] 网络配置优化

#### 文档更新

- [ ] 更新运维手册
- [ ] 更新应急预案
- [ ] 更新监控配置
- [ ] 更新联系人列表

### 季度检查

#### 全面审计

- [ ] 安全审计
- [ ] 性能基准测试
- [ ] 灾难恢复演练
- [ ] 代码质量审查

#### 系统升级

- [ ] 评估新版本
- [ ] 制定升级计划
- [ ] 执行升级测试
- [ ] 实施生产升级

---

## 附录

### A. 常用命令

#### 服务管理

```bash
# 启动服务
sudo systemctl start lsm-backend
sudo systemctl start lsm-frontend

# 停止服务
sudo systemctl stop lsm-backend

# 重启服务
sudo systemctl restart lsm-backend

# 查看状态
sudo systemctl status lsm-backend

# 查看日志
journalctl -u lsm-backend -f
```

#### Docker 管理

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 查看日志
docker-compose logs -f backend

# 重启服务
docker-compose restart backend

# 查看资源使用
docker stats
```

#### 数据库管理

```bash
# 备份数据库
pg_dump -U lsm -h localhost lsm > backup.sql

# 恢复数据库
psql -U lsm -h localhost lsm < backup.sql

# 查看连接
psql -U lsm -d lsm -c "SELECT * FROM pg_stat_activity;"

# 终止连接
psql -U lsm -d lsm -c "SELECT pg_terminate_backend(pid);"
```

### B. 联系人列表

| 角色 | 姓名 | 电话 | 邮箱 |
|------|------|------|------|
| On-call | 张三 | 138-xxxx-xxxx | zhangsan@example.com |
| DevOps 负责人 | 李四 | 139-xxxx-xxxx | lisi@example.com |
| 技术负责人 | 王五 | 137-xxxx-xxxx | wangwu@example.com |
| 产品经理 | 赵六 | 136-xxxx-xxxx | zhaoliu@example.com |

### C. 外部依赖

| 服务 | URL | 状态页面 |
|------|-----|---------|
| SMTP | smtp.example.com:587 | - |
| PostgreSQL | localhost:5432 | - |
| Redis | localhost:6379 | - |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | - |

---

**文档版本**: 3.0.0  
**创建日期**: 2026-03-13  
**维护者**: LSM DevOps 团队  
**下次审查**: 2026-04-13
