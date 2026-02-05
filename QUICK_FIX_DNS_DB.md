# ⚡ Quick Fix DNS & Database - Copy Paste

## 🚀 All-in-One Fix

```bash
# Fix SQLite permissions
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app/server/ && chmod 755 /home/foom/deployments/manufacturing-app/server/ && chmod 664 /home/foom/deployments/manufacturing-app/server/database.sqlite

# Test DNS
nslookup foomx.odoo.com

# Test database
psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;" || echo "Database connection failed - check credentials"

# Restart applications
pm2 restart all && pm2 save

# Check results
pm2 logs --lines 20 --err --nostream | tail -10
```

---

## 🔍 Individual Fixes

### Fix DNS Resolution

```bash
# Test DNS
nslookup foomx.odoo.com
dig foomx.odoo.com

# If fails, check DNS server
cat /etc/resolv.conf

# If domain is wrong, you need to fix in code
# Or add to /etc/hosts if you know the IP
```

### Fix Database Connection

```bash
# Test connection
psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;"

# If fails, check .env file
cat /home/foom/deployments/manufacturing-app/server/.env | grep -E "DB_|DATABASE_|POSTGRES"

# Test with password (replace YOUR_PASSWORD)
PGPASSWORD=YOUR_PASSWORD psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;"
```

### Fix SQLite Readonly

```bash
# Check current permissions
ls -la /home/foom/deployments/manufacturing-app/server/database.sqlite

# Fix permissions
sudo chown foom:foom /home/foom/deployments/manufacturing-app/server/database.sqlite
chmod 664 /home/foom/deployments/manufacturing-app/server/database.sqlite

# Fix directory
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app/server/
chmod 755 /home/foom/deployments/manufacturing-app/server/
```

---

## ✅ Verify All Fixes

```bash
echo "=== DNS ===" && nslookup foomx.odoo.com | head -5 && echo "" && echo "=== Database ===" && psql -h localhost -U postgres -d manufacturing_db -c "SELECT 1;" 2>&1 && echo "" && echo "=== SQLite Permissions ===" && ls -la /home/foom/deployments/manufacturing-app/server/database.sqlite && echo "" && echo "=== PM2 Status ===" && pm2 status
```

---

## 🔧 If DNS Still Fails

**Option 1: Use IP Address Instead**

```bash
# Get IP address
nslookup foomx.odoo.com | grep "Address:" | tail -1

# Or use dig
dig +short foomx.odoo.com

# Then update code to use IP instead of hostname
```

**Option 2: Add to /etc/hosts**

```bash
# Get IP (if known)
# Then add:
echo "IP_ADDRESS foomx.odoo.com" | sudo tee -a /etc/hosts
```

**Option 3: Fix DNS Server**

```bash
# Check current DNS
cat /etc/resolv.conf

# Add Google DNS (if needed)
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf
echo "nameserver 8.8.4.4" | sudo tee -a /etc/resolv.conf
```

---

## 🔧 If Database Still Fails

**Check Credentials:**

```bash
# Check .env file
cat /home/foom/deployments/manufacturing-app/server/.env | grep -E "DB_|DATABASE_|POSTGRES"

# Test different users
psql -h localhost -U postgres -d postgres -c "SELECT 1;"
psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"

# Check if database exists
psql -h localhost -U postgres -l | grep manufacturing_db
```

**Create Database if Missing:**

```bash
# Create database
psql -h localhost -U postgres -c "CREATE DATABASE manufacturing_db;"

# Grant permissions
psql -h localhost -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;"
```

---

**Gunakan `fix-identified-issues.sh` untuk auto-fix semua issues!**
