# 🔧 Fix: Database "manufacturing_db" Does Not Exist

## 🎯 Masalah

Error: `FATAL: database "manufacturing_db" does not exist`

## ⚡ Solusi Cepat

### Step 1: Create Database

```bash
sudo -u postgres psql << 'PSQL'
    CREATE DATABASE manufacturing_db OWNER admin;
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
PSQL
```

### Step 2: Verify Database Exists

```bash
# List all databases
sudo -u postgres psql -c "\l" | grep manufacturing

# Or check directly
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='manufacturing_db'"
```

### Step 3: Test Connection

```bash
# As postgres user
sudo -u postgres psql -d manufacturing_db -c "SELECT current_database();"

# As admin user
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_database();"
```

## 🔄 Complete Fix Script

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/check-and-fix-database.sh ./

# Run check and fix
sudo bash check-and-fix-database.sh
```

## 📋 Manual Steps

### 1. Ensure User Exists

```bash
# Check if user exists
sudo -u postgres psql -c "\du" | grep admin

# If not exists, create
sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Admin123';"
```

### 2. Create Database

```bash
# Create database
sudo -u postgres psql -c "CREATE DATABASE manufacturing_db OWNER admin;"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;"
```

### 3. Setup Schema Privileges

```bash
# Connect to database and grant schema privileges
sudo -u postgres psql -d manufacturing_db << 'PSQL'
    GRANT ALL ON SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL
```

### 4. Reload PostgreSQL

```bash
sudo systemctl reload postgresql
```

### 5. Test

```bash
# Test as postgres
sudo -u postgres psql -d manufacturing_db -c "SELECT 1;"

# Test as admin
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔍 Troubleshooting

### Error: "role admin does not exist"

```bash
sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Admin123';"
```

### Error: "permission denied"

```bash
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL ON SCHEMA public TO admin;"
```

### Error: "database does not exist" setelah create

```bash
# Reload PostgreSQL
sudo systemctl reload postgresql

# Verify database exists
sudo -u postgres psql -c "\l" | grep manufacturing_db
```

## ✅ Checklist

- [ ] User `admin` exists
- [ ] Database `manufacturing_db` exists
- [ ] Database owner = `admin`
- [ ] Privileges granted
- [ ] PostgreSQL reloaded
- [ ] Connection test successful

## 🎯 Quick Commands

```bash
# Create everything
sudo -u postgres psql << 'PSQL'
    CREATE USER admin WITH PASSWORD 'Admin123';
    CREATE DATABASE manufacturing_db OWNER admin;
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
