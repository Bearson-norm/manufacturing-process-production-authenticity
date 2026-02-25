# 🔧 Fix PostgreSQL Password Authentication Error

Jika Anda mendapatkan error: `password authentication failed for user "admin"`, ikuti langkah-langkah berikut.

---

## ⚡ Quick Fix

### Di VPS, jalankan:

```bash
cd ~/deployments/manufacturing-app/server
sudo bash fix-postgresql-password.sh
```

Script ini akan:
- ✅ Reset password untuk user `admin` menjadi `Admin123`
- ✅ Pastikan database `manufacturing_db` ada
- ✅ Grant semua privileges
- ✅ Test connection

---

## 🔍 Troubleshooting Step-by-Step

### 1. Cek Status PostgreSQL

```bash
sudo systemctl status postgresql
```

Jika tidak running:
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Cek User PostgreSQL

```bash
sudo -u postgres psql -c "\du"
```

Pastikan user `admin` ada.

### 3. Fix Password

**Opsi A: Menggunakan Script (Recommended)**

```bash
cd ~/deployments/manufacturing-app/server
sudo bash fix-postgresql-password.sh
```

**Opsi B: Manual**

```bash
sudo -u postgres psql << 'PSQL'
    ALTER USER admin WITH PASSWORD 'Admin123';
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

### 4. Test Connection

```bash
# Test dengan psql
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"

# Atau menggunakan script test
cd ~/deployments/manufacturing-app/server
node test-postgresql-connection.js
```

### 5. Verifikasi .env File

```bash
cd ~/deployments/manufacturing-app/server
cat .env | grep DB_
```

Pastikan:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=Admin123
```

Jika tidak ada atau salah, update:
```bash
# Edit .env
nano .env

# Atau set langsung
echo "DB_HOST=localhost" >> .env
echo "DB_PORT=5432" >> .env
echo "DB_NAME=manufacturing_db" >> .env
echo "DB_USER=admin" >> .env
echo "DB_PASSWORD=Admin123" >> .env
```

### 6. Run Migration Lagi

```bash
cd ~/deployments/manufacturing-app/server
node migrate-to-postgresql.js
```

---

## 🔄 Jika User/Database Sudah Ada

Jika user dan database sudah ada tapi password salah:

```bash
sudo -u postgres psql << 'PSQL'
    ALTER USER admin WITH PASSWORD 'Admin123';
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
PSQL
```

---

## 🆘 Jika Masih Error

### Error: "role admin does not exist"

```bash
sudo -u postgres psql << 'PSQL'
    CREATE USER admin WITH PASSWORD 'Admin123';
    CREATE DATABASE manufacturing_db OWNER admin;
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

### Error: "database manufacturing_db does not exist"

```bash
sudo -u postgres psql << 'PSQL'
    CREATE DATABASE manufacturing_db OWNER admin;
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

### Error: "permission denied"

```bash
sudo -u postgres psql -d manufacturing_db << 'PSQL'
    GRANT ALL ON SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL
```

---

## 📋 Checklist

- [ ] PostgreSQL running (`sudo systemctl status postgresql`)
- [ ] User `admin` exists (`sudo -u postgres psql -c "\du"`)
- [ ] Database `manufacturing_db` exists (`sudo -u postgres psql -c "\l"`)
- [ ] Password sudah di-reset (`ALTER USER admin WITH PASSWORD 'Admin123'`)
- [ ] .env file sudah benar (`cat .env | grep DB_`)
- [ ] Connection test berhasil (`node test-postgresql-connection.js`)
- [ ] Migration berhasil (`node migrate-to-postgresql.js`)

---

## 🎯 Quick Command Reference

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
