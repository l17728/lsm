#!/bin/bash

# ============================================
# LSM 项目服务器复刻打包脚本
# 用于将完整的 LSM 项目打包，以便在新服务器上部署
# ============================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="/root/.openclaw/workspace/lsm-project"
# 打包输出目录
OUTPUT_DIR="/tmp/lsm-clone-pack"
# 时间戳
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
# 打包文件名
PACKAGE_NAME="lsm-clone-pack-${TIMESTAMP}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LSM 项目服务器复刻打包脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 清理旧文件
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# ============================================
# 1. 导出 Docker 镜像
# ============================================
echo -e "${YELLOW}[1/7] 导出 Docker 镜像...${NC}"

mkdir -p "$OUTPUT_DIR/docker-images"

# 获取当前运行的镜像版本
BACKEND_IMAGE=$(docker ps --filter "name=lsm-backend" --format "{{.Image}}")
FRONTEND_IMAGE=$(docker ps --filter "name=lsm-frontend" --format "{{.Image}}")

echo "  - 后端镜像: $BACKEND_IMAGE"
echo "  - 前端镜像: $FRONTEND_IMAGE"

# 导出镜像
docker save "$BACKEND_IMAGE" -o "$OUTPUT_DIR/docker-images/lsm-backend.tar"
docker save "$FRONTEND_IMAGE" -o "$OUTPUT_DIR/docker-images/lsm-frontend.tar"

echo -e "${GREEN}  ✓ Docker 镜像导出完成${NC}"

# ============================================
# 2. 备份数据库
# ============================================
echo -e "${YELLOW}[2/7] 备份数据库...${NC}"

mkdir -p "$OUTPUT_DIR/database"

# 导出 PostgreSQL 数据库
docker exec lsm-postgres pg_dump -U lsm lsm > "$OUTPUT_DIR/database/lsm_db_backup.sql"

echo -e "${GREEN}  ✓ 数据库备份完成 ($(du -h $OUTPUT_DIR/database/lsm_db_backup.sql | cut -f1))${NC}"

# ============================================
# 3. 备份配置文件
# ============================================
echo -e "${YELLOW}[3/7] 备份配置文件...${NC}"

mkdir -p "$OUTPUT_DIR/config"

# 复制关键配置文件（去除敏感信息）
cp "$PROJECT_ROOT/.env.production" "$OUTPUT_DIR/config/.env.production.template"
# 替换敏感信息为占位符
sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=YOUR_DB_PASSWORD_HERE/' "$OUTPUT_DIR/config/.env.production.template"
sed -i 's/^REDIS_PASSWORD=.*/REDIS_PASSWORD=YOUR_REDIS_PASSWORD_HERE/' "$OUTPUT_DIR/config/.env.production.template"
sed -i 's/^JWT_SECRET=.*/JWT_SECRET=YOUR_JWT_SECRET_HERE/' "$OUTPUT_DIR/config/.env.production.template"
sed -i 's/^GRAFANA_ADMIN_PASSWORD=.*/GRAFANA_ADMIN_PASSWORD=YOUR_GRAFANA_PASSWORD_HERE/' "$OUTPUT_DIR/config/.env.production.template"
sed -i 's/^SMTP_PASSWORD=.*/SMTP_PASSWORD=YOUR_SMTP_PASSWORD_HERE/' "$OUTPUT_DIR/config/.env.production.template"

# 复制 docker-compose 文件
cp "$PROJECT_ROOT/docker-compose.prod.yml" "$OUTPUT_DIR/config/"
cp "$PROJECT_ROOT/docker-compose.yml" "$OUTPUT_DIR/config/" 2>/dev/null || true

# 复制监控配置
mkdir -p "$OUTPUT_DIR/config/monitoring"
cp -r "$PROJECT_ROOT/monitoring/"* "$OUTPUT_DIR/config/monitoring/" 2>/dev/null || true

# 复制 Nginx 配置
mkdir -p "$OUTPUT_DIR/config/nginx"
docker cp lsm-frontend:/etc/nginx/conf.d/default.conf "$OUTPUT_DIR/config/nginx/frontend.conf" 2>/dev/null || true

echo -e "${GREEN}  ✓ 配置文件备份完成${NC}"

# ============================================
# 4. 打包项目源码
# ============================================
echo -e "${YELLOW}[4/7] 打包项目源码...${NC}"

mkdir -p "$OUTPUT_DIR/source"

