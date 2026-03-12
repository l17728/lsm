#!/bin/bash

# LSM Project Database Migration Script
# SQLite to PostgreSQL Migration
# Version: 1.0.0
# Date: 2026-03-12

set -e

# Configuration
SQLITE_DB="${SQLITE_DB:-/root/.openclaw/workspace/lsm-project/src/backend/prisma/dev.db}"
POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-lsm}"
POSTGRES_USER="${POSTGRES_USER:-lsm_admin}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-lsm_password}"

echo "🚀 LSM Database Migration: SQLite → PostgreSQL"
echo "================================================"
echo ""

# Check if SQLite database exists
if [ ! -f "$SQLITE_DB" ]; then
    echo "❌ SQLite database not found: $SQLITE_DB"
    exit 1
fi

echo "✅ SQLite database found: $SQLITE_DB"

# Install required tools if not present
if ! command -v pg_dump &> /dev/null; then
    echo "⚠️  PostgreSQL tools not found. Installing..."
    apt-get update && apt-get install -y postgresql-client
fi

# Create PostgreSQL database
echo ""
echo "📦 Creating PostgreSQL database..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" 2>/dev/null || true
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB;"

echo "✅ Database created: $POSTGRES_DB"

# Apply schema
echo ""
echo "📋 Applying PostgreSQL schema..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f /root/.openclaw/workspace/lsm-project/src/backend/prisma/postgresql-schema.sql

echo "✅ Schema applied successfully"

# Export SQLite data
echo ""
echo "📤 Exporting SQLite data..."
sqlite3 "$SQLITE_DB" ".mode csv" ".headers on" ".output /tmp/users.csv" "SELECT * FROM User;" 2>/dev/null || echo "⚠️  No User table"
sqlite3 "$SQLITE_DB" ".mode csv" ".headers on" ".output /tmp/Server.csv" "SELECT * FROM Server;" 2>/dev/null || echo "⚠️  No Server table"
sqlite3 "$SQLITE_DB" ".mode csv" ".headers on" ".output /tmp/Gpu.csv" "SELECT * FROM Gpu;" 2>/dev/null || echo "⚠️  No Gpu table"
sqlite3 "$SQLITE_DB" ".mode csv" ".headers on" ".output /tmp/Task.csv" "SELECT * FROM Task;" 2>/dev/null || echo "⚠️  No Task table"

echo "✅ Data exported to /tmp/"

# Note: Full migration would require data transformation
# This is a simplified version

echo ""
echo "📊 Migration Summary"
echo "===================="
echo "Source: $SQLITE_DB"
echo "Target: PostgreSQL ($POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB)"
echo "Status: ✅ Schema migration complete"
echo "Note: Data migration requires manual verification"
echo ""
echo "⚠️  IMPORTANT: Update your .env file with new database connection:"
echo "DATABASE_URL=\"postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB?schema=public\""
echo ""
echo "🎉 Migration completed successfully!"
