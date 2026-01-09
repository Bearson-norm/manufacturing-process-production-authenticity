# 📦 Setup Dependencies di VPS

## 🎯 Masalah

Error: `Cannot find module 'pg'`

Module `pg` belum terinstall di running directory.

## ⚡ Solusi Cepat

### Di Running Directory (`~/deployments/manufacturing-app/server`)

```bash
cd ~/deployments/manufacturing-app/server

# Install dependencies
npm install

# Verify pg installed
npm list pg

# Test connection
node test-postgresql-connection.js
```

## 🔄 Complete Setup Script

### Copy Script ke VPS

```bash
# Dari komputer lokal
scp server/setup-and-test-vps.sh foom@103.31.39.189:~/deployments/manufacturing-app/server/

# Atau copy dari git repo ke running directory
ssh foom@103.31.39.189 << 'ENDSSH'
    cp /var/www/manufacturing-process-production-authenticity/server/setup-and-test-vps.sh \
       ~/deployments/manufacturing-app/server/
ENDSSH
```

### Run Script

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    bash setup-and-test-vps.sh
ENDSSH
```

## 📋 Manual Setup Steps

### Step 1: Install Dependencies

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Install dependencies
    npm install
    
    # Verify pg installed
    npm list pg
ENDSSH
```

### Step 2: Setup .env File

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Create .env if not exists
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Update DB_PORT to 5433
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    
    # Ensure other settings
    grep -q "^DB_HOST" .env || echo "DB_HOST=localhost" >> .env
    grep -q "^DB_NAME" .env || echo "DB_NAME=manufacturing_db" >> .env
    grep -q "^DB_USER" .env || echo "DB_USER=admin" >> .env
    grep -q "^DB_PASSWORD" .env || echo "DB_PASSWORD=Admin123" >> .env
    
    # Verify
    echo "=== .env DB Settings ==="
    grep "^DB_" .env
ENDSSH
```

### Step 3: Test Connection

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Test with Node.js script
    node test-postgresql-connection.js
    
    # Or test with psql
    # PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
ENDSSH
```

## 🔍 Troubleshooting

### Error: "Cannot find module 'pg'"

```bash
cd ~/deployments/manufacturing-app/server

# Install pg specifically
npm install pg

# Or install all dependencies
npm install
```

### Error: "npm: command not found"

```bash
# Install Node.js and npm if not exists
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### Error: "Permission denied"

```bash
# Fix npm permissions
sudo chown -R $USER:$USER ~/deployments/manufacturing-app
```

## ✅ Checklist

- [ ] npm installed (`npm --version`)
- [ ] Dependencies installed (`npm install`)
- [ ] Package `pg` installed (`npm list pg`)
- [ ] .env file configured (DB_PORT=5433)
- [ ] Test connection successful

## 🎯 Quick All-in-One Command

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Install dependencies
    npm install
    
    # Setup .env
    [ ! -f .env ] && cp env.example .env
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    grep -q "^DB_HOST" .env || echo "DB_HOST=localhost" >> .env
    grep -q "^DB_NAME" .env || echo "DB_NAME=manufacturing_db" >> .env
    grep -q "^DB_USER" .env || echo "DB_USER=admin" >> .env
    grep -q "^DB_PASSWORD" .env || echo "DB_PASSWORD=Admin123" >> .env
    
    # Test connection
    node test-postgresql-connection.js
ENDSSH
```

---

**Last Updated**: 2026-01-08
