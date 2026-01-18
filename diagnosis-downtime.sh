#!/bin/bash
# Diagnosis Script untuk Downtime Issue
# Author: System Administrator
# Date: 2026-01-17

echo "======================================"
echo "DIAGNOSIS DOWNTIME - VPS"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 1. MEMORY STATUS ===${NC}"
free -h
echo ""
MEM_PERCENT=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
if [ $MEM_PERCENT -gt 80 ]; then
    echo -e "${RED}⚠️  WARNING: Memory usage is ${MEM_PERCENT}% (HIGH!)${NC}"
else
    echo -e "${GREEN}✓ Memory usage: ${MEM_PERCENT}% (OK)${NC}"
fi
echo ""

echo -e "${BLUE}=== 2. DISK SPACE ===${NC}"
df -h
echo ""
DISK_PERCENT=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_PERCENT -gt 80 ]; then
    echo -e "${RED}⚠️  WARNING: Disk usage is ${DISK_PERCENT}% (HIGH!)${NC}"
else
    echo -e "${GREEN}✓ Disk usage: ${DISK_PERCENT}% (OK)${NC}"
fi
echo ""

echo -e "${BLUE}=== 3. CPU & LOAD ===${NC}"
uptime
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_CORES=$(nproc)
echo "CPU Cores: $CPU_CORES"
echo "Load Average (1m): $LOAD"
echo ""

echo -e "${BLUE}=== 4. PM2 STATUS ===${NC}"
pm2 status
echo ""

echo -e "${BLUE}=== 5. PM2 RESTART COUNT & UPTIME ===${NC}"
pm2 jlist 2>/dev/null | jq -r '.[] | "App: \(.name) | Restarts: \(.pm2_env.restart_time) | Status: \(.pm2_env.status)"' || pm2 list
echo ""

echo -e "${BLUE}=== 6. PORTS STATUS ===${NC}"
echo "Checking ports: 1234 (production), 5678 (staging), 80 (nginx), 5432 (postgres)"
netstat -tlnp 2>/dev/null | grep -E ":(1234|5678|80|443|5432)" || ss -tlnp | grep -E ":(1234|5678|80|443|5432)"
echo ""

echo -e "${BLUE}=== 7. HEALTH CHECK - Production (Port 1234) ===${NC}"
if curl -s --max-time 5 http://localhost:1234/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Production health endpoint responding${NC}"
    curl -s http://localhost:1234/health | jq . 2>/dev/null || curl -s http://localhost:1234/health
else
    echo -e "${RED}✗ Production health endpoint NOT responding${NC}"
fi
echo ""

echo -e "${BLUE}=== 8. HEALTH CHECK - Staging (Port 5678) ===${NC}"
if curl -s --max-time 5 http://localhost:5678/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Staging health endpoint responding${NC}"
    curl -s http://localhost:5678/health | jq . 2>/dev/null || curl -s http://localhost:5678/health
else
    echo -e "${RED}✗ Staging health endpoint NOT responding${NC}"
fi
echo ""

echo -e "${BLUE}=== 9. DOCKER STATUS ===${NC}"
if command -v docker &> /dev/null; then
    docker ps -a
else
    echo "Docker not installed or not in PATH"
fi
echo ""

echo -e "${BLUE}=== 10. RECENT PM2 ERRORS (Last 30 lines) ===${NC}"
pm2 logs --lines 30 --err --nostream 2>/dev/null | tail -30 || echo "No PM2 error logs available"
echo ""

echo -e "${BLUE}=== 11. NGINX ERROR LOGS (Last 20 lines) ===${NC}"
if [ -f /var/log/nginx/error.log ]; then
    sudo tail -20 /var/log/nginx/error.log 2>/dev/null || tail -20 /var/log/nginx/error.log 2>/dev/null || echo "Cannot read nginx error log"
else
    echo "Nginx error log not found"
fi
echo ""

echo -e "${BLUE}=== 12. CHECK OOM KILLER HISTORY ===${NC}"
echo "Checking for Out Of Memory events..."
dmesg | grep -i "out of memory\|oom\|killed process" | tail -10 || echo "No OOM events found (or dmesg not accessible)"
echo ""

echo -e "${BLUE}=== 13. PROCESS RESOURCE USAGE (Top 10) ===${NC}"
ps aux --sort=-%mem | head -11
echo ""

echo -e "${BLUE}=== 14. PM2 LOG FILES SIZE ===${NC}"
if [ -d ~/.pm2/logs ]; then
    du -sh ~/.pm2/logs/* 2>/dev/null | sort -rh | head -10
    echo ""
    echo "Total PM2 logs size:"
    du -sh ~/.pm2/logs 2>/dev/null
else
    echo "PM2 logs directory not found"
fi
echo ""

echo "======================================"
echo -e "${GREEN}DIAGNOSIS COMPLETE${NC}"
echo "======================================"
echo ""

# Summary
echo -e "${YELLOW}=== SUMMARY & RECOMMENDATIONS ===${NC}"
echo ""

# Memory check
if [ $MEM_PERCENT -gt 80 ]; then
    echo -e "${RED}❌ HIGH MEMORY USAGE ($MEM_PERCENT%)${NC}"
    echo "   → Recommendation: Reduce PM2 instances or add more RAM"
    echo "   → Consider reducing 'instances' in ecosystem.config.js from 'max' to a lower number"
else
    echo -e "${GREEN}✓ Memory usage is OK ($MEM_PERCENT%)${NC}"
fi

# Disk check
if [ $DISK_PERCENT -gt 80 ]; then
    echo -e "${RED}❌ HIGH DISK USAGE ($DISK_PERCENT%)${NC}"
    echo "   → Recommendation: Clear logs and temporary files"
    echo "   → Run: pm2 flush && docker system prune"
else
    echo -e "${GREEN}✓ Disk usage is OK ($DISK_PERCENT%)${NC}"
fi

# PM2 health check
echo ""
echo "Check the restart counts above:"
echo "   - If restart_time > 10: Application is crashing frequently"
echo "   - Check PM2 error logs for the root cause"

echo ""
echo "Next steps:"
echo "1. Review the output above for any RED warnings"
echo "2. Check PM2 error logs for specific errors"
echo "3. Test health endpoints manually"
echo "4. Monitor in real-time with: pm2 monit"
echo ""
echo "Save this output: ./diagnosis-downtime.sh > diagnosis-\$(date +%Y%m%d-%H%M%S).log"
