#!/bin/bash

# LSM Project - Day 1 Verification Script
# Usage: ./scripts/verify-day1.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

echo ""
echo "========================================"
echo "  LSM Phase 4 Day 1 Verification"
echo "========================================"
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Enable arithmetic
set +e

# Check 1: Environment file
check_env_file() {
    print_check "Checking .env.production..."
    if [ -f "${PROJECT_ROOT}/.env.production" ]; then
        if grep -q "JWT_SECRET=" "${PROJECT_ROOT}/.env.production"; then
            JWT_SECRET=$(grep "JWT_SECRET=" "${PROJECT_ROOT}/.env.production" | cut -d'=' -f2)
            SECRET_LEN=${#JWT_SECRET}
            if [ ${SECRET_LEN} -ge 32 ]; then
                print_pass "JWT_SECRET is properly configured (${SECRET_LEN} chars)"
                PASS_COUNT=$((PASS_COUNT + 1))
            else
                print_fail "JWT_SECRET is too short"
                FAIL_COUNT=$((FAIL_COUNT + 1))
            fi
        else
            print_fail "JWT_SECRET not found"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail ".env.production not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 2: Export service migration
check_export_service() {
    print_check "Checking export.service.ts..."
    SERVICE_FILE="${PROJECT_ROOT}/src/backend/src/services/export.service.ts"
    if [ -f "${SERVICE_FILE}" ]; then
        if grep -q "import ExcelJS" "${SERVICE_FILE}"; then
            print_pass "exceljs migration completed"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "exceljs not imported"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        
        if grep -q "import.*xlsx" "${SERVICE_FILE}"; then
            print_fail "Old xlsx import still present"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        else
            print_pass "Old xlsx import removed"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    else
        print_fail "export.service.ts not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 3: Export routes security
check_export_routes() {
    print_check "Checking export.routes.ts..."
    ROUTES_FILE="${PROJECT_ROOT}/src/backend/src/routes/export.routes.ts"
    if [ -f "${ROUTES_FILE}" ]; then
        if grep -q "rateLimit" "${ROUTES_FILE}"; then
            print_pass "Rate limiting configured"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "Rate limiting not found"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        
        if grep -q "requireAdmin" "${ROUTES_FILE}"; then
            print_pass "Admin permission check present"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "Admin permission check missing"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail "export.routes.ts not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 4: Package.json dependencies
check_package_json() {
    print_check "Checking package.json..."
    PKG_FILE="${PROJECT_ROOT}/src/backend/package.json"
    if [ -f "${PKG_FILE}" ]; then
        if grep -q "exceljs" "${PKG_FILE}"; then
            print_pass "exceljs dependency added"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "exceljs dependency missing"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        
        if grep -q '"xlsx"' "${PKG_FILE}"; then
            print_fail "Old xlsx dependency still present"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        else
            print_pass "Old xlsx dependency removed"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    else
        print_fail "package.json not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 5: Theme system
check_theme_system() {
    print_check "Checking theme system..."
    THEME_FILE="${PROJECT_ROOT}/src/frontend/src/styles/themes.css"
    if [ -f "${THEME_FILE}" ]; then
        if grep -q "data-theme='dark'" "${THEME_FILE}"; then
            print_pass "Dark theme defined"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "Dark theme not found"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
        
        if grep -q "\-\-bg-primary" "${THEME_FILE}"; then
            print_pass "CSS variables defined"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "CSS variables missing"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail "themes.css not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 6: Theme toggle component
check_theme_toggle() {
    print_check "Checking ThemeToggle component..."
    TOGGLE_FILE="${PROJECT_ROOT}/src/frontend/src/components/ThemeToggle.tsx"
    if [ -f "${TOGGLE_FILE}" ]; then
        if grep -q "toggleTheme" "${TOGGLE_FILE}"; then
            print_pass "Theme toggle function present"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "Theme toggle function missing"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail "ThemeToggle.tsx not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 7: i18n configuration
check_i18n() {
    print_check "Checking i18n configuration..."
    I18N_FILE="${PROJECT_ROOT}/src/frontend/src/i18n/config.ts"
    if [ -f "${I18N_FILE}" ]; then
        if grep -q "i18next" "${I18N_FILE}"; then
            print_pass "i18next configured"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "i18next not found"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail "i18n config not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    # Check translation files
    print_check "Checking translation files..."
    if [ -f "${PROJECT_ROOT}/src/frontend/src/i18n/locales/zh.json" ]; then
        print_pass "Chinese translation file exists"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_fail "Chinese translation missing"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    if [ -f "${PROJECT_ROOT}/src/frontend/src/i18n/locales/en.json" ]; then
        print_pass "English translation file exists"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_fail "English translation missing"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 8: Language switcher component
check_language_switcher() {
    print_check "Checking LanguageSwitcher component..."
    SWITCHER_FILE="${PROJECT_ROOT}/src/frontend/src/components/LanguageSwitcher.tsx"
    if [ -f "${SWITCHER_FILE}" ]; then
        if grep -q "changeLanguage" "${SWITCHER_FILE}"; then
            print_pass "Language switcher function present"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "Language switcher function missing"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail "LanguageSwitcher.tsx not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 9: Deployment scripts
check_deploy_scripts() {
    print_check "Checking deployment scripts..."
    if [ -x "${PROJECT_ROOT}/scripts/deploy-production.sh" ]; then
        print_pass "deploy-production.sh is executable"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_fail "deploy-production.sh not executable"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    
    if [ -x "${PROJECT_ROOT}/scripts/database-migration.sh" ]; then
        print_pass "database-migration.sh is executable"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        print_fail "database-migration.sh not executable"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Check 10: Day 1 report
check_report() {
    print_check "Checking Day 1 report..."
    REPORT_FILE="${PROJECT_ROOT}/docs/PHASE4_DAY1_REPORT.md"
    if [ -f "${REPORT_FILE}" ]; then
        if grep -q "2026-03-13" "${REPORT_FILE}"; then
            print_pass "Day 1 report created"
            PASS_COUNT=$((PASS_COUNT + 1))
        else
            print_fail "Day 1 report date mismatch"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        print_fail "Day 1 report not found"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

# Run all checks
echo "Running verification checks..."
echo ""

check_env_file
check_export_service
check_export_routes
check_package_json
check_theme_system
check_theme_toggle
check_i18n
check_language_switcher
check_deploy_scripts
check_report

echo ""
echo "========================================"
echo "  Verification Summary"
echo "========================================"
echo ""
echo -e "Passed: ${GREEN}${PASS_COUNT}${NC}"
echo -e "Failed: ${RED}${FAIL_COUNT}${NC}"
echo ""

if [ ${FAIL_COUNT} -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Day 1 work verified.${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ ${FAIL_COUNT} check(s) failed. Please review.${NC}"
    echo ""
    exit 1
fi
