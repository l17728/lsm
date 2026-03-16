#!/bin/bash

# ============================================
# LSM 项目一键远程部署脚本
# 在源服务器执行，自动推送到目标服务器并完成部署
# ============================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 打包文件路径
PACKAGE_FILE="/tmp/lsm-clone-pack-full-20260316_132322.tar.gz"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   LSM 项目一键远程部署${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查打包文件
if [ ! -f "$PACKAGE_FILE" ]; then
    echo -e "${RED}错误: 打包文件不存在${NC}"
    echo "请先运行 ./scripts/clone-server-pack.sh 创建打包文件"
    exit 1
fi

# 获取目标服务器信息
read -p "请输入目标服务器 IP: " TARGET_IP
read -p "请输入目标服务器 SSH 端口 (默认 22): " SSH_PORT
SSH_PORT=${SSH_PORT:-22}
read -p "请输入目标服务器 root 密码 (或按回车使用 SSH 密钥): " -s ROOT_PASSWORD
echo ""
read -p "请输入目标服务器域名/IP (用于 CORS 配置): " SERVER_HOST
read -p "请输入数据库密码 (回车自动生成): " DB_PASSWORD
read -p "请输入 Redis 密码 (回车自动生成): " REDIS_PASSWORD
read -p "请输入 JWT 密钥 (回车自动生成): " JWT_SECRET
read -p "请输入 Grafana 密码 (回车自动生成): " GRAFANA_PASSWORD

# 自动生成密码
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)}
REDIS_PASSWORD=${REDIS_PASSWORD:-$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)}
JWT_SECRET=${JWT_SECRET:-$(openssl rand -base64 48)}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD:-$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)}

echo ""
echo -e "${YELLOW}将使用以下密码:${NC}"
echo "  数据库: $DB_PASSWORD"
echo "  Redis: $REDIS_PASSWORD"
echo "  Grafana: $GRAFANA_PASSWORD"
echo ""

# URL 编码密码
DB_PASSWORD_ENCODED=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$DB_PASSWORD'))")

# 确认部署
read -p "确认部署到 $TARGET_IP? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "取消部署"
    exit 0
fi

echo ""
echo -e "${YELLOW}[1/5] 上传打包文件...${NC}"

# 上传文件
if [ -n "$ROOT_PASSWORD" ]; then
    # 使用 sshpass 传输
    if ! command -v sshpass &> /dev/null; then
        apt-get install -y sshpass
    fi
    sshpass -p "$ROOT_PASSWORD" scp -P $SSH_PORT -o StrictHostKeyChecking=no "$PACKAGE_FILE" root@${TARGET_IP}:/root/
else
    # 使用 SSH 密钥
    scp -P $SSH_PORT "$PACKAGE_FILE" root@${TARGET_IP}:/root/
fi

echo -e "${GREEN}  ✓ 上传完成${NC}"

echo -e "${YELLOW}[2/5] 解压并准备...${NC}"

# 在目标服务器解压
SSH_CMD="ssh -p $SSH_PORT root@${TARGET_IP}"
if [ -n "$ROOT_PASSWORD" ]; then
    SSH_CMD="sshpass -p '$ROOT_PASSWORD' ssh -p $SSH_PORT -o StrictHostKeyChecking=no root@${TARGET_IP}"
fi

$SSH_CMD "cd /root && tar -xzf $(basename $PACKAGE_FILE) && cd lsm-clone-pack* && chmod +x deploy-on-new-server.sh"

echo -e "${GREEN}  ✓ 解压完成${NC}"

echo -e "${YELLOW}[3/5] 安装 Docker...${NC}"

# 安装 Docker
$SSH_CMD "command -v docker &> /dev/null || (curl -fsSL https://get.docker.com | sh && systemctl enable docker && systemctl start docker)"
$SSH_CMD "command -v docker-compose &> /dev/null || (curl -L 'https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)' -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose)"

echo -e "${GREEN}  ✓ Docker 安装完成${NC}"

echo -e "${YELLOW}[4/5] 加载镜像并部署服务...${NC}"

# 在目标服务器执行部署
DEPLOY_DIR=$($SSH_CMD "ls -d /root/lsm-clone-pack* | head -1")

# 加载镜像
$SSH_CMD "cd $DEPLOY_DIR && docker load -i docker-images/lsm-backend.tar -q"
$SSH_CMD "cd $DEPLOY_DIR && docker load -i docker-images/lsm-frontend.tar -q"
$SSH_CMD "cd $DEPLOY_DIR && docker load -i docker-images/grafana.tar -q"
$SSH_CMD "cd $DEPLOY_DIR && docker load -i docker-images/prometheus.tar -q"
$SSH_CMD "cd $DEPLOY_DIR && docker load -i docker-images/node-exporter.tar -q"
$SSH_CMD "cd $DEPLOY_DIR && docker load -i docker-images/redis-exporter.tar -q"

