# LSM 项目服务器复刻操作指南

**版本**: 1.0.0  
**创建日期**: 2026-03-16  
**用途**: 将 LSM 项目完整部署到新服务器

---

## 📋 目录

1. [准备工作](#准备工作)
2. [一键打包](#一键打包)
3. [新服务器部署](#新服务器部署)
4. [手动部署步骤](#手动部署步骤)
5. [验证测试](#验证测试)
6. [常见问题](#常见问题)

---

## 准备工作

### 源服务器信息

记录当前服务器的关键信息：

```bash
# 查看服务器 IP
curl -4 ifconfig.me

# 查看运行的服务
docker ps

# 查看端口占用
netstat -tlnp | grep -E "80|8080|15432|16379"
```

### 新服务器要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Ubuntu 20.04+ | Ubuntu 22.04 |
| CPU | 4 核 | 8 核+ |
| 内存 | 8GB | 16GB+ |
| 磁盘 | 50GB | 100GB+ SSD |
| 网络 | 公网 IP | 固定公网 IP |

### 需要开放的端口

| 端口 | 服务 | 说明 |
|------|------|------|
| 80 | 前端 | Web 界面 |
| 8080 | 后端 API | 后端服务 |
| 15432 | PostgreSQL | 数据库（可选，仅调试用） |
| 16379 | Redis | 缓存（可选，仅调试用） |
| 13000 | Grafana | 监控面板（可选） |
| 9090 | Prometheus | 监控数据（可选） |

---

## 一键打包

### 在源服务器执行

```bash
# 进入项目目录
cd /root/.openclaw/workspace/lsm-project

# 执行打包脚本
chmod +x scripts/clone-server-pack.sh
./scripts/clone-server-pack.sh
```

### 打包内容

打包脚本会生成以下内容：

```
lsm-clone-pack-YYYYMMDD_HHMMSS/
├── docker-images/
│   ├── lsm-backend.tar      # 后端 Docker 镜像
│   └── lsm-frontend.tar     # 前端 Docker 镜像
├── database/
│   └── lsm_db_backup.sql    # 数据库完整备份
├── config/
│   ├── .env.production.template  # 环境变量模板
│   ├── docker-compose.prod.yml   # Docker Compose 配置
│   └── monitoring/              # Prometheus/Grafana 配置
├── source/
│   └── lsm-source.tar.gz    # 项目源码
├── user-data/
│   └── users.csv            # 用户数据导出
├── deploy-on-new-server.sh  # 一键部署脚本
└── README.md                # 说明文档
```

### 下载打包文件

```bash
# 查看打包文件
ls -lh /tmp/lsm-clone-pack-*.tar.gz

# 使用 scp 下载到本地
scp root@源服务器IP:/tmp/lsm-clone-pack-*.tar.gz ./
```

---

## 新服务器部署

### 方式一：一键部署（推荐）

```bash
# 1. 上传打包文件到新服务器
scp lsm-clone-pack-*.tar.gz root@新服务器IP:/root/

# 2. 登录新服务器
ssh root@新服务器IP

# 3. 解压
cd /root
tar -xzf lsm-clone-pack-*.tar.gz
cd lsm-clone-pack-*

# 4. 执行部署脚本
chmod +x deploy-on-new-server.sh
./deploy-on-new-server.sh
```

按提示输入以下信息：
- 数据库密码（自定义一个强密码）
- Redis 密码（自定义一个强密码）
- JWT 密钥（至少 32 个字符的随机字符串）

### 方式二：使用 Docker Compose

```bash
# 1. 解压打包文件
tar -xzf lsm-clone-pack-*.tar.gz
cd lsm-clone-pack-*

# 2. 加载 Docker 镜像
docker load -i docker-images/lsm-backend.tar
docker load -i docker-images/lsm-frontend.tar

# 3. 创建网络
docker network create lsm-project_lsm-network

# 4. 复制配置文件
cp config/.env.production.template .env.production

# 5. 编辑配置文件，设置密码
nano .env.production

# 6. 使用 docker-compose 启动
docker-compose -f config/docker-compose.prod.yml --env-file .env.production up -d

# 7. 恢复数据库
docker exec -i lsm-postgres psql -U lsm -d lsm < database/lsm_db_backup.sql
```

---

## 手动部署步骤

### 第一步：安装系统依赖

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

### 第二步：准备项目文件

```bash
# 创建项目目录
mkdir -p /opt/lsm
cd /opt/lsm

# 上传并解压打包文件
# 方式一：使用 scp
scp lsm-clone-pack-*.tar.gz root@新服务器IP:/opt/lsm/

# 方式二：使用 rsync（更快）
rsync -avz lsm-clone-pack-* root@新服务器IP:/opt/lsm/

# 解压
tar -xzf lsm-clone-pack-*.tar.gz
```

### 第三步：加载 Docker 镜像

```bash
cd lsm-clone-pack-*

# 加载镜像
docker load -i docker-images/lsm-backend.tar
docker load -i docker-images/lsm-frontend.tar

# 查看已加载的镜像
docker images | grep lsm
```

### 第四步：配置环境变量

```bash
# 复制模板
cp config/.env.production.template .env.production

# 编辑配置
nano .env.production
```

**必须修改的配置项：**

```bash
# 数据库密码
DB_PASSWORD=你的强密码

# Redis 密码
REDIS_PASSWORD=你的强密码

# JWT 密钥（至少 32 字符）
JWT_SECRET=你的随机密钥至少32字符长

# CORS 允许的域名
CORS_ORIGINS=http://你的域名,http://你的IP
```

**生成随机密钥：**

```bash
# 生成 32 字符随机密码
openssl rand -base64 32

# 生成 64 字符 JWT 密钥
openssl rand -base64 64
```

### 第五步：启动服务

```bash
# 创建 Docker 网络
docker network create lsm-project_lsm-network

# 启动 PostgreSQL
docker run -d \
    --name lsm-postgres \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e POSTGRES_USER=lsm \
    -e POSTGRES_PASSWORD="你的数据库密码" \
    -e POSTGRES_DB=lsm \
    -v lsm-postgres-data:/var/lib/postgresql/data \
    -p 15432:5432 \
    postgres:14-alpine

# 等待数据库启动
sleep 10

# 恢复数据库
docker exec -i lsm-postgres psql -U lsm -d lsm < database/lsm_db_backup.sql

# 启动 Redis
docker run -d \
    --name lsm-redis \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -v lsm-redis-data:/data \
    redis:7-alpine \
    redis-server --requirepass "你的Redis密码" --appendonly yes --maxmemory 256mb

# 启动后端（注意密码中的特殊字符需要 URL 编码）
docker run -d \
    --name lsm-backend \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e NODE_ENV=production \
    -e PORT=8080 \
    -e DATABASE_URL="postgresql://lsm:你的数据库密码@lsm-postgres:5432/lsm" \
    -e REDIS_HOST=lsm-redis \
    -e REDIS_PORT=6379 \
    -e REDIS_PASSWORD="你的Redis密码" \
    -e JWT_SECRET="你的JWT密钥" \
    -e JWT_EXPIRES_IN=24h \
    -e CORS_ORIGINS="http://你的域名,http://你的IP" \
    -e SCHEDULER_ENABLED=true \
    -e MONITORING_ENABLED=true \
    -v /app/docs:/app/docs \
    -p 8080:8080 \
    lsm-backend:v4.0.7

# 启动前端
docker run -d \
    --name lsm-frontend \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -p 80:80 \
    lsm-frontend:v4.0.12
```

---

## 验证测试

### 检查服务状态

```bash
# 查看所有容器
docker ps

# 应该看到以下容器运行中：
# - lsm-frontend
# - lsm-backend
# - lsm-redis
# - lsm-postgres

# 查看容器日志
docker logs lsm-backend --tail 50
docker logs lsm-frontend --tail 50
```

### 测试 API

```bash
# 测试后端健康检查
curl http://localhost:8080/health

# 测试登录
curl -X POST http://localhost:8080/api/auth/login \
    -H "Content-Type: application/json" \
    -H "Origin: http://localhost" \
    -d '{"username":"admin","password":"Pass@865342"}'
```

### 测试前端

浏览器访问：
- `http://你的服务器IP`
- 使用 admin / Pass@865342 登录

---

## 常见问题

### Q1: 数据库连接失败

```bash
# 检查数据库是否运行
docker ps | grep postgres

# 检查数据库日志
docker logs lsm-postgres

# 测试数据库连接
docker exec lsm-postgres psql -U lsm -d lsm -c "SELECT 1"
```

### Q2: 登录返回 401/403

检查 CORS 配置是否包含你的域名：

```bash
# 查看后端环境变量
docker exec lsm-backend env | grep CORS

# 重启后端更新配置
docker restart lsm-backend
```

### Q3: 前端无法访问后端

检查前端 Nginx 代理配置：

```bash
# 进入前端容器检查配置
docker exec lsm-frontend cat /etc/nginx/conf.d/default.conf

# 检查网络连接
docker exec lsm-frontend ping lsm-backend
```

### Q4: 如何修改密码

```bash
# 修改 admin 密码
docker exec lsm-backend node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('新密码', 10));"

# 复制输出的 hash，更新数据库
docker exec lsm-postgres psql -U lsm -d lsm -c "UPDATE users SET password_hash = '上面生成的hash' WHERE username = 'admin';"
```

### Q5: 如何启用 HTTPS

```bash
# 安装 certbot
apt install certbot

# 获取证书
certbot certonly --standalone -d 你的域名

# 配置 Nginx（需要自定义配置）
# 或使用反向代理如 Caddy
```

---

## 附录

### 服务管理命令

```bash
# 停止所有服务
docker stop lsm-frontend lsm-backend lsm-redis lsm-postgres

# 启动所有服务
docker start lsm-postgres lsm-redis lsm-backend lsm-frontend

# 重启所有服务
docker restart lsm-postgres lsm-redis lsm-backend lsm-frontend

# 查看资源占用
docker stats
```

### 数据备份

```bash
# 备份数据库
docker exec lsm-postgres pg_dump -U lsm lsm > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker exec -i lsm-postgres psql -U lsm -d lsm < backup.sql
```

### 日志查看

```bash
# 查看后端日志
docker logs lsm-backend -f

# 查看最近 100 行
docker logs lsm-backend --tail 100

# 导出日志
docker logs lsm-backend > backend.log 2>&1
```

---

**文档版本**: 1.0.0  
**最后更新**: 2026-03-16