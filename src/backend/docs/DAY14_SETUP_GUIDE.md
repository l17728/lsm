# Day 14 配置指南

## 📋 目录

1. [环境变量配置](#环境变量配置)
2. [数据库主从配置](#数据库主从配置)
3. [Redis 配置](#redis 配置)
4. [Nginx 负载均衡配置](#nginx 负载均衡配置)
5. [Docker Compose 配置](#docker-compose 配置)
6. [使用示例](#使用示例)

---

## 环境变量配置

### .env 文件

```bash
# ==================== 数据库配置 ====================

# 主数据库 (写操作)
DATABASE_URL=postgresql://lsm_user:lsm_pass@localhost:5432/lsm?schema=public

# 从数据库 (读操作，逗号分隔多个)
DATABASE_REPLICA_URLS=postgresql://lsm_user:lsm_pass@replica1:5432/lsm,postgresql://lsm_user:lsm_pass@replica2:5432/lsm

# 启用读写分离
ENABLE_READ_REPLICA=true

# 慢查询阈值 (毫秒)
READ_QUERY_THRESHOLD=100

# ==================== Redis 配置 ====================

# Redis URL (用于会话和消息队列)
REDIS_URL=redis://localhost:6379

# ==================== WebSocket 配置 ====================

# WebSocket 启用
WEBSOCKET_ENABLED=true

# WebSocket 心跳间隔 (毫秒)
WEBSOCKET_HEARTBEAT_INTERVAL=30000

# ==================== 通知配置 ====================

# 邮件通知
EMAIL_NOTIFICATIONS_ENABLED=true

# 钉钉通知
DINGTALK_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx

# 通知清理天数
NOTIFICATION_CLEANUP_DAYS=30

# ==================== 队列配置 ====================

# 队列并发处理数
QUEUE_CONCURRENCY=3

# 队列最大重试次数
QUEUE_MAX_RETRIES=3

# 队列任务超时 (毫秒)
QUEUE_TIMEOUT=30000

# ==================== 其他配置 ====================

# CORS 来源
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# 日志级别
LOG_LEVEL=info
```

---

## 数据库主从配置

### 1. 主库配置 (docker-compose.yml)

```yaml
services:
  db-primary:
    image: postgres:15-alpine
    container_name: lsm-db-primary
    environment:
      POSTGRES_USER: lsm_user
      POSTGRES_PASSWORD: lsm_pass
      POSTGRES_DB: lsm
    ports:
      - "5432:5432"
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data
      - ./postgres-primary.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    networks:
      - lsm-network

volumes:
  postgres_primary_data:
```

### 2. 从库配置 (docker-compose.yml)

```yaml
services:
  db-replica-1:
    image: postgres:15-alpine
    container_name: lsm-db-replica-1
    environment:
      POSTGRES_USER: lsm_user
      POSTGRES_PASSWORD: lsm_pass
      POSTGRES_DB: lsm
    ports:
      - "5433:5432"
    volumes:
      - postgres_replica1_data:/var/lib/postgresql/data
    command: >
      bash -c "
      pg_basebackup -h db-primary -U replication_user -D /var/lib/postgresql/data -Fp -Xs -P -R
      && postgres -c config_file=/etc/postgresql/postgresql.conf
      "
    depends_on:
      - db-primary
    networks:
      - lsm-network

volumes:
  postgres_replica1_data:
```

### 3. 主库配置文件 (postgres-primary.conf)

```conf
# 基础配置
listen_addresses = '*'
port = 5432
max_connections = 200

# WAL 配置
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1GB

# 归档配置
archive_mode = on
archive_command = 'test ! -f /var/lib/postgresql/archive/%f && cp %p /var/lib/postgresql/archive/%f'

# 复制槽
max_replication_slots = 10

# 同步提交
synchronous_standby_names = 'ANY 1 (db-replica-1, db-replica-2)'
```

### 4. 从库配置文件 (postgres-replica.conf)

```conf
# 基础配置
listen_addresses = '*'
port = 5432
max_connections = 200

# 热备配置
hot_standby = on
hot_standby_feedback = on

# 复制配置
primary_conninfo = 'host=db-primary port=5432 user=replication_user password=replication_pass'
primary_slot_name = 'replica1_slot'
```

### 5. 创建复制用户

```sql
-- 在主库执行
CREATE USER replication_user WITH REPLICATION ENCRYPTED PASSWORD 'replication_pass';
SELECT pg_create_physical_replication_slot('replica1_slot');
SELECT pg_create_physical_replication_slot('replica2_slot');
```

---

## Redis 配置

### 1. Redis 配置 (docker-compose.yml)

```yaml
services:
  redis:
    image: redis:7-alpine
    container_name: lsm-redis
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - lsm-network

volumes:
  redis_data:
```

### 2. Redis 高可用配置 (可选 - Sentinel)

```yaml
services:
  redis-master:
    image: redis:7-alpine
    container_name: lsm-redis-master
    ports:
      - "6379:6379"
    volumes:
      - redis_master_data:/data

  redis-slave:
    image: redis:7-alpine
    container_name: lsm-redis-slave
    command: redis-server --slaveof redis-master 6379
    ports:
      - "6380:6379"
    depends_on:
      - redis-master

  redis-sentinel:
    image: redis:7-alpine
    container_name: lsm-redis-sentinel
    command: redis-sentinel /usr/local/etc/redis/sentinel.conf
    ports:
      - "26379:26379"
    volumes:
      - ./sentinel.conf:/usr/local/etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-slave

volumes:
  redis_master_data:
```

### 3. Sentinel 配置 (sentinel.conf)

```conf
sentinel monitor mymaster redis-master 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
```

---

## Nginx 负载均衡配置

### 1. Nginx 配置 (nginx.conf)

```nginx
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for" '
                    'rt=$request_time uct="$upstream_connect_time" '
                    'uht="$upstream_header_time" urt="$upstream_response_time"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # 后端服务器池
    upstream lsm_backend {
        least_conn;  # 最少连接数优先
        
        server backend-1:3001 weight=1 max_fails=3 fail_timeout=30s;
        server backend-2:3002 weight=1 max_fails=3 fail_timeout=30s;
        server backend-3:3003 weight=1 max_fails=3 fail_timeout=30s;
        
        keepalive 32;
    }

    # WebSocket 支持
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }

    server {
        listen 80;
        server_name localhost;

        # 静态文件
        location /static/ {
            alias /usr/share/nginx/html/;
            expires 30d;
            add_header Cache-Control "public, immutable";
        }

        # API 代理
        location /api/ {
            proxy_pass http://lsm_backend;
            proxy_http_version 1.1;
            
            # 头部设置
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket 支持
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            
            # 超时设置
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # 缓冲设置
            proxy_buffering off;
            proxy_cache_bypass $http_upgrade;
        }

        # WebSocket 专用路径
        location /ws/ {
            proxy_pass http://lsm_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
        }

        # 健康检查
        location /health {
            proxy_pass http://lsm_backend;
            access_log off;
        }
    }
}
```

### 2. Docker Compose 中的 Nginx

```yaml
services:
  nginx:
    image: nginx:alpine
    container_name: lsm-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend-1
      - backend-2
      - backend-3
    networks:
      - lsm-network
    restart: always
```

---

## Docker Compose 配置

### 完整配置 (docker-compose.prod.yml)

```yaml
version: '3.8'

services:
  # ==================== 数据库层 ====================
  
  db-primary:
    image: postgres:15-alpine
    container_name: lsm-db-primary
    environment:
      POSTGRES_USER: lsm_user
      POSTGRES_PASSWORD: lsm_pass
      POSTGRES_DB: lsm
    volumes:
      - postgres_primary_data:/var/lib/postgresql/data
      - ./postgres-primary.conf:/etc/postgresql/postgresql.conf
    networks:
      - lsm-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lsm_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  db-replica-1:
    image: postgres:15-alpine
    container_name: lsm-db-replica-1
    environment:
      POSTGRES_USER: lsm_user
      POSTGRES_PASSWORD: lsm_pass
      POSTGRES_DB: lsm
    volumes:
      - postgres_replica1_data:/var/lib/postgresql/data
    depends_on:
      - db-primary
    networks:
      - lsm-network

  # ==================== 缓存层 ====================
  
  redis:
    image: redis:7-alpine
    container_name: lsm-redis
    command: redis-server --appendonly yes --maxmemory 256mb
    volumes:
      - redis_data:/data
    networks:
      - lsm-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== 应用层 ====================
  
  backend-1:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    container_name: lsm-backend-1
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://lsm_user:lsm_pass@db-primary:5432/lsm
      DATABASE_REPLICA_URLS: postgresql://lsm_user:lsm_pass@db-replica-1:5432/lsm
      ENABLE_READ_REPLICA: "true"
      REDIS_URL: redis://redis:6379
      CORS_ORIGINS: http://localhost
    depends_on:
      - db-primary
      - redis
    networks:
      - lsm-network
    restart: always

  backend-2:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    container_name: lsm-backend-2
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://lsm_user:lsm_pass@db-primary:5432/lsm
      DATABASE_REPLICA_URLS: postgresql://lsm_user:lsm_pass@db-replica-1:5432/lsm
      ENABLE_READ_REPLICA: "true"
      REDIS_URL: redis://redis:6379
      CORS_ORIGINS: http://localhost
    depends_on:
      - db-primary
      - redis
    networks:
      - lsm-network
    restart: always

  backend-3:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    container_name: lsm-backend-3
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://lsm_user:lsm_pass@db-primary:5432/lsm
      DATABASE_REPLICA_URLS: postgresql://lsm_user:lsm_pass@db-replica-1:5432/lsm
      ENABLE_READ_REPLICA: "true"
      REDIS_URL: redis://redis:6379
      CORS_ORIGINS: http://localhost
    depends_on:
      - db-primary
      - redis
    networks:
      - lsm-network
    restart: always

  # ==================== 负载均衡层 ====================
  
  nginx:
    image: nginx:alpine
    container_name: lsm-nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend-1
      - backend-2
      - backend-3
    networks:
      - lsm-network
    restart: always

  # ==================== 监控层 ====================
  
  prometheus:
    image: prom/prometheus:latest
    container_name: lsm-prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    ports:
      - "9090:9090"
    networks:
      - lsm-network

  grafana:
    image: grafana/grafana:latest
    container_name: lsm-grafana
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    networks:
      - lsm-network

volumes:
  postgres_primary_data:
  postgres_replica1_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  lsm-network:
    driver: bridge
```

---

## 使用示例

### 1. 启动完整环境

```bash
# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose -f docker-compose.prod.yml ps

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f backend-1
```

### 2. 数据库迁移

```bash
# 进入后端容器
docker exec -it lsm-backend-1 bash

# 运行迁移
npx prisma migrate deploy

# 生成客户端
npx prisma generate
```

### 3. 测试读写分离

```bash
# 测试写操作 (主库)
curl -X POST http://localhost/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"test-server","status":"ONLINE"}'

# 测试读操作 (从库)
curl http://localhost/api/servers \
  -H "Authorization: Bearer $TOKEN"

# 查看数据库连接状态
curl http://localhost/api/monitoring/health
```

### 4. 测试消息队列

```bash
# 添加邮件任务
curl -X POST http://localhost/api/queue/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "to": "user@example.com",
    "subject": "Test Email",
    "body": "Hello from LSM!"
  }'

# 查看队列统计
curl http://localhost/api/queue/stats \
  -H "Authorization: Bearer $TOKEN"
```

### 5. 测试 WebSocket 通知

```javascript
// 前端连接
const socket = io('http://localhost', {
  auth: {
    token: 'YOUR_TOKEN',
    userId: 'YOUR_USER_ID',
    username: 'YOUR_USERNAME',
  },
});

// 订阅频道
socket.on('connect', () => {
  socket.emit('subscribe:servers');
  socket.emit('subscribe:gpus');
  socket.emit('subscribe:tasks');
});

// 接收通知
socket.on('notification:alert', (data) => {
  console.log('收到告警:', data);
});

socket.on('notification:batch', (data) => {
  console.log('批量操作进度:', data);
});

socket.on('notification:system', (data) => {
  console.log('系统通知:', data);
});
```

### 6. 查看通知历史

```bash
# 获取通知历史
curl http://localhost/api/notification-history/history?page=1&limit=20 \
  -H "Authorization: Bearer $TOKEN"

# 获取未读数量
curl http://localhost/api/notification-history/unread-count \
  -H "Authorization: Bearer $TOKEN"

# 获取统计信息
curl http://localhost/api/notification-history/stats \
  -H "Authorization: Bearer $TOKEN"

# 标记全部已读
curl -X PUT http://localhost/api/notification-history/read-all \
  -H "Authorization: Bearer $TOKEN"
```

### 7. 监控和故障排查

```bash
# 查看复制延迟
docker exec -it lsm-db-primary psql -U lsm_user -d lsm -c \
  "SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn \
   FROM pg_stat_replication;"

# 查看 Redis 队列
docker exec -it lsm-redis redis-cli XLEN queue:email
docker exec -it lsm-redis redis-cli XLEN queue:export

# 查看死信队列
docker exec -it lsm-redis redis-cli XRANGE queue:email:dead - +

# 查看 Nginx 状态
curl http://localhost/nginx_status

# 查看后端健康
curl http://localhost/health
```

---

## 故障转移手册

### 主库故障转移

```bash
# 1. 检测主库故障
docker exec lsm-db-primary pg_isready
# 如果返回非 0，说明主库故障

# 2. 提升从库为主库
docker exec -it lsm-db-replica-1 psql -U lsm_user -c \
  "SELECT pg_promote();"

# 3. 更新应用配置
# 修改 DATABASE_URL 指向新的主库
# DATABASE_URL=postgresql://lsm_user:lsm_pass@db-replica-1:5432/lsm

# 4. 重启应用
docker-compose restart backend-1 backend-2 backend-3

# 5. 验证写操作
curl -X POST http://localhost/api/servers ...
```

### Redis 故障转移 (Sentinel 模式)

```bash
# 1. 查看 Sentinel 状态
docker exec -it lsm-redis-sentinel redis-cli -p 26379 sentinel master mymaster

# 2. 查看从库状态
docker exec -it lsm-redis-sentinel redis-cli -p 26379 sentinel slaves mymaster

# 3. 手动故障转移
docker exec -it lsm-redis-sentinel redis-cli -p 26379 \
  sentinel failover mymaster

# 4. 验证新的主库
docker exec -it lsm-redis-sentinel redis-cli -p 26379 \
  sentinel get-master-addr-by-name mymaster
```

---

## 性能调优建议

### 数据库调优

```conf
# postgresql.conf
shared_buffers = 256MB
effective_cache_size = 768MB
work_mem = 16MB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

### Redis 调优

```conf
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

### Nginx 调优

```nginx
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    multi_accept on;
    use epoll;
}

http {
    open_file_cache max=20000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
}
```

---

*Last Updated: 2026-03-14*  
*LSM Project - Phase 4: Production Deployment & Feature Enhancement*
