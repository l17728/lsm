#!/bin/bash
# LSM Project - Quick Start Script
# Usage: ./quickstart.sh [dev|prod|test]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LSM Project - Quick Start${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
check_prereqs() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}✗ Docker not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Docker: $(docker --version)"
    
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}✗ Docker Compose not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Docker Compose: $(docker-compose --version)"
    
    echo ""
}

# Setup development environment
setup_dev() {
    echo -e "${YELLOW}Setting up development environment...${NC}"
    
    # Copy env if not exists
    if [ ! -f .env ]; then
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env from template"
    fi
    
    # Generate secrets if default
    if grep -q "CHANGE_ME" .env; then
        echo -e "${YELLOW}Generating development secrets...${NC}"
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=dev-secret-key-not-for-production/" .env
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=dev_db_password/" .env
        sed -i "s/REDIS_PASSWORD=.*/REDIS_PASSWORD=dev_redis_password/" .env
        echo -e "${GREEN}✓${NC} Development secrets generated"
    fi
    
    # Start services
    echo -e "${YELLOW}Starting services...${NC}"
    docker-compose up -d postgres redis
    
    echo -e "${YELLOW}Waiting for databases...${NC}"
    sleep 10
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker-compose exec -T backend npx prisma migrate deploy || true
    docker-compose exec -T backend npx prisma generate || true
    
    # Start all services
    echo -e "${YELLOW}Starting all services...${NC}"
    docker-compose up -d
    
    echo ""
    echo -e "${GREEN}✅ Development environment ready!${NC}"
    echo ""
    echo "Services:"
    echo "  Frontend:  http://localhost:3000"
    echo "  Backend:   http://localhost:8080"
    echo "  Grafana:   http://localhost:3000 (admin/admin)"
    echo "  Prometheus: http://localhost:9090"
    echo ""
    echo "Commands:"
    echo "  docker-compose logs -f    # View logs"
    echo "  docker-compose down       # Stop services"
    echo ""
}

# Setup production environment
setup_prod() {
    echo -e "${RED}⚠️  PRODUCTION DEPLOYMENT ⚠️${NC}"
    echo ""
    
    read -p "Are you sure you want to deploy to production? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo -e "${YELLOW}Production deployment cancelled${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}Setting up production environment...${NC}"
    
    # Check .env exists
    if [ ! -f .env ]; then
        echo -e "${RED}✗ .env file not found${NC}"
        echo "Please create .env from .env.example and configure for production"
        exit 1
    fi
    
    # Validate required variables
    echo -e "${YELLOW}Validating configuration...${NC}"
    required_vars=("JWT_SECRET" "DB_PASSWORD" "REDIS_PASSWORD")
    for var in "${required_vars[@]}"; do
        if grep -q "CHANGE_ME\|^$" .env | grep -q "$var"; then
            echo -e "${RED}✗ $var not configured${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✓${NC} Configuration validated"
    
    # Start services
    echo -e "${YELLOW}Starting production services...${NC}"
    docker-compose up -d
    
    # Wait for services
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    sleep 15
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker-compose exec -T backend npx prisma migrate deploy
    docker-compose exec -T backend npx prisma generate
    
    # Health check
    echo -e "${YELLOW}Running health checks...${NC}"
    if curl -f http://localhost:8080/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Backend healthy"
    else
        echo -e "${RED}✗ Backend health check failed${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ Production deployment complete!${NC}"
    echo ""
    echo "Services:"
    echo "  Frontend:  https://yourdomain.com"
    echo "  Backend:   https://api.yourdomain.com"
    echo "  Grafana:   https://monitoring.yourdomain.com"
    echo ""
}

# Run tests
run_tests() {
    echo -e "${YELLOW}Running test suite...${NC}"
    
    # Backend tests
    echo -e "${BLUE}Backend Tests:${NC}"
    docker-compose exec -T backend npm test || true
    
    # Frontend tests
    echo -e "${BLUE}Frontend Tests:${NC}"
    docker-compose exec -T frontend npm test || true
    
    echo ""
    echo -e "${GREEN}✅ Test suite complete!${NC}"
}

# Main
main() {
    check_prereqs
    
    case "${1:-dev}" in
        dev)
            setup_dev
            ;;
        prod)
            setup_prod
            ;;
        test)
            run_tests
            ;;
        *)
            echo "Usage: $0 {dev|prod|test}"
            echo ""
            echo "Commands:"
            echo "  dev   - Setup development environment"
            echo "  prod  - Deploy to production"
            echo "  test  - Run test suite"
            exit 1
            ;;
    esac
}

main "$@"
