# LSM 项目 - 生产部署快速指南

**版本**: 1.0.0  
**日期**: 2026-03-13  
**状态**: 生产就绪

---

## 📋 部署前检查清单

### 系统要求
- [ ] CPU: 4 核+ (推荐 8 核)
- [ ] 内存：8GB+ (推荐 16GB)
- [ ] 磁盘：50GB+ SSD
- [ ] Docker 24.0+
- [ ] Docker Compose 2.20+

### 环境变量
- [ ] `.env.production` 文件已创建
- [ ] JWT_SECRET 已设置为强随机值
- [ ] 数据库密码已更改
- [ ] Redis 密码已更改
- [ ] Grafana 密码已更改

---

## 🚀 快速部署步骤

### 1. 准备环境

```bash
# 进入项目目录
cd /root/.openclaw/workspace/lsm-project

# 检查环境变量文件
ls -la .env.production

# 如果不存在，复制示例文件并修改
cp .env.example .env.production
# 编辑 .env.production，设置所有密码和密钥
```

### 2. 构建 Docker 镜像

```bash
# 构建后端镜像
docker build -t lsm-backend:prod -f backend/Dockerfile src/backend/

# 构建前端镜像
docker build -t lsm-frontend:prod -f frontend/Dockerfile src/frontend/

# 验证镜像
docker images | grep lsm
```

**预期输出**:
```
lsm-backend     prod      xxxxx    200MB
lsm-frontend    prod      xxxxx    50MB
```

### 3. 启动服务

```bash
# 使用生产配置启动所有服务
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d

# 查看服务状态
docker-compose -f docker-compose.prod.yml ps
```

**预期输出**:
```
NAME              STATUS                    PORTS
lsm-backend       Up (healthy)              0.0.0.0:8080->8080/tcp
lsm-frontend      Up (healthy)              0.0.0.0:80->80/tcp
lsm-postgres      Up (healthy)              0.0.0.0:5432->5432/tcp
lsm-redis         Up (healthy)              0.0.0.0:6379->6379/tcp
lsm-prometheus    Up (healthy)              0.0.0.0:9090->9090/tcp
lsm-grafana       Up (healthy)              0.0.0.0:3000->3000/tcp
```

### 4. 验证服务

```bash
# 检查后端健康状态
curl http://localhost:8080/health

# 检查前端
curl http://localhost/

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f backend
```

### 5. 访问服务

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost | Web 应用 |
| 后端 API | http://localhost:8080/api | REST API |
| Prometheus | http://localhost:9090 | 监控指标 |
| Grafana | http://localhost:3000 | 监控仪表盘 |

**Grafana 默认账号**:
- 用户名：`admin`
- 密码：从 `.env.production` 中的 `GRAFANA_ADMIN_PASSWORD`

---

## 🔧 常用运维命令

### 查看日志

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f postgres
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f docker-compose.prod.yml restart

# 重启特定服务
docker-compose -f docker-compose.prod.yml restart backend
```

### 停止服务

```bash
# 停止所有服务
docker-compose -f docker-compose.prod.yml down

# 停止并删除卷 (危险！会删除数据)
docker-compose -f docker-compose.prod.yml down -v
```

### 更新服务

```bash
# 重新构建并启动
docker-compose -f docker-compose.prod.yml up -d --build

# 仅更新特定服务
docker-compose -f docker-compose.prod.yml up -d --no-deps backend
```

### 数据库操作

```bash
# 进入数据库容器
docker-compose -f docker-compose.prod.yml exec postgres psql -U lsm -d lsm

# 创建数据库备份
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U lsm -d lsm > backup.sql

