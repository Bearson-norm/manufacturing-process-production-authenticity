# 🔧 Fix High CPU Usage (100% CPU pada Satu Instance)

**Issue**: `manufacturing-app` instance ID 9 menggunakan 100% CPU, sementara instance ID 10 normal (0%)

---

## 🔍 Diagnosis

### Quick Check

```bash
# Check CPU usage per instance
pm2 status

# Get detailed info
pm2 describe 9

# Check system process
ps aux | grep "manufacturing-app" | grep -v grep
```

### Full Diagnosis

```bash
# Upload diagnose-high-cpu.sh
chmod +x diagnose-high-cpu.sh
./diagnose-high-cpu.sh 9
```

---

## 🚀 Quick Fixes

### Fix 1: Restart Specific Instance (Recommended)

```bash
# Restart hanya instance yang bermasalah (ID 9)
pm2 restart 9

# Monitor CPU usage
watch -n 2 'pm2 status | grep manufacturing-app'
```

**Expected**: CPU usage turun ke normal (<10%)

### Fix 2: Restart All manufacturing-app Instances

```bash
# Restart semua instance manufacturing-app
pm2 restart manufacturing-app

# Save state
pm2 save
```

### Fix 3: Stop and Investigate

```bash
# Stop instance yang bermasalah
pm2 stop 9

# Check impact
uptime
free -h

# Investigate logs
pm2 logs manufacturing-app --lines 200

# Restart setelah fix
pm2 start 9
```

---

## 🔍 Investigate Root Cause

### Check 1: Recent Logs

```bash
# Check for patterns
pm2 logs manufacturing-app --lines 200 | grep -E "loop|while|for|setInterval|processing" -i

# Check for errors
pm2 logs manufacturing-app --lines 200 --err

# Check for stuck operations
pm2 logs manufacturing-app --lines 200 | grep -E "timeout|stuck|hang" -i
```

### Check 2: Code Patterns

Kemungkinan penyebab di code:

1. **Infinite Loop**
   ```javascript
   // BAD - No break condition
   while (true) {
       // do something
   }
   ```

2. **Heavy Database Query in Loop**
   ```javascript
   // BAD - Query in loop
   for (let item of items) {
       await db.query('SELECT * FROM ...'); // Heavy query
   }
   ```

3. **Recursive Function Without Base Case**
   ```javascript
   // BAD - No base case
   function process() {
       process(); // Infinite recursion
   }
   ```

4. **External API Call in Retry Loop**
   ```javascript
   // BAD - Infinite retry
   while (true) {
       try {
           await callAPI();
           break;
       } catch (error) {
           // No break, keeps retrying
       }
   }
   ```

### Check 3: Database Queries

```bash
# Check if database query is stuck
psql -h localhost -U postgres -d manufacturing_db -c "SELECT pid, state, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"
```

### Check 4: Network Connections

```bash
# Check for stuck connections
netstat -anp | grep <PID> | grep ESTABLISHED

# Check for connection leaks
lsof -p <PID> | grep -i tcp
```

---

## 🛠️ Solutions Based on Root Cause

### Solution 1: Fix Infinite Loop

**If found in logs/code:**

```javascript
// Add break condition or timeout
let timeout = Date.now() + 60000; // 1 minute timeout
while (condition && Date.now() < timeout) {
    // do something
    if (shouldBreak) break;
}
```

### Solution 2: Optimize Database Queries

**If database query is the issue:**

```javascript
// Use batch queries instead of loop
// BAD:
for (let item of items) {
    await db.query('SELECT ...', [item.id]);
}

// GOOD:
await db.query('SELECT ... WHERE id IN (?)', [items.map(i => i.id)]);
```

### Solution 3: Add CPU Usage Limits

**Prevent future issues:**

```javascript
// Add CPU usage monitoring
setInterval(() => {
    const usage = process.cpuUsage();
    if (usage.user > 1000000) { // High CPU
        console.warn('High CPU usage detected');
        // Take action: pause heavy operations, etc.
    }
}, 5000);
```

### Solution 4: Add Timeout to Operations

```javascript
// Add timeout to heavy operations
async function heavyOperation() {
    return Promise.race([
        doHeavyWork(),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 30000)
        )
    ]);
}
```

---

## 📋 Step-by-Step Fix

### Step 1: Immediate Fix

```bash
# Restart problematic instance
pm2 restart 9

# Monitor
watch -n 2 'pm2 status | grep manufacturing-app'
```

### Step 2: Verify Fix

```bash
# Check CPU usage (should be <10%)
pm2 status

# Check if issue recurs
# Monitor for 5-10 minutes
```

### Step 3: If Issue Persists

```bash
# Stop instance
pm2 stop 9

# Check logs
pm2 logs manufacturing-app --lines 500

# Look for patterns:
# - Infinite loops
# - Heavy database queries
# - Stuck API calls
# - Recursive functions
```

### Step 4: Fix Root Cause

Berdasarkan findings dari logs:
- Fix infinite loop
- Optimize database queries
- Add timeouts
- Fix recursive functions

### Step 5: Restart and Monitor

```bash
# Restart after fix
pm2 start 9

# Monitor for 30 minutes
watch -n 10 'pm2 status && uptime'
```

---

## 🎯 Prevention

### 1. Add CPU Monitoring

```javascript
// In server/index.js
setInterval(() => {
    const cpuUsage = process.cpuUsage();
    if (cpuUsage.user > 5000000) { // 5 seconds CPU time
        console.error('⚠️ High CPU usage detected:', cpuUsage);
        // Log or alert
    }
}, 10000); // Check every 10 seconds
```

### 2. Add Process Limits

```javascript
// Limit CPU-intensive operations
const MAX_OPERATIONS = 100;
let operationCount = 0;

function heavyOperation() {
    if (operationCount >= MAX_OPERATIONS) {
        console.warn('Too many operations, pausing...');
        return;
    }
    operationCount++;
    // do work
    setTimeout(() => operationCount--, 1000);
}
```

### 3. Add Timeouts to All Operations

```javascript
// Wrap all heavy operations with timeout
function withTimeout(promise, timeoutMs) {
    return Promise.race([
        promise,
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        )
    ]);
}
```

### 4. Monitor PM2 CPU Usage

```bash
# Add to cron job
*/5 * * * * pm2 status | grep -E "manufacturing-app.*[0-9]{2,}%" && echo "High CPU detected" | mail -s "CPU Alert" admin@example.com
```

---

## 📊 Monitoring Commands

```bash
# Watch CPU usage
watch -n 2 'pm2 status | grep manufacturing-app'

# Check specific process
pm2 describe 9

# Monitor system resources
htop

# Check for stuck processes
ps aux --sort=-%cpu | head -10
```

---

## 🆘 Emergency: If Restart Doesn't Help

```bash
# 1. Stop problematic instance
pm2 stop 9

# 2. Check if system improves
uptime
free -h

# 3. Investigate logs
pm2 logs manufacturing-app --lines 500 > /tmp/high-cpu-logs.txt

# 4. Check code for issues
# Review recent changes
# Look for infinite loops
# Check database queries

# 5. Fix code and redeploy
# After fix, restart
pm2 start 9
```

---

## 💡 Common Causes & Fixes

| Cause | Symptom | Fix |
|-------|---------|-----|
| Infinite loop | CPU 100%, no logs | Add break condition |
| Heavy DB query | CPU spikes during query | Optimize query, add index |
| Stuck API call | CPU high, timeout errors | Add timeout, retry logic |
| Recursive function | CPU 100%, stack errors | Add base case |
| File I/O loop | CPU high, disk I/O high | Add delay, batch operations |

---

**Update terakhir**: 2026-01-30
