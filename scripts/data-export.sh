#!/bin/bash
# ============================================
# LSM 数据导出导入脚本
# 支持完整备份、恢复、升级迁移、跨服务器迁移
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
EXPORT_DIR="$PROJECT_DIR/data-exports"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 默认保留天数
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

echo -e "${PURPLE}============================================${NC}"
echo -e "${PURPLE}    LSM 数据导出导入工具 v1.0${NC}"
echo -e "${PURPLE}============================================${NC}"
echo ""

# ============================================
# 工具函数
# ============================================

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# 加载环境变量
load_env() {
    if [ -f "$PROJECT_DIR/.env" ]; then
        export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
    fi
}

# 确保导出目录存在
ensure_export_dir() {
    mkdir -p "$EXPORT_DIR"
}

# 获取数据库配置
get_db_config() {
    if [ -n "$DATABASE_URL" ]; then
        DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
        DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
        DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
        DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    else
        DB_HOST=${DB_HOST:-localhost}
        DB_PORT=${DB_PORT:-5432}
        DB_NAME=${DB_NAME:-lsm}
        DB_USER=${DB_USER:-lsm}
        DB_PASS=${DB_PASSWORD:-}
    fi
}

# 获取 Redis 配置
get_redis_config() {
    REDIS_HOST=${REDIS_HOST:-localhost}
    REDIS_PORT=${REDIS_PORT:-6379}
    REDIS_PASS=${REDIS_PASSWORD:-}
}

# 检查 Docker 是否运行
check_docker() {
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        USE_DOCKER=true
        print_info "检测到 Docker 环境"
    else
        USE_DOCKER=false
        print_info "使用本地命令"
    fi
}

# ============================================
# 导出功能
# ============================================

# 导出 PostgreSQL 数据库
export_database() {
    print_info "导出 PostgreSQL 数据库..."
    
    get_db_config
    
    local EXPORT_FILE="$EXPORT_DIR/database-$TIMESTAMP.sql.gz"
    
    if [ "$USE_DOCKER" = true ]; then
        # Docker 方式
        local POSTGRES_CONTAINER=$(docker ps --filter "ancestor=postgres" --format "{{.Names}}" | head -1)
        if [ -z "$POSTGRES_CONTAINER" ]; then
            POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
        fi
        
        if [ -n "$POSTGRES_CONTAINER" ]; then
            print_info "使用容器: $POSTGRES_CONTAINER"
            docker exec $POSTGRES_CONTAINER pg_dump -U $DB_USER $DB_NAME | gzip > "$EXPORT_FILE"
        else
            print_error "未找到 PostgreSQL 容器"
            return 1
        fi
    else
        # 本地命令方式
        if ! command -v pg_dump &> /dev/null; then
            print_error "pg_dump 未安装，请安装 postgresql-client"
            return 1
        fi
        PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME | gzip > "$EXPORT_FILE"
    fi
    
    if [ -f "$EXPORT_FILE" ] && [ -s "$EXPORT_FILE" ]; then
        local SIZE=$(ls -lh "$EXPORT_FILE" | awk '{print $5}')
        print_status "数据库导出完成: $EXPORT_FILE ($SIZE)"
        
        # 创建校验和
        sha256sum "$EXPORT_FILE" > "$EXPORT_FILE.sha256"
        print_status "校验文件: $EXPORT_FILE.sha256"
        
        echo "$EXPORT_FILE"
    else
        print_error "数据库导出失败"
        return 1
    fi
}

