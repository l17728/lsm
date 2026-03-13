#!/bin/bash
# LSM Database Backup Script - Production
# Usage: ./scripts/backup.sh [backup|restore|list|prune]

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
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
fi

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LSM Database Backup Script${NC}"
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

# Function to extract database connection details
extract_db_config() {
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    print_status "Database: $DB_NAME@$DB_HOST:$DB_PORT"
}

# Function to create backup
create_backup() {
    local BACKUP_TYPE=${1:-full}
    local TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    local BACKUP_FILE="$BACKUP_DIR/backup-$BACKUP_TYPE-$TIMESTAMP"
    
    echo -e "${YELLOW}Creating $BACKUP_TYPE backup...${NC}"
    extract_db_config
    
    case $BACKUP_TYPE in
        full)
            BACKUP_FILE="$BACKUP_FILE.sql.gz"
            if command -v pg_dump &> /dev/null; then
                print_status "Running pg_dump..."
                PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME | gzip > "$BACKUP_FILE"
            else
                print_error "pg_dump not found. Please install postgresql-client."
                exit 1
            fi
            ;;
        schema)
            BACKUP_FILE="$BACKUP_FILE-schema.sql"
            if command -v pg_dump &> /dev/null; then
                PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --schema-only > "$BACKUP_FILE"
            else
                print_error "pg_dump not found"
                exit 1
            fi
            ;;
        data)
            BACKUP_FILE="$BACKUP_FILE-data.sql"
            if command -v pg_dump &> /dev/null; then
                PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --data-only > "$BACKUP_FILE"
            else
                print_error "pg_dump not found"
                exit 1
            fi
            ;;
        *)
            print_error "Unknown backup type: $BACKUP_TYPE"
            exit 1
            ;;
    esac
    
    # Verify backup
    if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        local SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
        print_status "Backup created: $BACKUP_FILE ($SIZE)"
        
        # Create checksum
        sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
        print_status "Checksum created: $BACKUP_FILE.sha256"
    else
        print_error "Backup failed or empty"
        exit 1
    fi
    
    echo ""
}

# Function to restore from backup
restore_backup() {
    local BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    echo -e "${RED}⚠️  WARNING: This will OVERWRITE the current database! ⚠️${NC}"
    echo "Backup file: $BACKUP_FILE"
    echo ""
    extract_db_config
    echo ""
    
    read -p "Type 'RESTORE' to confirm: " -r
    echo
    
    if [[ $REPLY != "RESTORE" ]]; then
        print_warning "Restore cancelled"
        exit 0
    fi
    
    # Create pre-restore backup
    print_warning "Creating pre-restore backup..."
    create_backup full
    
    echo -e "${YELLOW}Restoring database...${NC}"
    
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        PGPASSWORD=$DB_PASS gunzip -c "$BACKUP_FILE" | psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME
    else
        PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < "$BACKUP_FILE"
    fi
    
    print_status "✅ Database restored successfully!"
    echo ""
}

# Function to list backups
list_backups() {
    echo -e "${YELLOW}Available backups:${NC}"
    echo ""
    
    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        echo "Location: $BACKUP_DIR"
        echo ""
        printf "%-40s %-12s %-10s\n" "Filename" "Size" "Date"
        printf "%-40s %-12s %-10s\n" "--------" "----" "----"
        
        ls -lht "$BACKUP_DIR"/*.sql* 2>/dev/null | while read -r line; do
            filename=$(echo "$line" | awk '{print $NF}' | xargs basename)
            size=$(echo "$line" | awk '{print $5}')
            date=$(echo "$line" | awk '{print $6, $7, $8}')
            printf "%-40s %-12s %-10s\n" "$filename" "$size" "$date"
        done
        
        echo ""
        local COUNT=$(ls "$BACKUP_DIR"/*.sql* 2>/dev/null | wc -l)
        print_status "Total backups: $COUNT"
    else
        print_warning "No backups found"
    fi
    
    echo ""
}

# Function to prune old backups
prune_backups() {
    echo -e "${YELLOW}Pruning backups older than $RETENTION_DAYS days...${NC}"
    
    if [ -d "$BACKUP_DIR" ]; then
        local COUNT_BEFORE=$(ls "$BACKUP_DIR"/*.sql* 2>/dev/null | wc -l)
        
        find "$BACKUP_DIR" -name "backup-*.sql*" -type f -mtime +$RETENTION_DAYS -delete
        find "$BACKUP_DIR" -name "backup-*.sha256" -type f -mtime +$RETENTION_DAYS -delete
        
        local COUNT_AFTER=$(ls "$BACKUP_DIR"/*.sql* 2>/dev/null | wc -l)
        local DELETED=$((COUNT_BEFORE - COUNT_AFTER))
        
        print_status "Deleted $DELETED old backup(s)"
        print_status "Remaining backups: $COUNT_AFTER"
    else
        print_warning "Backup directory not found"
    fi
    
    echo ""
}

# Function to verify backup integrity
verify_backup() {
    local BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        print_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    echo -e "${YELLOW}Verifying backup integrity...${NC}"
    
    # Check checksum if available
    if [ -f "$BACKUP_FILE.sha256" ]; then
        print_status "Verifying checksum..."
        if sha256sum -c "$BACKUP_FILE.sha256" &> /dev/null; then
            print_status "✅ Checksum verified"
        else
            print_error "❌ Checksum mismatch! Backup may be corrupted"
            exit 1
        fi
    else
        print_warning "No checksum file found, skipping checksum verification"
    fi
    
    # Test backup file integrity
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        print_status "Testing gzip integrity..."
        if gzip -t "$BACKUP_FILE" 2>/dev/null; then
            print_status "✅ Gzip integrity verified"
        else
            print_error "❌ Gzip file is corrupted"
            exit 1
        fi
    fi
    
    print_status "✅ Backup verification completed"
    echo ""
}

# Main script
main() {
    case "${1:-backup}" in
        backup)
            create_backup "${2:-full}"
            ;;
        restore)
            if [ -z "$2" ]; then
                print_error "Please specify backup file to restore"
                echo "Usage: $0 restore <backup_file>"
                list_backups
                exit 1
            fi
            restore_backup "$2"
            ;;
        list)
            list_backups
            ;;
        prune)
            prune_backups
            ;;
        verify)
            if [ -z "$2" ]; then
                print_error "Please specify backup file to verify"
                exit 1
            fi
            verify_backup "$2"
            ;;
        *)
            echo "Usage: $0 {backup|restore|list|prune|verify}"
            echo ""
            echo "Commands:"
            echo "  backup [full|schema|data]  - Create backup (default: full)"
            echo "  restore <file>             - Restore from backup"
            echo "  list                       - List available backups"
            echo "  prune                      - Remove old backups"
            echo "  verify <file>              - Verify backup integrity"
            echo ""
            echo "Environment variables:"
            echo "  DATABASE_URL         - Database connection string"
            echo "  BACKUP_RETENTION_DAYS - Days to keep backups (default: 7)"
            exit 1
            ;;
    esac
}

main "$@"
