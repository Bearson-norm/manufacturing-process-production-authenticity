#!/bin/bash
# Investigate yVAc34l Process
# This process is HIGHLY SUSPICIOUS

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PID=2172245

echo -e "${RED}=========================================="
echo "🚨 INVESTIGATING SUSPICIOUS PROCESS: yVAc34l"
echo "==========================================${NC}"
echo ""

# 1. Process Details
echo -e "${BLUE}=== 1. PROCESS DETAILS ===${NC}"
ps aux | grep $PID | grep -v grep
echo ""

# Check process tree
echo "Process tree:"
pstree -p $PID 2>/dev/null || ps --forest -g $PID 2>/dev/null || echo "Cannot get process tree"
echo ""

# 2. Process File Location
echo -e "${BLUE}=== 2. PROCESS FILE LOCATION ===${NC}"
PROC_PATH=$(readlink -f /proc/$PID/exe 2>/dev/null)
if [ -n "$PROC_PATH" ]; then
    echo "Executable path: $PROC_PATH"
    echo ""
    echo "File details:"
    ls -la "$PROC_PATH" 2>/dev/null || echo "Cannot access file"
    echo ""
    echo "File type:"
    file "$PROC_PATH" 2>/dev/null || echo "Cannot determine file type"
    echo ""
    echo "File size:"
    du -h "$PROC_PATH" 2>/dev/null || echo "Cannot get size"
else
    echo -e "${RED}⚠️  Cannot determine executable path${NC}"
fi
echo ""

# 3. Process User
echo -e "${BLUE}=== 3. PROCESS USER ===${NC}"
USER_ID=$(ps -o uid= -p $PID 2>/dev/null | tr -d ' ')
USER_NAME=$(id -nu $USER_ID 2>/dev/null || echo "Unknown user ID: $USER_ID")
echo "User ID: $USER_ID"
echo "User Name: $USER_NAME"
echo ""
echo "This is ${RED}VERY SUSPICIOUS${NC} - user ID 70 is not a normal user!"
echo ""

# 4. Network Connections
echo -e "${BLUE}=== 4. NETWORK CONNECTIONS ===${NC}"
if command -v ss &> /dev/null; then
    echo "Network connections for PID $PID:"
    ss -anp | grep "pid=$PID" || echo "No network connections found"
else
    echo "ss not available, install with: sudo apt install iproute2"
fi
echo ""

# 5. Open Files
echo -e "${BLUE}=== 5. OPEN FILES ===${NC}"
if command -v lsof &> /dev/null; then
    echo "Open files for PID $PID:"
    sudo lsof -p $PID 2>/dev/null | head -20 || echo "Need sudo to check open files"
else
    echo "lsof not available"
fi
echo ""

# 6. Process Memory
echo -e "${BLUE}=== 6. PROCESS MEMORY ===${NC}"
echo "Memory map:"
cat /proc/$PID/maps 2>/dev/null | head -20 || echo "Cannot access memory map"
echo ""

# 7. Process Environment
echo -e "${BLUE}=== 7. PROCESS ENVIRONMENT ===${NC}"
echo "Environment variables:"
cat /proc/$PID/environ 2>/dev/null | tr '\0' '\n' | head -20 || echo "Cannot access environment"
echo ""

# 8. Process Command Line
echo -e "${BLUE}=== 8. PROCESS COMMAND LINE ===${NC}"
echo "Command line arguments:"
cat /proc/$PID/cmdline 2>/dev/null | tr '\0' ' ' || echo "Cannot access command line"
echo ""
echo ""

# 9. Check Parent Process
echo -e "${BLUE}=== 9. PARENT PROCESS ===${NC}"
PPID=$(ps -o ppid= -p $PID 2>/dev/null | tr -d ' ')
if [ -n "$PPID" ]; then
    echo "Parent PID: $PPID"
    echo "Parent process:"
    ps aux | grep "^[^ ]* *$PPID " | grep -v grep || echo "Parent process not found"
else
    echo "Cannot determine parent process"
fi
echo ""

# 10. Check for Persistence
echo -e "${BLUE}=== 10. PERSISTENCE MECHANISMS ===${NC}"
echo "Checking cron jobs..."
if crontab -l 2>/dev/null | grep -E "yVAc34l|2172245"; then
    echo -e "${RED}⚠️  Found in user crontab!${NC}"
else
    echo "Not in user crontab"
fi

if sudo crontab -l -u root 2>/dev/null | grep -E "yVAc34l|2172245"; then
    echo -e "${RED}⚠️  Found in root crontab!${NC}"
else
    echo "Not in root crontab"
fi

echo ""
echo "Checking systemd services..."
if systemctl list-units --type=service --all | grep -E "yVAc34l|2172245"; then
    echo -e "${RED}⚠️  Found in systemd services!${NC}"
else
    echo "Not in systemd services"
fi

echo ""
echo "Checking startup scripts..."
if [ -f "/etc/rc.local" ] && grep -E "yVAc34l|2172245" /etc/rc.local; then
    echo -e "${RED}⚠️  Found in /etc/rc.local!${NC}"
else
    echo "Not in /etc/rc.local"
fi

if grep -E "yVAc34l|2172245" ~/.bashrc 2>/dev/null; then
    echo -e "${RED}⚠️  Found in ~/.bashrc!${NC}"
else
    echo "Not in ~/.bashrc"
fi

if grep -E "yVAc34l|2172245" ~/.profile 2>/dev/null; then
    echo -e "${RED}⚠️  Found in ~/.profile!${NC}"
else
    echo "Not in ~/.profile"
fi
echo ""

# Summary
echo -e "${RED}=========================================="
echo "⚠️  SECURITY ASSESSMENT"
echo "==========================================${NC}"
echo ""
echo -e "${RED}This process is HIGHLY SUSPICIOUS:${NC}"
echo "1. Random name: yVAc34l (not a system process)"
echo "2. User ID 70 (not normal user)"
echo "3. Very small memory (0 bytes resident - unusual)"
echo "4. Running since Jan26 (long-running unknown process)"
echo ""
echo -e "${YELLOW}RECOMMENDATION:${NC}"
echo "1. Kill this process immediately: sudo kill -9 $PID"
echo "2. Remove executable file: $PROC_PATH"
echo "3. Check and remove persistence mechanisms"
echo "4. Change all passwords"
echo "5. Run full security scan"
echo ""