# 导出 Redis 数据
export_redis() {
    print_info "导出 Redis 数据..."
    
    get_redis_config
    
    local EXPORT_FILE="$EXPORT_DIR/redis-$TIMESTAMP.rdb"
    
    if [ "$USE_DOCKER" = true ]; then
        local REDIS_CONTAINER=$(docker ps --filter "ancestor=redis" --format "{{.Names}}" | head -1)
        if [ -z "$REDIS_CONTAINER" ]; then
            REDIS_CONTAINER=$(docker ps --filter "name=redis" --format "{{.Names}}" | head -1)
        fi
        
        if [ -n "$REDIS_CONTAINER" ]; then
            print_info "使用容器: $REDIS_CONTAINER"
            
            # 触发 RDB 快照
            if [ -n "$REDIS_PASS" ]; then
                docker exec $REDIS_CONTAINER redis-cli -a "$REDIS_PASS" BGSAVE
            else
                docker exec $REDIS_CONTAINER redis-cli BGSAVE
            fi
            
            # 等待快照完成
            sleep 2
            
            # 复制 RDB 文件
            docker cp $REDIS_CONTAINER:/data/dump.rdb "$EXPORT_FILE"
        else
            print_warning "未找到 Redis 容器，跳过 Redis 导出"
            return 0
        fi
    else
        if ! command -v redis-cli &> /dev/null; then
            print_warning "redis-cli 未安装，跳过 Redis 导出"
            return 0
        fi
        
        # 触发 RDB 快照
        if [ -n "$REDIS_PASS" ]; then
            redis-cli -h $REDIS_HOST -p $REDIS_PORT -a "$REDIS_PASS" BGSAVE
        else
            redis-cli -h $REDIS_HOST -p $REDIS_PORT BGSAVE
        fi
        
        sleep 2
        
        # 复制 RDB 文件（默认路径）
        local RDB_PATH="/var/lib/redis/dump.rdb"
        if [ -f "$RDB_PATH" ]; then
            cp "$RDB_PATH" "$EXPORT_FILE"
        else
            print_warning "RDB 文件未找到: $RDB_PATH"
            return 0
        fi
    fi
    
    if [ -f "$EXPORT_FILE" ] && [ -s "$EXPORT_FILE" ]; then
        local SIZE=$(ls -lh "$EXPORT_FILE" | awk '{print $5}')
        print_status "Redis 导出完成: $EXPORT_FILE ($SIZE)"
        sha256sum "$EXPORT_FILE" > "$EXPORT_FILE.sha256"
        echo "$EXPORT_FILE"
    else
        print_warning "Redis 导出跳过（无数据或无权限）"
    fi
}

# 导出配置文件
export_config() {
    print_info "导出配置文件..."
    
    local CONFIG_FILE="$EXPORT_DIR/config-$TIMESTAMP.tar.gz"
    local CONFIG_FILES=""
    
    # 收集配置文件
    [ -f "$PROJECT_DIR/.env" ] && CONFIG_FILES="$CONFIG_FILES .env"
    [ -f "$PROJECT_DIR/.env.production" ] && CONFIG_FILES="$CONFIG_FILES .env.production"
    [ -f "$PROJECT_DIR/docker-compose.yml" ] && CONFIG_FILES="$CONFIG_FILES docker-compose.yml"
    [ -f "$PROJECT_DIR/docker-compose.prod.yml" ] && CONFIG_FILES="$CONFIG_FILES docker-compose.prod.yml"
    [ -d "$PROJECT_DIR/config" ] && CONFIG_FILES="$CONFIG_FILES config"
    [ -d "$PROJECT_DIR/monitoring" ] && CONFIG_FILES="$CONFIG_FILES monitoring"
    
    if [ -n "$CONFIG_FILES" ]; then
        tar -czf "$CONFIG_FILE" -C "$PROJECT_DIR" $CONFIG_FILES 2>/dev/null
        local SIZE=$(ls -lh "$CONFIG_FILE" | awk '{print $5}')
        print_status "配置导出完成: $CONFIG_FILE ($SIZE)"
        sha256sum "$CONFIG_FILE" > "$CONFIG_FILE.sha256"
        echo "$CONFIG_FILE"
    else
        print_warning "未找到配置文件"
    fi
}

# 导出上传文件（如有）
export_uploads() {
    print_info "检查上传文件..."
    
    local UPLOADS_DIR="$PROJECT_DIR/uploads"
    
    if [ -d "$UPLOADS_DIR" ] && [ "$(ls -A $UPLOADS_DIR 2>/dev/null)" ]; then
        local UPLOADS_FILE="$EXPORT_DIR/uploads-$TIMESTAMP.tar.gz"
        tar -czf "$UPLOADS_FILE" -C "$PROJECT_DIR" uploads
        local SIZE=$(ls -lh "$UPLOADS_FILE" | awk '{print $5}')
        print_status "上传文件导出完成: $UPLOADS_FILE ($SIZE)"
        sha256sum "$UPLOADS_FILE" > "$UPLOADS_FILE.sha256"
        echo "$UPLOADS_FILE"
    else
        print_info "无上传文件需要导出"
    fi
}

