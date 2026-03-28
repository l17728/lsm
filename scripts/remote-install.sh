#!/bin/bash

# ============================================
# LSM 项目远程安装脚本
# 在新服务器执行此脚本即可完成部署
# 使用方法: curl -fsSL http://源服务器IP:8080/install.sh | bash
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 配置（这些值会在打包时替换）
PACKAGE_URL="http://PACKAGE_SERVER_IP:8080/lsm-clone-pack.tar.gz"
DB_PASSWORD="PACKAGE_DB_PASSWORD"
REDIS_PASSWORD="PACKAGE_REDIS_PASSWORD"
JWT_SECRET="PACKAGE_JWT_SECRET"
GRAFANA_PASSWORD="PACKAGE_GRAFANA_PASSWORD"
SERVER_HOST="PACKAGE_SERVER_HOST"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LSM 项目远程安装${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}请使用 root 用户执行${NC}"
    exit 1
fi

# ============================================
# 1. 安装依赖
# ============================================
echo -e "${YELLOW}[1/5] 安装系统依赖...${NC}"
apt-get update -qq

if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo -e "${GREEN}  ✓ 依赖安装完成${NC}"

# ============================================
# 2. 下载并解压
# ============================================
echo -e "${YELLOW}[2/5] 下载部署包...${NC}"

cd /root
curl -fsSL "$PACKAGE_URL" -o lsm-clone-pack.tar.gz
tar -xzf lsm-clone-pack.tar.gz
cd lsm-clone-pack*

echo -e "${GREEN}  ✓ 下载完成${NC}"

# ============================================
# 3. 加载镜像
# ============================================
echo -e "${YELLOW}[3/5] 加载 Docker 镜像...${NC}"

docker load -i docker-images/lsm-backend.tar -q
docker load -i docker-images/lsm-frontend.tar -q
docker load -i docker-images/grafana.tar -q
docker load -i docker-images/prometheus.tar -q
docker load -i docker-images/node-exporter.tar -q
docker load -i docker-images/redis-exporter.tar -q

echo -e "${GREEN}  ✓ 镜像加载完成${NC}"

# ============================================
# 4. 部署服务
# ============================================
echo -e "${YELLOW}[4/5] 部署服务...${NC}"

# 创建网络
docker network create lsm-project_lsm-network 2>/dev/null || true

# 数据库密码 URL 编码
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASSWORD'))")

# PostgreSQL
docker run -d --name lsm-postgres --restart unless-stopped --network lsm-project_lsm-network \
    -e POSTGRES_USER=lsm -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB=lsm \
    -v lsm-postgres-data:/var/lib/postgresql/data -p 15432:5432 postgres:14-alpine

sleep 10
docker exec -i lsm-postgres psql -U lsm -d lsm < database/lsm_db_backup.sql

# Redis
docker run -d --name lsm-redis --restart unless-stopped --network lsm-project_lsm-network \
    -v lsm-redis-data:/data redis:7-alpine \
    redis-server --requirepass "$REDIS_PASSWORD" --appendonly yes --maxmemory 256mb

# 监控
mkdir -p /opt/lsm/monitoring
cp -r config/monitoring/* /opt/lsm/monitoring/

docker run -d --name lsm-prometheus --restart unless-stopped --network lsm-project_lsm-network \
    -v /opt/lsm/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro \
    -v /opt/lsm/monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro \
    -v lsm-prometheus-data:/prometheus -p 9090:9090 \
    prom/prometheus:v2.45.0 --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.retention.time=15d

docker run -d --name lsm-node-exporter --restart unless-stopped --network lsm-project_lsm-network \
    -v /proc:/host/proc:ro -v /sys:/host/sys:ro -v /:/rootfs:ro -p 9100:9100 \
    prom/node-exporter:v1.6.0 --path.procfs=/host/proc --path.sysfs=/host/sys

docker run -d --name lsm-redis-exporter --restart unless-stopped --network lsm-project_lsm-network \
    -e REDIS_ADDR=redis://lsm-redis:6379 -e REDIS_PASSWORD="$REDIS_PASSWORD" -p 9121:9121 \
    oliver006/redis_exporter:alpine

docker run -d --name lsm-grafana --restart unless-stopped --network lsm-project_lsm-network \
    -e GF_SECURITY_ADMIN_USER=admin -e GF_SECURITY_ADMIN_PASSWORD="$GRAFANA_PASSWORD" \
    -e GF_USERS_ALLOW_SIGN_UP=false -v lsm-grafana-data:/var/lib/grafana -p 13000:3000 \
    grafana/grafana:10.0.0

# 后端
BACKEND_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep lsm-backend | head -1)
docker run -d --name lsm-backend --restart unless-stopped --network lsm-project_lsm-network \
    -e NODE_ENV=production -e PORT=8080 \
    -e DATABASE_URL="postgresql://lsm:${DB_PASSWORD_ENCODED}@lsm-postgres:5432/lsm" \
    -e REDIS_HOST=lsm-redis -e REDIS_PORT=6379 -e REDIS_PASSWORD="$REDIS_PASSWORD" \
    -e JWT_SECRET="$JWT_SECRET" -e JWT_EXPIRES_IN=24h \
    -e CORS_ORIGINS="http://${SERVER_HOST},http://localhost" \
    -e SCHEDULER_ENABLED=true -e MONITORING_ENABLED=true -p 8080:8080 $BACKEND_IMAGE

# 前端
FRONTEND_IMAGE=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep lsm-frontend | head -1)
docker run -d --name lsm-frontend --restart unless-stopped --network lsm-project_lsm-network \
    -p 80:80 $FRONTEND_IMAGE

echo -e "${GREEN}  ✓ 服务部署完成${NC}"

# ============================================
# 5. 验证
# ============================================
echo -e "${YELLOW}[5/5] 验证服务...${NC}"
sleep 5
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 获取本机 IP
LOCAL_IP=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   安装完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo "  前端:    http://${LOCAL_IP}"
echo "  Grafana: http://${LOCAL_IP}:13000"
echo ""
echo -e "${BLUE}登录账号:${NC}"
echo "  系统:   admin / Pass@865342"
echo "  Grafana: admin / ${GRAFANA_PASSWORD}"
echo ""