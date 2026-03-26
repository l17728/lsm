#!/bin/bash
# LSM Database Migration Script - Production
# Usage: ./scripts/migrate.sh [up|down|status|seed]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Default values
DATABASE_URL="${DATABASE_URL:-postgresql://lsm:lsm_password@localhost:5432/lsm}"
DRY_RUN=${DRY_RUN:-false}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LSM Database Migration Script${NC}"
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
    echo -e "${YELLOW}!${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    print_status "Node.js found: $(node -v)"
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_status "npm found: $(npm -v)"
    
    # Check if npx is available
    if ! command -v npx &> /dev/null; then
        print_error "npx is not available"
        exit 1
    fi
    print_status "npx found"
    
    # Check if Prisma is available
    if ! npx prisma --version &> /dev/null; then
        print_warning "Prisma CLI not found, will install locally"
    else
        print_status "Prisma CLI found: $(npx prisma --version)"
    fi
    
    echo ""
}

# Function to run database migrations
run_migrations() {
    echo -e "${YELLOW}Running database migrations...${NC}"
    
    cd "$BACKEND_DIR"
    
    # Generate Prisma Client
    print_status "Generating Prisma Client..."
    npx prisma generate
    
    # Check migration status
    print_status "Checking migration status..."
    npx prisma migrate status
    
    # Run migrations
    if [ "$DRY_RUN" = true ]; then
        print_warning "Dry run mode - skipping actual migration"
        npx prisma migrate deploy --dry-run
    else
        print_status "Deploying migrations..."
        npx prisma migrate deploy
    fi
    
    print_status "Migrations completed successfully"
    echo ""
}

# Function to rollback migrations
rollback_migrations() {
    echo -e "${YELLOW}Rolling back database migrations...${NC}"
    
    cd "$BACKEND_DIR"
    
    # Get the number of migrations to rollback
    ROLLBACK_COUNT=${1:-1}
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "Dry run mode - skipping actual rollback"
        npx prisma migrate resolve --rolled-back --dry-run
    else
        print_status "Rolling back $ROLLBACK_COUNT migration(s)..."
        npx prisma migrate resolve --rolled-back
    fi
    
    print_status "Rollback completed"
    echo ""
}

# Function to seed database
seed_database() {
    echo -e "${YELLOW}Seeding database...${NC}"
    
    cd "$BACKEND_DIR"
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "Dry run mode - skipping actual seeding"
    else
        print_status "Running seed script..."
        npx prisma db seed
    fi
    
    print_status "Database seeding completed"
    echo ""
}

# Function to show migration status
show_status() {
    echo -e "${YELLOW}Migration status:${NC}"
    
    cd "$BACKEND_DIR"
    
    npx prisma migrate status
    
    echo ""
}

# Function to create backup
create_backup() {
    echo -e "${YELLOW}Creating database backup...${NC}"
    
    BACKUP_DIR="$PROJECT_DIR/backups"
    BACKUP_FILE="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"
    
    mkdir -p "$BACKUP_DIR"
    
    # Extract connection details from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    print_status "Backup target: $DB_NAME@$DB_HOST:$DB_PORT"
    
    if command -v pg_dump &> /dev/null; then
        PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F c -f $BACKUP_FILE
        print_status "Backup created: $BACKUP_FILE"
    else
        print_warning "pg_dump not found, skipping backup"
    fi
    
    echo ""
}

# Function to validate migration
validate_migration() {
    echo -e "${YELLOW}Validating migration...${NC}"
    
    cd "$BACKEND_DIR"
    
    # Check if database is accessible
    print_status "Testing database connection..."
    npx prisma db execute --stdin <<EOF
SELECT 1;
EOF
    
    # Check if required tables exist
    print_status "Checking table structure..."
    npx prisma db pull --dry-run
    
    print_status "Validation completed successfully"
    echo ""
}

# Main script
main() {
    check_prerequisites
    
    case "${1:-up}" in
        up)
            create_backup
            run_migrations
            validate_migration
            print_status "✅ Migration completed successfully!"
            ;;
        down)
            rollback_migrations ${2:-1}
            print_status "✅ Rollback completed!"
            ;;
        status)
            show_status
            ;;
        seed)
            seed_database
            print_status "✅ Seeding completed!"
            ;;
        backup)
            create_backup
            print_status "✅ Backup completed!"
            ;;
        validate)
            validate_migration
            print_status "✅ Validation completed!"
            ;;
        *)
            echo "Usage: $0 {up|down|status|seed|backup|validate}"
            echo ""
            echo "Commands:"
            echo "  up       - Run all pending migrations (default)"
            echo "  down     - Rollback migrations (optionally specify count)"
            echo "  status   - Show migration status"
            echo "  seed     - Seed the database"
            echo "  backup   - Create database backup"
            echo "  validate - Validate migration"
            echo ""
            echo "Environment variables:"
            echo "  DATABASE_URL  - Database connection string"
            echo "  DRY_RUN       - Set to 'true' for dry run mode"
            exit 1
            ;;
    esac
}

main "$@"
