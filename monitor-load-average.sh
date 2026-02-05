#!/bin/bash
# Monitor Load Average and Alert if High
# Usage: ./monitor-load-average.sh [duration in minutes]

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DURATION=${1:-5} # Default 5 minutes
INTERVAL=10 # Check every 10 seconds

CPU_CORES=$(nproc)
WARNING_THRESHOLD=$(echo "$CPU_CORES * 0.75" | bc -l) # 75% of cores
CRITICAL_THRESHOLD=$CPU_CORES # 100% of cores

echo -e "${CYAN}=========================================="
echo "LOAD AVERAGE MONITOR"
echo "==========================================${NC}"
echo ""
echo "CPU Cores: $CPU_CORES"
echo "Warning Threshold: ${WARNING_THRESHOLD}"
echo "Critical Threshold: ${CRITICAL_THRESHOLD}"
echo "Monitoring for: $DURATION minutes"
echo "Check interval: $INTERVAL seconds"
echo ""

END_TIME=$(date -d "+$DURATION minutes" +%s 2>/dev/null || echo $(($(date +%s) + DURATION * 60)))
HIGH_LOAD_COUNT=0
TOTAL_CHECKS=0

while [ $(date +%s) -lt $END_TIME ]; do
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    # Get load average
    LOAD_1MIN=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    LOAD_5MIN=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $2}' | sed 's/,//')
    LOAD_15MIN=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $3}' | sed 's/,//')
    
    # Get CPU and Memory
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    MEM_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100}')
    
    # Timestamp
    TIMESTAMP=$(date '+%H:%M:%S')
    
    # Status
    if (( $(echo "$LOAD_1MIN > $CRITICAL_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
        STATUS="${RED}CRITICAL${NC}"
        HIGH_LOAD_COUNT=$((HIGH_LOAD_COUNT + 1))
        SYMBOL="🚨"
    elif (( $(echo "$LOAD_1MIN > $WARNING_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
        STATUS="${YELLOW}WARNING${NC}"
        HIGH_LOAD_COUNT=$((HIGH_LOAD_COUNT + 1))
        SYMBOL="⚠️"
    else
        STATUS="${GREEN}OK${NC}"
        SYMBOL="✓"
    fi
    
    # Display
    echo -e "[$TIMESTAMP] $SYMBOL Load: ${LOAD_1MIN} | CPU: ${CPU_USAGE}% | Mem: ${MEM_USAGE}% | Status: $STATUS"
    
    # Show top processes if high load
    if (( $(echo "$LOAD_1MIN > $WARNING_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
        echo "  Top 3 processes by CPU:"
        ps aux --sort=-%cpu | head -4 | tail -3 | awk '{print "    " $2 " " $3 "% " $11 " " $12 " " $13}'
    fi
    
    sleep $INTERVAL
done

echo ""
echo -e "${CYAN}=========================================="
echo "MONITORING SUMMARY"
echo "==========================================${NC}"
echo ""

# Final load
FINAL_LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
INITIAL_LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//' 2>/dev/null || echo "N/A")

echo "Total checks: $TOTAL_CHECKS"
echo "High load occurrences: $HIGH_LOAD_COUNT"
echo "High load percentage: $(echo "scale=1; $HIGH_LOAD_COUNT * 100 / $TOTAL_CHECKS" | bc -l)%"
echo ""

if [ $HIGH_LOAD_COUNT -gt $((TOTAL_CHECKS / 2)) ]; then
    echo -e "${RED}⚠️  High load detected in >50% of checks${NC}"
    echo "Recommendation: Investigate and optimize"
    echo ""
    echo "Top processes by CPU:"
    ps aux --sort=-%cpu | head -6
    echo ""
    echo "Top processes by Memory:"
    ps aux --sort=-%mem | head -6
else
    echo -e "${GREEN}✓ Load average is mostly normal${NC}"
    if (( $(echo "$FINAL_LOAD < $INITIAL_LOAD" | bc -l 2>/dev/null || echo "0") )); then
        echo "Load decreased during monitoring (good sign)"
    fi
fi

echo ""
