#!/bin/bash
# LSM Database Rollback Script - Production
# Usage: ./scripts/rollback.sh [migration_name|count]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LSM Database Rollback Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to create backup before rollback
create_backup() {
    echo -e "${YELLOW}Creating pre-rollback backup...${NC}"
    
    BACKUP_DIR="$PROJECT_DIR/backups"
    BACKUP_FILE="$BACKUP_DIR/rollback-backup-$(date +%Y%m%d-%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    # Extract connection details
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    if command -v pg_dump &> /dev/null; then
        PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f $BACKUP_FILE
        print_status "Backup created: $BACKUP_FILE"
    else
        print_warning "pg_dump not found, skipping backup"
    fi
    
    echo ""
}

# Function to rollback to specific migration
rollback_to() {
    local TARGET=$1
    
    echo -e "${YELLOW}Rolling back to: $TARGET${NC}"
    
    cd "$BACKEND_DIR"
    
    # First, show current status
    print_status "Current migration status:"
    npx prisma migrate status
    
    echo ""
    read -p "Are you sure you want to rollback? This action cannot be undone. (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Rollback cancelled"
        exit 0
    fi
    
    # Perform rollback
    if [[ "$TARGET" =~ ^[0-9]+$ ]]; then
        # Rollback by count
        print_status "Rolling back $TARGET migration(s)..."
        for ((i=1; i<=$TARGET; i++)); do
            npx prisma migrate resolve --rolled-back
            print_status "Rollback $i completed"
        done
    else
        # Rollback to specific migration
        print_status "Rolling back to migration: $TARGET..."
        npx prisma migrate resolve --rolled-back "$TARGET"
    fi
    
    echo ""
    print_status "Verifying rollback..."
    npx prisma migrate status
    
    print_status "✅ Rollback completed successfully!"
}

# Function to reset database (dangerous!)
reset_database() {
    echo -e "${RED}⚠️  WARNING: This will DELETE ALL DATA! ⚠️${NC}"
    echo ""
    read -p "Type 'RESET' to confirm database reset: " -r
    echo
    
    if [[ $REPLY != "RESET" ]]; then
        print_warning "Database reset cancelled"
        exit 0
    fi
    
    cd "$BACKEND_DIR"
    
    print_warning "Dropping all database objects..."
    npx prisma migrate reset --force
    
    print_status "Database reset completed"
    echo ""
    
    # Optionally seed
    read -p "Do you want to seed the database? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx prisma db seed
        print_status "Database seeded"
    fi
}

# Main script
main() {
    if [ $# -eq 0 ]; then
        echo "Usage: $0 <migration_name|count>"
        echo ""
        echo "Examples:"
        echo "  $0 20260312000000    - Rollback to specific migration"
        echo "  $0 1                 - Rollback 1 migration"
        echo "  $0 3                 - Rollback 3 migrations"
        echo "  $0 --reset           - Reset entire database (DESTRUCTIVE)"
        echo ""
        echo "Environment variables:"
        echo "  DATABASE_URL  - Database connection string"
        exit 1
    fi
    
    if [ "$1" == "--reset" ]; then
        create_backup
        reset_database
    else
        create_backup
        rollback_to "$1"
    fi
}

main "$@"
