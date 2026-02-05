#!/bin/bash
# Comprehensive Resource Usage Investigation Script
# Checks disk, memory, CPU, processes, logs, and database usage
# Author: System Administrator
# Date: 2026-01-29

echo "=========================================="
echo "INVESTIGASI KONSUMSI RESOURCE"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to format bytes
format_bytes() {
    local bytes=$1
    if [ $bytes -gt 1073741824 ]; then
        echo "$(echo "scale=2; $bytes/1073741824" | bc)GB"
    elif [ $bytes -gt 1048576 ]; then
        echo "$(echo "scale=2; $bytes/1048576" | bc)MB"
    elif [ $bytes -gt 1024 ]; then
        echo "$(echo "scale=2; $bytes/1024" | bc)KB"
    else
        echo "${bytes}B"
    fi
}

echo -e "${BLUE}=== 1. SYSTEM OVERVIEW ===${NC}"
echo "System load: $(uptime | awk -F'load average:' '{print $2}')"
echo "Memory usage:"
free -h
echo ""
echo "Disk usage:"
df -h /
echo ""

echo -e "${BLUE}=== 2. TOP DISK USAGE BY DIRECTORY ===${NC}"
echo "Checking largest directories in /home/foom..."
du -h --max-depth=1 /home/foom 2>/dev/null | sort -hr | head -20
echo ""

