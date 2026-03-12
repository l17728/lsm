#!/bin/bash

# LSM Project Performance Benchmark Script
# Version: 1.0.0
# Date: 2026-03-12

set -e

echo "🚀 LSM Project Performance Benchmark"
echo "====================================="
echo ""

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-lsm}"
DB_USER="${DB_USER:-lsm_admin}"
DB_PASSWORD="${DB_PASSWORD:-lsm_password}"

export PGPASSWORD=$DB_PASSWORD

# Test 1: Database Connection
echo "📊 Test 1: Database Connection"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null
echo "✅ Database connection successful"
echo ""

# Test 2: Insert Performance
echo "📊 Test 2: Insert Performance (1000 records)"
START_TIME=$(date +%s%N)

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << EOF
INSERT INTO users (username, email, password_hash, role)
SELECT 
  'user_' || i,
  'user_' || i || '@test.com',
  '\$2b\$10\$test',
  'USER'
FROM generate_series(1, 1000) AS i;
EOF

END_TIME=$(date +%s%N)
INSERT_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
echo "✅ Insert 1000 users: ${INSERT_TIME}ms"
echo ""

# Test 3: Query Performance
echo "📊 Test 3: Query Performance"
START_TIME=$(date +%s%N)

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT * FROM users WHERE email LIKE 'user_%';" > /dev/null

END_TIME=$(date +%s%N)
QUERY_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
echo "✅ Query 1000 users: ${QUERY_TIME}ms"
echo ""

# Test 4: Index Performance
echo "📊 Test 4: Index Performance"
START_TIME=$(date +%s%N)

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT * FROM users WHERE email = 'user_500@test.com';" > /dev/null

END_TIME=$(date +%s%N)
INDEX_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
echo "✅ Indexed query (email): ${INDEX_TIME}ms"
echo ""

# Test 5: Aggregate Performance
echo "📊 Test 5: Aggregate Performance"
START_TIME=$(date +%s%N)

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*), role FROM users GROUP BY role;" > /dev/null

END_TIME=$(date +%s%N)
AGGREGATE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
echo "✅ Aggregate query: ${AGGREGATE_TIME}ms"
echo ""

# Test 6: Concurrent Connections
echo "📊 Test 6: Concurrent Connections (10 connections)"
for i in {1..10}; do
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null &
done
wait
echo "✅ 10 concurrent connections successful"
echo ""

# Summary
echo "📈 Benchmark Summary"
echo "==================="
echo "Database Connection: ✅ Success"
echo "Insert Performance:  ${INSERT_TIME}ms (1000 records)"
echo "Query Performance:   ${QUERY_TIME}ms (1000 records)"
echo "Index Performance:   ${INDEX_TIME}ms (single record)"
echo "Aggregate Query:     ${AGGREGATE_TIME}ms"
echo "Concurrent Connections: ✅ 10 connections"
echo ""

# Cleanup
echo "🧹 Cleaning up test data..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "DELETE FROM users WHERE email LIKE 'user_%';" > /dev/null
echo "✅ Cleanup complete"
echo ""

echo "🎉 Benchmark completed successfully!"
