# LSM 运维手册 (Operations Manual)

**版本**: 3.1.0  
**最后更新**: 2026-03-15 (Day 18)  
**状态**: 生产就绪 ✅  
**维护团队**: DevOps 团队  
**项目**: LSM (Laboratory Server Management System)

---

## 📚 完整目录

### 第一部分 部署篇

- [第 1 章 环境准备](#第 1 章 - 环境准备)
- [第 2 章 Docker 部署](#第 2 章-docker-部署)
- [第 3 章 配置管理](#第 3 章 - 配置管理)
- [第 4 章 健康检查](#第 4 章 - 健康检查)

### 第二部分 监控篇

- [第 5 章 监控架构](#第 5 章 - 监控架构)
- [第 6 章 Prometheus 配置](#第 6 章-prometheus-配置)
- [第 7 章 Grafana 仪表盘](#第 7 章-grafana-仪表盘)
- [第 8 章 告警管理](#第 8 章 - 告警管理)

### 第三部分 维护篇

- [第 9 章 日志管理](#第 9 章 - 日志管理)
- [第 10 章 备份恢复](#第 10 章 - 备份恢复)
- [第 11 章 性能优化](#第 11 章 - 性能优化)
- [第 12 章 日常维护](#第 12 章 - 日常维护)

### 第四部分 应急篇

- [第 13 章 故障排查](#第 13 章 - 故障排查)
- [第 14 章 应急预案](#第 14 章 - 应急预案)
- [第 15 章 升级迁移](#第 15 章 - 升级迁移)

### 第五部分 v3.1.0 自动化运维篇

- [第 16 章 自动扩缩容服务运维](#第-16-章-自动扩缩容服务运维)
- [第 17 章 故障自愈服务运维](#第-17-章-故障自愈服务运维)
- [第 18 章 智能告警降噪服务运维](#第-18-章-智能告警降噪服务运维)

### 附录

- [附录 A 命令速查](#附录-a-命令速查)
- [附录 B 配置参考](#附录-b-配置参考)
- [附录 C 联系方式](#附录-c-联系方式)
- [附录 D v3.1.0 命令速查](#附录-d-v310-命令速查)

---

## 第一部分 部署篇

---

### 第 1 章 环境准备

#### 1.1 硬件要求

**最小配置** (开发/测试环境):

| 组件 | 要求 | 说明 |
|------|------|------|
| CPU | 4 核心 | 建议 8 核心+ |
| 内存 | 8 GB | 建议 16 GB+ |
| 存储 | 50 GB | SSD 推荐 |
| 网络 | 100 Mbps | 内网访问 |

**生产配置** (推荐):

| 组件 | 要求 | 说明 |
|------|------|------|
| CPU | 8 核心+ | 16 核心更佳 |
| 内存 | 16 GB+ | 32 GB 支持高并发 |
| 存储 | 200 GB SSD | 根据数据量调整 |
| 网络 | 1 Gbps | 外网访问需要 |
| 备份 | 独立存储 | 用于数据备份 |

**高可用配置**:

| 组件 | 要求 | 说明 |
|------|------|------|
| 应用服务器 | 2 台+ | 负载均衡 |
| 数据库 | 主从复制 | PostgreSQL HA |
| Redis | Sentinel 模式 | 高可用缓存 |
| 负载均衡 | Nginx/HAProxy | 流量分发 |

#### 1.2 软件要求

**操作系统**:

| 系统 | 版本 | 状态 |
|------|------|------|
| Ubuntu | 22.04 LTS | ✅ 推荐 |
| Ubuntu | 20.04 LTS | ✅ 支持 |
| CentOS | 8.x | ✅ 支持 |
| Debian | 11.x | ✅ 支持 |
| macOS | 12.x+ | ⚠️ 仅开发 |
| Windows | 10/11 | ⚠️ 仅开发 (WSL2) |

**必需软件**:

| 软件 | 版本 | 用途 |
|------|------|------|
| Docker | 24.x+ | 容器运行时 |
| Docker Compose | 2.20+ | 服务编排 |
| Git | 2.x+ | 版本控制 |
| Node.js | 20.x+ | 运行环境 (可选) |

**可选软件**:

| 软件 | 版本 | 用途 |
|------|------|------|
| kubectl | 1.28+ | Kubernetes 管理 |
| Helm | 3.x+ | K8s 包管理 |
| Terraform | 1.x+ | 基础设施即代码 |

#### 1.3 网络要求

**端口需求**:

| 端口 | 服务 | 协议 | 访问范围 |
|------|------|------|----------|
| 80 | Nginx (HTTP) | TCP | 外网 |
| 443 | Nginx (HTTPS) | TCP | 外网 |
| 3000 | 前端开发 | TCP | 内网 |
| 4000 | 后端 API | TCP | 内网 |
| 5432 | PostgreSQL | TCP | 内网 |
| 6379 | Redis | TCP | 内网 |
| 9090 | Prometheus | TCP | 内网 |
| 3001 | Grafana | TCP | 内网 |

**防火墙配置** (Ubuntu UFW):

```bash
# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 仅内网访问的服务
sudo ufw allow from 192.168.1.0/24 to any port 5432
sudo ufw allow from 192.168.1.0/24 to any port 6379

# 启用防火墙
sudo ufw enable
```

#### 1.4 系统优化

**内核参数优化** (`/etc/sysctl.conf`):

```bash
# 增加文件描述符限制
fs.file-max = 2097152

# 增加 TCP 连接队列
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# 启用 IP 转发 (如需)
net.ipv4.ip_forward = 1

# TCP 优化
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200

# 应用配置
sudo sysctl -p
```

**用户限制优化** (`/etc/security/limits.conf`):

```bash
# 增加打开文件数限制
* soft nofile 65535
* hard nofile 65535

# 增加进程数限制
* soft nproc 65535
* hard nproc 65535
```

#### 1.5 依赖检查脚本

**检查脚本** (`scripts/check-prerequisites.sh`):

```bash
#!/bin/bash

echo "🔍 检查系统依赖..."

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi
echo "✅ Docker $(docker --version)"

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi
echo "✅ Docker Compose $(docker-compose --version)"

# 检查 Git
if ! command -v git &> /dev/null; then
    echo "❌ Git 未安装"
    exit 1
fi
echo "✅ Git $(git --version)"

# 检查磁盘空间
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️  磁盘使用率过高：${DISK_USAGE}%"
else
    echo "✅ 磁盘使用率：${DISK_USAGE}%"
fi

# 检查内存
FREE_MEM=$(free -h | awk 'NR==2 {print $7}')
echo "✅ 可用内存：${FREE_MEM}"

echo ""
echo "✅ 所有检查通过！"
```

---

### 第 2 章 Docker 部署

#### 2.1 部署架构

**单节点部署** (开发/测试):

```
┌─────────────────────────────────────┐
│         单台服务器                   │
│  ┌──────────────────────────────┐   │
│  │   Docker Compose             │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ │   │
│  │  │前端  │ │后端  │ │ Nginx│ │   │
│  │  └──────┘ └──────┘ └──────┘ │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ │   │
│  │  │ PG   │ │Redis │ │Prom  │ │   │
│  │  └──────┘ └──────┘ └──────┘ │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**高可用部署** (生产):

```
                    ┌─────────────┐
                    │  负载均衡器  │
                    │   (Nginx)   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │  应用节点 1  │          │  应用节点 2  │
       │  (Docker)   │          │  (Docker)   │
       └──────┬──────┘          └──────┬──────┘
              │                         │
              └────────────┬────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │ PostgreSQL  │          │    Redis    │
       │   (主从)    │          │  (Sentinel) │
       └─────────────┘          └─────────────┘
```

#### 2.2 快速部署 (开发环境)

**Step 1: 克隆项目**

```bash
git clone https://github.com/l17728/lsm.git
cd lsm
```

**Step 2: 配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的环境变量
```

**Step 3: 启动服务**

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 检查服务状态
docker-compose ps
```

**Step 4: 数据库迁移**

```bash
# 运行迁移
docker-compose exec backend npx prisma migrate deploy

# 初始化数据 (可选)
docker-compose exec backend npx prisma db seed
```

**Step 5: 验证部署**

```bash
# 访问前端
curl http://localhost:3000

# 访问 API
curl http://localhost:4000/api/health

# 预期输出：{"status":"ok","timestamp":"..."}
```

#### 2.3 生产环境部署

**Step 1: 准备生产配置**

```bash
# 复制生产配置文件
cp docker-compose.prod.yml docker-compose.override.yml
cp .env.production .env

# 编辑生产配置
vim .env
```

**关键环境变量**:

```bash
# 数据库
DATABASE_URL=postgresql://user:password@db:5432/lsm_prod

# Redis
REDIS_URL=redis://redis:6379

# JWT 密钥 (必须修改！)
JWT_SECRET=your-super-secret-key-change-in-production

# 邮件配置
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_USER=notifications@your-domain.com
SMTP_PASSWORD=your-smtp-password

# SSL 证书
SSL_CERT_PATH=/etc/ssl/certs/lsm.crt
SSL_KEY_PATH=/etc/ssl/private/lsm.key
```

**Step 2: 配置 SSL/TLS**

```bash
# 创建 SSL 目录
sudo mkdir -p /etc/ssl/certs/lsm
sudo mkdir -p /etc/ssl/private/lsm

# 使用 Let's Encrypt (推荐)
sudo certbot certonly --standalone -d your-domain.com

# 复制证书
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /etc/ssl/certs/lsm/lsm.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /etc/ssl/private/lsm/lsm.key

# 设置权限
sudo chmod 644 /etc/ssl/certs/lsm/lsm.crt
sudo chmod 600 /etc/ssl/private/lsm/lsm.key
```

**Step 3: 启动生产服务**

```bash
# 使用生产配置启动
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose ps

# 查看资源使用
docker stats
```

**Step 4: 配置 Nginx**

```bash
# 复制 Nginx 配置
sudo cp config/nginx.conf /etc/nginx/sites-available/lsm

# 创建软链接
sudo ln -s /etc/nginx/sites-available/lsm /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

#### 2.4 服务管理

**启动/停止/重启**:

```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 重启所有服务
docker-compose restart

# 重启单个服务
docker-compose restart backend

# 停止并删除容器 (保留数据)
docker-compose down

# 停止并删除所有 (包括数据卷)
docker-compose down -v
```

**查看日志**:

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend

# 实时查看日志
docker-compose logs -f backend

# 查看最近 100 行
docker-compose logs --tail=100 backend
```

**进入容器**:

```bash
# 进入后端容器
docker-compose exec backend bash

# 进入数据库容器
docker-compose exec db psql -U lsm_user -d lsm

# 进入 Redis 容器
docker-compose exec redis redis-cli
```

#### 2.5 健康检查

**手动检查**:

```bash
# 检查所有服务状态
docker-compose ps

# 检查后端健康
curl http://localhost:4000/api/health

# 检查数据库连接
docker-compose exec backend npx prisma db pull

# 检查 Redis 连接
docker-compose exec redis redis-cli ping
# 预期输出：PONG
```

**自动化健康检查脚本**:

```bash
#!/bin/bash

echo "🏥 健康检查..."

# 检查容器状态
BACKEND_STATUS=$(docker-compose ps -q backend | wc -l)
if [ $BACKEND_STATUS -eq 0 ]; then
    echo "❌ 后端服务未运行"
    exit 1
fi
echo "✅ 后端服务运行中"

# 检查 API 健康
HEALTH=$(curl -s http://localhost:4000/api/health | jq -r '.status')
if [ "$HEALTH" != "ok" ]; then
    echo "❌ API 健康检查失败"
    exit 1
fi
echo "✅ API 健康"

# 检查数据库
DB_CHECK=$(docker-compose exec -T backend npx prisma db pull 2>&1)
if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败"
    exit 1
fi
echo "✅ 数据库连接正常"

# 检查 Redis
REDIS_CHECK=$(docker-compose exec -T redis redis-cli ping)
if [ "$REDIS_CHECK" != "PONG" ]; then
    echo "❌ Redis 连接失败"
    exit 1
fi
echo "✅ Redis 连接正常"

echo ""
echo "✅ 所有健康检查通过！"
```

---

### 第 3 章 配置管理

#### 3.1 环境变量

**核心环境变量**:

| 变量 | 说明 | 默认值 | 是否必需 |
|------|------|--------|----------|
| `NODE_ENV` | 运行环境 | production | ✅ |
| `PORT` | 后端端口 | 4000 | ✅ |
| `DATABASE_URL` | 数据库连接 | - | ✅ |
| `REDIS_URL` | Redis 连接 | - | ✅ |
| `JWT_SECRET` | JWT 密钥 | - | ✅ |
| `JWT_EXPIRES_IN` | JWT 过期时间 | 7d | ❌ |
| `FRONTEND_URL` | 前端地址 | http://localhost:3000 | ❌ |
| `CORS_ORIGINS` | CORS 允许来源 | * | ❌ |

**邮件配置**:

| 变量 | 说明 | 示例 |
|------|------|------|
| `SMTP_HOST` | SMTP 服务器 | smtp.gmail.com |
| `SMTP_PORT` | SMTP 端口 | 587 |
| `SMTP_USER` | SMTP 用户名 | notifications@domain.com |
| `SMTP_PASSWORD` | SMTP 密码 | your-password |
| `SMTP_FROM` | 发件人地址 | noreply@domain.com |

**监控配置**:

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PROMETHEUS_ENABLED` | 启用 Prometheus | true |
| `METRICS_PORT` | 指标端口 | 9090 |
| `LOG_LEVEL` | 日志级别 | info |

#### 3.2 配置文件

**Docker Compose 配置**:

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/lsm
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend

  db:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=lsm_user
      - POSTGRES_PASSWORD=secure_password
      - POSTGRES_DB=lsm
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lsm_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

#### 3.3 配置最佳实践

**安全建议**:

✅ **推荐**:
- 使用 `.env` 文件管理敏感信息
- 不要将 `.env` 提交到版本控制
- 生产环境使用强密码和密钥
- 定期轮换密钥
- 使用密钥管理服务 (如 AWS Secrets Manager)

❌ **避免**:
- 硬编码敏感信息
- 使用默认密码
- 将密钥提交到 Git
- 在不同环境使用相同密钥

**配置模板管理**:

```bash
# 创建配置模板
cp .env.example .env.development
cp .env.example .env.staging
cp .env.example .env.production

# 使用不同配置启动
docker-compose --env-file .env.development up -d
docker-compose --env-file .env.production up -d
```

---

### 第 4 章 健康检查

#### 4.1 健康检查端点

**API 健康检查**:

```bash
# 基础健康检查
GET /api/health

# 响应示例
{
  "status": "ok",
  "timestamp": "2026-03-14T10:30:00.000Z",
  "uptime": 86400,
  "services": {
    "database": "ok",
    "redis": "ok",
    "email": "ok"
  }
}
```

**详细健康检查**:

```bash
# 详细健康检查 (包含版本信息)
GET /api/health/detailed

# 响应示例
{
  "status": "ok",
  "version": "3.0.0",
  "nodeVersion": "v20.11.0",
  "platform": "linux",
  "memory": {
    "used": "256MB",
    "total": "512MB"
  },
  "services": {
    "database": {
      "status": "ok",
      "latency": "12ms"
    },
    "redis": {
      "status": "ok",
      "latency": "2ms"
    }
  }
}
```

#### 4.2 容器健康检查

**Docker 健康检查配置**:

```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lsm_user -d lsm"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**查看健康状态**:

```bash
# 查看所有容器健康状态
docker-compose ps

# 查看详细信息
docker inspect --format='{{.State.Health.Status}}' <container_id>

# 查看健康日志
docker inspect --format='{{json .State.Health}}' <container_id> | jq
```

#### 4.3 数据库健康检查

**PostgreSQL 检查**:

```bash
# 检查连接
docker-compose exec db pg_isready -U lsm_user -d lsm

# 检查数据库大小
docker-compose exec db psql -U lsm_user -d lsm -c "SELECT pg_size_pretty(pg_database_size('lsm'));"

# 检查连接数
docker-compose exec db psql -U lsm_user -d lsm -c "SELECT count(*) FROM pg_stat_activity;"

# 检查慢查询
docker-compose exec db psql -U lsm_user -d lsm -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 5;"
```

#### 4.4 Redis 健康检查

```bash
# 检查连接
docker-compose exec redis redis-cli ping

# 检查内存使用
docker-compose exec redis redis-cli INFO memory

# 检查连接数
docker-compose exec redis redis-cli INFO clients

# 检查持久化
docker-compose exec redis redis-cli INFO persistence

# 检查键数量
docker-compose exec redis redis-cli DBSIZE
```

---

## 第二部分 监控篇

---

### 第 5 章 监控架构

#### 5.1 监控体系

```
┌─────────────────────────────────────────────────────────────┐
│                      监控展示层                              │
│                    ┌─────────────┐                          │
│                    │   Grafana   │                          │
│                    │  (仪表盘)   │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                      告警通知层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 邮件通知    │  │ 站内信      │  │ 短信通知    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                    ┌─────────────┐                          │
│                    │Alertmanager │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                      数据采集层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Prometheus  │  │  Node       │  │  Redis      │         │
│  │  (应用指标) │  │  Exporter   │  │  Exporter   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────────┐
│                      数据源层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  后端服务   │  │  操作系统   │  │   Redis     │         │
│  │  (Metrics)  │  │  (Stats)    │  │   (Stats)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2 监控指标分类

**黄金四指标** (Golden Signals):

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| **延迟** (Latency) | 请求处理时间 | P95 > 1s |
| **流量** (Traffic) | 每秒请求数 | 突增/突降 > 50% |
| **错误** (Errors) | 错误率 | > 5% |
| **饱和度** (Saturation) | 资源使用率 | CPU/内存 > 90% |

**业务指标**:

| 指标 | 说明 | 关注点 |
|------|------|--------|
| 任务总数 | 系统总任务数 | 趋势分析 |
| 待处理任务 | 排队任务数 | > 100 告警 |
| GPU 分配率 | 已分配 GPU 比例 | > 90% 告警 |
| 活跃用户 | 当前在线用户 | 趋势分析 |

---

### 第 6 章 Prometheus 配置

#### 6.1 安装 Prometheus

**Docker Compose 配置**:

```yaml
# monitoring/prometheus.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.45.0
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    restart: unless-stopped

volumes:
  prometheus_data:
```

#### 6.2 抓取配置

**prometheus.yml**:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    monitor: 'lsm-monitor'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

rule_files:
  - 'alerts.yml'

scrape_configs:
  # Prometheus 自监控
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # 后端应用
  - job_name: 'lsm-backend'
    static_configs:
      - targets: ['backend:4000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Node Exporter (系统指标)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

#### 6.3 告警规则

**alerts.yml**:

```yaml
groups:
  - name: lsm-alerts
    rules:
      # 服务宕机告警
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "服务 {{ $labels.job }} 宕机"
          description: "{{ $labels.instance }} 的服务已宕机超过 1 分钟"

      # 高错误率告警
      - alert: HighErrorRate
        expr: rate(lsm_app_errors_total[5m]) / rate(lsm_app_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高错误率"
          description: "错误率超过 5% (当前值：{{ $value | humanizePercentage }})"

      # 高延迟告警
      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(lsm_app_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "高延迟"
          description: "P95 延迟超过 1 秒 (当前值：{{ $value | humanizeDuration }})"

      # CPU 使用率过高
      - alert: HighCPUUsage
        expr: lsm_health_cpu_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU 使用率过高"
          description: "CPU 使用率：{{ $value }}%"

      # 内存使用率过高
      - alert: HighMemoryUsage
        expr: lsm_health_memory_percent > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "内存使用率过高"
          description: "内存使用率：{{ $value }}%"

      # 磁盘使用率过高
      - alert: HighDiskUsage
        expr: lsm_health_disk_percent > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "磁盘使用率过高"
          description: "磁盘使用率：{{ $value }}%"

      # 待处理任务过多
      - alert: PendingTasksHigh
        expr: lsm_tasks_pending > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "待处理任务过多"
          description: "待处理任务数：{{ $value }}"

      # GPU 分配率过高
      - alert: GPUAllocationHigh
        expr: lsm_gpus_allocated / lsm_gpus_total > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "GPU 分配率过高"
          description: "GPU 分配率：{{ $value | humanizePercentage }}"
```

---

### 第 7 章 Grafana 仪表盘

#### 7.1 安装 Grafana

**Docker Compose 配置**:

```yaml
# monitoring/grafana.yml
version: '3.8'

services:
  grafana:
    image: grafana/grafana:10.0.0
    container_name: grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=secure_password
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3001:3000"
    restart: unless-stopped

volumes:
  grafana_data:
```

#### 7.2 数据源配置

**provisioning/datasources/prometheus.yml**:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
```

#### 7.3 仪表盘配置

**provisioning/dashboards/lsm.yml**:

```yaml
apiVersion: 1

providers:
  - name: 'LSM Dashboards'
    orgId: 1
    folder: 'LSM'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

#### 7.4 主要仪表盘

**系统概览仪表盘**:

| 面板 | 类型 | 指标 |
|------|------|------|
| 系统状态 | Stat | up |
| CPU 使用率 | Time series | lsm_health_cpu_percent |
| 内存使用率 | Time series | lsm_health_memory_percent |
| 磁盘使用率 | Time series | lsm_health_disk_percent |
| 请求量 | Time series | rate(lsm_app_requests_total[1m]) |
| 错误率 | Time series | error rate |

**性能监控仪表盘**:

| 面板 | 类型 | 指标 |
|------|------|------|
| P50 延迟 | Time series | histogram_quantile(0.5, ...) |
| P95 延迟 | Time series | histogram_quantile(0.95, ...) |
| P99 延迟 | Time series | histogram_quantile(0.99, ...) |
| 数据库查询时间 | Time series | db query duration |
| 缓存命中率 | Time series | lsm_cache_hit_rate_percent |

**业务监控仪表盘**:

| 面板 | 类型 | 指标 |
|------|------|------|
| 任务总数 | Stat | lsm_tasks_total |
| 待处理任务 | Time series | lsm_tasks_pending |
| GPU 分配状态 | Pie chart | lsm_gpus_allocated |
| 活跃用户 | Time series | lsm_users_active |

#### 7.5 访问仪表盘

1. 访问 `http://localhost:3001`
2. 登录：admin / secure_password
3. 进入 Dashboards → LSM 文件夹
4. 选择要查看的仪表盘

---

### 第 8 章 告警管理

#### 8.1 Alertmanager 配置

**alertmanager.yml**:

```yaml
global:
  smtp_smarthost: 'smtp.your-domain.com:587'
  smtp_from: 'alertmanager@your-domain.com'
  smtp_auth_username: 'alertmanager@your-domain.com'
  smtp_auth_password: 'your-password'

route:
  group_by: ['alertname', 'severity']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default-receiver'
  routes:
    - match:
        severity: critical
      receiver: 'critical-receiver'
    - match:
        severity: warning
      receiver: 'warning-receiver'

receivers:
  - name: 'default-receiver'
    email_configs:
      - to: 'ops-team@your-domain.com'
        send_resolved: true

  - name: 'critical-receiver'
    email_configs:
      - to: 'ops-team@your-domain.com'
        send_resolved: true
    webhook_configs:
      - url: 'http://your-webhook-url/alert'

  - name: 'warning-receiver'
    email_configs:
      - to: 'dev-team@your-domain.com'
        send_resolved: true

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'instance']
```

#### 8.2 告警级别

| 级别 | 说明 | 响应时间 | 通知方式 |
|------|------|----------|----------|
| **Critical** | 严重故障，服务不可用 | 立即 | 邮件 + 短信 + 电话 |
| **Warning** | 警告，需要关注 | 30 分钟内 | 邮件 + 站内信 |
| **Info** | 信息，无需立即处理 | 工作时间 | 站内信 |

#### 8.3 告警处理流程

```
1. 接收告警
   ↓
2. 确认告警 (Acknowledge)
   ↓
3. 评估影响
   ↓
4. 执行修复
   ↓
5. 验证恢复
   ↓
6. 关闭告警
   ↓
7. 事后分析 (Post-mortem)
```

---

## 第三部分 维护篇

---

### 第 9 章 日志管理

#### 9.1 日志架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   应用日志  │────▶│    Filebeat  │────▶│  Elasticsearch│
│  (stdout)   │     │  (采集)      │     │  (存储)      │
└─────────────┘     └──────────────┘     └─────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │    Kibana    │
                                       │  (展示)      │
                                       └──────────────┘
```

#### 9.2 日志级别

| 级别 | 说明 | 使用场景 |
|------|------|----------|
| **ERROR** | 错误 | 系统错误、异常 |
| **WARN** | 警告 | 潜在问题、降级 |
| **INFO** | 信息 | 正常操作、状态变更 |
| **DEBUG** | 调试 | 详细调试信息 |
| **TRACE** | 追踪 | 最详细追踪 |

#### 9.3 日志查看

**Docker 日志**:

```bash
# 查看后端日志
docker-compose logs backend

# 实时查看
docker-compose logs -f backend

# 查看最近 100 行
docker-compose logs --tail=100 backend

# 查看特定时间范围
docker-compose logs --since="2026-03-14T10:00:00" --until="2026-03-14T12:00:00" backend
```

**应用日志文件**:

```bash
# 查看日志文件
tail -f /var/log/lsm/backend.log

# 搜索错误日志
grep "ERROR" /var/log/lsm/backend.log

# 查看今天日志
cat /var/log/lsm/backend-$(date +%Y-%m-%d).log
```

#### 9.4 日志轮转

**logrotate 配置** (`/etc/logrotate.d/lsm`):

```
/var/log/lsm/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
    postrotate
        systemctl reload lsm-backend > /dev/null 2>&1 || true
    endscript
}
```

---

### 第 10 章 备份恢复

#### 10.1 备份策略

| 数据类型 | 频率 | 保留期 | 存储位置 |
|----------|------|--------|----------|
| 数据库 | 每日 | 30 天 | 本地 + 云存储 |
| Redis 数据 | 每周 | 7 天 | 本地 |
| 配置文件 | 变更时 | 永久 | Git + 本地 |
| 日志文件 | 每日 | 90 天 | 本地 + 云存储 |

#### 10.2 数据库备份

**完整备份**:

```bash
# 备份数据库
docker-compose exec db pg_dump -U lsm_user lsm > backup-$(date +%Y%m%d-%H%M%S).sql

# 压缩备份
docker-compose exec db pg_dump -U lsm_user lsm | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz

# 备份到指定目录
docker-compose exec db pg_dump -U lsm_user lsm > /backups/lsm-$(date +%Y%m%d).sql
```

**恢复数据库**:

```bash
# 从备份恢复
cat backup-20260314.sql | docker-compose exec -T db psql -U lsm_user -d lsm

# 从压缩备份恢复
gunzip -c backup-20260314.sql.gz | docker-compose exec -T db psql -U lsm_user -d lsm
```

#### 10.3 备份脚本

**自动备份脚本** (`scripts/backup.sh`):

```bash
#!/bin/bash

set -e

BACKUP_DIR="/backups/lsm"
DATE=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=30

echo "🗄️  开始备份..."

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
echo "📦 备份数据库..."
docker-compose exec -T db pg_dump -U lsm_user lsm | gzip > $BACKUP_DIR/db-$DATE.sql.gz

# 备份 Redis
echo "📦 备份 Redis..."
docker-compose exec -T redis redis-cli --rdb /tmp/redis-$DATE.rdb
docker cp $(docker-compose ps -q redis):/tmp/redis-$DATE.rdb $BACKUP_DIR/
rm /tmp/redis-$DATE.rdb

# 备份配置文件
echo "📦 备份配置..."
cp .env $BACKUP_DIR/env-$DATE
cp docker-compose.yml $BACKUP_DIR/docker-compose-$DATE.yml

# 删除过期备份
echo "🧹 清理过期备份..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete

# 计算备份大小
BACKUP_SIZE=$(du -sh $BACKUP_DIR | cut -f1)
echo "✅ 备份完成！总大小：$BACKUP_SIZE"

# 列出最新备份
echo ""
echo "📋 最新备份:"
ls -lh $BACKUP_DIR | tail -5
```

#### 10.4 恢复流程

**数据库恢复**:

```bash
# 1. 停止应用
docker-compose down

# 2. 恢复数据库
gunzip -c /backups/lsm/db-20260314-120000.sql.gz | docker-compose exec -T db psql -U lsm_user -d lsm

# 3. 启动服务
docker-compose up -d

# 4. 验证恢复
docker-compose exec backend npx prisma db pull
```

**恢复测试**:

```bash
# 在测试环境验证备份
docker-compose -f docker-compose.test.yml up -d
gunzip -c backup.sql.gz | docker-compose exec -T db psql -U lsm_user -d lsm
# 运行测试验证数据完整性
```

---

### 第 11 章 性能优化

#### 11.1 数据库优化

**索引优化**:

```sql
-- 查看慢查询
SELECT query, calls, total_time, rows
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- 添加索引
CREATE INDEX CONCURRENTLY idx_tasks_status ON tasks(status);
CREATE INDEX CONCURRENTLY idx_tasks_created_at ON tasks(created_at);
CREATE INDEX CONCURRENTLY idx_gpus_status ON gpus(status);

-- 查看索引使用情况
EXPLAIN ANALYZE SELECT * FROM tasks WHERE status = 'PENDING';
```

**连接池优化**:

```yaml
# Prisma 连接池配置
DATABASE_URL="postgresql://user:pass@db:5432/lsm?connection_limit=20"
```

#### 11.2 缓存优化

**Redis 优化**:

```bash
# 查看内存使用
docker-compose exec redis redis-cli INFO memory

# 查看键空间
docker-compose exec redis redis-cli INFO keyspace

# 设置键过期时间
docker-compose exec redis redis-cli EXPIRE key 3600

# 清理过期键
docker-compose exec redis redis-cli MEMORY PURGE
```

**缓存策略**:

| 数据类型 | 缓存时间 | 策略 |
|----------|----------|------|
| 用户信息 | 1 小时 | 惰性更新 |
| 服务器状态 | 30 秒 | 主动刷新 |
| GPU 状态 | 30 秒 | 主动刷新 |
| 任务列表 | 5 分钟 | 惰性更新 |

#### 11.3 前端优化

**构建优化**:

```bash
# 生产构建
npm run build

# 分析打包大小
npm run build -- --stats
npx webpack-bundle-analyzer dist/stats.json
```

**CDN 配置**:

```nginx
# Nginx 静态资源缓存
location /static/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

#### 11.4 性能监控

**关键指标**:

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| API P95 延迟 | < 200ms | Prometheus |
| 数据库查询 | < 100ms | Prometheus |
| 缓存命中率 | > 80% | Redis INFO |
| 页面加载时间 | < 2s | Lighthouse |

---

### 第 12 章 日常维护

#### 12.1 每日检查清单

- [ ] 查看 Grafana 仪表盘
- [ ] 检查告警历史
- [ ] 验证备份完成
- [ ] 审查错误日志
- [ ] 检查磁盘空间
- [ ] 查看待处理任务

#### 12.2 每周检查清单

- [ ] 性能趋势分析
- [ ] 容量规划评估
- [ ] 安全更新检查
- [ ] 日志审查
- [ ] 备份恢复测试
- [ ] 代码审查

#### 12.3 每月检查清单

- [ ] 系统补丁更新
- [ ] 密码轮换
- [ ] 证书有效期检查
- [ ] 灾难恢复演练
- [ ] 文档更新
- [ ] 团队培训

---

## 第四部分 应急篇

---

### 第 13 章 故障排查

#### 13.1 故障分类

| 类别 | 说明 | 优先级 |
|------|------|--------|
| P0 - 严重 | 服务完全不可用 | 立即响应 |
| P1 - 高 | 核心功能受损 | 30 分钟内 |
| P2 - 中 | 部分功能异常 | 2 小时内 |
| P3 - 低 | 轻微问题 | 24 小时内 |

#### 13.2 常见故障

**服务无法启动**:

| 可能原因 | 排查步骤 | 解决方案 |
|----------|----------|----------|
| 端口占用 | `netstat -tlnp \| grep 4000` | 停止占用进程或修改端口 |
| 配置错误 | `docker-compose config` | 修复配置文件 |
| 依赖服务未就绪 | 检查 db/redis 状态 | 等待依赖服务启动 |
| 资源不足 | `docker stats` | 增加资源或清理 |

**数据库连接失败**:

| 可能原因 | 排查步骤 | 解决方案 |
|----------|----------|----------|
| 数据库未启动 | `docker-compose ps db` | 启动数据库 |
| 密码错误 | 检查 DATABASE_URL | 修正密码 |
| 网络问题 | `docker-compose exec backend ping db` | 检查网络配置 |
| 连接数耗尽 | `SELECT count(*) FROM pg_stat_activity` | 增加连接数或优化 |

**Redis 连接失败**:

| 可能原因 | 排查步骤 | 解决方案 |
|----------|----------|----------|
| Redis 未启动 | `docker-compose ps redis` | 启动 Redis |
| 内存满 | `docker-compose exec redis redis-cli INFO memory` | 清理内存或扩容 |
| 持久化失败 | 检查磁盘空间 | 清理磁盘 |

#### 13.3 排查流程

```
1. 确认故障范围
   ↓
2. 收集相关信息 (日志、指标)
   ↓
3. 定位问题根源
   ↓
4. 制定修复方案
   ↓
5. 执行修复
   ↓
6. 验证恢复
   ↓
7. 记录和总结
```

---

### 第 14 章 应急预案

#### 14.1 应急联系人

| 角色 | 姓名 | 电话 | 邮箱 |
|------|------|------|------|
| 值班工程师 | - | - | oncall@domain.com |
| 技术负责人 | - | - | tech-lead@domain.com |
| 运维负责人 | - | - | ops-lead@domain.com |

#### 14.2 应急流程

```
1. 发现故障
   ↓
2. 初步评估 (P0/P1/P2/P3)
   ↓
3. 通知相关人员
   ↓
4. 启动应急预案
   ↓
5. 执行修复
   ↓
6. 验证恢复
   ↓
7. 事后分析 (Post-mortem)
```

#### 14.3 应急场景

**场景一：数据库宕机**

```bash
# 1. 确认故障
docker-compose ps db

# 2. 尝试重启
docker-compose restart db

# 3. 检查日志
docker-compose logs db

# 4. 如无法恢复，切换到从库
# (如有主从配置)

# 5. 通知相关人员
```

**场景二：磁盘空间不足**

```bash
# 1. 检查磁盘使用
df -h

# 2. 查找大文件
du -ah /var | sort -rh | head -10

# 3. 清理日志
docker-compose logs --tail=0 backend

# 4. 清理旧备份
find /backups -mtime +30 -delete

# 5. 扩容磁盘 (如需要)
```

---

### 第 15 章 升级迁移

#### 15.1 版本升级

**升级流程**:

```bash
# 1. 备份当前版本
docker-compose down
docker save -o backup-images.tar $(docker-compose images -q)

# 2. 拉取新镜像
docker-compose pull

# 3. 查看变更
docker-compose diff

# 4. 执行迁移
docker-compose up -d

# 5. 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 6. 验证升级
curl http://localhost:4000/api/health
```

#### 15.2 数据迁移

**迁移检查**:

```bash
# 1. 迁移前备份
pg_dump -U lsm_user lsm > pre-migration-backup.sql

# 2. 执行迁移
npx prisma migrate deploy

# 3. 验证数据
npx prisma db pull

# 4. 运行测试
npm test
```

---

## 附录

---

### 附录 A 命令速查

**服务管理**:
```bash
docker-compose up -d          # 启动服务
docker-compose down           # 停止服务
docker-compose restart        # 重启服务
docker-compose ps             # 查看状态
docker-compose logs -f        # 查看日志
```

**数据库**:
```bash
docker-compose exec db pg_isready           # 检查连接
docker-compose exec db pg_dump -U user db   # 备份
docker-compose exec backend npx prisma migrate deploy  # 迁移
```

**Redis**:
```bash
docker-compose exec redis redis-cli ping    # 检查连接
docker-compose exec redis redis-cli INFO    # 查看信息
docker-compose exec redis redis-cli DBSIZE  # 键数量
```

**监控**:
```bash
curl http://localhost:9090/api/v1/query?query=up  # Prometheus
curl http://localhost:3001/api/health             # Grafana
```

---

### 附录 B 配置参考

**环境变量模板**:
```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@db:5432/lsm
REDIS_URL=redis://redis:6379
JWT_SECRET=change-me-in-production
```

**Docker Compose 模板**:
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
```

---

### 附录 C 联系方式

**技术支持**:
- 邮箱：support@domain.com
- 电话：xxx-xxxx-xxxx
- 工单系统：https://domain.com/support

**文档**:
- 用户手册：/docs/USER_MANUAL.md
- API 文档：http://localhost:4000/api/docs
- 项目仓库：https://github.com/l17728/lsm

---

---

## 第五部分 v3.1.0 自动化运维篇

---

### 第 16 章 自动扩缩容服务运维

#### 16.1 服务概述

自动扩缩容服务基于资源指标自动调整计算资源，支持响应式、预测性和定时三种扩缩容策略。

**核心能力**:
- 基于 CPU/内存/GPU 使用率的响应式扩缩容
- 基于历史趋势的预测性扩缩容
- 按时间计划的定时扩缩容
- 冷却机制防止扩缩容抖动

#### 16.2 服务启动/停止

**启动服务**:

```bash
# 启动自动评估（每 60 秒评估一次）
curl -X POST http://localhost:4000/api/autoscaling/start

# 或通过环境变量自动启动
AUTOSCALING_ENABLED=true docker-compose up -d
```

**停止服务**:

```bash
# 停止自动评估
curl -X POST http://localhost:4000/api/autoscaling/stop

# 查看服务状态
curl http://localhost:4000/api/autoscaling/status
```

**手动扩缩容**:

```bash
# 手动触发扩容到指定实例数
curl -X POST http://localhost:4000/api/autoscaling/manual-scale \
  -H "Content-Type: application/json" \
  -d '{"policyId": "policy_cpu_reactive", "targetInstances": 5}'
```

#### 16.3 配置管理

**环境变量配置**:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AUTOSCALING_ENABLED` | true | 启用自动扩缩容 |
| `AUTOSCALING_INTERVAL` | 60 | 评估间隔（秒） |
| `AUTOSCALING_DEFAULT_MIN_INSTANCES` | 1 | 默认最小实例数 |
| `AUTOSCALING_DEFAULT_MAX_INSTANCES` | 10 | 默认最大实例数 |

**策略配置示例**:

```json
{
  "name": "GPU 训练任务扩缩容",
  "strategyType": "REACTIVE",
  "metricType": "GPU_USAGE",
  "scaleUpThreshold": 85,
  "scaleDownThreshold": 30,
  "scaleUpStep": 2,
  "scaleDownStep": 1,
  "minInstances": 2,
  "maxInstances": 20,
  "cooldownPeriod": 300
}
```

**策略管理**:

```bash
# 查看所有策略
curl http://localhost:4000/api/autoscaling/policies

# 创建策略
curl -X POST http://localhost:4000/api/autoscaling/policies \
  -H "Content-Type: application/json" \
  -d @policy-config.json

# 启用/禁用策略
curl -X POST http://localhost:4000/api/autoscaling/policies/{id}/toggle
```

#### 16.4 监控指标

**Prometheus 指标**:

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| `lsm_autoscaling_action_total` | 扩缩容动作计数 | 频繁操作告警 |
| `lsm_autoscaling_current_instances` | 当前实例数 | 接近上限告警 |
| `lsm_autoscaling_cooldown_remaining_seconds` | 冷却剩余时间 | - |

**Grafana 查询示例**:

```promql
# 扩缩容操作频率
rate(lsm_autoscaling_action_total[5m])

# 实例数趋势
lsm_autoscaling_current_instances

# 冷却状态
lsm_autoscaling_cooldown_remaining_seconds > 0
```

**关键告警规则**:

```yaml
- alert: AutoScalingFrequentActions
  expr: increase(lsm_autoscaling_action_total[10m]) > 5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "扩缩容操作频繁"
    description: "10分钟内发生 {{ $value }} 次扩缩容操作"
```

#### 16.5 日志位置

| 日志 | 路径 | 说明 |
|------|------|------|
| 服务日志 | `/var/log/lsm/autoscaling.log` | 主服务日志 |
| Docker 日志 | `docker-compose logs backend \| grep autoscaling` | 容器输出 |
| 扩缩容历史 | `/var/log/lsm/autoscaling-events.log` | 操作记录 |

**日志查看命令**:

```bash
# 查看最近扩缩容事件
curl http://localhost:4000/api/autoscaling/events?limit=20

# 查看服务日志
tail -f /var/log/lsm/autoscaling.log

# 过滤错误日志
grep "ERROR" /var/log/lsm/autoscaling.log | tail -50
```

#### 16.6 故障排查

**常见问题**:

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 扩缩容不触发 | 服务未启动 | 检查 `AUTOSCALING_ENABLED` 并启动服务 |
| 频繁扩缩容 | 阈值设置不当 | 调整 `cooldownPeriod` 和阈值 |
| 实例数不变化 | 达到上限/下限 | 检查 `minInstances/maxInstances` 配置 |
| 预测不准确 | 历史数据不足 | 累积更多监控数据后重试 |

**排查流程**:

```bash
# 1. 检查服务状态
curl http://localhost:4000/api/autoscaling/status

# 2. 查看活跃策略
curl http://localhost:4000/api/autoscaling/policies

# 3. 检查当前指标
curl http://localhost:4000/api/metrics | grep autoscaling

# 4. 查看事件历史
curl http://localhost:4000/api/autoscaling/events

# 5. 检查日志
grep -E "ERROR|WARN" /var/log/lsm/autoscaling.log
```

---

### 第 17 章 故障自愈服务运维

#### 17.1 服务概述

故障自愈服务实时监控系统组件，自动检测和修复常见故障，支持分级处理和人工确认机制。

**核心能力**:
- 自动检测服务器、GPU、数据库等组件故障
- 预定义修复动作自动执行
- 四级故障分类（低/中/高/关键）
- 危险操作人工确认机制

#### 17.2 服务启动/停止

**启动服务**:

```bash
# 启动故障检测（每 30 秒检测一次）
curl -X POST http://localhost:4000/api/self-healing/start

# 或通过环境变量
SELF_HEALING_ENABLED=true docker-compose up -d
```

**停止服务**:

```bash
# 停止故障检测
curl -X POST http://localhost:4000/api/self-healing/stop

# 查看服务状态
curl http://localhost:4000/api/self-healing/status
```

**手动触发修复**:

```bash
# 查看活跃故障
curl "http://localhost:4000/api/self-healing/events?active=true"

# 手动触发修复
curl -X POST http://localhost:4000/api/self-healing/events/{eventId}/repair

# 忽略故障
curl -X POST http://localhost:4000/api/self-healing/events/{eventId}/ignore
```

#### 17.3 配置管理

**环境变量配置**:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SELF_HEALING_ENABLED` | true | 启用故障自愈 |
| `SELF_HEALING_INTERVAL` | 30 | 检测间隔（秒） |
| `SELF_HEALING_AUTO_REPAIR` | true | 启用自动修复 |

**故障规则配置**:

```json
{
  "name": "GPU 过热规则",
  "faultType": "GPU_OVERHEAT",
  "level": "HIGH",
  "detection": {
    "metric": "gpu_temperature",
    "operator": "gt",
    "threshold": 90,
    "duration": 60
  },
  "repairActions": [
    {
      "type": "RESET_GPU",
      "description": "重置GPU",
      "requiresConfirmation": false,
      "timeout": 60,
      "retryCount": 2,
      "retryDelay": 30
    }
  ],
  "autoRepair": true,
  "maxRepairAttempts": 3
}
```

**规则管理**:

```bash
# 查看所有规则
curl http://localhost:4000/api/self-healing/rules

# 创建自定义规则
curl -X POST http://localhost:4000/api/self-healing/rules \
  -H "Content-Type: application/json" \
  -d @rule-config.json
```

#### 17.4 监控指标

**Prometheus 指标**:

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| `lsm_fault_active_total` | 活跃故障数 | > 5 告警 |
| `lsm_fault_detected_total` | 检测到的故障总数 | 趋势分析 |
| `lsm_repair_success_total` | 修复成功次数 | - |
| `lsm_repair_failed_total` | 修复失败次数 | 增长告警 |

**Grafana 查询示例**:

```promql
# 活跃故障数
lsm_fault_active_total

# 修复成功率
rate(lsm_repair_success_total[1h]) / 
  (rate(lsm_repair_success_total[1h]) + rate(lsm_repair_failed_total[1h]))

# 故障分布
sum by (fault_type) (lsm_fault_detected_total)
```

**关键告警规则**:

```yaml
- alert: HighActiveFaults
  expr: lsm_fault_active_total > 5
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "活跃故障过多"
    description: "当前有 {{ $value }} 个未修复的故障"

- alert: RepairFailures
  expr: increase(lsm_repair_failed_total[1h]) > 3
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "自愈修复失败"
    description: "1小时内修复失败 {{ $value }} 次"
```

#### 17.5 日志位置

| 日志 | 路径 | 说明 |
|------|------|------|
| 服务日志 | `/var/log/lsm/self-healing.log` | 主服务日志 |
| 修复历史 | `/var/log/lsm/repair-history.log` | 修复操作记录 |
| Docker 日志 | `docker-compose logs backend \| grep self-healing` | 容器输出 |

**日志查看命令**:

```bash
# 查看修复历史
curl http://localhost:4000/api/self-healing/history?limit=20

# 查看服务日志
tail -f /var/log/lsm/self-healing.log

# 过滤关键故障
grep -E "CRITICAL|HIGH" /var/log/lsm/self-healing.log | tail -20
```

#### 17.6 故障排查

**常见问题**:

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 故障未检测到 | 检测间隔过长 | 减小 `SELF_HEALING_INTERVAL` |
| 修复失败 | 修复动作超时 | 增加 `timeout` 或检查系统状态 |
| 误报频繁 | 阈值设置过低 | 调整检测阈值和持续时间 |
| 自动修复未执行 | `autoRepair` 为 false | 启用自动修复或手动触发 |

**排查流程**:

```bash
# 1. 检查服务状态
curl http://localhost:4000/api/self-healing/status

# 2. 查看活跃故障
curl "http://localhost:4000/api/self-healing/events?active=true"

# 3. 检查修复历史
curl http://localhost:4000/api/self-healing/history

# 4. 查看指标
curl http://localhost:4000/api/metrics | grep fault

# 5. 检查日志
grep -E "ERROR|failed" /var/log/lsm/self-healing.log
```

---

### 第 18 章 智能告警降噪服务运维

#### 18.1 服务概述

智能告警降噪服务通过去重、聚合、抑制和静默机制，大幅减少告警噪音，提升运维效率。

**核心能力**:
- 告警去重：基于指纹识别重复告警
- 告警聚合：合并相似告警
- 告警抑制：关联告警自动抑制
- 告警静默：维护窗口静默告警

**预期效果**:
- 去重减少重复告警 70%
- 聚合减少告警数量 50%
- 抑制减少关联告警 80%

#### 18.2 服务启动/停止

**启动服务**:

```bash
# 启动告警降噪服务
curl -X POST http://localhost:4000/api/alert-dedup/start

# 或通过环境变量
ALERT_DEDUP_ENABLED=true docker-compose up -d
```

**停止服务**:

```bash
# 停止告警降噪服务
curl -X POST http://localhost:4000/api/alert-dedup/stop

# 查看服务状态
curl http://localhost:4000/api/alert-dedup/status
```

**管理静默规则**:

```bash
# 创建静默规则（维护窗口）
curl -X POST http://localhost:4000/api/alert-dedup/silences \
  -H "Content-Type: application/json" \
  -d '{
    "name": "计划维护窗口",
    "matchers": [{"field": "serverId", "operator": "equals", "value": "server-001"}],
    "duration": 3600,
    "reason": "计划维护"
  }'

# 查看静默规则
curl http://localhost:4000/api/alert-dedup/silences

# 删除静默规则
curl -X DELETE http://localhost:4000/api/alert-dedup/silences/{id}
```

#### 18.3 配置管理

**环境变量配置**:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ALERT_DEDUP_ENABLED` | true | 启用告警降噪 |
| `ALERT_DEDUP_DEDUP_WINDOW` | 300 | 去重窗口（秒） |
| `ALERT_DEDUP_AGG_WINDOW` | 600 | 聚合窗口（秒） |
| `ALERT_DEDUP_AUTO_RESOLVE` | 3600 | 自动解决时间（秒） |

**降噪配置更新**:

```bash
# 更新配置
curl -X PUT http://localhost:4000/api/alert-dedup/config \
  -H "Content-Type: application/json" \
  -d '{
    "dedupWindow": 300,
    "aggregationWindow": 600,
    "autoResolveTimeout": 3600
  }'
```

#### 18.4 监控指标

**Prometheus 指标**:

| 指标 | 说明 | 目标值 |
|------|------|--------|
| `lsm_alerts_raw_total` | 原始告警数 | - |
| `lsm_alerts_aggregated_total` | 聚合后告警数 | < 原始 35% |
| `lsm_alert_deduplication_rate` | 去重率 | > 70% |
| `lsm_silence_rules_active` | 活跃静默规则数 | 监控 |

**Grafana 查询示例**:

```promql
# 去重效果
lsm_alert_deduplication_rate * 100

# 告警数量对比
lsm_alerts_raw_total / lsm_alerts_aggregated_total

# 活跃静默规则
lsm_silence_rules_active

# 告警分布
sum by (severity) (lsm_alerts_aggregated_total)
```

**关键告警规则**:

```yaml
- alert: LowDeduplicationRate
  expr: lsm_alert_deduplication_rate < 0.5
  for: 30m
  labels:
    severity: warning
  annotations:
    summary: "告警去重率偏低"
    description: "去重率 {{ $value | humanizePercentage }}，低于预期"

- alert: TooManySilenceRules
  expr: lsm_silence_rules_active > 10
  for: 1h
  labels:
    severity: info
  annotations:
    summary: "静默规则过多"
    description: "当前有 {{ $value }} 个活跃的静默规则"
```

#### 18.5 日志位置

| 日志 | 路径 | 说明 |
|------|------|------|
| 服务日志 | `/var/log/lsm/alert-dedup.log` | 主服务日志 |
| 告警日志 | `/var/log/lsm/alerts.log` | 告警处理记录 |
| Docker 日志 | `docker-compose logs backend \| grep alert-dedup` | 容器输出 |

**日志查看命令**:

```bash
# 查看告警统计
curl http://localhost:4000/api/alert-dedup/statistics

# 查看告警分组
curl http://localhost:4000/api/alert-dedup/groups

# 查看服务日志
tail -f /var/log/lsm/alert-dedup.log

# 过滤聚合操作
grep "aggregated" /var/log/lsm/alert-dedup.log | tail -20
```

#### 18.6 故障排查

**常见问题**:

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 去重率低 | 去重窗口过短 | 增加 `ALERT_DEDUP_DEDUP_WINDOW` |
| 重要告警被静默 | 静默规则过于宽泛 | 细化 matchers 条件 |
| 告警未聚合 | 聚合窗口过短 | 增加 `ALERT_DEDUP_AGG_WINDOW` |
| 告警堆积 | 处理速度不足 | 检查系统资源 |

**排查流程**:

```bash
# 1. 检查服务状态
curl http://localhost:4000/api/alert-dedup/status

# 2. 查看统计数据
curl http://localhost:4000/api/alert-dedup/statistics

# 3. 查看活跃告警
curl http://localhost:4000/api/alert-dedup/alerts?status=active

# 4. 检查静默规则
curl http://localhost:4000/api/alert-dedup/silences

# 5. 查看指标
curl http://localhost:4000/api/metrics | grep alert

# 6. 检查日志
grep -E "ERROR|WARN" /var/log/lsm/alert-dedup.log
```

---

### 附录 D v3.1.0 命令速查

**自动扩缩容**:
```bash
# 查看状态
curl http://localhost:4000/api/autoscaling/status

# 启动/停止
curl -X POST http://localhost:4000/api/autoscaling/start
curl -X POST http://localhost:4000/api/autoscaling/stop

# 管理策略
curl http://localhost:4000/api/autoscaling/policies
curl -X POST http://localhost:4000/api/autoscaling/policies/:id/toggle

# 手动扩缩容
curl -X POST http://localhost:4000/api/autoscaling/manual-scale -d '{"targetInstances": 5}'
```

**故障自愈**:
```bash
# 查看状态
curl http://localhost:4000/api/self-healing/status

# 启动/停止
curl -X POST http://localhost:4000/api/self-healing/start
curl -X POST http://localhost:4000/api/self-healing/stop

# 查看故障
curl http://localhost:4000/api/self-healing/events?active=true

# 手动修复
curl -X POST http://localhost:4000/api/self-healing/events/:id/repair
```

**告警降噪**:
```bash
# 查看状态
curl http://localhost:4000/api/alert-dedup/status

# 查看统计
curl http://localhost:4000/api/alert-dedup/statistics

# 管理静默
curl http://localhost:4000/api/alert-dedup/silences
curl -X POST http://localhost:4000/api/alert-dedup/silences -d '{...}'

# 确认/解决告警
curl -X POST http://localhost:4000/api/alert-dedup/alerts/:id/acknowledge
curl -X POST http://localhost:4000/api/alert-dedup/alerts/:id/resolve
```

---

**运维手册版本**: 3.1.0  
**最后更新**: 2026-03-15 (Day 18)  
**页数**: 约 45+ 页  
**字数**: 约 16,000+ 字

---

*🔧 运维团队必备指南，确保系统稳定运行！*
