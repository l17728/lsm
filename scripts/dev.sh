#!/bin/bash

# LSM Project - Development Environment Script
# 启动开发调试环境（不使用Docker镜像）
# 前端: http://localhost:8081 (Vite dev server with HMR)
# 后端: http://localhost:8080 (Node.js with ts-node-dev hot reload)

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="${PROJECT_ROOT}/src/frontend"
BACKEND_DIR="${PROJECT_ROOT}/src/backend"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  LSM Development Environment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}[CHECK]${NC} Checking dependencies..."
    
    if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
        echo -e "${YELLOW}[INSTALL]${NC} Installing frontend dependencies..."
        cd "${FRONTEND_DIR}" && npm install
    fi
    
    if [ ! -d "${BACKEND_DIR}/node_modules" ]; then
        echo -e "${YELLOW}[INSTALL]${NC} Installing backend dependencies..."
        cd "${BACKEND_DIR}" && npm install
    fi
    
    echo -e "${GREEN}[OK]${NC} Dependencies ready"
}

# 启动后端开发服务器
start_backend() {
    echo -e "${GREEN}[START]${NC} Starting backend dev server on port 8080..."
    cd "${BACKEND_DIR}"
    
    # 使用 tmux 或后台运行
    if command -v tmux &> /dev/null; then
        tmux has-session -t lsm-backend 2>/dev/null || tmux new-session -d -s lsm-backend "npm run dev"
        echo -e "${GREEN}[OK]${NC} Backend running in tmux session 'lsm-backend'"
    else
        nohup npm run dev > /tmp/lsm-backend-dev.log 2>&1 &
        echo $! > /tmp/lsm-backend-dev.pid
        echo -e "${GREEN}[OK]${NC} Backend running (PID: $(cat /tmp/lsm-backend-dev.pid))"
    fi
}

# 启动前端开发服务器
start_frontend() {
    echo -e "${GREEN}[START]${NC} Starting frontend dev server on port 8081..."
    cd "${FRONTEND_DIR}"
    
    if command -v tmux &> /dev/null; then
        tmux has-session -t lsm-frontend 2>/dev/null || tmux new-session -d -s lsm-frontend "npm run dev"
        echo -e "${GREEN}[OK]${NC} Frontend running in tmux session 'lsm-frontend'"
    else
        nohup npm run dev > /tmp/lsm-frontend-dev.log 2>&1 &
        echo $! > /tmp/lsm-frontend-dev.pid
        echo -e "${GREEN}[OK]${NC} Frontend running (PID: $(cat /tmp/lsm-frontend-dev.pid))"
    fi
}

# 显示状态
show_status() {
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}  Development Environment Started!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo -e "  ${BLUE}Frontend:${NC} http://localhost:8081"
    echo -e "  ${BLUE}Backend:${NC}  http://localhost:8080"
    echo ""
    echo -e "  ${YELLOW}Tips:${NC}"
    echo -e "  - 修改前端代码会自动热重载 (HMR)"
    echo -e "  - 修改后端代码会自动重启 (ts-node-dev)"
    echo -e "  - 查看后端日志: tail -f /tmp/lsm-backend-dev.log"
    echo -e "  - 查看前端日志: tail -f /tmp/lsm-frontend-dev.log"
    if command -v tmux &> /dev/null; then
        echo -e "  - 连接后端: tmux attach -t lsm-backend"
        echo -e "  - 连接前端: tmux attach -t lsm-frontend"
    fi
    echo ""
}

# 停止开发环境
stop_dev() {
    echo -e "${YELLOW}[STOP]${NC} Stopping development environment..."
    
    if command -v tmux &> /dev/null; then
        tmux kill-session -t lsm-backend 2>/dev/null || true
        tmux kill-session -t lsm-frontend 2>/dev/null || true
    fi
    
    if [ -f /tmp/lsm-backend-dev.pid ]; then
        kill $(cat /tmp/lsm-backend-dev.pid) 2>/dev/null || true
        rm /tmp/lsm-backend-dev.pid
    fi
    
    if [ -f /tmp/lsm-frontend-dev.pid ]; then
        kill $(cat /tmp/lsm-frontend-dev.pid) 2>/dev/null || true
        rm /tmp/lsm-frontend-dev.pid
    fi
    
    echo -e "${GREEN}[OK]${NC} Development environment stopped"
}

# 主逻辑
case "${1:-start}" in
    start)
        check_dependencies
        start_backend
        sleep 2
        start_frontend
        sleep 2
        show_status
        ;;
    stop)
        stop_dev
        ;;
    restart)
        stop_dev
        sleep 1
        check_dependencies
        start_backend
        sleep 2
        start_frontend
        sleep 2
        show_status
        ;;
    status)
        echo -e "${BLUE}Backend:${NC}"
        if [ -f /tmp/lsm-backend-dev.pid ]; then
            ps -p $(cat /tmp/lsm-backend-dev.pid) > /dev/null 2>&1 && echo "  Running (PID: $(cat /tmp/lsm-backend-dev.pid))" || echo "  Stopped"
        else
            tmux has-session -t lsm-backend 2>/dev/null && echo "  Running (tmux: lsm-backend)" || echo "  Stopped"
        fi
        
        echo -e "${BLUE}Frontend:${NC}"
        if [ -f /tmp/lsm-frontend-dev.pid ]; then
            ps -p $(cat /tmp/lsm-frontend-dev.pid) > /dev/null 2>&1 && echo "  Running (PID: $(cat /tmp/lsm-frontend-dev.pid))" || echo "  Stopped"
        else
            tmux has-session -t lsm-frontend 2>/dev/null && echo "  Running (tmux: lsm-frontend)" || echo "  Stopped"
        fi
        ;;
    logs)
        echo -e "${BLUE}=== Backend Logs ===${NC}"
        tail -20 /tmp/lsm-backend-dev.log 2>/dev/null || echo "No logs"
        echo ""
        echo -e "${BLUE}=== Frontend Logs ===${NC}"
        tail -20 /tmp/lsm-frontend-dev.log 2>/dev/null || echo "No logs"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac