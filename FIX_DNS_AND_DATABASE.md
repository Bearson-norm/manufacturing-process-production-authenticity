# 🔧 Fix DNS & Database Issues

**Berdasarkan Diagnosis**: Masalah utama yang menyebabkan intermittent up/down

---

## 🔍 Masalah yang Ditemukan

### 1. **DNS Resolution Failures** 🔴 CRITICAL
- Error: `getaddrinfo EAI_AGAIN foomx.odoo.com`
- Hostname `foomx.odoo.com` tidak bisa di-resolve
- Menyebabkan scheduler errors saat update MO data

### 2. **Database Connection Issues** 🔴 CRITICAL
- PostgreSQL connection test gagal (5/5 failed)
- Meskipun PostgreSQL service running
- Kemungkinan: authentication atau connection string

### 3. **SQLite Readonly Error** 🟡 MEDIUM
- Error: `SQLITE_READONLY: attempt to write a readonly database`
- File permissions issue

### 4. **High Load Average** 🟡 MEDIUM
- Load: 2.79 (CPU cores: 2)
- System overloaded

### 5. **Database Timeout Errors** 🟡 MEDIUM
- "timeout exceeded when trying to connect"
- Banyak error saat insert MO data

---

## 🚀 Quick Fixes

### Fix 1: Test & Fix DNS Resolution

```bash
# Test DNS
nslookup foomx.odoo.com
dig foomx.odoo.com

# If fails, check DNS server
cat /etc/resolv.conf

# If domain is wrong, fix in code
# Or add to /etc/hosts if IP is known
# Example:
# echo "123.45.67.89 foomx.odoo.com" | sudo tee -a /etc/hosts
```

### Fix 2: Fix Database Connection

```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d postgres -c "SELECT 1;"

# If fails, check password
# Check .env file for correct credentials
cat /home/foom/deployments/manufacturing-app/server/.env | grep -E "DB_|DATABASE_|POSTGRES"

# Test with password
PGPASSWORD=your_password psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;"

# Check if database exists
psql -h localhost -U postgres -l | grep manufacturing_db
```

### Fix 3: Fix SQLite Readonly

```bash
# Check permissions
ls -la /home/foom/deployments/manufacturing-app/server/database.sqlite

# Fix ownership
sudo chown foom:foom /home/foom/deployments/manufacturing-app/server/database.sqlite

# Fix permissions
chmod 664 /home/foom/deployments/manufacturing-app/server/database.sqlite

# Fix directory permissions
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app/server/
chmod 755 /home/foom/deployments/manufacturing-app/server/
```

### Fix 4: Reduce Load Average

```bash
# Check what's causing high load
top
htop

# Restart applications (clears memory)
pm2 restart all

# Check if load decreases
uptime
```

---

## 🔧 Code-Level Fixes (Recommended)

### Fix 1: Add DNS Retry Logic

Edit `server/index.js` - add retry logic untuk DNS resolution:

```javascript
// Add at top of file
const dns = require('dns');

// Function to resolve hostname with retry
async function resolveHostname(hostname, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return new Promise((resolve, reject) => {
                dns.lookup(hostname, (err, address) => {
                    if (err) {
                        if (i === retries - 1) reject(err);
                        else setTimeout(() => resolve(resolveHostname(hostname, retries - i - 1, delay * 2)), delay);
                    } else {
                        resolve(address);
                    }
                });
            });
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

// Use in API calls
try {
    const ip = await resolveHostname('foomx.odoo.com');
    // Use IP instead of hostname, or retry with hostname
} catch (error) {
    console.error('DNS resolution failed after retries:', error);
    // Handle error gracefully
}
```

### Fix 2: Add Database Connection Retry

```javascript
// Add connection retry logic
async function connectWithRetry(retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Your database connection code
            return await db.connect();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Connection attempt ${i + 1} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}
```

### Fix 3: Increase Database Timeout

```javascript
// In database connection config
const dbConfig = {
    host: 'localhost',
    port: 5432,
    database: 'manufacturing_db',
    user: 'admin',
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 10000, // Increase from default
    idleTimeoutMillis: 30000,
    max: 20 // Connection pool size
};
```

### Fix 4: Add Error Handling for External API

```javascript
// Wrap external API calls with timeout and retry
async function callExternalAPIWithRetry(url, data, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(data),
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000 // 10 second timeout
            });
            return response;
        } catch (error) {
            if (i === retries - 1) {
                console.error('External API call failed after retries:', error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

---

## 📋 Step-by-Step Fix

### Step 1: Run Fix Script

```bash
chmod +x fix-identified-issues.sh
./fix-identified-issues.sh
```

### Step 2: Verify DNS

```bash
# Test DNS resolution
nslookup foomx.odoo.com

# If fails, check if domain is correct
# Or get IP address and use that instead
```

### Step 3: Verify Database

```bash
# Test connection
psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;"

# If fails, check credentials in .env
cat /home/foom/deployments/manufacturing-app/server/.env | grep DB
```

### Step 4: Fix SQLite Permissions

```bash
# Run fix
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app/server/
chmod 755 /home/foom/deployments/manufacturing-app/server/
chmod 664 /home/foom/deployments/manufacturing-app/server/database.sqlite
```

### Step 5: Restart Applications

```bash
pm2 restart all
pm2 save
```

### Step 6: Monitor

```bash
# Watch logs for errors
pm2 logs --lines 0

# Watch load average
watch -n 5 'uptime && free -h'
```

---

## 🎯 Priority Actions

### Immediate (Do Now):

1. **Fix DNS Resolution**:
   ```bash
   # Test first
   nslookup foomx.odoo.com
   
   # If fails, check if domain is correct
   # Or use IP address in code instead
   ```

2. **Fix Database Connection**:
   ```bash
   # Test connection
   psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;"
   
   # Fix credentials if needed
   ```

3. **Fix SQLite Permissions**:
   ```bash
   sudo chown -R foom:foom /home/foom/deployments/manufacturing-app/server/
   ```

### Short-term (This Week):

1. Add DNS retry logic in code
2. Add database connection retry
3. Increase database timeout
4. Add error handling for external API calls

### Long-term (This Month):

1. Monitor and optimize load average
2. Review and optimize database queries
3. Setup proper connection pooling
4. Add comprehensive error logging

---

## 📊 Verify Fixes

```bash
# 1. Check DNS
nslookup foomx.odoo.com

# 2. Check database
psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;"

# 3. Check SQLite permissions
ls -la /home/foom/deployments/manufacturing-app/server/database.sqlite

# 4. Check load average
uptime

# 5. Check logs (should have fewer errors)
pm2 logs --lines 50 --err --nostream | grep -i "error\|failed" | wc -l
```

---

**Update terakhir**: 2026-01-30
