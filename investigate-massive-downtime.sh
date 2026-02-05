#!/bin/bash
# Investigate Massive Downtime - All Services Down Simultaneously
# Checks for malware, network issues, resource exhaustion, etc.

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}=========================================="
echo "⚠️  INVESTIGATING MASSIVE DOWNTIME"
echo "==========================================${NC}"
echo ""

ISSUES_FOUND=0

# 1. Check Suspicious Processes
echo -e "${BLUE}=== 1. SUSPICIOUS PROCESSES ===${NC}"
echo "Checking for suspicious/malicious processes..."

# Check for suspicious process names
SUSPICIOUS=$(ps aux | grep -E "p1eNsfx|curl.*tor2web|curl.*doh-url|\.tor2web|\.onion" | grep -v grep)

if [ -n "$SUSPICIOUS" ]; then
    echo -e "${RED}🚨 SUSPICIOUS PROCESSES DETECTED:${NC}"
    echo "$SUSPICIOUS"
    echo ""
    echo -e "${RED}⚠️  WARNING: These processes look like malware/backdoor!${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    
    # Extract PIDs
    SUSPICIOUS_PIDS=$(echo "$SUSPICIOUS" | awk '{print $2}')
    echo ""
    echo "Suspicious PIDs: $SUSPICIOUS_PIDS"
    echo ""
    echo -e "${YELLOW}RECOMMENDATION: Kill these processes immediately!${NC}"
    echo "Command: sudo kill -9 $SUSPICIOUS_PIDS"
else
    echo -e "${GREEN}✓${NC} No obvious suspicious processes found"
fi
echo ""

# 2. Check Network Connectivity
echo -e "${BLUE}=== 2. NETWORK CONNECTIVITY ===${NC}"

# Test localhost
if curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:1234/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Localhost:1234 is accessible"
else
    echo -e "${RED}✗${NC} Localhost:1234 is NOT accessible"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:5678/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Localhost:5678 is accessible"
else
    echo -e "${RED}✗${NC} Localhost:5678 is NOT accessible"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Test external connectivity
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} External connectivity (8.8.8.8) OK"
else
    echo -e "${RED}✗${NC} External connectivity FAILED"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Test DNS
if nslookup google.com > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} DNS resolution OK"
else
    echo -e "${RED}✗${NC} DNS resolution FAILED"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 3. Check Firewall
echo -e "${BLUE}=== 3. FIREWALL STATUS ===${NC}"
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(sudo ufw status | head -1)
    echo "UFW: $UFW_STATUS"
    if echo "$UFW_STATUS" | grep -q "active"; then
        echo -e "${YELLOW}⚠${NC} Firewall is active - check if it's blocking ports"
        echo "Check rules: sudo ufw status numbered"
    fi
elif command -v iptables &> /dev/null; then
    echo "iptables rules count: $(sudo iptables -L | wc -l)"
    echo "Check rules: sudo iptables -L -n"
fi
echo ""

# 4. Check Resource Exhaustion
echo -e "${BLUE}=== 4. RESOURCE EXHAUSTION ===${NC}"
echo "Load average:"
uptime | awk -F'load average:' '{print $2}'
echo ""

echo "Memory usage:"
free -h
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 90 ]; then
    echo -e "${RED}⚠️  Memory usage is CRITICAL: ${MEM_USAGE}%${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

echo "Disk usage:"
df -h / | tail -1
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo -e "${RED}⚠️  Disk usage is CRITICAL: ${DISK_USAGE}%${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 5. Check PM2 Status
echo -e "${BLUE}=== 5. PM2 PROCESSES STATUS ===${NC}"
pm2 status
echo ""

# Check if processes are actually running
DOWN_PROCESSES=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.status != "online") | .name' || \
                 pm2 list | grep -E "stopped|errored" | awk '{print $4}')

if [ -n "$DOWN_PROCESSES" ]; then
    echo -e "${RED}⚠️  Down processes:${NC}"
    echo "$DOWN_PROCESSES"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} All PM2 processes are online"
fi
echo ""

# 6. Check Port Listeners
echo -e "${BLUE}=== 6. PORT LISTENERS ===${NC}"
echo "Checking if ports are listening:"
for port in 1234 5678 80 443; do
    if netstat -tlnp 2>/dev/null | grep -q ":$port " || ss -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} Port $port: LISTENING"
    else
        echo -e "${RED}✗${NC} Port $port: NOT LISTENING"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done
echo ""

