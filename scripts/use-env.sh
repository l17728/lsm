#!/bin/bash
# use-env.sh - 环境切换脚本

# 用法: source scripts/use-env.sh [prod|staging|dev]

ENV=$1

if [ -z "$ENV" ]; then
    echo "用法: source scripts/use-env.sh [prod|staging|dev]"
    echo ""
    echo "环境说明:"
    echo "  prod/production  - 生产环境 (端口 3000/4000)"
    echo "  staging/test     - 测试环境 (端口 3010/4010)"
    echo "  dev/development  - 开发环境 (端口 3020/4020)"
    return 0 2>/dev/null || exit 0
fi

case $ENV in
    prod|production)
        export LSM_ENV=production
        export API_URL=http://localhost:4000
        export FRONTEND_URL=http://localhost:3000
        export DATABASE_URL="postgresql://postgres:password@localhost:5432/lsm_prod"
        export REDIS_URL="redis://localhost:6379/0"
        export WS_URL="ws://localhost:4000"
        echo "✅ 已切换到【生产环境】"
        echo "   前端: http://localhost:3000"
        echo "   后端: http://localhost:4000"
        echo "   数据库: lsm_prod"
        echo "   Redis: DB 0"
        ;;
    
    staging|test)
        export LSM_ENV=staging
        export API_URL=http://localhost:4010
        export FRONTEND_URL=http://localhost:3010
        export DATABASE_URL="postgresql://postgres:password@localhost:5432/lsm_staging"
        export REDIS_URL="redis://localhost:6379/1"
        export WS_URL="ws://localhost:4010"
        echo "✅ 已切换到【测试环境】"
        echo "   前端: http://localhost:3010"
        echo "   后端: http://localhost:4010"
        echo "   数据库: lsm_staging"
        echo "   Redis: DB 1"
        ;;
    
    dev|development)
        export LSM_ENV=development
        export API_URL=http://localhost:4020
        export FRONTEND_URL=http://localhost:3020
        export DATABASE_URL="postgresql://postgres:password@localhost:5432/lsm_dev"
        export REDIS_URL="redis://localhost:6379/2"
        export WS_URL="ws://localhost:4020"
        echo "✅ 已切换到【开发环境】"
        echo "   前端: http://localhost:3020"
        echo "   后端: http://localhost:4020"
        echo "   数据库: lsm_dev"
        echo "   Redis: DB 2"
        ;;
    
    *)
        echo "❌ 未知环境: $ENV"
        echo "可用环境: prod, staging, dev"
        return 1 2>/dev/null || exit 1
        ;;
esac

# 显示当前环境变量
echo ""
echo "环境变量:"
echo "  LSM_ENV=$LSM_ENV"
echo "  API_URL=$API_URL"
echo "  DATABASE_URL=$DATABASE_URL"