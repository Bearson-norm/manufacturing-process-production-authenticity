#!/bin/bash
# Investigate Process Issues - Manufacturing App
# Author: System Administrator
# Date: 2026-01-17

echo "=========================================="
echo "INVESTIGASI 165 PROCESSES"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 1. TOTAL PROCESSES BREAKDOWN ===${NC}"
echo "Total processes: $(ps aux | wc -l)"
echo "Root processes: $(ps aux | grep "^root" | wc -l)"
echo "User processes: $(ps aux | grep -v "^root" | wc -l)"
echo "Node.js processes: $(ps aux | grep node | grep -v grep | wc -l)"
echo "Zombie processes: $(ps aux | grep '<defunct>' | wc -l)"
echo ""

echo -e "${BLUE}=== 2. PM2 PROCESSES DETAIL ===${NC}"
pm2 status
echo ""
echo "PM2 process count from list:"
pm2 list | grep -E "online|stopped|errored" | wc -l
echo ""

echo -e "${BLUE}=== 3. NODE.JS PROCESSES ===${NC}"
echo "All Node.js processes:"
ps aux | grep -E "node|PM2" | grep -v grep | awk '{print $2, $3, $4, $11, $12, $13, $14}'
echo ""
echo "Node.js process count: $(ps aux | grep node | grep -v grep | wc -l)"
echo ""

echo -e "${BLUE}=== 4. MANUFACTURING-APP PROCESSES ===${NC}"
echo "Manufacturing-app production (cluster) processes:"
ps aux | grep -E "manufacturing-app|index.js" | grep -v grep | grep -v staging | head -20
echo ""
echo "Count: $(ps aux | grep -E "manufacturing-app|index.js" | grep -v grep | grep -v staging | wc -l)"
echo ""

echo -e "${BLUE}=== 5. MANUFACTURING-APP-STAGING PROCESSES ===${NC}"
echo "Manufacturing-app-staging (fork) processes:"
ps aux | grep "staging" | grep -v grep
echo ""
echo "Count: $(ps aux | grep staging | grep -v grep | wc -l)"
echo ""

echo -e "${BLUE}=== 6. ZOMBIE PROCESSES ===${NC}"
ZOMBIE_COUNT=$(ps aux | grep '<defunct>' | grep -v grep | wc -l)
if [ $ZOMBIE_COUNT -gt 0 ]; then
    echo -e "${RED}⚠️  Found $ZOMBIE_COUNT zombie processes:${NC}"
    ps aux | grep '<defunct>' | grep -v grep
else
    echo -e "${GREEN}✓ No zombie processes found${NC}"
fi
echo ""

echo -e "${BLUE}=== 7. PROCESS TREE - PM2 ===${NC}"
echo "PM2 main process and its children:"
PM2_PID=$(pgrep -f "PM2 v" | head -1)
if [ ! -z "$PM2_PID" ]; then
    echo "PM2 PID: $PM2_PID"
    pstree -p $PM2_PID 2>/dev/null || ps --forest -g $PM2_PID
else
    echo "PM2 main process not found"
fi
echo ""

echo -e "${BLUE}=== 8. CHILD PROCESSES COUNT ===${NC}"
echo "Checking parent-child relationships..."
ps -eo pid,ppid,cmd | grep node | grep -v grep | head -30
echo ""

echo -e "${BLUE}=== 9. PORT LISTENERS ===${NC}"
echo "Processes listening on ports (1234, 5678):"
lsof -i :1234 -i :5678 2>/dev/null || netstat -tlnp | grep -E ":(1234|5678)"
echo ""

echo -e "${BLUE}=== 10. PM2 GOD DAEMON ===${NC}"
echo "PM2 daemon info:"
pm2 info pm2
echo ""

echo -e "${BLUE}=== 11. ORPHANED PROCESSES ===${NC}"
echo "Processes with PPID=1 (init/systemd adopted - possibly orphaned):"
ps -eo pid,ppid,cmd | grep "node.*index.js" | grep -v grep | awk '$2==1 {print}'
echo ""
ORPHANED=$(ps -eo pid,ppid,cmd | grep "node.*index.js" | grep -v grep | awk '$2==1 {print}' | wc -l)
if [ $ORPHANED -gt 0 ]; then
    echo -e "${RED}⚠️  Found $ORPHANED potentially orphaned Node.js processes${NC}"
else
    echo -e "${GREEN}✓ No orphaned Node.js processes${NC}"
fi
echo ""

echo -e "${BLUE}=== 12. PROCESS TIMELINE (Started time) ===${NC}"
echo "When were these processes started?"
ps -eo pid,lstart,cmd | grep -E "node|PM2" | grep -v grep | head -20
echo ""

echo -e "${BLUE}=== 13. TOP PROCESSES BY PID ===${NC}"
echo "Highest PID numbers (recently created):"
ps aux --sort=-pid | head -15
echo ""

echo "=========================================="
echo -e "${GREEN}INVESTIGATION COMPLETE${NC}"
echo "=========================================="
echo ""

# Analysis Summary
echo -e "${YELLOW}=== ANALYSIS SUMMARY ===${NC}"
echo ""

TOTAL_PROC=$(ps aux | wc -l)
NODE_PROC=$(ps aux | grep node | grep -v grep | wc -l)
PM2_INSTANCES=$(pm2 list | grep -E "online|stopped" | wc -l)

echo "Total processes: $TOTAL_PROC"
echo "Node.js processes: $NODE_PROC"
echo "PM2 managed instances: $PM2_INSTANCES"
echo ""

if [ $NODE_PROC -gt 20 ]; then
    echo -e "${RED}❌ TOO MANY NODE.JS PROCESSES ($NODE_PROC)${NC}"
    echo ""
    echo "Expected for your setup:"
    echo "  - manufacturing-app (cluster, max instances): ~16 processes"
    echo "  - manufacturing-app-staging (fork): 1 process"
    echo "  - PM2 daemon: 1 process"
    echo "  - Other services (mo-receiver, mo-reporting): 2 processes"
    echo "  - TOTAL EXPECTED: ~20 Node.js processes"
    echo ""
    echo -e "${YELLOW}RECOMMENDATIONS:${NC}"
    
    if [ $ORPHANED -gt 0 ]; then
        echo "1. ⚠️  Found orphaned processes - kill them:"
        echo "   ps -eo pid,ppid,cmd | grep 'node.*index.js' | awk '\$2==1 {print \$1}' | xargs kill"
    fi
    
    ZOMBIE_COUNT=$(ps aux | grep '<defunct>' | grep -v grep | wc -l)
    if [ $ZOMBIE_COUNT -gt 0 ]; then
        echo "2. ⚠️  Found zombie processes - kill parent or reboot"
    fi
    
    echo "3. Consider reducing cluster instances from 'max' to a fixed number (4-8)"
    echo "4. Check if staging was restarted multiple times without cleanup"
    echo "5. Restart PM2 to clean up: pm2 restart all"
    
else
    echo -e "${GREEN}✓ Node.js process count seems reasonable ($NODE_PROC)${NC}"
fi

echo ""
echo "165 total processes includes:"
echo "  - System processes (kernel, systemd, etc.)"
echo "  - Docker processes"
echo "  - SSH, cron, logging services"
echo "  - Your application processes"
echo ""
echo "If Node.js count is reasonable, 165 total is actually NORMAL for a VPS!"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "1. Review the output above"
echo "2. Kill orphaned processes if found"
echo "3. Check if staging restarted multiple times: pm2 logs manufacturing-app-staging --lines 100"
echo "4. Consider restarting PM2 if too many node processes: pm2 restart all"
