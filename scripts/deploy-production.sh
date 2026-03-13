#!/bin/bash

# LSM Project - Production Deployment Script
# Usage: ./scripts/deploy-production.sh
# Date: 2026-03-13

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.production"
DOCKER_COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  LSM Project - Production Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env.production exists
check_env_file() {
    print_status "Checking environment configuration..."
    
    if [ ! -f "${ENV_FILE}" ]; then
        print_error ".env.production not found!"
        print_warning "Please create .env.production from .env.example"
        print_warning "Command: cp .env.example .env.production"
        exit 1
    fi
    
    print_success "Environment file found"
}

# Check Docker and Docker Compose
check_docker() {
    print_status "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_success "Docker $(docker --version) found"
    print_success "Docker Compose $(docker-compose --version) found"
}

# Check environment variables
check_env_vars() {
    print_status "Validating environment variables..."
    
    # Source the env file
    set -a
    source "${ENV_FILE}"
    set +a
    
    # Required variables
    required_vars=(
        "JWT_SECRET"
        "DB_PASSWORD"
        "REDIS_PASSWORD"
        "CORS_ORIGINS"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    # Check JWT_SECRET strength
    if [ ${#JWT_SECRET} -lt 32 ]; then
        print_error "JWT_SECRET is too short (minimum 32 characters)"
        exit 1
    fi
    
    print_success "All required environment variables are set"
}

# Backup existing data
backup_data() {
    print_status "Creating backup..."
    
    BACKUP_DIR="${PROJECT_ROOT}/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "${BACKUP_DIR}"
    
    # Backup database if running
    if docker ps | grep -q lsm-postgres; then
        print_status "Backing up PostgreSQL database..."
        docker exec lsm-postgres pg_dump -U lsm lsm | gzip > "${BACKUP_DIR}/database.sql.gz"
        print_success "Database backup created: ${BACKUP_DIR}/database.sql.gz"
    fi
    
    # Backup volumes
    if [ -d "${PROJECT_ROOT}/.data" ]; then
        print_status "Backing up data volumes..."
        cp -r "${PROJECT_ROOT}/.data" "${BACKUP_DIR}/data"
        print_success "Data volumes backup created"
    fi
    
    print_success "Backup completed: ${BACKUP_DIR}"
}

# Build Docker images
build_images() {
    print_status "Building Docker images..."
    
    cd "${PROJECT_ROOT}"
    
    # Build backend
    print_status "Building backend image..."
    docker-compose build backend
    
    # Build frontend
    print_status "Building frontend image..."
    docker-compose build frontend
    
    print_success "Docker images built successfully"
}

# Deploy services
deploy_services() {
    print_status "Deploying services..."
    
    cd "${PROJECT_ROOT}"
    
    # Stop existing services
    print_status "Stopping existing services..."
    docker-compose down
    
    # Start all services
    print_status "Starting production services..."
    docker-compose --env-file "${ENV_FILE}" up -d
    
    print_success "Services deployed"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # Wait for database to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Run migrations
    docker-compose exec -T backend npx prisma migrate deploy
    
    # Generate Prisma client
    docker-compose exec -T backend npx prisma generate
    
    print_success "Database migrations completed"
}

# Health check
health_check() {
    print_status "Running health checks..."
    
    # Wait for services to start
    sleep 15
    
    # Check PostgreSQL
    if docker ps | grep -q lsm-postgres; then
        print_success "PostgreSQL is running"
    else
        print_error "PostgreSQL failed to start"
        return 1
    fi
    
    # Check Redis
    if docker ps | grep -q lsm-redis; then
        print_success "Redis is running"
    else
        print_error "Redis failed to start"
        return 1
    fi
    
    # Check Backend
    if docker ps | grep -q lsm-backend; then
        print_success "Backend is running"
    else
        print_error "Backend failed to start"
        return 1
    fi
    
    # Check Frontend
    if docker ps | grep -q lsm-frontend; then
        print_success "Frontend is running"
    else
        print_error "Frontend failed to start"
        return 1
    fi
    
    # Check Prometheus
    if docker ps | grep -q lsm-prometheus; then
        print_success "Prometheus is running"
    else
        print_error "Prometheus failed to start"
        return 1
    fi
    
    # Check Grafana
    if docker ps | grep -q lsm-grafana; then
        print_success "Grafana is running"
    else
        print_error "Grafana failed to start"
        return 1
    fi
    
    print_success "All health checks passed"
}

# Show service status
show_status() {
    echo ""
    print_status "Service Status:"
    docker-compose ps
    
    echo ""
    print_status "Access URLs:"
    echo "  Frontend:    http://localhost"
    echo "  Backend API: http://localhost:8080"
    echo "  Prometheus:  http://localhost:9090"
    echo "  Grafana:     http://localhost:3000"
    echo ""
}

# Main deployment process
main() {
    echo ""
    
    # Pre-deployment checks
    check_env_file
    check_docker
    check_env_vars
    
    echo ""
    print_warning "This will deploy LSM to production. Continue?"
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    
    echo ""
    
    # Backup
    backup_data
    
    echo ""
    
    # Build
    build_images
    
    echo ""
    
    # Deploy
    deploy_services
    
    echo ""
    
    # Migrations
    run_migrations
    
    echo ""
    
    # Health check
    if health_check; then
        echo ""
        print_success "=========================================="
        print_success "  Production Deployment Completed!"
        print_success "=========================================="
        show_status
    else
        echo ""
        print_error "=========================================="
        print_error "  Deployment Failed - Health Check Error"
        print_error "=========================================="
        print_warning "Check logs: docker-compose logs"
        exit 1
    fi
}

# Run main function
main
