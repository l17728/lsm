#!/bin/bash

# LSM Project - Database Migration Script
# Usage: ./scripts/database-migration.sh [backup|migrate|rollback|status]
# Date: 2026-03-13

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/src/backend"
BACKUP_DIR="${PROJECT_ROOT}/backups/database"

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

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup database
backup_database() {
    print_status "Creating database backup..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="${BACKUP_DIR}/lsm_backup_${TIMESTAMP}.sql"
    
    # Get database credentials from .env
    if [ -f "${PROJECT_ROOT}/.env.production" ]; then
        set -a
        source "${PROJECT_ROOT}/.env.production"
        set +a
    else
        print_error ".env.production not found"
        exit 1
    fi
    
    # Backup using pg_dump
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h localhost \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        -F c \
        -f "${BACKUP_FILE}.dump"
    
    # Also create SQL format backup
    PGPASSWORD="${DB_PASSWORD}" pg_dump \
        -h localhost \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        > "${BACKUP_FILE}.sql"
    
    # Compress
    gzip "${BACKUP_FILE}.sql"
    
    print_success "Backup created:"
    echo "  - ${BACKUP_FILE}.dump"
    echo "  - ${BACKUP_FILE}.sql.gz"
    
    # Keep only last 10 backups
    cd "${BACKUP_DIR}"
    ls -t *.dump 2>/dev/null | tail -n +11 | xargs -r rm
    ls -t *.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm
    
    print_success "Old backups cleaned (keeping last 10)"
}

# Run migrations
run_migrations() {
    print_status "Running database migrations..."
    
    cd "${BACKEND_DIR}"
    
    # Check migration status
    print_status "Checking migration status..."
    npx prisma migrate status
    
    echo ""
    print_warning "This will apply pending migrations. Continue?"
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    
    # Run migrations
    print_status "Applying migrations..."
    npx prisma migrate deploy
    
    # Generate Prisma client
    print_status "Generating Prisma client..."
    npx prisma generate
    
    print_success "Migrations completed successfully"
}

# Rollback last migration
rollback_migration() {
    print_status "Rolling back last migration..."
    
    cd "${BACKEND_DIR}"
    
    print_warning "This will rollback the last migration. Continue?"
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    
    # Rollback one migration
    npx prisma migrate resolve --rolled-back
    
    print_success "Rollback completed"
}

# Show migration status
show_status() {
    print_status "Database Migration Status"
    echo ""
    
    cd "${BACKEND_DIR}"
    
    # Show migration history
    print_status "Migration History:"
    npx prisma migrate status
    
    echo ""
    print_status "Available Backups:"
    ls -lh "${BACKUP_DIR}"/*.dump 2>/dev/null || echo "  No backups found"
    
    echo ""
    print_status "Database Schema:"
    npx prisma db pull --print
}

# Verify data integrity
verify_integrity() {
    print_status "Verifying data integrity..."
    
    cd "${BACKEND_DIR}"
    
    # Check database connection
    print_status "Testing database connection..."
    npx prisma db execute --stdin <<EOF
SELECT 1;
EOF
    
    # Count records in key tables
    print_status "Checking record counts..."
    npx prisma db execute --stdin <<EOF
SELECT 
    'users' as table_name, COUNT(*) as count FROM "User"
UNION ALL
SELECT 
    'servers' as table_name, COUNT(*) as count FROM "Server"
UNION ALL
SELECT 
    'gpus' as table_name, COUNT(*) as count FROM "GPU"
UNION ALL
SELECT 
    'tasks' as table_name, COUNT(*) as count FROM "Task";
EOF
    
    print_success "Data integrity check completed"
}

# Show help
show_help() {
    echo "LSM Database Migration Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  backup    Create database backup"
    echo "  migrate   Run database migrations"
    echo "  rollback  Rollback last migration"
    echo "  status    Show migration status"
    echo "  verify    Verify data integrity"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 backup"
    echo "  $0 migrate"
    echo "  $0 status"
}

# Main
case "${1:-help}" in
    backup)
        backup_database
        ;;
    migrate)
        backup_database
        run_migrations
        verify_integrity
        ;;
    rollback)
        rollback_migration
        ;;
    status)
        show_status
        ;;
    verify)
        verify_integrity
        ;;
    help)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac
