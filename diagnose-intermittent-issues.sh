#!/bin/bash
# Diagnose Intermittent Up/Down Issues
# Checks timeout, response time, database, resources, and PM2 restarts

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================="
echo "DIAGNOSE INTERMITTENT UP/DOWN ISSUES"
echo "==========================================${NC}"
echo ""

# Function to test endpoint with timeout
test_endpoint_timeout() {
    local url=$1
    local name=$2
    local timeout=${3:-5}
    
    echo -n "Testing $name (timeout: ${timeout}s)... "
    
    START_TIME=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $timeout "$url" 2>/dev/null)
    END_TIME=$(date +%s%N)
    
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 )) # Convert to milliseconds
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        if [ $RESPONSE_TIME -lt 1000 ]; then
            echo -e "${GREEN}✓${NC} HTTP $HTTP_CODE (${RESPONSE_TIME}ms) - OK"
        elif [ $RESPONSE_TIME -lt 3000 ]; then
            echo -e "${YELLOW}⚠${NC} HTTP $HTTP_CODE (${RESPONSE_TIME}ms) - SLOW"
        else
            echo -e "${RED}✗${NC} HTTP $HTTP_CODE (${RESPONSE_TIME}ms) - VERY SLOW"
        fi
        return 0
    else
        if [ "$HTTP_CODE" = "000" ]; then
            echo -e "${RED}✗${NC} TIMEOUT (no response after ${timeout}s)"
        else
            echo -e "${RED}✗${NC} HTTP $HTTP_CODE"
        fi
        return 1
    fi
}

# 1. PM2 Restart Count (Indicates Crashes)
echo -e "${BLUE}=== 1. PM2 RESTART COUNT (Crashes) ===${NC}"
pm2 status
echo ""
echo "Restart counts (high = frequent crashes):"
pm2 jlist 2>/dev/null | jq -r '.[] | "\(.name): \(.pm2_env.restart_time) restarts"' || \
pm2 list | awk 'NR>3 {print $4": "$10" restarts"}'
echo ""

# Check for high restart counts
HIGH_RESTARTS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.restart_time > 5) | .name' || echo "")
if [ -n "$HIGH_RESTARTS" ]; then
    echo -e "${RED}⚠️  WARNING: High restart counts detected:${NC}"
    echo "$HIGH_RESTARTS"
    echo "This indicates frequent crashes/restarts"
fi
echo ""

# 2. Response Time Test
echo -e "${BLUE}=== 2. RESPONSE TIME TEST ===${NC}"
echo "Testing health endpoints with different timeouts..."
echo ""

# Test Manufacturing App Production
test_endpoint_timeout "http://localhost:1234/health" "Manufacturing App Production" 5
test_endpoint_timeout "http://localhost:1234/health" "Manufacturing App Production (48s)" 48

echo ""

# Test Manufacturing App Staging
test_endpoint_timeout "http://localhost:5678/health" "Manufacturing App Staging" 5
test_endpoint_timeout "http://localhost:5678/health" "Manufacturing App Staging (48s)" 48

echo ""

# 3. Database Connection Stability
echo -e "${BLUE}=== 3. DATABASE CONNECTION STABILITY ===${NC}"

# Test PostgreSQL connection multiple times
echo "Testing PostgreSQL connection (5 attempts):"
SUCCESS=0
FAILED=0

for i in {1..5}; do
    if PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Attempt $i: OK"
        SUCCESS=$((SUCCESS + 1))
    else
        echo -e "${RED}✗${NC} Attempt $i: FAILED"
        FAILED=$((FAILED + 1))
    fi
    sleep 1
done

echo ""
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠️  Database connection is unstable: $FAILED/$((SUCCESS + FAILED)) failed${NC}"
else
    echo -e "${GREEN}✓${NC} Database connection is stable: $SUCCESS/$((SUCCESS + FAILED)) successful"
fi
echo ""

# 4. Resource Usage Spikes
echo -e "${BLUE}=== 4. RESOURCE USAGE (Check for Spikes) ===${NC}"
echo "Current usage:"
echo "Memory:"
free -h | grep Mem
echo ""
echo "CPU Load:"
uptime
echo ""

# Check if memory is high
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 80 ]; then
    echo -e "${RED}⚠️  Memory usage is HIGH: ${MEM_USAGE}%${NC}"
    echo "This can cause timeouts and crashes"
fi

# Check load average
LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CPU_CORES=$(nproc)
if (( $(echo "$LOAD_AVG > $CPU_CORES" | bc -l 2>/dev/null || echo "0") )); then
    echo -e "${RED}⚠️  Load average is HIGH: $LOAD_AVG (CPU cores: $CPU_CORES)${NC}"
    echo "System is overloaded"
fi
echo ""

# 5. Check Application Logs for Errors
echo -e "${BLUE}=== 5. RECENT ERRORS IN LOGS ===${NC}"
echo "Manufacturing App Production errors (last 20 lines):"
pm2 logs manufacturing-app --lines 20 --err --nostream 2>/dev/null | tail -10 || echo "No errors found"
echo ""

echo "Manufacturing App Staging errors (last 20 lines):"
pm2 logs manufacturing-app-staging --lines 20 --err --nostream 2>/dev/null | tail -10 || echo "No errors found"
echo ""

# 6. Database Query Performance
echo -e "${BLUE}=== 6. DATABASE QUERY PERFORMANCE ===${NC}"
echo "Testing database query speed..."

