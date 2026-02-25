# ⚡ Quick Fix: Install Dependencies di Running Directory

## 🎯 Masalah

Error: `Cannot find module 'pg'`

Script dijalankan di git repository (`/var/www/manufacturing-process-production-authenticity/server`) yang belum punya `node_modules`.

## ⚡ Solusi Cepat

### Di Running Directory (`~/deployments/manufacturing-app/server`)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Install dependencies
    npm install
    
    # Verify pg installed
    npm list pg
    
    # Test connection
    node test-postgresql-connection.js
ENDSSH
```

## 🔄 Complete Setup (All-in-One)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # 1. Install dependencies
    echo "Installing dependencies..."
    npm install
    
    # 2. Verify pg module
    echo "Verifying pg module..."
    npm list pg || npm install pg
    
    # 3. Setup .env
    echo "Setting up .env..."
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Update DB_PORT to 5433
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    grep -q "^DB_HOST" .env || echo "DB_HOST=localhost" >> .env
    grep -q "^DB_NAME" .env || echo "DB_NAME=manufacturing_db" >> .env
    grep -q "^DB_USER" .env || echo "DB_USER=admin" >> .env
    grep -q "^DB_PASSWORD" .env || echo "DB_PASSWORD=Admin123" >> .env
    
    # 4. Verify .env
    echo ""
    echo "=== .env DB Settings ==="
    grep "^DB_" .env
    
    # 5. Test connection
    echo ""
    echo "Testing PostgreSQL connection..."
    node test-postgresql-connection.js
ENDSSH
```

## 📋 Atau Copy Script ke Running Directory

```bash
# Copy script dari git repo ke running directory
ssh foom@103.31.39.189 << 'ENDSSH'
    # Copy test script
    cp /var/www/manufacturing-process-production-authenticity/server/test-postgresql-connection.js \
       ~/deployments/manufacturing-app/server/ 2>/dev/null || echo "Script not in git repo"
    
    # Copy migration script
    cp /var/www/manufacturing-process-production-authenticity/server/migrate-to-postgresql.js \
       ~/deployments/manufacturing-app/server/ 2>/dev/null || echo "Migration script not in git repo"
    
    # Install dependencies
    cd ~/deployments/manufacturing-app/server
    npm install
    
    # Test
    node test-postgresql-connection.js
ENDSSH
```

## ✅ Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Package `pg` installed (`npm list pg`)
- [ ] .env file configured (DB_PORT=5433)
- [ ] Test connection successful

## 🎯 Quick Command

```bash
cd ~/deployments/manufacturing-app/server && npm install && echo "DB_PORT=5433" >> .env && node test-postgresql-connection.js
```

---

**Last Updated**: 2026-01-08
