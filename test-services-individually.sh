#!/bin/bash
# Test Services Individually by Stopping One at a Time
# Helps identify which service is causing issues

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Backup file for restoration
BACKUP_FILE="/tmp/pm2_backup_$(date +%Y%m%d_%H%M%S).json"

echo -e "${CYAN}=========================================="
echo "TEST SERVICES INDIVIDUALLY"
echo "==========================================${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This script will stop services one by one${NC}"
echo "Make sure you have access to restart them if needed"
echo ""

# Function to get system metrics
get_metrics() {
    echo "Load: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')"
    echo "Memory: $(free -h | grep Mem | awk '{print $3"/"$2" ("$3/$2*100"%)"}')"
    echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
}

# Function to test health endpoints
test_health() {
    local prod=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:1234/health 2>/dev/null)
    local staging=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5678/health 2>/dev/null)
    echo "Production: $prod, Staging: $staging"
}

# Save PM2 state
echo -e "${BLUE}=== Saving PM2 State ===${NC}"
pm2 save
pm2 jlist > "$BACKUP_FILE" 2>/dev/null || pm2 list > "$BACKUP_FILE"
echo -e "${GREEN}✓${NC} PM2 state saved to: $BACKUP_FILE"
echo ""

# Get baseline metrics
echo -e "${BLUE}=== Baseline Metrics (Before Testing) ===${NC}"
get_metrics
test_health
echo ""

# List PM2 processes
echo -e "${BLUE}=== PM2 Processes ===${NC}"
pm2 list
echo ""

# Get PM2 process names
PM2_PROCESSES=$(pm2 jlist 2>/dev/null | jq -r '.[] | .name' | sort -u || pm2 list | awk 'NR>3 {print $4}' | grep -v "^$" | sort -u)

if [ -z "$PM2_PROCESSES" ]; then
    echo -e "${RED}No PM2 processes found${NC}"
    exit 1
fi

echo "Found PM2 processes:"
echo "$PM2_PROCESSES" | nl
echo ""

# List Docker containers
echo -e "${BLUE}=== Docker Containers ===${NC}"
if command -v docker &> /dev/null; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    DOCKER_CONTAINERS=$(docker ps --format "{{.Names}}")
else
    echo -e "${YELLOW}Docker not available${NC}"
    DOCKER_CONTAINERS=""
fi
echo ""

