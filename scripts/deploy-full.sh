#!/bin/bash

# ============================================
# LSM 项目新服务器部署脚本（完整版）
# 包含：前端、后端、数据库、监控套件
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LSM 项目新服务器完整部署${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查是否 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户执行此脚本${NC}"
    exit 1
fi

# ============================================
# 1. 安装依赖
# ============================================
echo -e "${YELLOW}[1/6] 安装系统依赖...${NC}"

# 更新系统
apt-get update -qq

# 安装 Docker
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 安装 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "安装 Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo -e "${GREEN}  ✓ 依赖安装完成${NC}"

# ============================================
# 2. 加载 Docker 镜像
# ============================================
echo -e "${YELLOW}[2/6] 加载 Docker 镜像...${NC}"

cd "$(dirname "$0")"

echo "  加载后端镜像..."
docker load -i docker-images/lsm-backend.tar -q

echo "  加载前端镜像..."
docker load -i docker-images/lsm-frontend.tar -q

echo "  加载 Grafana..."
docker load -i docker-images/grafana.tar -q

echo "  加载 Prometheus..."
docker load -i docker-images/prometheus.tar -q

echo "  加载 Node Exporter..."
docker load -i docker-images/node-exporter.tar -q

echo "  加载 Redis Exporter..."
docker load -i docker-images/redis-exporter.tar -q

echo -e "${GREEN}  ✓ Docker 镜像加载完成${NC}"

# ============================================
# 3. 配置环境变量
# ============================================
echo -e "${YELLOW}[3/6] 配置环境变量...${NC}"

read -p "请输入服务器 IP 或域名: " SERVER_HOST
read -p "请输入数据库密码 (回车自动生成): " DB_PASSWORD
read -p "请输入 Redis 密码 (回车自动生成): " REDIS_PASSWORD
read -p "请输入 JWT 密钥 (回车自动生成): " JWT_SECRET
read -p "请输入 Grafana 管理员密码 (回车自动生成): " GRAFANA_PASSWORD

# 自动生成密码
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)}
REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 48)}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)}

# URL 编码密码（处理特殊字符）
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASSWORD'))")

echo ""
echo "已生成密码："
echo "  数据库: $DB_PASSWORD"
echo "  Redis: $REDIS_PASSWORD"
echo "  Grafana: $GRAFANA_PASSWORD"
echo ""

# ============================================
# 4. 创建网络和启动数据库
# ============================================
echo -e "${YELLOW}[4/6] 启动数据库服务...${NC}"

# 创建网络
docker network create lsm-project_lsm-network 2>/dev/null || true

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
# 5. 启动监控套件
# ============================================
echo -e "${YELLOW}[5/6] 启动监控套件...${NC}"

# 创建监控配置目录
mkdir -p /opt/lsm/monitoring
cp -r config/monitoring/* /opt/lsm/monitoring/

# 启动 Prometheus
docker run -d \
    --name lsm-prometheus \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -v /opt/lsm/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro \
    -v /opt/lsm/monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro \
    -v lsm-prometheus-data:/prometheus \
    -p 9090:9090 \
    prom/prometheus:v2.45.0 \
    --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.retention.time=15d

# 启动 Node Exporter
docker run -d \
    --name lsm-node-exporter \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -v /proc:/host/proc:ro \
    -v /sys:/host/sys:ro \
    -v /:/rootfs:ro \
    -p 9100:9100 \
    prom/node-exporter:v1.6.0 \
    --path.procfs=/host/proc \
    --path.sysfs=/host/sys

# 启动 Redis Exporter
docker run -d \
    --name lsm-redis-exporter \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e REDIS_ADDR=redis://lsm-redis:6379 \
    -e REDIS_PASSWORD="$REDIS_PASSWORD" \
    -p 9121:9121 \
    oliver006/redis_exporter:alpine

# 启动 Grafana
docker run -d \
    --name lsm-grafana \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e GF_SECURITY_ADMIN_USER=admin \
    -e GF_SECURITY_ADMIN_PASSWORD="$GRAFANA_PASSWORD" \
    -e GF_USERS_ALLOW_SIGN_UP=false \
    -v lsm-grafana-data:/var/lib/grafana \
    -p 13000:3000 \
    grafana/grafana:10.0.0

echo -e "${GREEN}  ✓ 监控套件启动完成${NC}"

# ============================================
# 6. 启动应用服务
# ============================================
echo -e "${YELLOW}[6/6] 启动应用服务...${NC}"

# 获取镜像名称
BACKEND_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep lsm-backend | head -1)
FRONTEND_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep lsm-frontend | head -1)

# 启动后端
docker run -d \
    --name lsm-backend \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -e NODE_ENV=production \
    -e PORT=8080 \
    -e DATABASE_URL="postgresql://lsm:${DB_PASSWORD_ENCODED}@lsm-postgres:5432/lsm" \
    -e REDIS_HOST=lsm-redis \
    -e REDIS_PORT=6379 \
    -e REDIS_PASSWORD="$REDIS_PASSWORD" \
    -e JWT_SECRET="$JWT_SECRET" \
    -e JWT_EXPIRES_IN=24h \
    -e CORS_ORIGINS="http://${SERVER_HOST},http://localhost" \
    -e SCHEDULER_ENABLED=true \
    -e MONITORING_ENABLED=true \
    -p 8080:8080 \
    $BACKEND_IMAGE

# 启动前端（Nginx 已内置）
docker run -d \
    --name lsm-frontend \
    --restart unless-stopped \
    --network lsm-project_lsm-network \
    -p 80:80 \
    $FRONTEND_IMAGE

echo -e "${GREEN}  ✓ 应用服务启动完成${NC}"

# ============================================
# 完成
# ============================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo "  前端:          http://${SERVER_HOST}"
echo "  后端 API:      http://${SERVER_HOST}:8080"
echo "  Grafana 监控:  http://${SERVER_HOST}:13000"
echo "  Prometheus:    http://${SERVER_HOST}:9090"
echo ""
echo -e "${BLUE}默认账号:${NC}"
echo "  系统登录 - 用户名: admin  密码: Pass@865342"
echo "  Grafana  - 用户名: admin  密码: ${GRAFANA_PASSWORD}"
echo ""
echo -e "${BLUE}服务端口:${NC}"
echo "  80     - 前端 (Nginx)"
echo "  8080   - 后端 API"
echo "  15432  - PostgreSQL"
echo "  16379  - Redis"
echo "  9090   - Prometheus"
echo "  13000  - Grafana"
echo "  9100   - Node Exporter"
echo "  9121   - Redis Exporter"
echo ""
echo -e "${YELLOW}建议:${NC}"
echo "  1. 配置防火墙，仅开放必要端口 (80, 8080, 13000)"
echo "  2. 配置 HTTPS (推荐使用 Caddy 或 Nginx)"
echo "  3. 定期备份数据库"
echo ""