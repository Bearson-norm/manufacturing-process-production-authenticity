# 🔧 Fix: PostgreSQL Port Mismatch

## 🎯 Masalah

PostgreSQL berjalan di **port 5433**, bukan 5432!

Dari log:
```
listening on IPv4 address "127.0.0.1", port 5433
```

Tapi aplikasi mencoba connect ke port 5432.

## ⚡ Solusi Cepat

### Option 1: Update .env ke Port 5433 (Recommended)

```bash
cd ~/deployments/manufacturing-app/server
nano .env
```

Ubah atau tambahkan:
```
DB_PORT=5433
```

Lalu test:
```bash
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

### Option 2: Ubah PostgreSQL ke Port 5432

```bash
# Cari config file
POSTGRESQL_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW config_file;' | xargs)
echo "Config: $POSTGRESQL_CONF"

# Backup
sudo cp $POSTGRESQL_CONF ${POSTGRESQL_CONF}.backup

# Update port
sudo sed -i 's/^port.*/port = 5432/' $POSTGRESQL_CONF

# Restart PostgreSQL
sudo systemctl restart postgresql

# Verify
sudo -u postgres psql -tAc "SHOW port;"
```

## 🔄 Complete Fix Script

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-postgresql-port.sh ./

# Run fix
sudo bash fix-postgresql-port.sh
```

## 📋 Quick Fix

### Update .env

```bash
cd ~/deployments/manufacturing-app/server

# Update atau tambahkan DB_PORT
if grep -q "DB_PORT" .env; then
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env
else
    echo "DB_PORT=5433" >> .env
fi

# Verify
cat .env | grep DB_PORT
```

### Test Connection

```bash
# Test dengan port 5433
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

## ✅ Checklist

- [ ] Cek PostgreSQL port: `sudo -u postgres psql -tAc "SHOW port;"`
- [ ] Update .env: `DB_PORT=5433` (atau ubah PostgreSQL ke 5432)
- [ ] Test connection dengan port yang benar
- [ ] Update aplikasi untuk menggunakan port yang benar

## 🎯 Quick Commands

```bash
# Cek port
sudo -u postgres psql -tAc "SHOW port;"

# Update .env
cd ~/deployments/manufacturing-app/server
echo "DB_PORT=5433" >> .env

# Test
PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

---

**Last Updated**: 2026-01-08