# Menu
echo -e "${CYAN}Select testing mode:${NC}"
echo "1. Test PM2 processes one by one"
echo "2. Test Docker containers one by one"
echo "3. Test both (PM2 first, then Docker)"
echo "4. View current status only"
echo "5. Exit"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
    1)
        echo -e "${BLUE}=== Testing PM2 Processes ===${NC}"
        echo ""
        
        for process in $PM2_PROCESSES; do
            echo -e "${CYAN}----------------------------------------${NC}"
            echo -e "${YELLOW}Testing: $process${NC}"
            echo -e "${CYAN}----------------------------------------${NC}"
            
            # Get metrics before
            echo "Before stopping:"
            get_metrics
            test_health
            echo ""
            
            # Stop process
            echo "Stopping $process..."
            pm2 stop "$process"
            sleep 3
            
            # Get metrics after
            echo "After stopping:"
            get_metrics
            test_health
            echo ""
            
            # Ask user
            echo -e "${YELLOW}Did stopping $process help? (y/n/skip)${NC}"
            read -p "> " response
            
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo -e "${GREEN}✓${NC} $process may be causing issues"
                echo "Keeping it stopped. You can restart later with: pm2 start $process"
                echo ""
            elif [[ "$response" =~ ^[Ss]$ ]]; then
                echo "Skipping restart for now..."
                echo ""
            else
                # Restart process
                echo "Restarting $process..."
                pm2 start "$process"
                sleep 2
                echo -e "${GREEN}✓${NC} $process restarted"
                echo ""
            fi
            
            echo "Press Enter to continue to next process..."
            read
        done
        ;;
        
    2)
        if [ -z "$DOCKER_CONTAINERS" ]; then
            echo -e "${YELLOW}No Docker containers running${NC}"
            exit 0
        fi
        
        echo -e "${BLUE}=== Testing Docker Containers ===${NC}"
        echo ""
        
        for container in $DOCKER_CONTAINERS; do
            echo -e "${CYAN}----------------------------------------${NC}"
            echo -e "${YELLOW}Testing: $container${NC}"
            echo -e "${CYAN}----------------------------------------${NC}"
            
            # Get metrics before
            echo "Before stopping:"
            get_metrics
            test_health
            echo ""
            
            # Stop container
            echo "Stopping $container..."
            docker stop "$container"
            sleep 3
            
            # Get metrics after
            echo "After stopping:"
            get_metrics
            test_health
            echo ""
            
            # Ask user
            echo -e "${YELLOW}Did stopping $container help? (y/n/skip)${NC}"
            read -p "> " response
            
            if [[ "$response" =~ ^[Yy]$ ]]; then
                echo -e "${GREEN}✓${NC} $container may be causing issues"
                echo "Keeping it stopped. You can restart later with: docker start $container"
                echo ""
            elif [[ "$response" =~ ^[Ss]$ ]]; then
                echo "Skipping restart for now..."
                echo ""
            else
                # Restart container
                echo "Restarting $container..."
                docker start "$container"
                sleep 2
                echo -e "${GREEN}✓${NC} $container restarted"
                echo ""
            fi
            
            echo "Press Enter to continue to next container..."
            read
        done
        ;;
        
    3)
        # Test PM2 first
        echo -e "${BLUE}=== Testing PM2 Processes First ===${NC}"
        echo ""
        
        for process in $PM2_PROCESSES; do
            echo -e "${CYAN}----------------------------------------${NC}"
            echo -e "${YELLOW}Testing PM2: $process${NC}"
            echo -e "${CYAN}----------------------------------------${NC}"
            
            echo "Before:"
            get_metrics
            test_health
            echo ""
            
            pm2 stop "$process"
            sleep 3
            
            echo "After:"
            get_metrics
            test_health
            echo ""
            
            echo -e "${YELLOW}Impact? (y=helpful, n=no impact, s=skip restart)${NC}"
            read -p "> " response
            
            if [[ ! "$response" =~ ^[Yy]$ ]]; then
                if [[ ! "$response" =~ ^[Ss]$ ]]; then
                    pm2 start "$process"
                    sleep 2
                fi
            fi
            
            echo "Press Enter to continue..."
            read
        done
        
        # Then test Docker
        if [ -n "$DOCKER_CONTAINERS" ]; then
            echo -e "${BLUE}=== Testing Docker Containers ===${NC}"
            echo ""
            
            for container in $DOCKER_CONTAINERS; do
                echo -e "${CYAN}----------------------------------------${NC}"
                echo -e "${YELLOW}Testing Docker: $container${NC}"
                echo -e "${CYAN}----------------------------------------${NC}"
                
                echo "Before:"
                get_metrics
                test_health
                echo ""
                
                docker stop "$container"
                sleep 3
                
                echo "After:"
                get_metrics
                test_health
                echo ""
                
                echo -e "${YELLOW}Impact? (y=helpful, n=no impact, s=skip restart)${NC}"
                read -p "> " response
                
                if [[ ! "$response" =~ ^[Yy]$ ]]; then
                    if [[ ! "$response" =~ ^[Ss]$ ]]; then
                        docker start "$container"
                        sleep 2
                    fi
                fi
                
                echo "Press Enter to continue..."
                read
            done
        fi
        ;;
        
    4)
        echo -e "${BLUE}=== Current Status ===${NC}"
        echo ""
        echo "PM2 Status:"
        pm2 status
        echo ""
        echo "Docker Status:"
        docker ps 2>/dev/null || echo "Docker not available"
        echo ""
        echo "System Metrics:"
        get_metrics
        echo ""
        echo "Health Endpoints:"
        test_health
        ;;
        
    5)
        echo "Exiting..."
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}=========================================="
echo "TESTING COMPLETE"
echo "==========================================${NC}"
echo ""

# Final status
echo "Final PM2 Status:"
pm2 status
echo ""

if [ -n "$DOCKER_CONTAINERS" ]; then
    echo "Final Docker Status:"
    docker ps
    echo ""
fi

echo "Final System Metrics:"
get_metrics
echo ""

echo -e "${YELLOW}Note:${NC} PM2 backup saved to: $BACKUP_FILE"
echo "To restore: pm2 resurrect (if using PM2 save)"
echo ""
