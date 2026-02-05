#!/bin/bash
# Fix High CPU Usage on PM2 Process
# Usage: ./fix-high-cpu.sh <process-id>

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROCESS_ID=${1:-9}

echo -e "${CYAN}=========================================="
echo "FIX HIGH CPU USAGE"
echo "Process ID: $PROCESS_ID"
echo "==========================================${NC}"
echo ""

# Get current CPU usage
CPU_USAGE=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.pm_id == $PROCESS_ID) | .monit.cpu" || \
            pm2 status | grep -E "^\s+$PROCESS_ID" | awk '{print $10}' | sed 's/%//')

echo "Current CPU usage: ${CPU_USAGE}%"
echo ""

if (( $(echo "$CPU_USAGE < 80" | bc -l 2>/dev/null || echo "1") )); then
    echo -e "${GREEN}CPU usage is already normal (<80%)${NC}"
    exit 0
fi

echo -e "${YELLOW}⚠️  High CPU usage detected. Applying fixes...${NC}"
echo ""

# Option 1: Restart specific instance
echo -e "${BLUE}=== Option 1: Restart Specific Instance ===${NC}"
echo "This will restart only the problematic instance (ID: $PROCESS_ID)"
read -p "Restart this instance? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Restarting instance $PROCESS_ID..."
    pm2 restart $PROCESS_ID
    sleep 5
    
    NEW_CPU=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.pm_id == $PROCESS_ID) | .monit.cpu" || \
              pm2 status | grep -E "^\s+$PROCESS_ID" | awk '{print $10}' | sed 's/%//')
    
    if (( $(echo "$NEW_CPU < 80" | bc -l 2>/dev/null || echo "1") )); then
        echo -e "${GREEN}✓${NC} CPU usage normalized: ${NEW_CPU}%"
    else
        echo -e "${YELLOW}⚠${NC} CPU usage still high: ${NEW_CPU}%"
        echo "May need to investigate further"
    fi
fi
echo ""

# Option 2: Restart all manufacturing-app instances
echo -e "${BLUE}=== Option 2: Restart All manufacturing-app Instances ===${NC}"
read -p "Restart all manufacturing-app instances? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Restarting all manufacturing-app instances..."
    pm2 restart manufacturing-app
    sleep 5
    
    echo "New CPU usage:"
    pm2 status | grep manufacturing-app
fi
echo ""

# Option 3: Stop and investigate
echo -e "${BLUE}=== Option 3: Stop Instance for Investigation ===${NC}"
read -p "Stop instance for investigation? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Stopping instance $PROCESS_ID..."
    pm2 stop $PROCESS_ID
    echo -e "${YELLOW}Instance stopped. You can investigate logs and restart later.${NC}"
    echo "To restart: pm2 start $PROCESS_ID"
fi
echo ""

# Option 4: Check logs
echo -e "${BLUE}=== Option 4: Check Recent Logs ===${NC}"
read -p "View recent logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Recent logs (last 100 lines):"
    pm2 logs manufacturing-app --lines 100 --nostream | tail -50
fi
echo ""

# Final status
echo -e "${CYAN}=========================================="
echo "FINAL STATUS"
echo "==========================================${NC}"
pm2 status | grep manufacturing-app
echo ""

echo -e "${YELLOW}If CPU usage is still high after restart:${NC}"
echo "1. Check logs: pm2 logs manufacturing-app --lines 200"
echo "2. Look for infinite loops or heavy operations"
echo "3. Check database queries"
echo "4. Review recent code changes"
echo "5. Consider adding CPU usage limits"

echo ""