# 复制核心源码（排除 node_modules 和构建产物）
tar --exclude='node_modules' \
    --exclude='dist' \
    --exclude='coverage' \
    --exclude='.git' \
    --exclude='*.log' \
    -czf "$OUTPUT_DIR/source/lsm-source.tar.gz" \
    -C "$(dirname $PROJECT_ROOT)" \
    "$(basename $PROJECT_ROOT)"

echo -e "${GREEN}  ✓ 源码打包完成 ($(du -h $OUTPUT_DIR/source/lsm-source.tar.gz | cut -f1))${NC}"

# ============================================
# 5. 导出用户数据
# ============================================
echo -e "${YELLOW}[5/7] 导出用户数据...${NC}"

mkdir -p "$OUTPUT_DIR/user-data"

# 导出用户表数据
docker exec lsm-postgres psql -U lsm -d lsm -c "COPY (SELECT id, username, email, role, created_at, updated_at FROM users) TO STDOUT WITH CSV HEADER" > "$OUTPUT_DIR/user-data/users.csv"

echo -e "${GREEN}  ✓ 用户数据导出完成${NC}"

# ============================================
# 6. 创建部署脚本
# ============================================
echo -e "${YELLOW}[6/7] 创建部署脚本...${NC}"

cat > "$OUTPUT_DIR/deploy-on-new-server.sh" << 'DEPLOY_SCRIPT'
#!/bin/bash

