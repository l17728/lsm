#!/bin/bash
# LSM Project - Day 7 Fix Script
# Resolves TypeScript compilation errors identified in Day 7 analysis

set -e

echo "🔧 LSM Project - TypeScript Error Fix Script"
echo "=============================================="
echo ""

cd /root/.openclaw/workspace/lsm-project/src/backend

# Step 1: Install missing dependencies
echo "📦 Step 1: Installing missing dependencies..."
npm install ssh2
echo "✅ ssh2 installed"
echo ""

# Step 2: Fix bcrypt import in jwt.ts
echo "🔧 Step 2: Fixing bcrypt import in jwt.ts..."
sed -i "s/import bcrypt from 'bcrypt';/import bcrypt from 'bcryptjs';/g" src/utils/jwt.ts
echo "✅ bcrypt import fixed"
echo ""

# Step 3: Update Prisma schema with remaining missing fields
echo "🔧 Step 3: Updating Prisma schema..."

# Add GpuStatus enum if not exists
if ! grep -q "enum GpuStatus" prisma/schema.prisma; then
  cat >> prisma/schema.prisma << 'EOF'

enum GpuStatus {
  AVAILABLE
  ALLOCATED
  MAINTENANCE
  ERROR
}
EOF
  echo "✅ GpuStatus enum added"
fi

# Add status field to Gpu model
if ! grep -q "status.*GpuStatus" prisma/schema.prisma; then
  sed -i '/model Gpu {/,/^[[:space:]]*@@map/a\  status       GpuStatus    @default(AVAILABLE)' prisma/schema.prisma
  echo "✅ Gpu.status field added"
fi

# Add timestamp field to ServerMetric model
if ! grep -q "timestamp.*DateTime" prisma/schema.prisma; then
  sed -i '/model ServerMetric {/,/^[[:space:]]*@@map/a\  timestamp    DateTime     @default(now()) @map("timestamp")' prisma/schema.prisma
  echo "✅ ServerMetric.timestamp field added"
fi

echo ""

# Step 4: Regenerate Prisma client
echo "🔄 Step 4: Regenerating Prisma client..."
npx prisma generate
echo "✅ Prisma client regenerated"
echo ""

# Step 5: Run TypeScript compiler to check for remaining errors
echo "🔍 Step 5: Checking for remaining TypeScript errors..."
if npx tsc --noEmit; then
  echo "✅ No TypeScript errors found!"
else
  echo "⚠️  Some TypeScript errors remain. Please review the output above."
  echo ""
  echo "Common remaining issues:"
  echo "  - Type mismatches in service code (priority, relations)"
  echo "  - Missing includes in Prisma queries"
  echo "  - Implicit 'any' types"
  echo ""
  echo "Run 'npx tsc --noEmit' to see full error list"
fi

echo ""
echo "=============================================="
echo "📊 Fix Script Complete"
echo "=============================================="
echo ""
echo "Next steps:"
echo "  1. Review any remaining TypeScript errors"
echo "  2. Run tests: npm test -- --coverage"
echo "  3. Fix any test-specific issues"
echo ""