# 创建完整导出包
create_export_package() {
    print_info "创建完整导出包..."
    
    local PACKAGE_NAME="lsm-export-$TIMESTAMP"
    local PACKAGE_DIR="$EXPORT_DIR/$PACKAGE_NAME"
    
    mkdir -p "$PACKAGE_DIR"
    
    # 收集所有导出文件
    local DB_FILE=$(ls -t $EXPORT_DIR/database-*.sql.gz 2>/dev/null | head -1)
    local REDIS_FILE=$(ls -t $EXPORT_DIR/redis-*.rdb 2>/dev/null | head -1)
    local CONFIG_FILE=$(ls -t $EXPORT_DIR/config-*.tar.gz 2>/dev/null | head -1)
    local UPLOADS_FILE=$(ls -t $EXPORT_DIR/uploads-*.tar.gz 2>/dev/null | head -1)
    
    [ -f "$DB_FILE" ] && cp "$DB_FILE" "$PACKAGE_DIR/" && cp "$DB_FILE.sha256" "$PACKAGE_DIR/"
    [ -f "$REDIS_FILE" ] && cp "$REDIS_FILE" "$PACKAGE_DIR/" && cp "$REDIS_FILE.sha256" "$PACKAGE_DIR/"
    [ -f "$CONFIG_FILE" ] && cp "$CONFIG_FILE" "$PACKAGE_DIR/" && cp "$CONFIG_FILE.sha256" "$PACKAGE_DIR/"
    [ -f "$UPLOADS_FILE" ] && cp "$UPLOADS_FILE" "$PACKAGE_DIR/" && cp "$UPLOADS_FILE.sha256" "$PACKAGE_DIR/"
    
    # 创建元数据
    cat > "$PACKAGE_DIR/manifest.json" << EOF
{
    "version": "3.2.2",
    "export_time": "$(date -Iseconds)",
    "hostname": "$(hostname)",
    "components": {
        "database": $([ -f "$DB_FILE" ] && echo "true" || echo "false"),
        "redis": $([ -f "$REDIS_FILE" ] && echo "true" || echo "false"),
        "config": $([ -f "$CONFIG_FILE" ] && echo "true" || echo "false"),
        "uploads": $([ -f "$UPLOADS_FILE" ] && echo "true" || echo "false")
    }
}
EOF
    
    # 打包
    local PACKAGE_FILE="$EXPORT_DIR/$PACKAGE_NAME.tar.gz"
    tar -czf "$PACKAGE_FILE" -C "$EXPORT_DIR" "$PACKAGE_NAME"
    
    local SIZE=$(ls -lh "$PACKAGE_FILE" | awk '{print $5}')
    print_status "完整导出包: $PACKAGE_FILE ($SIZE)"
    sha256sum "$PACKAGE_FILE" > "$PACKAGE_FILE.sha256"
    
    # 清理临时文件
    rm -rf "$PACKAGE_DIR"
    
    echo "$PACKAGE_FILE"
}

# ============================================
# 导入功能
# ============================================

# 导入数据库
import_database() {
    local IMPORT_FILE=$1
    
    if [ ! -f "$IMPORT_FILE" ]; then
        print_error "文件不存在: $IMPORT_FILE"
        return 1
    fi
    
    print_info "导入 PostgreSQL 数据库..."
    
    get_db_config
    
    echo -e "${RED}⚠️  警告: 这将覆盖当前数据库中的所有数据！${NC}"
    echo "文件: $IMPORT_FILE"
    echo ""
    
    read -p "输入 'IMPORT' 确认导入: " -r
    echo
    
    if [[ $REPLY != "IMPORT" ]]; then
        print_warning "导入已取消"
        return 0
    fi
    
    # 验证文件
    if [ -f "$IMPORT_FILE.sha256" ]; then
        print_info "验证文件完整性..."
        if sha256sum -c "$IMPORT_FILE.sha256" &> /dev/null; then
            print_status "校验通过"
        else
            print_error "校验失败，文件可能已损坏"
            return 1
        fi
    fi
    
    if [ "$USE_DOCKER" = true ]; then
        local POSTGRES_CONTAINER=$(docker ps --filter "ancestor=postgres" --format "{{.Names}}" | head -1)
        [ -z "$POSTGRES_CONTAINER" ] && POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
        
        if [ -n "$POSTGRES_CONTAINER" ]; then
            print_info "使用容器: $POSTGRES_CONTAINER"
            
            # 解压并导入
            if [[ "$IMPORT_FILE" == *.gz ]]; then
                gunzip -c "$IMPORT_FILE" | docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER $DB_NAME
            else
                docker exec -i $POSTGRES_CONTAINER psql -U $DB_USER $DB_NAME < "$IMPORT_FILE"
            fi
        else
            print_error "未找到 PostgreSQL 容器"
            return 1
        fi
    else
        if ! command -v psql &> /dev/null; then
            print_error "psql 未安装"
            return 1
        fi
        
        if [[ "$IMPORT_FILE" == *.gz ]]; then
            gunzip -c "$IMPORT_FILE" | PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        else
            PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME < "$IMPORT_FILE"
        fi
    fi
    
    print_status "数据库导入完成"
}

