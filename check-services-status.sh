#!/bin/bash
# Comprehensive Service Status Check Script
# Checks all services: PM2, Docker, Nginx, Database, Health Endpoints

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================="
echo "SERVICE STATUS CHECK"
echo "==========================================${NC}"
echo ""

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local name=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
    if [ "$response" = "200" ] || [ "$response" = "204" ]; then
        echo -e "${GREEN}✓${NC} $name: HTTP $response"
        return 0
    else
        echo -e "${RED}✗${NC} $name: HTTP $response (or timeout)"
        return 1
    fi
}

# 1. PM2 Status
echo -e "${BLUE}=== 1. PM2 PROCESSES STATUS ===${NC}"
pm2 status
echo ""

# Check each PM2 process
echo -e "${BLUE}=== PM2 Process Details ===${NC}"
PM2_PROCESSES=$(pm2 jlist | jq -r '.[] | "\(.name)|\(.pm2_env.status)|\(.pm2_env.restart_time)"' 2>/dev/null || pm2 list | grep -E "manufacturing|mo-" | awk '{print $4, $10}')

if [ -z "$PM2_PROCESSES" ]; then
    echo -e "${YELLOW}⚠️  Cannot parse PM2 processes (jq may not be installed)${NC}"
    echo "Manual check:"
    pm2 list
else
    echo "$PM2_PROCESSES" | while IFS='|' read -r name status restarts; do
        if [ "$status" = "online" ]; then
            echo -e "${GREEN}✓${NC} $name: $status (restarts: $restarts)"
        else
            echo -e "${RED}✗${NC} $name: $status (restarts: $restarts)"
        fi
    done
fi
echo ""

# 2. Health Endpoints
echo -e "${BLUE}=== 2. HEALTH ENDPOINTS ===${NC}"