echo -e "${BLUE}=== 3. DEPLOYMENT DIRECTORIES SIZE ===${NC}"
if [ -d "/home/foom/deployments" ]; then
    echo "Deployment directories:"
    du -sh /home/foom/deployments/* 2>/dev/null | sort -hr
    echo ""
    echo "Detailed breakdown:"
    du -h --max-depth=2 /home/foom/deployments 2>/dev/null | sort -hr | head -30
else
    echo "Deployments directory not found"
fi
echo ""

echo -e "${BLUE}=== 4. NODE_MODULES SIZE ===${NC}"
echo "Searching for node_modules directories..."
find /home/foom -type d -name "node_modules" -exec du -sh {} \; 2>/dev/null | sort -hr | head -10
echo ""

echo -e "${BLUE}=== 5. LOG FILES SIZE ===${NC}"
echo "Large log files (>10MB):"
find /home/foom -type f -name "*.log" -size +10M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
echo ""
echo "PM2 logs size:"
if [ -d "/home/foom/.pm2/logs" ]; then
    du -sh /home/foom/.pm2/logs
    ls -lh /home/foom/.pm2/logs/*.log 2>/dev/null | tail -10
fi
echo ""
echo "Nginx logs:"
if [ -d "/var/log/nginx" ]; then
    sudo du -sh /var/log/nginx 2>/dev/null || echo "Need sudo to check nginx logs"
    sudo ls -lh /var/log/nginx/*.log 2>/dev/null | tail -5 || echo ""
fi
echo ""

echo -e "${BLUE}=== 6. DATABASE FILES SIZE ===${NC}"
echo "SQLite databases:"
find /home/foom -type f -name "*.sqlite*" -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
echo ""
echo "PostgreSQL data directory:"
if [ -d "/var/lib/postgresql" ]; then
    sudo du -sh /var/lib/postgresql 2>/dev/null || echo "Need sudo to check PostgreSQL"
fi
echo ""

echo -e "${BLUE}=== 7. DOCKER CONTAINERS & IMAGES ===${NC}"
if command -v docker &> /dev/null; then
    echo "Docker disk usage:"
    docker system df 2>/dev/null || echo "Docker not accessible"
    echo ""
    echo "Docker volumes:"
    docker volume ls 2>/dev/null
    docker system df -v 2>/dev/null | head -20
else
    echo "Docker not installed or not accessible"
fi
echo ""

echo -e "${BLUE}=== 8. OLD BACKUPS & ARCHIVES ===${NC}"
echo "Finding .tar.gz, .zip, .bak files:"
find /home/foom -type f \( -name "*.tar.gz" -o -name "*.zip" -o -name "*.bak" -o -name "*backup*" \) -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' | head -20
echo ""

echo -e "${BLUE}=== 9. PROCESS RESOURCE USAGE ===${NC}"
echo "Top 10 processes by CPU usage:"
ps aux --sort=-%cpu | head -11
echo ""
echo "Top 10 processes by Memory usage:"
ps aux --sort=-%mem | head -11
echo ""

echo -e "${BLUE}=== 10. PM2 PROCESSES RESOURCE ===${NC}"
pm2 status
echo ""
pm2 monit --no-interaction 2>/dev/null || echo "PM2 monit not available"
echo ""

echo -e "${BLUE}=== 11. NODE.JS PROCESSES MEMORY ===${NC}"
echo "Node.js processes memory usage:"
ps aux | grep -E "node|PM2" | grep -v grep | awk '{print $2, $3"%", $4"%", $11, $12, $13, $14}' | column -t
echo ""
NODE_MEM=$(ps aux | grep -E "node|PM2" | grep -v grep | awk '{sum+=$4} END {print sum}')
echo "Total Node.js memory usage: ${NODE_MEM}%"
echo ""

echo -e "${BLUE}=== 12. SYSTEM SERVICES ===${NC}"
echo "Active systemd services:"
systemctl list-units --type=service --state=running | head -20
echo ""

echo -e "${BLUE}=== 13. LARGE FILES (>100MB) ===${NC}"
echo "Finding large files in /home/foom:"
find /home/foom -type f -size +100M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' | head -20
echo ""

echo -e "${BLUE}=== 14. RECENTLY MODIFIED LARGE FILES ===${NC}"
echo "Large files modified in last 7 days:"
find /home/foom -type f -size +50M -mtime -7 -exec ls -lht {} \; 2>/dev/null | head -10
echo ""

echo -e "${BLUE}=== 15. GIT REPOSITORIES SIZE ===${NC}"
echo "Git repositories size:"
find /home/foom -type d -name ".git" -exec sh -c 'du -sh "$1" 2>/dev/null' _ {} \; | sort -hr | head -10
echo ""

echo "=========================================="
echo -e "${GREEN}INVESTIGATION COMPLETE${NC}"
echo "=========================================="
echo ""

# Analysis Summary
echo -e "${YELLOW}=== ANALYSIS SUMMARY & RECOMMENDATIONS ===${NC}"
echo ""

# Disk usage check
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 80 ]; then
    echo -e "${RED}⚠️  DISK USAGE CRITICAL: ${DISK_USAGE}%${NC}"
    echo ""
    echo "Top recommendations:"
    echo "1. Clean old deployments/backups"
    echo "2. Remove unused node_modules"
    echo "3. Clean log files"
    echo "4. Clean Docker images/containers if not needed"
    echo "5. Check database size"
else
    echo -e "${GREEN}✓ Disk usage: ${DISK_USAGE}% (OK)${NC}"
fi
echo ""

# Memory check
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 80 ]; then
    echo -e "${RED}⚠️  MEMORY USAGE HIGH: ${MEM_USAGE}%${NC}"
else
    echo -e "${GREEN}✓ Memory usage: ${MEM_USAGE}% (OK)${NC}"
fi
echo ""

# Load average check
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_CORES=$(nproc)
if (( $(echo "$LOAD_AVG > $CPU_CORES" | bc -l) )); then
    echo -e "${RED}⚠️  LOAD AVERAGE HIGH: ${LOAD_AVG} (CPU cores: ${CPU_CORES})${NC}"
else
    echo -e "${GREEN}✓ Load average: ${LOAD_AVG} (CPU cores: ${CPU_CORES})${NC}"
fi
echo ""

echo -e "${CYAN}QUICK CLEANUP COMMANDS:${NC}"
echo ""
echo "# Clean PM2 logs (keep last 100 lines):"
echo "pm2 flush"
echo ""
echo "# Clean old deployments (keep last 2):"
echo "cd /home/foom/deployments && ls -t | tail -n +3 | xargs rm -rf"
echo ""
echo "# Clean Docker (if not needed):"
echo "docker system prune -a --volumes"
echo ""
echo "# Clean npm cache:"
echo "npm cache clean --force"
echo ""
echo "# Find and remove large node_modules:"
echo "find /home/foom -type d -name node_modules -exec du -sh {} \; | sort -hr"
echo ""
