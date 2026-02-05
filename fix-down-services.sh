#!/bin/bash
# Fix Down Services Script
# Automatically restarts failed services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================="
echo "FIX DOWN SERVICES"
echo "==========================================${NC}"
echo ""

# Function to check and restart PM2 process
restart_pm2_if_down() {
    local name=$1
    local status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name == \"$name\") | .pm2_env.status" || echo "unknown")
    
    if [ "$status" != "online" ]; then
        echo -e "${YELLOW}⚠️  $name is $status, restarting...${NC}"
        pm2 restart "$name"
        sleep 2
        NEW_STATUS=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name == \"$name\") | .pm2_env.status" || echo "unknown")
        if [ "$NEW_STATUS" = "online" ]; then
            echo -e "${GREEN}✓${NC} $name restarted successfully"
            return 0
        else
            echo -e "${RED}✗${NC} $name failed to restart (status: $NEW_STATUS)"
            return 1
        fi
    else
        echo -e "${GREEN}✓${NC} $name is already online"
        return 0
    fi
}

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
    if [ "$response" = "200" ] || [ "$response" = "204" ]; then
        return 0
    else
        return 1
    fi
}

FIXED=0
FAILED=0

# 1. Fix PM2 Processes
echo -e "${BLUE}=== 1. Checking PM2 Processes ===${NC}"
PM2_APPS=("manufacturing-app" "manufacturing-app-staging" "mo-receiver" "mo-reporting")

for app in "${PM2_APPS[@]}"; do
    if restart_pm2_if_down "$app"; then
        FIXED=$((FIXED + 1))
    else
        FAILED=$((FAILED + 1))
    fi
done
echo ""

# 2. Fix Nginx
echo -e "${BLUE}=== 2. Checking Nginx ===${NC}"
if ! systemctl is-active --quiet nginx; then
    echo -e "${YELLOW}⚠️  Nginx is not running, starting...${NC}"
    sudo systemctl start nginx
    sleep 2
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✓${NC} Nginx started successfully"
        FIXED=$((FIXED + 1))
    else
        echo -e "${RED}✗${NC} Nginx failed to start"
        echo "Check logs: sudo journalctl -u nginx -n 50"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${GREEN}✓${NC} Nginx is already running"
fi
echo ""

# 3. Fix PostgreSQL
echo -e "${BLUE}=== 3. Checking PostgreSQL ===${NC}"
if ! systemctl is-active --quiet postgresql@16-main && ! systemctl is-active --quiet postgresql; then
    echo -e "${YELLOW}⚠️  PostgreSQL is not running, starting...${NC}"
    sudo systemctl start postgresql@16-main 2>/dev/null || sudo systemctl start postgresql
    sleep 3
    if systemctl is-active --quiet postgresql@16-main || systemctl is-active --quiet postgresql; then
        echo -e "${GREEN}✓${NC} PostgreSQL started successfully"
        FIXED=$((FIXED + 1))
    else
        echo -e "${RED}✗${NC} PostgreSQL failed to start"
        echo "Check logs: sudo journalctl -u postgresql@16-main -n 50"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${GREEN}✓${NC} PostgreSQL is already running"
fi
echo ""

# 4. Fix Docker Containers
echo -e "${BLUE}=== 4. Checking Docker Containers ===${NC}"
if command -v docker &> /dev/null; then
    # Get stopped containers
    STOPPED=$(docker ps -a --filter "status=exited" --format "{{.Names}}")
    
    if [ -n "$STOPPED" ]; then
        echo "Found stopped containers:"
        echo "$STOPPED"
        echo ""
        read -p "Restart stopped containers? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$STOPPED" | while read container; do
                echo "Starting $container..."
                docker start "$container"
                sleep 2
                if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
                    echo -e "${GREEN}✓${NC} $container started"
                    FIXED=$((FIXED + 1))
                else
                    echo -e "${RED}✗${NC} $container failed to start"
                    FAILED=$((FAILED + 1))
                fi
            done
        fi
    else
        echo -e "${GREEN}✓${NC} All Docker containers are running"
    fi
else
    echo -e "${YELLOW}Docker not installed or not accessible${NC}"
fi
echo ""

# 5. Verify Health Endpoints
echo -e "${BLUE}=== 5. Verifying Health Endpoints ===${NC}"

# Manufacturing App Production
if check_endpoint "http://localhost:1234/health"; then
    echo -e "${GREEN}✓${NC} Manufacturing App Production: Healthy"
else
    echo -e "${RED}✗${NC} Manufacturing App Production: Health check failed"
    echo "  Checking logs..."
    pm2 logs manufacturing-app --lines 20 --nostream --err | tail -10
    FAILED=$((FAILED + 1))
fi

# Manufacturing App Staging
if check_endpoint "http://localhost:5678/health"; then
    echo -e "${GREEN}✓${NC} Manufacturing App Staging: Healthy"
else
    echo -e "${RED}✗${NC} Manufacturing App Staging: Health check failed"
    echo "  Checking logs..."
    pm2 logs manufacturing-app-staging --lines 20 --nostream --err | tail -10
    FAILED=$((FAILED + 1))
fi
echo ""

# 6. Summary
echo -e "${CYAN}=========================================="
echo "FIX SUMMARY"
echo "==========================================${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All services are now running!${NC}"
    if [ $FIXED -gt 0 ]; then
        echo "Fixed $FIXED service(s)"
    fi
else
    echo -e "${YELLOW}⚠️  Fixed $FIXED service(s), but $FAILED still have issues${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Check PM2 logs: pm2 logs --lines 50"
    echo "2. Check system logs: sudo journalctl -xe"
    echo "3. Verify database connection"
    echo "4. Check port conflicts: netstat -tlnp | grep -E '1234|5678'"
fi

echo ""
echo "Current PM2 status:"
pm2 status

echo ""
echo "Current system status:"
df -h / | tail -1
free -h | grep Mem