# 7. Check Nginx
echo -e "${BLUE}=== 7. NGINX STATUS ===${NC}"
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC} Nginx is running"
else
    echo -e "${RED}✗${NC} Nginx is NOT running"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    echo "Start with: sudo systemctl start nginx"
fi
echo ""

# 8. Check Recent System Events
echo -e "${BLUE}=== 8. RECENT SYSTEM EVENTS ===${NC}"
echo "Recent systemd events (last 20):"
sudo journalctl -n 20 --no-pager 2>/dev/null | tail -10 || echo "Need sudo to check system logs"
echo ""

# 9. Check for DDoS/Attack Patterns
echo -e "${BLUE}=== 9. CHECKING FOR ATTACK PATTERNS ===${NC}"
echo "Active connections:"
if command -v ss &> /dev/null; then
    CONN_COUNT=$(ss -an 2>/dev/null | grep ESTAB | wc -l)
    echo "Established connections: $CONN_COUNT"
    
    if [ "$CONN_COUNT" -gt 1000 ]; then
        echo -e "${RED}⚠️  High connection count - possible DDoS${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
    
    echo ""
    echo "Top connections by IP:"
    ss -an 2>/dev/null | grep ESTAB | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -5
elif command -v netstat &> /dev/null; then
    CONN_COUNT=$(netstat -an 2>/dev/null | grep ESTABLISHED | wc -l)
    echo "Established connections: $CONN_COUNT"
    
    if [ "$CONN_COUNT" -gt 1000 ]; then
        echo -e "${RED}⚠️  High connection count - possible DDoS${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
    
    echo ""
    echo "Top connections by IP:"
    netstat -an 2>/dev/null | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -5
else
    echo -e "${YELLOW}Neither ss nor netstat available. Install with: sudo apt install iproute2 net-tools${NC}"
fi
echo ""

# 10. Check Cron Jobs
echo -e "${BLUE}=== 10. CRON JOBS (Suspicious) ===${NC}"
echo "Checking for suspicious cron jobs..."
if [ -f "/var/spool/cron/crontabs/root" ]; then
    echo "Root crontab:"
    sudo cat /var/spool/cron/crontabs/root 2>/dev/null | grep -v "^#" | grep -v "^$"
fi

if [ -f "/var/spool/cron/crontabs/foom" ]; then
    echo "User crontab:"
    crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$"
fi
echo ""

# 11. Check for Malware Indicators
echo -e "${BLUE}=== 11. MALWARE INDICATORS ===${NC}"
echo "Checking for common malware patterns..."

# Check for processes with random names
RANDOM_NAMES=$(ps aux | awk '{print $11}' | grep -E "^[a-zA-Z0-9]{8,}$" | grep -vE "systemd|dockerd|containerd|node|nginx|postgres" | head -5)
if [ -n "$RANDOM_NAMES" ]; then
    echo -e "${YELLOW}⚠${NC} Processes with random-looking names:"
    echo "$RANDOM_NAMES"
fi

# Check for processes connecting to suspicious domains
echo "Checking network connections to suspicious domains..."
if command -v ss &> /dev/null; then
    ss -anp 2>/dev/null | grep -E "tor2web|onion|\.tk|\.ml|\.ga" || echo "No obvious suspicious connections found"
elif command -v netstat &> /dev/null; then
    netstat -anp 2>/dev/null | grep -E "tor2web|onion|\.tk|\.ml|\.ga" || echo "No obvious suspicious connections found"
else
    echo "Cannot check (ss/netstat not available)"
fi
echo ""

# Summary
echo -e "${CYAN}=========================================="
echo "INVESTIGATION SUMMARY"
echo "==========================================${NC}"
echo ""

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No obvious issues found"
    echo "All services may be down due to external factors (network, monitoring tool, etc.)"
else
    echo -e "${RED}⚠️  Found $ISSUES_FOUND potential issue(s)${NC}"
    echo ""
    echo "Priority actions:"
    echo ""
    
    if [ -n "$SUSPICIOUS" ]; then
        echo -e "${RED}1. CRITICAL: Kill suspicious processes${NC}"
        SUSPICIOUS_PIDS=$(echo "$SUSPICIOUS" | awk '{print $2}')
        echo "   sudo kill -9 $SUSPICIOUS_PIDS"
        echo ""
    fi
    
    echo "2. Check network connectivity"
    echo "3. Restart services: pm2 restart all"
    echo "4. Check firewall rules"
    echo "5. Review system logs"
fi

echo ""
