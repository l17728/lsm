# LSM 项目部署指南

**版本**: 3.2.0  
**最后更新**: 2026-03-13  
**状态**: 生产就绪

---

## 📚 目录

1. [部署前准备](#部署前准备)
2. [Redis 缓存部署](#redis-缓存部署)
3. [Prometheus+Grafana 部署](#prometheusgrafana-部署)
4. [邮件服务配置](#邮件服务配置)
5. [缓存优化配置](#缓存优化配置)
6. [Docker 部署](#docker-部署)
7. [生产环境检查清单](#生产环境检查清单)
8. [故障排查](#故障排查)

---

## 部署前准备

### 系统要求

| 组件 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 4 核 | 8 核+ |
| 内存 | 8GB | 16GB+ |
| 磁盘 | 50GB | 100GB+ SSD |
| 网络 | 100Mbps | 1Gbps |

### 软件依赖

```bash
# Node.js 20+
node -v  # v20.0.0+

# PostgreSQL 14+
psql --version  # 14.0+

# Redis 7+
redis-cli --version  # 7.0+

# Docker (可选)
docker --version  # 24.0+
docker-compose --version  # 2.20+
```

---

## Redis 缓存部署

### 安装 Redis

#### Ubuntu/Debian

```bash
# 安装 Redis
sudo apt update
sudo apt install redis-server

# 验证安装
redis-cli --version

# 启动服务
sudo systemctl start redis
sudo systemctl enable redis
```

#### CentOS/RHEL

```bash
# 安装 EPEL 仓库
sudo yum install epel-release

# 安装 Redis
sudo yum install redis

# 启动服务
sudo systemctl start redis
sudo systemctl enable redis
```

#### Docker 部署

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine
```

### Redis 配置优化

编辑 `/etc/redis/redis.conf`:

```conf
# 基础配置
bind 127.0.0.1
port 6379
timeout 0
tcp-keepalive 300

# 持久化
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /var/lib/redis

# 内存管理
maxmemory 2gb
maxmemory-policy allkeys-lru

# 性能优化
tcp-backlog 511
hash-max-ziplist-entries 512
hash-max-ziplist-value 64
list-max-ziplist-size -2
set-max-intset-entries 512
zset-max-ziplist-entries 128
zset-max-ziplist-value 64
activerehashing yes
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# 日志
loglevel notice
logfile /var/log/redis/redis-server.log

# 安全
requirepass your-strong-password
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
```

### Redis 性能测试

```bash
# 安装 redis-benchmark
sudo apt install redis-tools

# 运行基准测试
redis-benchmark -h localhost -p 6379 -q

# 测试 SET 性能
redis-benchmark -t set -n 100000 -q

# 测试 GET 性能
redis-benchmark -t get -n 100000 -q

# 预期结果:
# SET: ~8500 ops/sec
# GET: ~12000 ops/sec
```

### Redis 监控

```bash
# 查看 Redis 信息
redis-cli info

# 查看内存使用
redis-cli info memory

# 查看命中率
redis-cli info stats | grep keyspace

# 实时监控
redis-cli --stat

# 慢查询日志
redis-cli config set slowlog-log-slower-than 10000
redis-cli slowlog get 10
```

---

## Prometheus+Grafana 部署

### Prometheus 部署

#### 创建配置文件

创建 `prometheus.yml`:

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

#### Docker 部署 Prometheus

```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v prometheus-data:/prometheus \
  prom/prometheus:latest
```

### Grafana 部署

#### Docker 部署 Grafana

```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana:latest
```

#### 配置 Prometheus 数据源

1. 登录 Grafana (http://localhost:3000)
2. 默认账号：admin / admin
3. 进入 Configuration → Data Sources
4. 添加 Prometheus 数据源
   - URL: http://prometheus:9090
   - Access: Server

#### 导入仪表盘

1. 进入 Dashboards → Import
2. 上传 `monitoring/grafana-dashboard.json`
3. 选择 Prometheus 数据源
4. 点击 Import

### 告警规则配置

创建 `alerts.yml`:

```yaml
groups:
  - name: lsm-alerts
    rules:
      - alert: HighCPUUsage
        expr: lsm_health_memory_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高 CPU 使用率"
          description: "CPU 使用率超过 90% 持续 5 分钟"

      - alert: HighMemoryUsage
        expr: lsm_health_memory_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高内存使用率"
          description: "内存使用率超过 90% 持续 5 分钟"

      - alert: DatabaseDown
        expr: lsm_health_database == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "数据库不可用"
          description: "数据库连接失败"

      - alert: RedisDown
        expr: lsm_health_redis == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Redis 不可用"
          description: "Redis 连接失败"

      - alert: LowCacheHitRate
        expr: lsm_cache_hit_rate_percent < 80
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "缓存命中率低"
          description: "缓存命中率低于 80%"

      - alert: HighErrorRate
        expr: rate(lsm_app_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高错误率"
          description: "API 错误率超过 5%"
```

### 通知渠道配置

#### 邮件通知

在 Grafana 配置文件中添加:

```ini
[smtp]
enabled = true
host = smtp.example.com:587
user = alert@example.com
password = your-password
from_address = alert@example.com
```

#### Webhook 通知

```yaml
# 钉钉 webhook
- alert: CriticalAlert
  annotations:
    webhook_url: https://oapi.dingtalk.com/robot/send?access_token=xxx
```

---

## 邮件服务配置

### SMTP 配置

#### 环境变量配置

在 `.env` 文件中配置:

```env
# SMTP 配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-password
SMTP_FROM="LSM System <noreply@example.com>"

# TLS 配置
SMTP_TLS_ENABLED=true
SMTP_TLS_REJECT_UNAUTHORIZED=false
```

#### 常见 SMTP 服务商配置

**Gmail**:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

**QQ 邮箱**:
```env
SMTP_HOST=smtp.qq.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-qq@qq.com
SMTP_PASSWORD=your-auth-code
```

**企业邮箱**:
```env
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=user@company.com
SMTP_PASSWORD=your-password
```

### 邮件模板配置

邮件模板位于 `backend/src/email-templates/`:

```
email-templates/
├── task_assigned.hbs
├── task_completed.hbs
├── gpu_allocated.hbs
├── gpu_released.hbs
├── system_alert.hbs
└── welcome.hbs
```

### 测试邮件发送

```bash
# 使用 API 测试
curl -X POST http://localhost:4000/api/notifications/email/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "测试邮件",
    "template": "welcome",
    "data": {
      "username": "Test User"
    }
  }'
```

---

## 缓存优化配置

### TTL 策略配置

在 `backend/src/services/cache.service.ts` 中配置:

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

### 缓存预热策略

创建 `scripts/cache-warm.ts`:

```typescript
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

### 定时缓存刷新

使用 cron 任务定时刷新:

```bash
# 编辑 crontab
crontab -e

# 添加定时任务 (每 5 分钟刷新一次)
*/5 * * * * cd /path/to/lsm-project && node scripts/cache-warm.ts
```

### 缓存监控

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

---

## Docker 部署

### Docker Compose 配置

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:14-alpine
    container_name: lsm-postgres
    environment:
      POSTGRES_USER: lsm
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: lsm
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lsm"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: lsm-redis
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # 后端服务
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: lsm-backend
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://lsm:${DB_PASSWORD}@postgres:5432/lsm
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
      - /app/node_modules

  # 前端服务
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: lsm-frontend
    environment:
      VITE_API_BASE_URL: http://localhost:4000/api
      VITE_WS_URL: ws://localhost:4000
    ports:
      - "80:80"
    depends_on:
      - backend

  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: lsm-prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: lsm-grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
      - ./monitoring/grafana-dashboard.json:/etc/grafana/provisioning/dashboards/dashboard.json
    ports:
      - "3000:3000"
    depends_on:
      - prometheus

volumes:
  postgres-data:
  redis-data:
  prometheus-data:
  grafana-data:
```

### 部署步骤

```bash
# 1. 克隆项目
git clone https://github.com/your-org/lsm-project.git
cd lsm-project

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，设置密码和配置

# 3. 启动所有服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 验证服务状态
docker-compose ps

# 6. 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 7. 生成 Prisma 客户端
docker-compose exec backend npx prisma generate
```

### 服务访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost | Web 界面 |
| 后端 API | http://localhost:4000/api | REST API |
| Prometheus | http://localhost:9090 | 监控指标 |
| Grafana | http://localhost:3000 | 监控仪表盘 |

---

## 生产环境检查清单

### 安全检查

- [ ] 所有密码已更改为强密码
- [ ] JWT_SECRET 已设置为随机字符串
- [ ] HTTPS 已配置 (生产环境)
- [ ] 防火墙规则已配置
- [ ] 速率限制已启用 (见下方配置)
- [ ] CORS 白名单已配置
- [ ] 审计日志已启用
- [ ] 依赖漏洞已扫描

---

## 限流配置

### 概述

LSM 系统提供两层限流保护：
1. **API 限流** - 限制所有 API 端点的请求频率
2. **认证限流** - 专门针对登录/注册等认证端点的严格限流

### 默认配置

**开发环境：限流默认关闭**

为了便于开发和测试，限流功能在开发环境下默认关闭。这意味着：
- 开发时不会因为频繁请求而被限制
- E2E 测试可以正常执行
- 调试时不会受到限流干扰

### 生产环境启用限流

**⚠️ 重要：生产环境必须启用限流以防止暴力破解和 DDoS 攻击**

在 `.env` 文件中添加以下配置：

```env
# 限流配置 - 生产环境必须启用
RATE_LIMIT_ENABLED=true        # 启用 API 限流 (15分钟内最多100次请求)
AUTH_RATE_LIMIT_ENABLED=true   # 启用认证限流 (15分钟内最多20次登录尝试)
```

### 限流参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `RATE_LIMIT_ENABLED` | `false` | 是否启用 API 全局限流 |
| `AUTH_RATE_LIMIT_ENABLED` | `false` | 是否启用认证端点限流 |
| API 限流窗口 | 15 分钟 | 时间窗口 |
| API 限流上限 | 100 次 | 每个 IP 在窗口内最大请求数 |
| 认证限流窗口 | 15 分钟 | 认证端点时间窗口 |
| 认证限流上限 | 20 次 | 每个 IP 在窗口内最大登录尝试 |

### 限流响应

当触发限流时，API 返回以下响应：

```json
// API 限流
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later."
  }
}

// 认证限流
{
  "success": false,
  "error": {
    "code": "AUTH_RATE_LIMIT_EXCEEDED",
    "message": "Too many authentication attempts, please try again later."
  }
}
```

### 响应头信息

限流启用后，响应头会包含限流状态：

```
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Policy: 100;w=900
```

### 验证限流是否生效

```bash
# 检查响应头是否包含 RateLimit 信息
curl -I http://localhost:8080/api/servers

# 如果看到 RateLimit-Limit 头，说明限流已启用
# 如果没有看到，说明限流未启用
```

### 生产部署检查清单

- [ ] `RATE_LIMIT_ENABLED=true` 已设置
- [ ] `AUTH_RATE_LIMIT_ENABLED=true` 已设置
- [ ] 验证限流响应头正常返回
- [ ] 测试触发限流后的错误响应

### 性能检查

- [ ] Redis 缓存已配置
- [ ] 数据库索引已优化
- [ ] 静态资源已启用 CDN
- [ ] Gzip 压缩已启用
- [ ] 连接池已优化
- [ ] 缓存命中率 > 85%

### 监控检查

- [ ] Prometheus 已部署
- [ ] Grafana 仪表盘已配置
- [ ] 告警规则已设置
- [ ] 通知渠道已配置
- [ ] 日志收集已启用

### 备份检查

- [ ] 数据库自动备份已配置
- [ ] 备份恢复测试已通过
- [ ] 灾难恢复计划已制定

---

## 数据库迁移步骤

### 1. 准备迁移

```bash
# 进入后端目录
cd backend

# 备份当前数据库
pg_dump -U lsm -h localhost lsm > backup_$(date +%Y%m%d_%H%M%S).sql

# 检查当前迁移状态
npx prisma migrate status
```

### 2. 执行迁移

```bash
# 开发环境迁移
npx prisma migrate dev

# 生产环境迁移
npx prisma migrate deploy

# 生成 Prisma 客户端
npx prisma generate
```

### 3. 验证迁移

```bash
# 检查数据库 Schema
npx prisma db pull

# 验证数据完整性
npx prisma db seed
```

### 4. 回滚迁移 (如需要)

```bash
# 回滚到上一个迁移
npx prisma migrate resolve --rolled-back

# 或者回滚特定步骤
npx prisma migrate resolve --applied <migration_name>
```

---

## 回滚和备份策略

### 备份策略

#### 数据库备份

```bash
# 每日自动备份 (crontab)
0 2 * * * pg_dump -U lsm -h localhost lsm | gzip > /backups/lsm_$(date +\%Y\%m\%d).sql.gz

# 手动备份
pg_dump -U lsm -h localhost lsm | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# 验证备份
gunzip -c backup_20260313_020000.sql.gz | psql -U lsm -h localhost -d lsm_test
```

#### 应用备份

```bash
# 备份应用代码
tar -czf lsm-app-$(date +%Y%m%d).tar.gz /path/to/lsm-project

# 备份配置文件
cp -r /path/to/lsm-project/config /backups/config_$(date +%Y%m%d)

# 备份环境变量
cp /path/to/lsm-project/.env /backups/env_$(date +%Y%m%d)
```

### 恢复策略

#### 数据库恢复

```bash
# 从备份恢复
gunzip -c backup_20260313_020000.sql.gz | psql -U lsm -h localhost lsm

# 验证恢复
psql -U lsm -h localhost -c "SELECT COUNT(*) FROM users;" -d lsm
```

#### 应用回滚

```bash
# 停止当前服务
docker-compose down

# 恢复代码
tar -xzf lsm-app-20260312.tar.gz -C /path/to/

# 恢复配置
cp /backups/env_20260312 /path/to/lsm-project/.env

# 重启服务
docker-compose up -d
```

### 灾难恢复计划

#### 1. 评估损害

- 确定问题范围
- 检查备份可用性
- 评估恢复时间目标 (RTO)

#### 2. 通知相关人员

- 发送事故通知
- 建立沟通渠道
- 更新状态页面

#### 3. 执行恢复

- 按优先级恢复服务
- 验证数据完整性
- 监控系统状态

#### 4. 事后总结

- 记录事故原因
- 更新应急预案
- 实施预防措施

---

## 故障排查

### Redis 连接失败

```bash
# 检查 Redis 服务状态
sudo systemctl status redis

# 测试连接
redis-cli ping

# 查看日志
sudo tail -f /var/log/redis/redis-server.log

# 重启服务
sudo systemctl restart redis
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 测试连接
psql -U lsm -d lsm -h localhost

# 查看连接数
psql -U lsm -d lsm -c "SELECT count(*) FROM pg_stat_activity;"

# 重启服务
sudo systemctl restart postgresql
```

### 邮件发送失败

```bash
# 测试 SMTP 连接
telnet smtp.example.com 587

# 检查邮件队列
curl http://localhost:4000/api/notifications/email/queue

# 查看后端日志
docker-compose logs backend | grep -i email
```

### 缓存命中率低

```bash
# 查看缓存统计
curl http://localhost:4000/api/cache/stats

# 检查 TTL 配置
# 调整 cache.service.ts 中的 TTL 值

# 清除缓存并预热
curl -X DELETE http://localhost:4000/api/cache/clear
curl -X POST http://localhost:4000/api/cache/warm
```

### 监控指标缺失

```bash
# 检查 Prometheus 目标状态
# 访问 http://localhost:9090/targets

# 测试 metrics 端点
curl http://localhost:4000/metrics

# 重启 Prometheus
docker-compose restart prometheus
```

---

## 性能优化建议

### 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_gpus_status ON gpus(status);
CREATE INDEX idx_servers_status ON servers(status);

-- 分析表
ANALYZE tasks;
ANALYZE gpus;
ANALYZE servers;
```

### 应用优化

```typescript
// 启用连接池
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// 批量操作
await Promise.all([
  cache.set('key1', value1),
  cache.set('key2', value2),
  cache.set('key3', value3)
]);
```

### 前端优化

```bash
# 启用代码分割
npm run build -- --splitChunks

# 压缩图片
npm install -g imagemin-cli
imagemin src/images/* --out-dir=dist/images

# 启用 CDN
# 在 nginx 配置中设置静态资源 CDN
```

---

**文档版本**: 3.1.0  
**最后更新**: 2026-03-13  
**维护者**: DevOps 团队