# 创建网络
$SSH_CMD "docker network create lsm-project_lsm-network 2>/dev/null || true"

# 启动 PostgreSQL
$SSH_CMD "docker run -d --name lsm-postgres --restart unless-stopped --network lsm-project_lsm-network -e POSTGRES_USER=lsm -e POSTGRES_PASSWORD='$DB_PASSWORD' -e POSTGRES_DB=lsm -v lsm-postgres-data:/var/lib/postgresql/data -p 15432:5432 postgres:14-alpine"

echo "等待数据库启动..."
sleep 15

# 恢复数据库
$SSH_CMD "cd $DEPLOY_DIR && docker exec -i lsm-postgres psql -U lsm -d lsm < database/lsm_db_backup.sql"

# 启动 Redis
$SSH_CMD "docker run -d --name lsm-redis --restart unless-stopped --network lsm-project_lsm-network -v lsm-redis-data:/data redis:7-alpine redis-server --requirepass '$REDIS_PASSWORD' --appendonly yes --maxmemory 256mb"

# 复制监控配置
$SSH_CMD "mkdir -p /opt/lsm/monitoring && cp -r $DEPLOY_DIR/config/monitoring/* /opt/lsm/monitoring/"

# 启动 Prometheus
$SSH_CMD "docker run -d --name lsm-prometheus --restart unless-stopped --network lsm-project_lsm-network -v /opt/lsm/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro -v /opt/lsm/monitoring/alerts.yml:/etc/prometheus/alerts.yml:ro -v lsm-prometheus-data:/prometheus -p 9090:9090 prom/prometheus:v2.45.0 --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.retention.time=15d"

# 启动 Node Exporter
$SSH_CMD "docker run -d --name lsm-node-exporter --restart unless-stopped --network lsm-project_lsm-network -v /proc:/host/proc:ro -v /sys:/host/sys:ro -v /:/rootfs:ro -p 9100:9100 prom/node-exporter:v1.6.0 --path.procfs=/host/proc --path.sysfs=/host/sys"

# 启动 Redis Exporter
$SSH_CMD "docker run -d --name lsm-redis-exporter --restart unless-stopped --network lsm-project_lsm-network -e REDIS_ADDR=redis://lsm-redis:6379 -e REDIS_PASSWORD='$REDIS_PASSWORD' -p 9121:9121 oliver006/redis_exporter:alpine"

# 启动 Grafana
$SSH_CMD "docker run -d --name lsm-grafana --restart unless-stopped --network lsm-project_lsm-network -e GF_SECURITY_ADMIN_USER=admin -e GF_SECURITY_ADMIN_PASSWORD='$GRAFANA_PASSWORD' -e GF_USERS_ALLOW_SIGN_UP=false -v lsm-grafana-data:/var/lib/grafana -p 13000:3000 grafana/grafana:10.0.0"

# 启动后端
BACKEND_IMAGE=$($SSH_CMD "docker images --format '{{.Repository}}:{{.Tag}}' | grep lsm-backend | head -1")
$SSH_CMD "docker run -d --name lsm-backend --restart unless-stopped --network lsm-project_lsm-network -e NODE_ENV=production -e PORT=8080 -e DATABASE_URL='postgresql://lsm:${DB_PASSWORD_ENCODED}@lsm-postgres:5432/lsm' -e REDIS_HOST=lsm-redis -e REDIS_PORT=6379 -e REDIS_PASSWORD='$REDIS_PASSWORD' -e JWT_SECRET='$JWT_SECRET' -e JWT_EXPIRES_IN=24h -e CORS_ORIGINS='http://${SERVER_HOST},http://localhost' -e SCHEDULER_ENABLED=true -e MONITORING_ENABLED=true -p 8080:8080 $BACKEND_IMAGE"

# 启动前端
FRONTEND_IMAGE=$($SSH_CMD "docker images --format '{{.Repository}}:{{.Tag}}' | grep lsm-frontend | head -1")
$SSH_CMD "docker run -d --name lsm-frontend --restart unless-stopped --network lsm-project_lsm-network -p 80:80 $FRONTEND_IMAGE"

echo -e "${GREEN}  ✓ 服务部署完成${NC}"

echo -e "${YELLOW}[5/5] 验证服务状态...${NC}"

# 等待服务启动
sleep 10

# 检查服务状态
$SSH_CMD "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   一键部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC}"
echo "  前端:          http://${TARGET_IP}"
echo "  后端 API:      http://${TARGET_IP}:8080"
echo "  Grafana 监控:  http://${TARGET_IP}:13000"
echo ""
echo -e "${BLUE}登录账号:${NC}"
echo "  系统登录: admin / Pass@865342"
echo "  Grafana:  admin / ${GRAFANA_PASSWORD}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "  1. 配置域名解析到 ${TARGET_IP}"
echo "  2. 配置 HTTPS (推荐使用 Caddy)"
echo "  3. 配置防火墙规则"
echo ""