# 恢复数据库
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U lsm -d lsm < backup.sql
```

---

## 📊 监控和告警

### Prometheus 指标

访问：http://localhost:9090

**关键指标**:
- `lsm_app_requests_total` - API 请求总数
- `lsm_app_errors_total` - API 错误总数
- `lsm_cache_hit_rate_percent` - 缓存命中率
- `lsm_health_database` - 数据库健康状态
- `lsm_health_redis` - Redis 健康状态

### Grafana 仪表盘

访问：http://localhost:3000

**内置仪表盘**:
- 系统概览
- 服务器监控
- GPU 资源监控
- 任务执行监控
- 数据库性能

### 配置告警

1. 登录 Grafana
2. 进入 Alerting → Alert rules
3. 创建告警规则
4. 配置通知渠道 (邮件、Webhook)

---

## 🔒 安全建议

### 1. 配置 HTTPS

使用 Nginx 反向代理配置 SSL:

```nginx
server {
    listen 443 ssl;
    server_name lsm.example.com;
    
    ssl_certificate /etc/ssl/certs/lsm.example.com.crt;
    ssl_certificate_key /etc/ssl/private/lsm.example.com.key;
    
    location / {
        proxy_pass http://localhost:80;
    }
    
    location /api {
        proxy_pass http://localhost:8080;
    }
}
```

### 2. 防火墙配置

```bash
# 仅开放必要端口
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw enable
```

### 3. 定期更新

```bash
# 每周更新依赖
npm audit fix

# 每月更新基础镜像
docker pull node:20-alpine
docker pull nginx:alpine
docker pull postgres:14-alpine
docker pull redis:7-alpine
```

---

## 🐛 故障排查

### 后端无法启动

```bash
# 查看日志
docker-compose -f docker-compose.prod.yml logs backend

# 常见问题:
# 1. 数据库连接失败 - 检查 DATABASE_URL
# 2. 端口被占用 - 更改 BACKEND_PORT
# 3. 内存不足 - 检查资源限制
```

### 前端无法访问

```bash
# 检查容器状态
docker-compose -f docker-compose.prod.yml ps frontend

# 测试 Nginx 配置
docker-compose -f docker-compose.prod.yml exec frontend nginx -t

# 查看日志
docker-compose -f docker-compose.prod.yml logs frontend
```

### 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# 查看连接数
docker-compose -f docker-compose.prod.yml exec postgres psql -U lsm -d lsm -c "SELECT count(*) FROM pg_stat_activity;"

# 重启数据库
docker-compose -f docker-compose.prod.yml restart postgres
```

### 缓存命中率低

```bash
# 查看 Redis 状态
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD info stats

# 检查命中率
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD info stats | grep keyspace

# 清除缓存 (谨慎使用)
docker-compose -f docker-compose.prod.yml exec redis redis-cli -a $REDIS_PASSWORD FLUSHALL
```

---

## 📦 备份策略

### 数据库备份

```bash
# 创建备份脚本
cat > backup-db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/database"
mkdir -p $BACKUP_DIR

docker-compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U lsm -d lsm | gzip > $BACKUP_DIR/lsm_$TIMESTAMP.sql.gz

# 保留最近 30 天的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x backup-db.sh

# 添加到 crontab (每天凌晨 2 点)
crontab -e
# 0 2 * * * /path/to/backup-db.sh
```

### 应用备份

```bash
# 备份整个项目
tar -czf lsm-backup-$(date +%Y%m%d).tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  /root/.openclaw/workspace/lsm-project
```

---

## 📈 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX IF NOT EXISTS idx_tasks_status ON "Task"(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON "Task"(user_id);
CREATE INDEX IF NOT EXISTS idx_gpus_status ON "GPU"(status);
CREATE INDEX IF NOT EXISTS idx_servers_status ON "Server"(status);

-- 分析表
ANALYZE "Task";
ANALYZE "GPU";
ANALYZE "Server";
```

### 2. Redis 优化

```bash
# 配置最大内存
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD CONFIG SET maxmemory 512mb

# 配置淘汰策略
docker-compose -f docker-compose.prod.yml exec redis \
  redis-cli -a $REDIS_PASSWORD CONFIG SET maxmemory-policy allkeys-lru
```

### 3. 前端优化

- ✅ 启用 Gzip 压缩
- ✅ 静态资源缓存 1 年
- ✅ 代码分割 (懒加载)
- ✅ 图片优化

---

## 🎯 下一步

1. **配置域名和 SSL** - 申请 Let's Encrypt 证书
2. **设置监控告警** - 配置 Grafana 告警规则
3. **配置日志收集** - 集成 ELK 或 Loki
4. **性能测试** - 使用 k6 或 JMeter 进行压力测试
5. **灾难恢复演练** - 测试备份恢复流程

---

**文档维护**: DevOps 团队  
**最后更新**: 2026-03-13  
**版本**: 1.0.0
