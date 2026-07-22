# 🔧 Solusi: Password Authentication Failed

## 🎯 Masalah

Error: `password authentication failed for user "admin"`

**Penyebab**: User `admin` sudah ada di PostgreSQL, tapi passwordnya tidak sesuai dengan yang di `.env`.

---

## ⚡ Solusi Cepat

### Di VPS, jalankan:

```bash
cd ~/deployments/manufacturing-app/server
sudo bash fix-postgresql-password.sh
```

Script ini akan:
- ✅ Reset password user `admin` menjadi `YOUR_DB_PASSWORD`
- ✅ Pastikan database `manufacturing_db` ada
- ✅ Grant semua privileges
- ✅ Test connection

---

## 📋 Langkah-Langkah Manual

### 1. Fix Password PostgreSQL

```bash
sudo -u postgres psql << 'PSQL'
    ALTER USER admin WITH PASSWORD 'YOUR_DB_PASSWORD';
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
PSQL
```

### 2. Verifikasi .env File

```bash
cd ~/deployments/manufacturing-app/server
cat .env | grep DB_
```

Pastikan ada:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=YOUR_DB_PASSWORD
```

Jika tidak ada, tambahkan:
```bash
echo "DB_HOST=localhost" >> .env
echo "DB_PORT=5432" >> .env
echo "DB_NAME=manufacturing_db" >> .env
echo "DB_USER=admin" >> .env
echo "DB_PASSWORD=YOUR_DB_PASSWORD" >> .env
```

### 3. Test Connection

```bash
cd ~/deployments/manufacturing-app/server
node test-postgresql-connection.js
```

Atau manual:
```bash
PGPASSWORD=YOUR_DB_PASSWORD psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

### 4. Run Migration

```bash
cd ~/deployments/manufacturing-app/server
node migrate-to-postgresql.js
```

---

## 🔍 Troubleshooting

### Jika Script Tidak Ada

Script `fix-postgresql-password.sh` ada di git repository. Copy ke running directory:

```bash
# Copy dari git repo ke running directory
cp /var/www/manufacturing-process-production-authenticity/server/fix-postgresql-password.sh \
   ~/deployments/manufacturing-app/server/

# Atau copy semua script
rsync -av /var/www/manufacturing-process-production-authenticity/server/*.sh \
          ~/deployments/manufacturing-app/server/
```

### Jika User Tidak Ada

```bash
sudo -u postgres psql << 'PSQL'
    CREATE USER admin WITH PASSWORD 'YOUR_DB_PASSWORD';
    CREATE DATABASE manufacturing_db OWNER admin;
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

### Jika Database Tidak Ada

```bash
sudo -u postgres psql << 'PSQL'
    CREATE DATABASE manufacturing_db OWNER admin;
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

---

## 📁 File yang Dibuat

1. **`server/fix-postgresql-password.sh`** - Script untuk fix password
2. **`server/setup-postgresql-user.sh`** - Script untuk setup user dan database
3. **`server/test-postgresql-connection.js`** - Script untuk test connection
4. **`FIX_POSTGRESQL_PASSWORD.md`** - Dokumentasi lengkap

---

## ✅ Checklist

- [ ] PostgreSQL running (`sudo systemctl status postgresql`)
- [ ] User `admin` exists dan password = `YOUR_DB_PASSWORD`
- [ ] Database `manufacturing_db` exists
- [ ] .env file sudah benar
- [ ] Connection test berhasil
- [ ] Migration berhasil

---

## 🚀 Quick Commands

```bash
# Fix password
cd ~/deployments/manufacturing-app/server
sudo bash fix-postgresql-password.sh

# Test connection
node test-postgresql-connection.js

# Run migration
node migrate-to-postgresql.js
```

---

**Last Updated**: 2026-01-08
