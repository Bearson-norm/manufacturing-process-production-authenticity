#!/bin/bash
# Emergency Fix - SSH Timeout & App Crash Loop
# Run this ASAP when you can SSH!

echo "=========================================="
echo "EMERGENCY FIX - SSH TIMEOUT & CRASH LOOP"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check if we can continue
check_connection() {
    if ! ping -c 1 google.com &> /dev/null; then
        echo -e "${RED}⚠️  Network issue detected${NC}"
    fi
}

echo -e "${RED}=== STEP 1: STOP CRASH LOOP ===${NC}"
echo "Stopping manufacturing-app to stabilize server..."
pm2 stop manufacturing-app
echo -e "${GREEN}✓ Manufacturing-app stopped${NC}"
echo ""
sleep 5

echo -e "${BLUE}=== STEP 2: CHECK PM2 STATUS ===${NC}"
pm2 status
echo ""

echo -e "${BLUE}=== STEP 3: SAVE CRASH LOGS ===${NC}"
echo "Saving last 500 error lines..."
pm2 logs manufacturing-app --lines 500 --err --nostream > crash-logs-$(date +%Y%m%d-%H%M%S).txt 2>&1
echo -e "${GREEN}✓ Logs saved to crash-logs-*.txt${NC}"
echo ""

echo -e "${BLUE}=== STEP 4: SHOW RECENT ERRORS ===${NC}"
echo "Last 20 error lines:"
pm2 logs manufacturing-app --lines 20 --err --nostream 2>&1 | tail -20
echo ""

echo -e "${BLUE}=== STEP 5: CHECK DATABASE ===${NC}"
echo "Checking PostgreSQL status..."
docker ps | grep postgres
echo ""

echo "Testing database connection..."
docker exec whac-postgres pg_isready -U postgres 2>&1 || echo "Database check failed"
echo ""

echo -e "${BLUE}=== STEP 6: CHECK PORTS ===${NC}"
echo "Checking if port 1234 is free..."
PORT_CHECK=$(netstat -tlnp 2>/dev/null | grep :1234 || ss -tlnp | grep :1234)
if [ -z "$PORT_CHECK" ]; then
    echo -e "${GREEN}✓ Port 1234 is free${NC}"
else
    echo -e "${YELLOW}⚠️  Port 1234 in use:${NC}"
    echo "$PORT_CHECK"
fi
echo ""

echo -e "${BLUE}=== STEP 7: SYSTEM RESOURCES ===${NC}"
echo "Load average:"
uptime
echo ""
echo "Memory:"
free -h
echo ""
echo "Disk:"
df -h /
echo ""

echo -e "${YELLOW}=== STEP 8: ANALYSIS ===${NC}"
echo ""

# Count restarts
RESTART_COUNT=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name=="manufacturing-app") | .pm2_env.restart_time' | head -1)
if [ ! -z "$RESTART_COUNT" ] && [ "$RESTART_COUNT" -gt 10 ]; then
    echo -e "${RED}❌ CRASH LOOP DETECTED: $RESTART_COUNT restarts${NC}"
    echo ""
    echo "Common causes:"
    echo "1. Database connection errors"
    echo "2. Port already in use"
    echo "3. Unhandled exceptions in code"
    echo "4. Memory issues"
    echo ""
    echo "Check crash-logs-*.txt for details"
else
    echo -e "${GREEN}✓ Restart count acceptable${NC}"
fi

echo ""
echo "=========================================="
echo -e "${YELLOW}RECOMMENDATIONS:${NC}"
echo "=========================================="
echo ""
echo "1. Review crash-logs-*.txt for error patterns:"
echo "   grep -i 'error\|exception\|crash' crash-logs-*.txt | head -30"
echo ""
echo "2. Check for specific errors:"
echo "   grep -i 'database\|postgres\|connection' crash-logs-*.txt"
echo "   grep -i 'eaddrinuse\|port' crash-logs-*.txt"
echo "   grep -i 'memory\|heap' crash-logs-*.txt"
echo ""
echo "3. Options to restart:"
echo ""
echo "   OPTION A - Restart with reduced instances (RECOMMENDED):"
echo "   cd ~/deployments/manufacturing-app/server"
echo "   # Edit ecosystem.config.js: change 'instances: max' to 'instances: 2'"
echo "   pm2 restart manufacturing-app"
echo ""
echo "   OPTION B - Restart with fork mode (SAFE):"
echo "   pm2 delete manufacturing-app"
echo "   pm2 start ecosystem.config.js --only manufacturing-app"
echo "   # After editing instances to 1 and exec_mode to 'fork'"
echo ""
echo "   OPTION C - Use staging as temporary replacement:"
echo "   pm2 start manufacturing-app-staging"
echo "   # Update nginx to proxy to port 5678"
echo ""
echo "4. Monitor after restart:"
echo "   watch -n 5 'pm2 status'"
echo "   pm2 logs manufacturing-app"
echo ""
echo "5. SSH should be stable now. If still timing out:"
echo "   sudo systemctl restart sshd"
echo ""
echo -e "${GREEN}Server should be more stable now with manufacturing-app stopped.${NC}"
echo ""

# Check if SSH is stable
echo -e "${BLUE}=== SSH STABILITY CHECK ===${NC}"
SSH_CONN=$(netstat -an 2>/dev/null | grep :22 | grep ESTABLISHED | wc -l || ss -an | grep :22 | grep ESTABLISHED | wc -l)
echo "Active SSH connections: $SSH_CONN"
if [ $SSH_CONN -lt 10 ]; then
    echo -e "${GREEN}✓ SSH connection count is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Many SSH connections ($SSH_CONN)${NC}"
fi
echo ""

echo "=========================================="
echo -e "${GREEN}EMERGENCY FIX COMPLETE${NC}"
echo "=========================================="
echo ""
echo "Next: Review logs and restart with safer config"
