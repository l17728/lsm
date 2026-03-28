#!/bin/bash
# deploy-to-prod.sh - 部署到生产环境（单服务器）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

echo "🚀 LSM 生产部署脚本"
echo "===================="

# 1. 验证测试环境
echo ""
echo "📋 Step 1: 验证测试环境..."
if curl -sf http://localhost:4010/api/health > /dev/null 2>&1; then
    echo "✅ 测试环境健康检查通过"
else
    echo "❌ 测试环境健康检查失败，请先确保测试环境正常运行"
    exit 1
fi

# 2. 备份生产数据库
echo ""
echo "💾 Step 2: 备份生产数据库..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/lsm_prod_$(date +%Y%m%d_%H%M%S).sql"
if docker exec lsm-postgres pg_dump -U postgres lsm_prod > "$BACKUP_FILE" 2>/dev/null; then
    echo "✅ 数据库备份完成: $BACKUP_FILE"
else
    echo "⚠️ 数据库备份失败，继续部署..."
fi

# 3. 拉取最新代码
echo ""
echo "📥 Step 3: 拉取最新代码..."
cd "$PROJECT_DIR"
git fetch origin
git status

read -p "是否继续部署? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "部署已取消"
    exit 0
fi

# 4. 构建新镜像
echo ""
echo "🔨 Step 4: 构建新镜像..."
docker-compose build backend-prod frontend-prod 2>/dev/null || \
    docker compose build backend-prod frontend-prod

# 5. 滚动更新后端
echo ""
echo "🔄 Step 5: 滚动更新后端..."
docker-compose --profile prod stop backend-prod 2>/dev/null || \
    docker compose --profile prod stop backend-prod
docker-compose --profile prod up -d backend-prod 2>/dev/null || \
    docker compose --profile prod up -d backend-prod

echo "⏳ 等待后端启动..."
sleep 10

# 6. 后端健康检查
echo ""
echo "🏥 Step 6: 后端健康检查..."
for i in {1..30}; do
    if curl -sf http://localhost:4000/api/health > /dev/null 2>&1; then
        echo "✅ 后端健康检查通过"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 后端健康检查超时"
        exit 1
    fi
    sleep 2
done

# 7. 滚动更新前端
echo ""
echo "🔄 Step 7: 滚动更新前端..."
docker-compose --profile prod stop frontend-prod 2>/dev/null || \
    docker compose --profile prod stop frontend-prod
docker-compose --profile prod up -d frontend-prod 2>/dev/null || \
    docker compose --profile prod up -d frontend-prod

echo "⏳ 等待前端启动..."
sleep 5

# 8. 最终验证
echo ""
echo "✅ Step 8: 最终验证..."
if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ 生产环境部署成功！"
else
    echo "❌ 生产环境健康检查失败"
    exit 1
fi

# 9. 显示状态
echo ""
echo "===================="
echo "🎉 部署完成！"
echo ""
echo "📍 生产环境: http://localhost:3000"
echo "📍 测试环境: http://localhost:3010"
echo ""
echo "📊 查看日志: docker-compose --profile prod logs -f"
echo ""