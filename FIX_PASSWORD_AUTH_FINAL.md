# 🔧 Final Fix: Password Authentication Failed

## 🎯 Masalah

Database sudah ada, tapi password authentication masih gagal:
```
psql: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: 
FATAL: password authentication failed for user "admin"
```

## ⚡ Solusi: Force Reset Password

### Step 1: Drop dan Recreate User

```bash
sudo -u postgres psql << 'PSQL'
    -- Drop user (akan drop owned objects juga)
    DROP OWNED BY admin;
    DROP USER IF EXISTS admin;
    
    -- Create fresh user
    CREATE USER admin WITH PASSWORD 'Admin123';
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    
    -- Connect and grant schema
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL
```

### Step 2: Reload PostgreSQL

```bash
sudo systemctl reload postgresql
```

### Step 3: Test Connection

```bash
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Alternatif: Gunakan Unix Socket

Jika TCP/IP masih bermasalah, gunakan Unix socket (tidak perlu password):

### Update .env

```bash
cd ~/deployments/manufacturing-app/server
nano .env
```

Ubah:
```
DB_HOST=
```

Atau:
```
DB_HOST=/var/run/postgresql
```

Kosongkan `DB_HOST` akan membuat PostgreSQL menggunakan Unix socket dengan peer authentication.

### Test Unix Socket

```bash
# Test via postgres user dengan role switch
sudo -u postgres psql -d manufacturing_db << 'SQL'
    SET ROLE admin;
    SELECT current_user, current_database();
SQL
```

## 📋 Script Lengkap

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-admin-password-final.sh ./

# Run fix
sudo bash fix-admin-password-final.sh
```

## 🔍 Troubleshooting

### Jika Drop User Gagal (ada objects)

```bash
# Cek objects owned by admin
sudo -u postgres psql -d manufacturing_db -c "\dt" | grep admin

# Reassign ownership ke postgres dulu
sudo -u postgres psql -d manufacturing_db << 'PSQL'
    REASSIGN OWNED BY admin TO postgres;
    DROP OWNED BY admin;
    DROP USER admin;
    
    CREATE USER admin WITH PASSWORD 'Admin123';
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL
```

### Jika Masih Gagal: Cek PostgreSQL Logs

```bash
# Cek error logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log

# Atau
sudo journalctl -u postgresql -f
```

### Gunakan Peer Authentication (Recommended untuk Localhost)

Update aplikasi untuk menggunakan Unix socket:

**Update `server/config.js`**:
```javascript
database: {
  host: process.env.DB_HOST || '', // Empty = Unix socket
  // ... rest of config
}
```

**Atau update `.env`**:
```
DB_HOST=
```

## ✅ Checklist

- [ ] User `admin` di-drop dan recreate
- [ ] Password di-set: `Admin123`
- [ ] Privileges granted
- [ ] PostgreSQL reloaded
- [ ] Test connection berhasil
- [ ] (Optional) Update ke Unix socket jika TCP/IP masih gagal

## 🎯 Quick Commands

```bash
# Force reset user
sudo -u postgres psql << 'PSQL'
    DROP OWNED BY admin;
    DROP USER IF EXISTS admin;
    CREATE USER admin WITH PASSWORD 'Admin123';
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL

# Reload
sudo systemctl reload postgresql

# Test
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

---

**Last Updated**: 2026-01-08
