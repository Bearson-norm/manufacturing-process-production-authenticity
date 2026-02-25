# 🔧 Fix: PostgreSQL Tidak Start Setelah Restart

## 🎯 Masalah

PostgreSQL tidak bisa start setelah perubahan port:
```
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: 
No such file or directory
```

## ⚡ Solusi

### Step 1: Cek Status PostgreSQL

```bash
sudo systemctl status postgresql
```

### Step 2: Cek Error Logs

```bash
# Cek systemd logs
sudo journalctl -u postgresql -n 50

# Atau cek PostgreSQL logs
sudo tail -50 /var/log/postgresql/postgresql-*-main.log
```

### Step 3: Revert Port Change (Jika Perlu)

Kembalikan ke port 5433 yang sudah berjalan:

```bash
# Edit config
sudo nano /etc/postgresql/16/main/postgresql.conf

# Atau langsung
sudo sed -i 's/^port.*/port = 5433/' /etc/postgresql/16/main/postgresql.conf

# Restart
sudo systemctl restart postgresql
```

### Step 4: Atau Gunakan Port 5433 (Recommended)

Lebih mudah menggunakan port yang sudah berjalan:

```bash
cd ~/deployments/manufacturing-app/server

# Update .env
if grep -q "DB_PORT" .env; then
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env
else
    echo "DB_PORT=5433" >> .env
fi

# Test connection
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Complete Fix Script

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-postgresql-restart.sh ./

# Run fix
sudo bash fix-postgresql-restart.sh
```

## 📋 Quick Recovery

### Option 1: Revert ke Port 5433 (Easiest)

```bash
# Revert config
sudo sed -i 's/^port.*/port = 5433/' /etc/postgresql/16/main/postgresql.conf

# Restart
sudo systemctl restart postgresql

# Update .env
cd ~/deployments/manufacturing-app/server
echo "DB_PORT=5433" > .env.tmp
grep -v "^DB_PORT" .env >> .env.tmp || true
echo "DB_PORT=5433" >> .env.tmp
mv .env.tmp .env

# Test
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

### Option 2: Fix Port 5432

Jika ingin tetap menggunakan 5432:

```bash
# Check error
sudo journalctl -u postgresql -n 50

# Fix config (pastikan tidak ada konflik)
sudo nano /etc/postgresql/16/main/postgresql.conf

# Pastikan hanya ada satu line:
# port = 5432

# Remove backup file yang mungkin konflik
sudo rm -f /etc/postgresql/16/main/postgresql.conf.backup*

# Restart
sudo systemctl restart postgresql
```

## 🔍 Troubleshooting

### Error: "port already in use"

```bash
# Cek apakah ada PostgreSQL lain yang jalan
sudo netstat -tulpn | grep 5432

# Atau
sudo lsof -i :5432
```

### Error: "permission denied"

```bash
# Fix ownership
sudo chown -R postgres:postgres /var/lib/postgresql
sudo chown -R postgres:postgres /var/run/postgresql
```

### Error: "configuration file error"

```bash
# Test config
sudo -u postgres /usr/lib/postgresql/16/bin/postgres --check-config -D /var/lib/postgresql/16/main
```

## ✅ Recommended Solution

**Gunakan port 5433** yang sudah berjalan:

```bash
# 1. Revert config ke 5433
sudo sed -i 's/^port.*/port = 5433/' /etc/postgresql/16/main/postgresql.conf
sudo systemctl restart postgresql

# 2. Update .env
cd ~/deployments/manufacturing-app/server
sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env

# 3. Test
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

---

**Last Updated**: 2026-01-08
