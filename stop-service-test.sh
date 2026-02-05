#!/bin/bash
# Quick Script to Stop One Service and Monitor Impact
# Usage: ./stop-service-test.sh <service-name> [pm2|docker]

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SERVICE_NAME=$1
SERVICE_TYPE=${2:-pm2}

if [ -z "$SERVICE_NAME" ]; then
    echo -e "${RED}Usage: $0 <service-name> [pm2|docker]${NC}"
    echo ""
    echo "PM2 services:"
    pm2 list | awk 'NR>3 {print "  - " $4}'
    echo ""
    echo "Docker containers:"
    docker ps --format "  - {{.Names}}" 2>/dev/null || echo "  (Docker not available)"
    exit 1
fi

echo -e "${CYAN}=========================================="
echo "STOP SERVICE TEST: $SERVICE_NAME"
echo "==========================================${NC}"
echo ""

# Function to get metrics
get_metrics() {
    echo "  Load: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')"
    echo "  Memory: $(free -h | grep Mem | awk '{print $3"/"$2}')"
    echo "  CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
}

# Function to test health
test_health() {
    local prod=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:1234/health 2>/dev/null)
    local staging=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5678/health 2>/dev/null)
    echo "  Production: $prod, Staging: $staging"
}

# Before
echo -e "${BLUE}=== BEFORE STOPPING ===${NC}"
get_metrics
test_health
echo ""

# Stop service
echo -e "${YELLOW}Stopping $SERVICE_NAME ($SERVICE_TYPE)...${NC}"

if [ "$SERVICE_TYPE" = "pm2" ]; then
    pm2 stop "$SERVICE_NAME"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Stopped"
    else
        echo -e "${RED}✗${NC} Failed to stop"
        exit 1
    fi
elif [ "$SERVICE_TYPE" = "docker" ]; then
    docker stop "$SERVICE_NAME"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} Stopped"
    else
        echo -e "${RED}✗${NC} Failed to stop"
        exit 1
    fi
else
    echo -e "${RED}Invalid service type: $SERVICE_TYPE${NC}"
    exit 1
fi

echo ""
echo "Waiting 5 seconds..."
sleep 5

# After
echo -e "${BLUE}=== AFTER STOPPING ===${NC}"
get_metrics
test_health
echo ""

# Monitor for 30 seconds
echo -e "${YELLOW}Monitoring for 30 seconds...${NC}"
for i in {1..6}; do
    sleep 5
    echo "[$((i*5))s]"
    get_metrics
    test_health
    echo ""
done

# Ask to restart
echo -e "${YELLOW}Restart $SERVICE_NAME? (y/n)${NC}"
read -p "> " response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo "Restarting..."
    if [ "$SERVICE_TYPE" = "pm2" ]; then
        pm2 start "$SERVICE_NAME"
    else
        docker start "$SERVICE_NAME"
    fi
    sleep 2
    echo -e "${GREEN}✓${NC} Restarted"
else
    echo -e "${YELLOW}Keeping $SERVICE_NAME stopped${NC}"
    echo "Restart manually with:"
    if [ "$SERVICE_TYPE" = "pm2" ]; then
        echo "  pm2 start $SERVICE_NAME"
    else
        echo "  docker start $SERVICE_NAME"
    fi
fi
