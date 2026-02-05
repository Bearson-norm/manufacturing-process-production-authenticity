#!/bin/bash
# Diagnose High CPU Usage on Specific PM2 Process
# Usage: ./diagnose-high-cpu.sh <process-id-or-name>

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROCESS_ID=${1:-9}

echo -e "${CYAN}=========================================="
echo "DIAGNOSE HIGH CPU USAGE"
echo "Process: manufacturing-app (ID: $PROCESS_ID)"
echo "==========================================${NC}"
echo ""

# Get PM2 process info
echo -e "${BLUE}=== 1. PM2 PROCESS INFO ===${NC}"
pm2 describe $PROCESS_ID
echo ""

# Get system PID
SYSTEM_PID=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.pm_id == $PROCESS_ID) | .pid" || \
             pm2 describe $PROCESS_ID | grep "pid" | head -1 | awk '{print $4}')

if [ -z "$SYSTEM_PID" ]; then
    echo -e "${RED}Could not find system PID for process ID $PROCESS_ID${NC}"
    exit 1
fi

echo "System PID: $SYSTEM_PID"
echo ""

# Check CPU usage
echo -e "${BLUE}=== 2. CPU USAGE DETAIL ===${NC}"
echo "Current CPU usage:"
ps -p $SYSTEM_PID -o pid,pcpu,pmem,etime,cmd --no-headers
echo ""

# Check thread CPU usage
echo "Thread CPU usage (top threads):"
ps -T -p $SYSTEM_PID -o pid,tid,pcpu,pmem,cmd --no-headers | sort -k3 -rn | head -5
echo ""

# Check what the process is doing
echo -e "${BLUE}=== 3. PROCESS ACTIVITY ===${NC}"
echo "Recent system calls (if available):"
if command -v strace &> /dev/null; then
    echo "Running strace for 5 seconds (this may show what process is doing)..."
    timeout 5 strace -p $SYSTEM_PID -c 2>&1 | head -20 || echo "strace not available or permission denied"
else
    echo "strace not installed. Install with: sudo apt-get install strace"
fi
echo ""

# Check open files and connections
echo -e "${BLUE}=== 4. OPEN FILES & CONNECTIONS ===${NC}"
echo "Open file descriptors:"
lsof -p $SYSTEM_PID 2>/dev/null | wc -l
echo ""

echo "Network connections:"
lsof -p $SYSTEM_PID -i 2>/dev/null | head -10 || netstat -anp 2>/dev/null | grep $SYSTEM_PID | head -10
echo ""

# Check recent logs
echo -e "${BLUE}=== 5. RECENT LOGS (Last 50 lines) ===${NC}"
echo "Looking for patterns that might indicate infinite loop or heavy processing..."
pm2 logs manufacturing-app --lines 50 --nostream 2>/dev/null | grep -E "loop|while|for|setInterval|setTimeout|processing|heavy" -i | tail -20 || echo "No obvious patterns found"
echo ""

# Check for stuck operations
echo -e "${BLUE}=== 6. CHECKING FOR STUCK OPERATIONS ===${NC}"
echo "Recent errors:"
pm2 logs manufacturing-app --lines 100 --err --nostream 2>/dev/null | tail -20
echo ""

# Check memory usage pattern
echo -e "${BLUE}=== 7. MEMORY USAGE PATTERN ===${NC}"
echo "Memory usage over time (checking for leaks):"
for i in {1..5}; do
    MEM=$(ps -p $SYSTEM_PID -o rss --no-headers 2>/dev/null | awk '{print $1/1024}')
    echo "[$i] Memory: ${MEM}MB"
    sleep 2
done
echo ""

# Compare with other instance
echo -e "${BLUE}=== 8. COMPARISON WITH OTHER INSTANCE ===${NC}"
OTHER_PID=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name == "manufacturing-app" and .pm_id != '$PROCESS_ID') | .pid' | head -1)

if [ -n "$OTHER_PID" ]; then
    echo "Comparing with other manufacturing-app instance (PID: $OTHER_PID):"
    echo ""
    echo "High CPU instance (PID $SYSTEM_PID):"
    ps -p $SYSTEM_PID -o pid,pcpu,pmem,etime,cmd --no-headers
    echo ""
    echo "Normal instance (PID $OTHER_PID):"
    ps -p $OTHER_PID -o pid,pcpu,pmem,etime,cmd --no-headers
    echo ""
    
    # Compare thread counts
    THREADS_HIGH=$(ps -T -p $SYSTEM_PID 2>/dev/null | wc -l)
    THREADS_NORMAL=$(ps -T -p $OTHER_PID 2>/dev/null | wc -l)
    echo "Threads - High CPU: $THREADS_HIGH, Normal: $THREADS_NORMAL"
else
    echo "Could not find other instance for comparison"
fi
echo ""

# Summary and recommendations
echo -e "${CYAN}=========================================="
echo "DIAGNOSIS SUMMARY"
echo "==========================================${NC}"
echo ""

CPU_USAGE=$(ps -p $SYSTEM_PID -o pcpu --no-headers 2>/dev/null | awk '{print $1}')

if (( $(echo "$CPU_USAGE > 80" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${RED}⚠️  HIGH CPU USAGE DETECTED: ${CPU_USAGE}%${NC}"
    echo ""
    echo "Possible causes:"
    echo "1. Infinite loop in code"
    echo "2. Heavy database query running continuously"
    echo "3. Stuck in recursive function"
    echo "4. Heavy computation without yield"
    echo "5. External API call stuck in retry loop"
    echo "6. File I/O operation stuck"
    echo ""
    echo "Recommendations:"
    echo "1. Restart the specific instance: pm2 restart $PROCESS_ID"
    echo "2. Check logs for patterns: pm2 logs manufacturing-app --lines 200"
    echo "3. If persists, check code for infinite loops"
    echo "4. Consider adding CPU usage monitoring"
    echo "5. Check if specific endpoint/function is being called repeatedly"
else
    echo -e "${GREEN}CPU usage is normal: ${CPU_USAGE}%${NC}"
fi

echo ""