# ============================================
# LSM 项目新服务器部署脚本
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LSM 项目新服务器部署${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查是否 root
if [ "$EUID" -ne 0 ]; then
    echo "请使用 root 用户执行此脚本"
    exit 1
fi

# ============================================
# 1. 安装依赖
# ============================================
echo -e "${YELLOW}[1/5] 安装系统依赖...${NC}"

# 更新系统
apt-get update

# 安装 Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 安装 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo -e "${GREEN}  ✓ 依赖安装完成${NC}"

# ============================================
# 2. 加载 Docker 镜像
# ============================================
echo -e "${YELLOW}[2/5] 加载 Docker 镜像...${NC}"

docker load -i docker-images/lsm-backend.tar
docker load -i docker-images/lsm-frontend.tar

echo -e "${GREEN}  ✓ Docker 镜像加载完成${NC}"

# ============================================
# 3. 创建网络
# ============================================
echo -e "${YELLOW}[3/5] 创建 Docker 网络...${NC}"

docker network create lsm-project_lsm-network 2>/dev/null || true

echo -e "${GREEN}  ✓ 网络创建完成${NC}"

# ============================================
# 4. 启动数据库
# ============================================
echo -e "${YELLOW}[4/5] 启动数据库服务...${NC}"

# 读取配置
read -p "请输入数据库密码: " DB_PASSWORD
read -p "请输入 Redis 密码: " REDIS_PASSWORD
read -p "请输入 JWT 密钥 (至少32字符): " JWT_SECRET

# 创建 .env 文件
cat > .env.production << EOF
# 数据库配置
DB_USER=lsm
DB_PASSWORD=$DB_PASSWORD
DB_NAME=lsm

# Redis 配置
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_MAXMEMORY=256mb

# JWT 配置
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h

# CORS 配置
CORS_ORIGINS=http://localhost,http://localhost:3000

# 其他配置
NODE_ENV=production
LOG_LEVEL=info
EOF

# 启动 PostgreSQL
docker run -d \
    --name lsm-postgres \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e POSTGRES_USER=lsm \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=lsm \
    -v lsm-postgres-data:/var/lib/postgresql/data \
    -p 15432:5432 \
    postgres:14-alpine

# 等待数据库启动
echo "等待数据库启动..."
sleep 10

# 恢复数据库
echo "恢复数据库数据..."
docker exec -i lsm-postgres psql -U lsm -d lsm < database/lsm_db_backup.sql

# 启动 Redis
docker run -d \
    --name lsm-redis \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -v lsm-redis-data:/data \
    redis:7-alpine \
    redis-server --requirepass "$REDIS_PASSWORD" --appendonly yes --maxmemory 256mb

echo -e "${GREEN}  ✓ 数据库服务启动完成${NC}"

# ============================================
# 5. 启动应用
# ============================================
echo -e "${YELLOW}[5/5] 启动应用服务...${NC}"

# 获取镜像名
BACKEND_IMAGE=$(docker load -i docker-images/lsm-backend.tar 2>&1 | grep "Loaded image" | awk '{print $3}')
FRONTEND_IMAGE=$(docker load -i docker-images/lsm-frontend.tar 2>&1 | grep "Loaded image" | awk '{print $3}')

# 启动后端
docker run -d \
    --name lsm-backend \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e NODE_ENV=production \
    -e PORT=8080 \
    -e DATABASE_URL="postgresql://lsm:$DB_PASSWORD@lsm-postgres:5432/lsm" \
    -e REDIS_HOST=lsm-redis \
    -e REDIS_PORT=6379 \
    -e REDIS_PASSWORD="$REDIS_PASSWORD" \
    -e JWT_SECRET="$JWT_SECRET" \
    -e JWT_EXPIRES_IN=24h \
    -e CORS_ORIGINS="http://localhost,http://localhost:3000" \
    -e SCHEDULER_ENABLED=true \
    -e MONITORING_ENABLED=true \
    -p 8080:8080 \
    $BACKEND_IMAGE

# 启动前端
docker run -d \
    --name lsm-frontend \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -p 80:80 \
    $FRONTEND_IMAGE

echo -e "${GREEN}  ✓ 应用服务启动完成${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址:"
echo "  - 前端: http://localhost"
echo "  - 后端 API: http://localhost:8080"
echo ""
echo "默认账号:"
echo "  - 用户名: admin"
echo "  - 密码: Pass@865342"
DEPLOY_SCRIPT

chmod +x "$OUTPUT_DIR/deploy-on-new-server.sh"

echo -e "${GREEN}  ✓ 部署脚本创建完成${NC}"

# ============================================
# 7. 创建说明文档
# ============================================
echo -e "${YELLOW}[7/7] 创建说明文档...${NC}"

cat > "$OUTPUT_DIR/README.md" << 'README'
# LSM 项目服务器复刻包

## 包含内容

```
lsm-clone-pack-YYYYMMDD_HHMMSS/
├── docker-images/          # Docker 镜像文件
│   ├── lsm-backend.tar     # 后端镜像
│   └── lsm-frontend.tar    # 前端镜像
├── database/               # 数据库备份
│   └── lsm_db_backup.sql   # 数据库完整备份
├── config/                 # 配置文件
│   ├── .env.production.template  # 环境变量模板
│   ├── docker-compose.prod.yml   # Docker Compose 配置
│   └── monitoring/              # 监控配置
├── source/                 # 源码包
│   └── lsm-source.tar.gz
├── user-data/              # 用户数据导出
│   └── users.csv
├── deploy-on-new-server.sh # 一键部署脚本
└── README.md               # 本文档
```

## 新服务器部署步骤

### 方式一：一键部署（推荐）

1. 将整个打包目录上传到新服务器：
   ```bash
   scp -r lsm-clone-pack-* root@新服务器IP:/root/
   ```

2. 进入目录执行部署脚本：
   ```bash
   cd /root/lsm-clone-pack-*
   chmod +x deploy-on-new-server.sh
   ./deploy-on-new-server.sh
   ```

3. 按提示输入密码即可完成部署

### 方式二：手动部署

详见 `SERVER_CLONE_GUIDE.md`

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | Pass@865342 |
| 经理 | manager | Pass@865342 |
| 普通用户 | user | Pass@865342 |

## 服务端口

| 服务 | 端口 |
|------|------|
| 前端 | 80 |
| 后端 API | 8080 |
| PostgreSQL | 15432 |
| Redis | 16379 |

## 注意事项

1. 部署前请确保新服务器已开放相关端口
2. 建议在生产环境修改默认密码
3. 如需 HTTPS，请配置 SSL 证书
README

echo -e "${GREEN}  ✓ 说明文档创建完成${NC}"

# ============================================
# 打包
# ============================================
echo ""
echo -e "${YELLOW}正在创建最终打包文件...${NC}"

cd /tmp
tar -czf "${PACKAGE_NAME}.tar.gz" "$(basename $OUTPUT_DIR)"

# 计算大小
SIZE=$(du -h "${PACKAGE_NAME}.tar.gz" | cut -f1)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   打包完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "打包文件: /tmp/${PACKAGE_NAME}.tar.gz"
echo "文件大小: $SIZE"
echo ""
echo "下一步:"
echo "  1. 下载打包文件到本地"
echo "  2. 上传到新服务器"
echo "  3. 解压后执行 deploy-on-new-server.sh"
echo ""