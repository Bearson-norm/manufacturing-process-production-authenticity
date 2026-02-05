#!/bin/bash
# Check for Suspicious Processes
# Detects malware, backdoors, and suspicious activity

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}=========================================="
echo "CHECKING FOR SUSPICIOUS PROCESSES"
echo "==========================================${NC}"
echo ""

SUSPICIOUS_FOUND=0

# 1. Check for random-looking process names
echo -e "${BLUE}=== 1. RANDOM-LOOKING PROCESS NAMES ===${NC}"
echo "Processes with random names (8+ alphanumeric, not common system processes):"

RANDOM_PROCS=$(ps aux | awk '{print $11}' | grep -E "^[a-zA-Z0-9]{8,}$" | grep -vE "systemd|dockerd|containerd|node|nginx|postgres|sshd|bash|python|gunicorn|agetty|kworker|psimon" | sort -u)

if [ -n "$RANDOM_PROCS" ]; then
    echo -e "${RED}⚠️  SUSPICIOUS PROCESSES FOUND:${NC}"
    for proc in $RANDOM_PROCS; do
        echo "  - $proc"
        SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
        
        # Get details
        echo "    Details:"
        ps aux | grep "$proc" | grep -v grep | head -1 | awk '{print "      PID: " $2 ", CPU: " $3 "%, MEM: " $4 "%, CMD: " $11 " " $12 " " $13}'
    done
else
    echo -e "${GREEN}✓${NC} No random-looking process names found"
fi
echo ""

# 2. Check for processes with suspicious command lines
echo -e "${BLUE}=== 2. SUSPICIOUS COMMAND LINES ===${NC}"
SUSP_CMDS=$(ps aux | grep -E "tor2web|\.onion|curl.*doh-url|wget.*tor|p1eNsfx|yVAc34l" | grep -v grep)

if [ -n "$SUSP_CMDS" ]; then
    echo -e "${RED}🚨 SUSPICIOUS COMMANDS FOUND:${NC}"
    echo "$SUSP_CMDS"
    SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} No suspicious command lines found"
fi
echo ""

# 3. Check for processes with high CPU but unknown purpose
echo -e "${BLUE}=== 3. HIGH CPU UNKNOWN PROCESSES ===${NC}"
echo "Top processes by CPU (excluding known system processes):"
ps aux --sort=-%cpu | grep -vE "systemd|dockerd|containerd|node|nginx|postgres|sshd|bash|python|gunicorn|agetty|kworker|psimon|top|htop|watch|grep|awk|sort|uniq" | head -10
echo ""

# 4. Check network connections for suspicious domains
echo -e "${BLUE}=== 4. SUSPICIOUS NETWORK CONNECTIONS ===${NC}"
if command -v ss &> /dev/null; then
    echo "Checking for connections to suspicious domains..."
    SUSP_CONN=$(ss -anp 2>/dev/null | grep -E "tor2web|onion|\.tk|\.ml|\.ga|\.cf" || echo "")
    
    if [ -n "$SUSP_CONN" ]; then
        echo -e "${RED}⚠️  Suspicious connections found:${NC}"
        echo "$SUSP_CONN"
        SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
    else
        echo -e "${GREEN}✓${NC} No suspicious network connections found"
    fi
else
    echo -e "${YELLOW}ss command not available${NC}"
fi
echo ""

# 5. Check for processes listening on unusual ports
echo -e "${BLUE}=== 5. UNUSUAL PORT LISTENERS ===${NC}"
if command -v ss &> /dev/null; then
    echo "Processes listening on ports:"
    ss -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $7}' | sort | uniq | head -20
else
    echo -e "${YELLOW}ss command not available, install with: sudo apt install iproute2${NC}"
fi
echo ""

# 6. Check cron jobs
echo -e "${BLUE}=== 6. CRON JOBS ===${NC}"
echo "User crontab:"
if crontab -l 2>/dev/null | grep -v "^#" | grep -v "^$" | grep -E "curl|wget|p1eNsfx|yVAc34l|tor2web"; then
    echo -e "${RED}⚠️  Suspicious cron jobs found in user crontab${NC}"
    SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} No suspicious cron jobs in user crontab"
fi

echo ""
echo "Root crontab:"
if sudo crontab -l -u root 2>/dev/null | grep -v "^#" | grep -v "^$" | grep -E "curl|wget|p1eNsfx|yVAc34l|tor2web"; then
    echo -e "${RED}⚠️  Suspicious cron jobs found in root crontab${NC}"
    SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} No suspicious cron jobs in root crontab"
fi
echo ""

# 7. Check startup scripts
echo -e "${BLUE}=== 7. STARTUP SCRIPTS ===${NC}"
echo "Checking /etc/rc.local:"
if [ -f "/etc/rc.local" ]; then
    if grep -E "p1eNsfx|yVAc34l|tor2web" /etc/rc.local 2>/dev/null; then
        echo -e "${RED}⚠️  Suspicious content in /etc/rc.local${NC}"
        SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
    else
        echo -e "${GREEN}✓${NC} /etc/rc.local looks clean"
    fi
else
    echo "  /etc/rc.local not found"
fi

echo ""
echo "Checking ~/.bashrc:"
if grep -E "p1eNsfx|yVAc34l|tor2web|curl.*tor" ~/.bashrc 2>/dev/null; then
    echo -e "${RED}⚠️  Suspicious content in ~/.bashrc${NC}"
    SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} ~/.bashrc looks clean"
fi

echo ""
echo "Checking ~/.profile:"
if grep -E "p1eNsfx|yVAc34l|tor2web|curl.*tor" ~/.profile 2>/dev/null; then
    echo -e "${RED}⚠️  Suspicious content in ~/.profile${NC}"
    SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} ~/.profile looks clean"
fi
echo ""

# 8. Check systemd services
echo -e "${BLUE}=== 8. SYSTEMD SERVICES ===${NC}"
echo "Checking for suspicious systemd services:"
if systemctl list-units --type=service --all | grep -E "p1eNsfx|yVAc34l|tor2web"; then
    echo -e "${RED}⚠️  Suspicious systemd services found${NC}"
    SUSPICIOUS_FOUND=$((SUSPICIOUS_FOUND + 1))
else
    echo -e "${GREEN}✓${NC} No suspicious systemd services found"
fi
echo ""

# Summary
echo -e "${CYAN}=========================================="
echo "SUMMARY"
echo "==========================================${NC}"
echo ""

if [ $SUSPICIOUS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No suspicious processes found"
    echo "System appears clean"
else
    echo -e "${RED}⚠️  Found $SUSPICIOUS_FOUND suspicious item(s)${NC}"
    echo ""
    echo "Recommendations:"
    echo "1. Kill suspicious processes immediately"
    echo "2. Remove from cron jobs if found"
    echo "3. Clean startup scripts"
    echo "4. Change all passwords"
    echo "5. Review system logs"
    echo "6. Consider full system scan"
fi

echo ""