if command -v psql &> /dev/null; then
    START_TIME=$(date +%s%N)
    PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -U postgres -c "SELECT COUNT(*) FROM pg_stat_activity;" > /dev/null 2>&1
    END_TIME=$(date +%s%N)
    QUERY_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ $QUERY_TIME -lt 100 ]; then
        echo -e "${GREEN}✓${NC} Database query time: ${QUERY_TIME}ms (OK)"
    elif [ $QUERY_TIME -lt 500 ]; then
        echo -e "${YELLOW}⚠${NC} Database query time: ${QUERY_TIME}ms (SLOW)"
    else
        echo -e "${RED}✗${NC} Database query time: ${QUERY_TIME}ms (VERY SLOW)"
        echo "This can cause application timeouts"
    fi
else
    echo -e "${YELLOW}psql not available, skipping database performance test${NC}"
fi
echo ""

# 7. Network/Port Issues
echo -e "${BLUE}=== 7. NETWORK/PORT ISSUES ===${NC}"
echo "Checking if ports are consistently listening:"

for port in 1234 5678; do
    if netstat -tlnp 2>/dev/null | grep -q ":$port " || ss -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} Port $port: LISTENING"
    else
        echo -e "${RED}✗${NC} Port $port: NOT LISTENING (application may have crashed)"
    fi
done
echo ""

# 8. Health Endpoint Response Time Analysis
echo -e "${BLUE}=== 8. HEALTH ENDPOINT RESPONSE TIME (10 Tests) ===${NC}"
echo "Testing Manufacturing App Production (10 attempts):"
PROD_TIMES=()
PROD_FAILS=0

for i in {1..10}; do
    START_TIME=$(date +%s%N)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:1234/health" 2>/dev/null)
    END_TIME=$(date +%s%N)
    RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        PROD_TIMES+=($RESPONSE_TIME)
        echo -e "${GREEN}✓${NC} Attempt $i: ${RESPONSE_TIME}ms"
    else
        PROD_FAILS=$((PROD_FAILS + 1))
        echo -e "${RED}✗${NC} Attempt $i: FAILED (HTTP $HTTP_CODE)"
    fi
    sleep 0.5
done

if [ ${#PROD_TIMES[@]} -gt 0 ]; then
    AVG_TIME=$(echo "${PROD_TIMES[@]}" | awk '{sum=0; for(i=1;i<=NF;i++) sum+=$i; print sum/NF}')
    MAX_TIME=$(echo "${PROD_TIMES[@]}" | awk '{max=$1; for(i=2;i<=NF;i++) if($i>max) max=$i; print max}')
    MIN_TIME=$(echo "${PROD_TIMES[@]}" | awk '{min=$1; for(i=2;i<=NF;i++) if($i<min) min=$i; print min}')
    echo ""
    echo "Statistics:"
    echo "  Average: ${AVG_TIME}ms"
    echo "  Min: ${MIN_TIME}ms"
    echo "  Max: ${MAX_TIME}ms"
    echo "  Failed: $PROD_FAILS/10"
    
    if (( $(echo "$AVG_TIME > 3000" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${RED}⚠️  Average response time is HIGH (>3s)${NC}"
    fi
fi
echo ""

# 9. Summary & Recommendations
echo -e "${CYAN}=========================================="
echo "DIAGNOSIS SUMMARY"
echo "==========================================${NC}"
echo ""

ISSUES_FOUND=0

# Check restart counts
HIGH_RESTARTS_COUNT=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.pm2_env.restart_time > 5) | .name' | wc -l || echo "0")
if [ "$HIGH_RESTARTS_COUNT" -gt 0 ]; then
    echo -e "${RED}✗${NC} High restart counts detected ($HIGH_RESTARTS_COUNT processes)"
    echo "   → Application is crashing frequently"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check response time
if [ ${#PROD_TIMES[@]} -gt 0 ]; then
    if (( $(echo "$AVG_TIME > 3000" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${RED}✗${NC} Slow response times (avg: ${AVG_TIME}ms)"
        echo "   → Health checks may timeout"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
fi

# Check database
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}✗${NC} Database connection instability"
    echo "   → Intermittent database connection failures"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check resources
if [ "$MEM_USAGE" -gt 80 ]; then
    echo -e "${RED}✗${NC} High memory usage (${MEM_USAGE}%)"
    echo "   → Can cause timeouts and crashes"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No obvious issues found"
    echo "   → Intermittent issues may be network-related or external dependencies"
else
    echo ""
    echo -e "${YELLOW}RECOMMENDATIONS:${NC}"
    echo ""
    
    if [ "$HIGH_RESTARTS_COUNT" -gt 0 ]; then
        echo "1. Fix application crashes:"
        echo "   - Check PM2 logs: pm2 logs --lines 100"
        echo "   - Review error patterns"
        echo "   - Fix root cause (database, memory leaks, etc.)"
        echo ""
    fi
    
    if [ ${#PROD_TIMES[@]} -gt 0 ] && (( $(echo "$AVG_TIME > 3000" | bc -l 2>/dev/null || echo "0") )); then
        echo "2. Optimize response time:"
        echo "   - Check database query performance"
        echo "   - Optimize health endpoint"
        echo "   - Increase health check timeout in monitoring tool"
        echo ""
    fi
    
    if [ "$MEM_USAGE" -gt 80 ]; then
        echo "3. Reduce memory usage:"
        echo "   - Restart applications: pm2 restart all"
        echo "   - Check for memory leaks"
        echo "   - Consider increasing server memory"
        echo ""
    fi
    
    if [ $FAILED -gt 0 ]; then
        echo "4. Fix database connection:"
        echo "   - Check PostgreSQL: sudo systemctl status postgresql@16-main"
        echo "   - Review connection pool settings"
        echo "   - Check database logs"
        echo ""
    fi
    
    echo "5. Increase monitoring timeout:"
    echo "   - Current timeout may be too short (48s)"
    echo "   - Consider increasing to 60-90s if response is consistently slow"
    echo "   - Or optimize application to respond faster"
fi

echo ""