# 导入 Redis
import_redis() {
    local IMPORT_FILE=$1
    
    if [ ! -f "$IMPORT_FILE" ]; then
        print_error "文件不存在: $IMPORT_FILE"
        return 1
    fi
    
    print_info "导入 Redis 数据..."
    
    get_redis_config
    
    echo -e "${RED}⚠️  警告: 这将覆盖当前 Redis 中的所有数据！${NC}"
    echo "文件: $IMPORT_FILE"
    echo ""
    
    read -p "输入 'IMPORT' 确认导入: " -r
    echo
    
    if [[ $REPLY != "IMPORT" ]]; then
        print_warning "导入已取消"
        return 0
    fi
    
    if [ "$USE_DOCKER" = true ]; then
        local REDIS_CONTAINER=$(docker ps --filter "ancestor=redis" --format "{{.Names}}" | head -1)
        [ -z "$REDIS_CONTAINER" ] && REDIS_CONTAINER=$(docker ps --filter "name=redis" --format "{{.Names}}" | head -1)
        
        if [ -n "$REDIS_CONTAINER" ]; then
            print_info "使用容器: $REDIS_CONTAINER"
            
            # 停止 Redis
            docker stop $REDIS_CONTAINER
            
            # 复制 RDB 文件
            docker cp "$IMPORT_FILE" $REDIS_CONTAINER:/data/dump.rdb
            
            # 启动 Redis
            docker start $REDIS_CONTAINER
            
            print_status "Redis 导入完成"
        else
            print_error "未找到 Redis 容器"
            return 1
        fi
    else
        # 停止 Redis
        sudo systemctl stop redis
        
        # 复制 RDB 文件
        sudo cp "$IMPORT_FILE" /var/lib/redis/dump.rdb
        sudo chown redis:redis /var/lib/redis/dump.rdb
        
        # 启动 Redis
        sudo systemctl start redis
        
        print_status "Redis 导入完成"
    fi
}

