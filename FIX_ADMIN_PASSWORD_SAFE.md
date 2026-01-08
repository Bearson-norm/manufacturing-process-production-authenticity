# 🔧 Safe Fix: Admin Password (Reassign Ownership)

## 🎯 Masalah

Error saat drop user:
```
ERROR: role "admin" cannot be dropped because some objects depend on it
DETAIL: owner of database manufacturing_db
3 objects in database manufacturing_db
```

## ⚡ Solusi: Reassign Ownership Dulu

### Step 1: Reassign Ownership

```bash
sudo -u postgres psql -d manufacturing_db << 'PSQL'
    -- Reassign all objects owned by admin to postgres
    REASSIGN OWNED BY admin TO postgres;
    
    -- Drop owned objects
    DROP OWNED BY admin;
PSQL
```

### Step 2: Change Database Owner

```bash
sudo -u postgres psql << 'PSQL'
    -- Change database owner to postgres
    ALTER DATABASE manufacturing_db OWNER TO postgres;
PSQL
```

### Step 3: Drop dan Recreate User

```bash
sudo -u postgres psql << 'PSQL'
    -- Now we can drop the user
    DROP USER IF EXISTS admin;
    
    -- Create fresh user
    CREATE USER admin WITH PASSWORD 'Admin123';
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    
    -- Change owner back to admin
    ALTER DATABASE manufacturing_db OWNER TO admin;
    
    -- Connect and grant schema privileges
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL
```

### Step 4: Reload PostgreSQL

```bash
sudo systemctl reload postgresql
```

### Step 5: Test Connection

```bash
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Complete Script

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-admin-password-safe.sh ./

# Run fix
sudo bash fix-admin-password-safe.sh
```

## 📋 All-in-One Command

```bash
sudo -u postgres psql << 'PSQL'
    -- Reassign ownership
    \c manufacturing_db
    REASSIGN OWNED BY admin TO postgres;
    DROP OWNED BY admin;
    
    -- Change database owner
    \c postgres
    ALTER DATABASE manufacturing_db OWNER TO postgres;
    
    -- Drop user
    DROP USER IF EXISTS admin;
    
    -- Create fresh user
    CREATE USER admin WITH PASSWORD 'Admin123';
    
    -- Grant privileges and change owner back
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    ALTER DATABASE manufacturing_db OWNER TO admin;
    
    -- Grant schema privileges
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL

# Reload
sudo systemctl reload postgresql

# Test
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Alternatif: Hanya Update Password (Tanpa Drop)

Jika tidak ingin drop user, bisa langsung update password:

```bash
sudo -u postgres psql << 'PSQL'
    -- Update password
    ALTER USER admin WITH PASSWORD 'Admin123';
    
    -- Ensure privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
PSQL

# Reload
sudo systemctl reload postgresql

# Test
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Alternatif: Gunakan Unix Socket

Jika password authentication masih bermasalah, gunakan Unix socket:

### Update .env

```bash
cd ~/deployments/manufacturing-app/server
nano .env
```

Ubah:
```
DB_HOST=
```

Kosongkan `DB_HOST` akan menggunakan Unix socket dengan peer authentication.

## ✅ Checklist

- [ ] Objects reassigned to postgres
- [ ] Database owner changed to postgres
- [ ] User admin dropped
- [ ] User admin recreated
- [ ] Database owner changed back to admin
- [ ] Privileges granted
- [ ] PostgreSQL reloaded
- [ ] Test connection successful

---

**Last Updated**: 2026-01-08
