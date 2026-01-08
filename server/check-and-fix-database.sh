#!/bin/bash
# Check dan fix PostgreSQL database

set -e

echo "=========================================="
echo "Check and Fix PostgreSQL Database"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Some commands need sudo privileges"
fi

echo "🔍 Step 1: Checking PostgreSQL status..."
sudo systemctl status postgresql --no-pager | head -3 || {
    echo "   ⚠️  PostgreSQL not running, starting..."
    sudo systemctl start postgresql
}
echo ""

echo "🔍 Step 2: Listing all databases..."
sudo -u postgres psql -c "\l" | grep -E "Name|manufacturing" || echo "   (manufacturing_db not found)"
echo ""

echo "🔍 Step 3: Checking users..."
sudo -u postgres psql -c "\du" | grep -E "Role|admin" || echo "   (admin user not found)"
echo ""

echo "🔄 Step 4: Creating database if not exists..."
sudo -u postgres psql << 'PSQL'
    -- Check if database exists
    SELECT 'Database manufacturing_db exists' 
    WHERE EXISTS (SELECT FROM pg_database WHERE datname = 'manufacturing_db')
    \gexec
    
    -- If not exists, create it
    CREATE DATABASE manufacturing_db OWNER admin;
PSQL

# Better approach: check first, then create
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='manufacturing_db'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "   ✅ Database 'manufacturing_db' exists"
else
    echo "   Creating database 'manufacturing_db'..."
    sudo -u postgres psql -c "CREATE DATABASE manufacturing_db OWNER admin;"
    echo "   ✅ Database created"
fi

echo ""
echo "🔄 Step 5: Ensuring user 'admin' exists..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='admin'")

if [ "$USER_EXISTS" = "1" ]; then
    echo "   ✅ User 'admin' exists"
    echo "   Updating password..."
    sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"
else
    echo "   Creating user 'admin'..."
    sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Admin123';"
fi

echo ""
echo "🔄 Step 6: Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL ON SCHEMA public TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;" 2>/dev/null || true
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;" 2>/dev/null || true
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;"
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;"

echo ""
echo "🔄 Step 7: Reloading PostgreSQL..."
sudo systemctl reload postgresql

echo ""
echo "=========================================="
echo "Testing Connections:"
echo "=========================================="
echo ""

echo "Test 1: As postgres user..."
sudo -u postgres psql -d manufacturing_db -c "SELECT current_database(), current_user;" && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
}

echo ""
echo "Test 2: As admin user via TCP/IP..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_database(), current_user;" 2>&1 && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
    echo ""
    echo "Test 3: As admin user via Unix socket..."
    sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT current_database(), current_user;" && {
        echo "   ✅ OK (Unix socket works)"
    } || {
        echo "   ❌ FAILED"
    }
}

echo ""
echo "=========================================="
echo "Database Information:"
echo "=========================================="
echo ""
echo "Databases:"
sudo -u postgres psql -c "\l" | grep -E "Name|manufacturing"
echo ""
echo "Users:"
sudo -u postgres psql -c "\du" | grep -E "Role|admin"
echo ""

echo "=========================================="
echo "✅ Check completed!"
echo "=========================================="