# Manufacturing App Production
if check_endpoint "http://localhost:1234/health" "Manufacturing App (Production)"; then
    HEALTH_RESPONSE=$(curl -s http://localhost:1234/health 2>/dev/null)
    echo "  Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}  ⚠️  Manufacturing App Production is DOWN${NC}"
fi
echo ""

# Manufacturing App Staging
if check_endpoint "http://localhost:5678/health" "Manufacturing App (Staging)"; then
    HEALTH_RESPONSE=$(curl -s http://localhost:5678/health 2>/dev/null)
    echo "  Response: $HEALTH_RESPONSE"
else
    echo -e "${RED}  ⚠️  Manufacturing App Staging is DOWN${NC}"
fi
echo ""

# MO Reporting (if exists)
if check_endpoint "http://localhost:3000/health" "MO Reporting"; then
    :
elif check_endpoint "http://localhost:3000" "MO Reporting (root)"; then
    :
else
    echo -e "${YELLOW}  ⚠️  MO Reporting endpoint not accessible${NC}"
fi
echo ""

# 3. Docker Containers
echo -e "${BLUE}=== 3. DOCKER CONTAINERS ===${NC}"
if command -v docker &> /dev/null; then
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    echo "All containers (including stopped):"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    # Check specific containers
    echo ""
    echo "Container health check:"
    CONTAINERS=("pzem-monitoring-dashboard" "pzem-monitoring-mqtt-listener" "v2-web-ui" "postgres")
    for container in "${CONTAINERS[@]}"; do
        if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
            if [ "$STATUS" = "running" ]; then
                echo -e "${GREEN}✓${NC} $container: $STATUS"
            else
                echo -e "${RED}✗${NC} $container: $STATUS"
            fi
        else
            echo -e "${YELLOW}⚠${NC} $container: not found"
        fi
    done
else
    echo -e "${YELLOW}Docker not installed or not accessible${NC}"
fi
echo ""

# 4. Nginx Status
echo -e "${BLUE}=== 4. NGINX STATUS ===${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx: running"
    systemctl status nginx --no-pager -l | head -5
else
    echo -e "${RED}✗${NC} Nginx: not running"
    echo "Try: sudo systemctl start nginx"
fi
echo ""

# 5. Database Connections
echo -e "${BLUE}=== 5. DATABASE STATUS ===${NC}"

# PostgreSQL
if systemctl is-active --quiet postgresql@16-main || systemctl is-active --quiet postgresql; then
    echo -e "${GREEN}✓${NC} PostgreSQL: running"
    # Try to connect
    if command -v psql &> /dev/null; then
        PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -c "SELECT version();" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}  ✓${NC} PostgreSQL connection: OK"
        else
            echo -e "${YELLOW}  ⚠${NC} PostgreSQL connection: failed (may need password)"
        fi
    fi
else
    echo -e "${RED}✗${NC} PostgreSQL: not running"
    echo "Try: sudo systemctl start postgresql@16-main"
fi
echo ""

# SQLite (check if files exist)
echo "SQLite databases:"
find /home/foom/deployments -name "*.sqlite" -type f 2>/dev/null | while read db; do
    if [ -f "$db" ]; then
        SIZE=$(du -h "$db" | cut -f1)
        echo -e "${GREEN}  ✓${NC} Found: $db ($SIZE)"
    fi
done
echo ""

# 6. Port Listeners
echo -e "${BLUE}=== 6. PORT LISTENERS ===${NC}"
echo "Checking important ports:"
PORTS=(1234 5678 3000 80 443 5000 5432)
for port in "${PORTS[@]}"; do
    if netstat -tlnp 2>/dev/null | grep -q ":$port " || ss -tlnp 2>/dev/null | grep -q ":$port "; then
        PROCESS=$(netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | head -1 || ss -tlnp 2>/dev/null | grep ":$port " | awk '{print $6}' | head -1)
        echo -e "${GREEN}✓${NC} Port $port: LISTENING ($PROCESS)"
    else
        echo -e "${YELLOW}⚠${NC} Port $port: NOT LISTENING"
    fi
done
echo ""

# 7. System Resources
echo -e "${BLUE}=== 7. SYSTEM RESOURCES ===${NC}"
echo "Disk usage:"
df -h / | tail -1
echo ""
echo "Memory usage:"
free -h | grep Mem
echo ""
echo "Load average:"
uptime | awk -F'load average:' '{print $2}'
echo ""

# 8. Recent Errors in Logs
echo -e "${BLUE}=== 8. RECENT ERRORS (Last 10 lines) ===${NC}"
echo "PM2 Error Logs:"
pm2 logs --lines 10 --err --nostream 2>/dev/null | tail -20 || echo "No PM2 error logs found"
echo ""

# 9. Summary
echo -e "${CYAN}=========================================="
echo "SUMMARY"
echo "==========================================${NC}"
echo ""

# Count issues
ISSUES=0

# Check PM2
PM2_DOWN=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.status != "online") | .name' | wc -l)
if [ "$PM2_DOWN" -gt 0 ]; then
    echo -e "${RED}✗${NC} PM2: $PM2_DOWN process(es) not online"
    ISSUES=$((ISSUES + PM2_DOWN))
else
    echo -e "${GREEN}✓${NC} PM2: All processes online"
fi

# Check Health Endpoints
if ! curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:1234/health | grep -q "200\|204"; then
    echo -e "${RED}✗${NC} Manufacturing App Production: Health check failed"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC} Manufacturing App Production: Healthy"
fi

if ! curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5678/health | grep -q "200\|204"; then
    echo -e "${RED}✗${NC} Manufacturing App Staging: Health check failed"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC} Manufacturing App Staging: Healthy"
fi

# Check Nginx
if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}✗${NC} Nginx: Not running"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC} Nginx: Running"
fi

# Check PostgreSQL
if ! systemctl is-active --quiet postgresql@16-main && ! systemctl is-active --quiet postgresql; then
    echo -e "${RED}✗${NC} PostgreSQL: Not running"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}✓${NC} PostgreSQL: Running"
fi

echo ""
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ All services are running correctly!${NC}"
else
    echo -e "${RED}⚠️  Found $ISSUES issue(s) that need attention${NC}"
    echo ""
    echo -e "${YELLOW}Recommended actions:${NC}"
    echo "1. Check PM2 logs: pm2 logs --lines 50"
    echo "2. Restart failed services: pm2 restart all"
    echo "3. Check Nginx: sudo systemctl status nginx"
    echo "4. Check PostgreSQL: sudo systemctl status postgresql@16-main"
fi

echo ""
