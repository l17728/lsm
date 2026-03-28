# LSM 安装指南

**版本**: 3.2.2  
**最后更新**: 2026-03-28  
**项目**: LSM (Laboratory Server Management System)

---

## 快速导航

- [系统要求](#系统要求)
- [一键部署](#一键部署推荐)
- [手动部署](#手动部署)
- [生产环境部署](#生产环境部署)
- [验证安装](#验证安装)
- [常见问题](#常见问题)

---

## 系统要求

### 硬件要求

| 配置 | 开发环境 | 生产环境 |
|------|---------|---------|
| CPU | 4 核心 | 8 核心+ |
| 内存 | 8 GB | 16 GB+ |
| 存储 | 50 GB SSD | 200 GB SSD |
| 网络 | 100 Mbps | 1 Gbps |

### 软件要求

| 软件 | 版本 | 检查命令 |
|------|------|----------|
| Docker | 24.0+ | `docker --version` |
| Docker Compose | 2.20+ | `docker-compose --version` |
| Git | 2.x+ | `git --version` |

### 支持的操作系统

| 系统 | 版本 | 状态 |
|------|------|------|
| Ubuntu | 22.04 LTS | ✅ 推荐 |
| Ubuntu | 20.04 LTS | ✅ 支持 |
| CentOS | 8.x | ✅ 支持 |
| Debian | 11.x | ✅ 支持 |
| macOS | 12.x+ | ⚠️ 仅开发 |
| Windows | 10/11 | ⚠️ 仅开发 (WSL2) |

---

## 一键部署（推荐）

### 最快方式

```bash
# 克隆项目
git clone https://github.com/l17728/lsm.git
cd lsm

# 一键启动
./quickstart.sh dev
```

### 部署选项

| 命令 | 说明 | 用途 |
|------|------|------|
| `./quickstart.sh dev` | 开发环境 | 本地开发测试，自动配置开发密码 |
| `./quickstart.sh prod` | 生产环境 | 正式部署，需要手动配置 .env |
| `./quickstart.sh test` | 运行测试 | 验证安装是否成功 |

### 访问服务

部署成功后可访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端界面 | http://localhost:3000 | Web 用户界面 |
| 后端 API | http://localhost:8080 | REST API |
| API 文档 | http://localhost:8080/api/docs | Swagger 文档 |
| Grafana | http://localhost:3001 | 监控仪表盘 |
| Prometheus | http://localhost:9090 | 监控指标 |

### 默认账号

| 系统 | 用户名 | 密码 |
|------|--------|------|
| LSM 系统 | admin | Pass@865342 |
| Grafana | admin | admin（首次登录需修改） |

---

## 手动部署

### Step 1: 安装依赖

**Ubuntu/Debian**:

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

**CentOS/RHEL**:

```bash
# 安装 Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

### Step 2: 克隆项目

```bash
git clone https://github.com/l17728/lsm.git
cd lsm
```

### Step 3: 配置环境变量

```bash
# 复制配置模板
cp .env.example .env

# 编辑配置
vim .env
```

**必改配置项**:

```env
# 数据库密码
DB_PASSWORD=your_secure_db_password

# Redis 密码
REDIS_PASSWORD=your_secure_redis_password

# JWT 密钥（用于签名认证令牌）
JWT_SECRET=your_secure_jwt_secret_key

# 前端 API 地址（生产环境改为实际地址）
VITE_API_BASE_URL=http://your-server-ip:8080/api
VITE_WS_URL=ws://your-server-ip:8080
```

**生成安全密钥**:

```bash
# JWT 密钥（64字节）
openssl rand -base64 64

# 数据库密码（32字节）
openssl rand -base64 32
```

### Step 4: 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### Step 5: 初始化数据库

```bash
# 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 生成 Prisma 客户端
docker-compose exec backend npx prisma generate
```

---

## 生产环境部署

### 使用生产配置

```bash
# 方式 1: 指定生产配置文件
docker-compose -f docker-compose.prod.yml up -d

# 方式 2: 复制为默认配置
cp docker-compose.prod.yml docker-compose.override.yml
docker-compose up -d
```

### 生产环境检查清单

**安全配置**:

- [ ] 修改所有默认密码
  - [ ] 数据库密码 (`DB_PASSWORD`)
  - [ ] Redis 密码 (`REDIS_PASSWORD`)
  - [ ] JWT 密钥 (`JWT_SECRET`)
  - [ ] Grafana 管理员密码
- [ ] 配置 HTTPS/SSL 证书
- [ ] 设置 CORS 允许的域名 (`CORS_ORIGINS`)
- [ ] 配置防火墙规则

**服务配置**:

- [ ] 配置邮件服务 SMTP
- [ ] 设置备份计划
- [ ] 启用监控告警
- [ ] 配置日志轮转

### 防火墙配置

**Ubuntu (UFW)**:

```bash
# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status
```

**CentOS (firewalld)**:

```bash
# 允许服务
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=22/tcp

# 重载配置
sudo firewall-cmd --reload
```

### SSL/HTTPS 配置

**使用 Let's Encrypt**:

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 验证安装

### 健康检查

```bash
# 后端 API 健康检查
curl http://localhost:8080/api/health
# 预期输出: {"success":true,"data":{"status":"ok"}}

# 数据库连接检查
docker-compose exec backend npx prisma db execute --stdin <<< "SELECT 1"

# Redis 连接检查
docker-compose exec redis redis-cli ping
# 预期输出: PONG
```

### 服务状态

```bash
# 查看所有服务状态
docker-compose ps

# 预期输出:
# NAME           STATUS    PORTS
# lsm-backend    running   0.0.0.0:8080->8080/tcp
# lsm-frontend   running   0.0.0.0:3000->80/tcp
# lsm-postgres   running   5432/tcp
# lsm-redis      running   6379/tcp
```

### 功能验证

1. 访问 http://localhost:3000 打开前端界面
2. 使用 `admin / Pass@865342` 登录
3. 检查仪表盘数据是否正常显示
4. 访问 http://localhost:8080/api/docs 查看 API 文档

---

## 常见问题

### Q: Docker 未安装

**A**: 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable docker
sudo systemctl start docker
```

### Q: 端口被占用

**A**: 查看并释放端口

```bash
# 查看端口占用
sudo netstat -tlnp | grep :8080

# 方式 1: 停止占用进程
sudo kill -9 <PID>

# 方式 2: 修改端口配置
# 编辑 .env 文件
BACKEND_PORT=8081
FRONTEND_PORT=3001
```

### Q: 数据库连接失败

**A**: 检查 PostgreSQL 状态

```bash
# 检查服务状态
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重启服务
docker-compose restart postgres

# 等待服务启动
sleep 10

# 验证连接
docker-compose exec postgres pg_isready
```

### Q: Redis 连接失败

**A**: 检查 Redis 状态

```bash
# 检查服务状态
docker-compose ps redis

# 测试连接
docker-compose exec redis redis-cli ping

# 如果设置了密码
docker-compose exec redis redis-cli -a your_redis_password ping
```

### Q: 权限不足

**A**: 添加用户到 docker 组

```bash
sudo usermod -aG docker $USER
# 重新登录后生效
```

### Q: 如何更新版本

**A**: 拉取最新代码并重启

```bash
# 停止服务
docker-compose down

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker-compose build
docker-compose up -d

# 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy
```

### Q: 如何备份数据

**A**: 使用数据导出脚本

```bash
# 完整导出（数据库 + Redis + 配置）
./scripts/data-export.sh export

# 查看导出文件
./scripts/data-export.sh list

# 恢复数据
./scripts/data-export.sh import lsm-export-xxx.tar.gz
```

**导出命令列表**:

| 命令 | 说明 |
|------|------|
| `export` | 完整导出（推荐） |
| `export-db` | 仅导出数据库 |
| `export-redis` | 仅导出 Redis |
| `import <file>` | 从导出包恢复 |
| `list` | 列出所有导出文件 |
| `pre-upgrade` | 升级前备份 |
| `post-upgrade` | 升级后验证 |

**或使用传统备份脚本**:

```bash
# 运行备份脚本
./scripts/backup.sh backup

# 列出备份
./scripts/backup.sh list

# 恢复备份
./scripts/backup.sh restore backups/backup-full-xxx.sql.gz
```

---

## 数据迁移与升级

### 升级前备份

在升级系统版本前，务必执行完整备份：

```bash
# 升级前自动备份
./scripts/data-export.sh pre-upgrade

# 导出文件保存在 data-exports/ 目录
```

### 版本升级步骤

```bash
# 1. 备份数据
./scripts/data-export.sh export

# 2. 停止服务
docker-compose down

# 3. 拉取新版本
git pull origin main

# 4. 重新构建
docker-compose build

# 5. 启动服务
docker-compose up -d

# 6. 运行数据库迁移
docker-compose exec backend npx prisma migrate deploy

# 7. 验证升级
./scripts/data-export.sh post-upgrade
```

### 跨服务器迁移

**源服务器**:

```bash
# 导出所有数据
./scripts/data-export.sh export

# 打包传输
scp data-exports/lsm-export-*.tar.gz user@new-server:/path/to/lsm/
```

**目标服务器**:

```bash
# 导入数据
./scripts/data-export.sh import lsm-export-xxx.tar.gz

# 验证
./scripts/data-export.sh post-upgrade
```

---

## 下一步

安装完成后：

1. 📖 阅读 [用户手册](docs/USER_MANUAL.md) 了解系统功能
2. 🔧 参考 [运维手册](docs/OPERATIONS_MANUAL.md) 配置生产环境
3. 🐛 遇到问题？查看 [故障排查](docs/USER_MANUAL.md#第-15-章-故障排查)

---

## 获取帮助

- **GitHub Issues**: https://github.com/l17728/lsm/issues
- **用户手册**: docs/USER_MANUAL.md
- **运维手册**: docs/OPERATIONS_MANUAL.md
- **API 文档**: http://localhost:8080/api/docs (部署后访问)

---

*LSM Project - Laboratory Server Management System*  
*Version 3.2.2*