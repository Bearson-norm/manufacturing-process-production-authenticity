#!/bin/bash
# Fix Identified Issues from Diagnosis
# Fixes: DNS resolution, Database connection, SQLite readonly, High load

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================="
echo "FIX IDENTIFIED ISSUES"
echo "==========================================${NC}"
echo ""

FIXED=0
ISSUES=0

# 1. Fix DNS Resolution Issues
echo -e "${BLUE}=== 1. FIXING DNS RESOLUTION ISSUES ===${NC}"
echo "Testing DNS resolution for foomx.odoo.com..."

if nslookup foomx.odoo.com > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} DNS resolution works"
    IP=$(nslookup foomx.odoo.com | grep -A1 "Name:" | tail -1 | awk '{print $2}')
    echo "  IP: $IP"
else
    echo -e "${RED}✗${NC} DNS resolution FAILED"
    echo "  Error: Cannot resolve foomx.odoo.com"
    ISSUES=$((ISSUES + 1))
    
    echo ""
    echo "Possible fixes:"
    echo "1. Check if domain is correct"
    echo "2. Check DNS server: cat /etc/resolv.conf"
    echo "3. Try using IP address instead of domain"
    echo "4. Add to /etc/hosts if IP is known"
fi
echo ""

# 2. Fix Database Connection Issues
echo -e "${BLUE}=== 2. FIXING DATABASE CONNECTION ===${NC}"

# Check PostgreSQL is running
if systemctl is-active --quiet postgresql@16-main; then
    echo -e "${GREEN}✓${NC} PostgreSQL is running"
    
    # Test connection with different methods
    echo "Testing database connection..."
    
    # Method 1: Direct psql
    if PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Connection with default password works"
        FIXED=$((FIXED + 1))
    else
        echo -e "${YELLOW}⚠${NC} Connection with default password failed"
        
        # Check if database exists
        echo "Checking if manufacturing_db exists..."
        if PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -lqt | cut -d \| -f 1 | grep -qw manufacturing_db; then
            echo -e "${GREEN}✓${NC} Database 'manufacturing_db' exists"
        else
            echo -e "${YELLOW}⚠${NC} Database 'manufacturing_db' not found"
        fi
        
        # Check connection string in .env
        echo "Checking connection configuration..."
        if [ -f "/home/foom/deployments/manufacturing-app/server/.env" ]; then
            echo "Found .env file, checking DB config:"
            grep -E "DB_|DATABASE_|POSTGRES" /home/foom/deployments/manufacturing-app/server/.env | head -5
        fi
        
        ISSUES=$((ISSUES + 1))
    fi
else
    echo -e "${RED}✗${NC} PostgreSQL is not running"
    echo "Starting PostgreSQL..."
    sudo systemctl start postgresql@16-main
    sleep 3
    if systemctl is-active --quiet postgresql@16-main; then
        echo -e "${GREEN}✓${NC} PostgreSQL started"
        FIXED=$((FIXED + 1))
    else
        echo -e "${RED}✗${NC} Failed to start PostgreSQL"
        ISSUES=$((ISSUES + 1))
    fi
fi
echo ""

# 3. Fix SQLite Readonly Issue
echo -e "${BLUE}=== 3. FIXING SQLITE READONLY ISSUE ===${NC}"
echo "Checking SQLite database permissions..."

SQLITE_DB="/home/foom/deployments/manufacturing-app/server/database.sqlite"
if [ -f "$SQLITE_DB" ]; then
    echo "Found SQLite database: $SQLITE_DB"
    
    # Check permissions
    PERMS=$(stat -c "%a %U:%G" "$SQLITE_DB" 2>/dev/null || stat -f "%OLp %Su:%Sg" "$SQLITE_DB" 2>/dev/null)
    echo "Current permissions: $PERMS"
    
    # Check if writable
    if [ -w "$SQLITE_DB" ]; then
        echo -e "${GREEN}✓${NC} Database is writable"
    else
        echo -e "${RED}✗${NC} Database is NOT writable"
        echo "Fixing permissions..."
        
        # Fix ownership
        sudo chown foom:foom "$SQLITE_DB" 2>/dev/null
        
        # Fix permissions
        chmod 664 "$SQLITE_DB" 2>/dev/null
        
        # Check parent directory
        DB_DIR=$(dirname "$SQLITE_DB")
        if [ -w "$DB_DIR" ]; then
            echo -e "${GREEN}✓${NC} Directory is writable"
        else
            echo "Fixing directory permissions..."
            sudo chown -R foom:foom "$DB_DIR" 2>/dev/null
            chmod 755 "$DB_DIR" 2>/dev/null
        fi
        
        if [ -w "$SQLITE_DB" ]; then
            echo -e "${GREEN}✓${NC} Permissions fixed"
            FIXED=$((FIXED + 1))
        else
            echo -e "${RED}✗${NC} Failed to fix permissions"
            ISSUES=$((ISSUES + 1))
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} SQLite database not found at expected location"
fi
echo ""

# 4. Check High Load Average
echo -e "${BLUE}=== 4. CHECKING HIGH LOAD AVERAGE ===${NC}"
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_CORES=$(nproc)

echo "Load average: $LOAD_AVG"
echo "CPU cores: $CPU_CORES"

if (( $(echo "$LOAD_AVG > $CPU_CORES" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${RED}⚠️  Load average is HIGH${NC}"
    echo "Top processes by CPU:"
    ps aux --sort=-%cpu | head -6
    echo ""
    echo "Top processes by memory:"
    ps aux --sort=-%mem | head -6
    echo ""
    echo "Recommendations:"
    echo "1. Identify and optimize heavy processes"
    echo "2. Consider reducing PM2 cluster instances"
    echo "3. Check for runaway processes"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC} Load average is OK"
fi
echo ""

# 5. Check for DNS/Network Issues in Code
echo -e "${BLUE}=== 5. RECOMMENDATIONS FOR CODE FIXES ===${NC}"
echo "Based on errors found:"
echo ""
echo "1. DNS Resolution Errors (getaddrinfo EAI_AGAIN):"
echo "   - Add DNS retry logic with exponential backoff"
echo "   - Add timeout handling"
echo "   - Consider using IP address instead of domain"
echo "   - Add connection pooling"
echo ""
echo "2. Database Timeout Errors:"
echo "   - Increase connection timeout"
echo "   - Add connection retry logic"
echo "   - Check connection pool settings"
echo "   - Verify database credentials"
echo ""
echo "3. SQLite Readonly Errors:"
echo "   - Check file permissions (already checked above)"
echo "   - Ensure database file is not locked"
echo "   - Check if using correct database path"
echo ""

# 6. Quick Fixes Summary
echo -e "${CYAN}=========================================="
echo "QUICK FIXES APPLIED"
echo "==========================================${NC}"
echo ""

if [ $FIXED -gt 0 ]; then
    echo -e "${GREEN}✓${NC} Fixed $FIXED issue(s)"
fi

if [ $ISSUES -gt 0 ]; then
    echo -e "${YELLOW}⚠️  $ISSUES issue(s) need manual attention${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Fix DNS resolution for foomx.odoo.com"
    echo "2. Verify database connection credentials"
    echo "3. Add retry logic in application code"
    echo "4. Monitor load average"
fi

echo ""
echo "Restarting applications to apply fixes..."
pm2 restart all
pm2 save

echo ""
echo -e "${GREEN}✅ Fix script complete!${NC}"
echo ""
echo "Monitor for improvements:"
echo "  pm2 logs --lines 20"
echo "  watch -n 5 'uptime && free -h'"