# 从完整包导入
import_from_package() {
    local PACKAGE_FILE=$1
    
    if [ ! -f "$PACKAGE_FILE" ]; then
        print_error "文件不存在: $PACKAGE_FILE"
        return 1
    fi
    
    print_info "解压导出包..."
    
    local EXTRACT_DIR="$EXPORT_DIR/restore-$TIMESTAMP"
    mkdir -p "$EXTRACT_DIR"
    
    tar -xzf "$PACKAGE_FILE" -C "$EXTRACT_DIR"
    
    # 找到解压后的目录
    local PACKAGE_DIR=$(ls -d $EXTRACT_DIR/*/ 2>/dev/null | head -1)
    
    if [ -z "$PACKAGE_DIR" ]; then
        print_error "无法解压导出包"
        return 1
    fi
    
    # 读取 manifest
    if [ -f "$PACKAGE_DIR/manifest.json" ]; then
        print_info "导出包信息:"
        cat "$PACKAGE_DIR/manifest.json" | jq '.' 2>/dev/null || cat "$PACKAGE_DIR/manifest.json"
        echo ""
    fi
    
    # 导入各组件
    echo -e "${YELLOW}选择要导入的组件:${NC}"
    echo "1) 全部"
    echo "2) 仅数据库"
    echo "3) 仅 Redis"
    echo "4) 仅配置"
    echo "5) 取消"
    echo ""
    read -p "选择 [1-5]: " choice
    
    case $choice in
        1)
            # 全部导入
            if [ -f "$PACKAGE_DIR/database-"*.sql.gz ]; then
                import_database "$PACKAGE_DIR/database-"*.sql.gz
            fi
            if [ -f "$PACKAGE_DIR/redis-"*.rdb ]; then
                import_redis "$PACKAGE_DIR/redis-"*.rdb
            fi
            if [ -f "$PACKAGE_DIR/config-"*.tar.gz ]; then
                print_info "配置文件请手动解压: $PACKAGE_DIR/config-"*.tar.gz
            fi
            ;;
        2)
            if [ -f "$PACKAGE_DIR/database-"*.sql.gz ]; then
                import_database "$PACKAGE_DIR/database-"*.sql.gz
            else
                print_error "导出包中无数据库文件"
            fi
            ;;
        3)
            if [ -f "$PACKAGE_DIR/redis-"*.rdb ]; then
                import_redis "$PACKAGE_DIR/redis-"*.rdb
            else
                print_error "导出包中无 Redis 文件"
            fi
            ;;
        4)
            print_info "配置文件位置: $PACKAGE_DIR"
            ;;
        5)
            print_warning "导入已取消"
            ;;
        *)
            print_error "无效选择"
            ;;
    esac
    
    # 清理
    read -p "是否删除临时文件? [y/N]: " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$EXTRACT_DIR"
        print_status "临时文件已删除"
    fi
}

# ============================================
# 列表和清理
# ============================================

list_exports() {
    echo -e "${YELLOW}可用的导出文件:${NC}"
    echo ""
    
    if [ ! -d "$EXPORT_DIR" ] || [ -z "$(ls -A $EXPORT_DIR 2>/dev/null)" ]; then
        print_warning "暂无导出文件"
        return 0
    fi
    
    echo "位置: $EXPORT_DIR"
    echo ""
    
    # 完整导出包
    echo -e "${BLUE}完整导出包:${NC}"
    ls -lht "$EXPORT_DIR"/lsm-export-*.tar.gz 2>/dev/null | awk '{print "  " $NF "  (" $5 ")"}' || echo "  无"
    echo ""
    
    # 数据库导出
    echo -e "${BLUE}数据库导出:${NC}"
    ls -lht "$EXPORT_DIR"/database-*.sql.gz 2>/dev/null | awk '{print "  " $NF "  (" $5 ")"}' || echo "  无"
    echo ""
    
    # Redis 导出
    echo -e "${BLUE}Redis 导出:${NC}"
    ls -lht "$EXPORT_DIR"/redis-*.rdb 2>/dev/null | awk '{print "  " $NF "  (" $5 ")"}' || echo "  无"
    echo ""
    
    # 统计
    local TOTAL=$(ls "$EXPORT_DIR"/*.tar.gz "$EXPORT_DIR"/*.sql.gz "$EXPORT_DIR"/*.rdb 2>/dev/null | wc -l)
    local TOTAL_SIZE=$(du -sh "$EXPORT_DIR" 2>/dev/null | awk '{print $1}')
    print_status "共 $TOTAL 个文件，总大小: $TOTAL_SIZE"
}

# 清理旧导出
prune_exports() {
    print_info "清理 $RETENTION_DAYS 天前的导出文件..."
    
    if [ -d "$EXPORT_DIR" ]; then
        local COUNT_BEFORE=$(ls "$EXPORT_DIR"/*.{tar.gz,sql.gz,rdb,sha256} 2>/dev/null | wc -l)
        
        find "$EXPORT_DIR" -type f -mtime +$RETENTION_DAYS -delete
        
        local COUNT_AFTER=$(ls "$EXPORT_DIR"/*.{tar.gz,sql.gz,rdb,sha256} 2>/dev/null | wc -l)
        local DELETED=$((COUNT_BEFORE - COUNT_AFTER))
        
        print_status "已删除 $DELETED 个旧文件"
    fi
}

# ============================================
# 升级辅助
# ============================================

# 升级前导出
pre_upgrade_export() {
    echo -e "${PURPLE}============================================${NC}"
    echo -e "${PURPLE}    升级前数据导出${NC}"
    echo -e "${PURPLE}============================================${NC}"
    echo ""
    
    print_warning "建议在每次升级前执行完整备份"
    echo ""
    
    # 执行完整导出
    export_all
}

# 升级后验证
post_upgrade_verify() {
    echo -e "${PURPLE}============================================${NC}"
    echo -e "${PURPLE}    升级后数据验证${NC}"
    echo -e "${PURPLE}============================================${NC}"
    echo ""
    
    get_db_config
    get_redis_config
    
    print_info "验证数据库..."
    
    if [ "$USE_DOCKER" = true ]; then
        local POSTGRES_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -1)
        if [ -n "$POSTGRES_CONTAINER" ]; then
            docker exec $POSTGRES_CONTAINER pg_isready -U $DB_USER
            print_status "数据库连接正常"
            
            # 检查表数量
            local TABLE_COUNT=$(docker exec $POSTGRES_CONTAINER psql -U $DB_USER $DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
            print_info "数据表数量: $TABLE_COUNT"
        fi
    else
        if PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME -c "SELECT 1;" &> /dev/null; then
            print_status "数据库连接正常"
        fi
    fi
    
    print_info "验证 Redis..."
    
    if [ "$USE_DOCKER" = true ]; then
        local REDIS_CONTAINER=$(docker ps --filter "name=redis" --format "{{.Names}}" | head -1)
        if [ -n "$REDIS_CONTAINER" ]; then
            if [ -n "$REDIS_PASS" ]; then
                docker exec $REDIS_CONTAINER redis-cli -a "$REDIS_PASS" ping
            else
                docker exec $REDIS_CONTAINER redis-cli ping
            fi
            print_status "Redis 连接正常"
        fi
    else
        if [ -n "$REDIS_PASS" ]; then
            redis-cli -h $REDIS_HOST -p $REDIS_PORT -a "$REDIS_PASS" ping
        else
            redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
        fi
        print_status "Redis 连接正常"
    fi
    
    print_status "验证完成"
}

# ============================================
# 主命令
# ============================================

# 完整导出
export_all() {
    ensure_export_dir
    load_env
    check_docker
    
    echo -e "${YELLOW}开始完整导出...${NC}"
    echo ""
    
    export_database
    export_redis
    export_config
    export_uploads
    
    echo ""
    create_export_package
    
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}    导出完成！${NC}"
    echo -e "${GREEN}============================================${NC}"
}

# 显示帮助
show_help() {
    echo "LSM 数据导出导入工具"
    echo ""
    echo "用法: $0 <命令> [参数]"
    echo ""
    echo "命令:"
    echo "  export              - 完整导出（数据库 + Redis + 配置）"
    echo "  export-db           - 仅导出数据库"
    echo "  export-redis        - 仅导出 Redis"
    echo "  export-config       - 仅导出配置文件"
    echo ""
    echo "  import <file>       - 从完整包导入"
    echo "  import-db <file>    - 导入数据库"
    echo "  import-redis <file> - 导入 Redis"
    echo ""
    echo "  list                - 列出所有导出文件"
    echo "  prune               - 清理旧导出文件"
    echo ""
    echo "  pre-upgrade         - 升级前备份（完整导出）"
    echo "  post-upgrade        - 升级后验证"
    echo ""
    echo "环境变量:"
    echo "  DATABASE_URL        - 数据库连接字符串"
    echo "  REDIS_HOST          - Redis 主机"
    echo "  REDIS_PORT          - Redis 端口"
    echo "  REDIS_PASSWORD      - Redis 密码"
    echo "  BACKUP_RETENTION_DAYS - 导出保留天数 (默认: 30)"
    echo ""
    echo "示例:"
    echo "  $0 export                    # 完整导出"
    echo "  $0 import lsm-export-xxx.tar.gz  # 从包导入"
    echo "  $0 pre-upgrade               # 升级前备份"
}

# 主入口
main() {
    case "${1:-help}" in
        export)
            export_all
            ;;
        export-db)
            load_env
            check_docker
            ensure_export_dir
            export_database
            ;;
        export-redis)
            load_env
            check_docker
            ensure_export_dir
            export_redis
            ;;
        export-config)
            ensure_export_dir
            export_config
            ;;
        import)
            if [ -z "$2" ]; then
                print_error "请指定导出包文件"
                echo "用法: $0 import <package.tar.gz>"
                exit 1
            fi
            load_env
            check_docker
            import_from_package "$2"
            ;;
        import-db)
            if [ -z "$2" ]; then
                print_error "请指定数据库文件"
                exit 1
            fi
            load_env
            check_docker
            import_database "$2"
            ;;
        import-redis)
            if [ -z "$2" ]; then
                print_error "请指定 Redis 文件"
                exit 1
            fi
            load_env
            check_docker
            import_redis "$2"
            ;;
        list)
            list_exports
            ;;
        prune)
            prune_exports
            ;;
        pre-upgrade)
            pre_upgrade_export
            ;;
        post-upgrade)
            load_env
            check_docker
            post_upgrade_verify
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"