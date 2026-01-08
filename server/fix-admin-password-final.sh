#!/bin/bash
# Final fix untuk admin password authentication
# Database sudah ada, tinggal fix password authentication

set -e

echo "=========================================="
echo "Fix Admin Password Authentication"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Step 1: Verifying database exists..."
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='manufacturing_db'")
if [ "$DB_EXISTS" = "1" ]; then
    echo "   ✅ Database 'manufacturing_db' exists"
else
    echo "   ❌ Database 'manufacturing_db' does not exist"
    exit 1
fi

echo ""
echo "🔄 Step 2: Checking user 'admin'..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='admin'")
if [ "$USER_EXISTS" = "1" ]; then
    echo "   ✅ User 'admin' exists"
else
    echo "   Creating user 'admin'..."
    sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Admin123';"
fi

echo ""
echo "🔄 Step 3: Resetting password (force update)..."
# Force password update - drop and recreate if needed
sudo -u postgres psql << 'PSQL'
    -- Drop user if exists (will recreate)
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

echo ""
echo "🔄 Step 4: Verifying password encryption..."
PASSWORD_ENCRYPTION=$(sudo -u postgres psql -tAc "SHOW password_encryption;")
echo "   Password encryption method: $PASSWORD_ENCRYPTION"

echo ""
echo "🔄 Step 5: Reloading PostgreSQL..."
sudo systemctl reload postgresql
sleep 1

echo ""
echo "🔄 Step 6: Testing connections..."
echo ""

echo "   Test 1: As postgres user (should work)..."
sudo -u postgres psql -d manufacturing_db -c "SELECT current_user, current_database();" > /dev/null 2>&1 && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
}

echo ""
echo "   Test 2: As admin via TCP/IP with password..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 | head -3 && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
    echo ""
    echo "   Test 3: As admin via Unix socket (peer auth)..."
    sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT current_user, current_database();" > /dev/null 2>&1 && {
        echo "   ✅ OK (Unix socket works)"
        echo ""
        echo "   💡 Solution: Use Unix socket instead of TCP/IP"
        echo "   Update .env: DB_HOST= (empty) or DB_HOST=/var/run/postgresql"
    } || {
        echo "   ❌ FAILED"
    }
}

echo ""
echo "=========================================="
echo "Diagnostic Information:"
echo "=========================================="
echo ""
echo "User info:"
sudo -u postgres psql -c "SELECT usename, usecreatedb, usesuper, passwd IS NOT NULL as has_password FROM pg_user WHERE usename = 'admin';"
echo ""
echo "Database owner:"
sudo -u postgres psql -c "SELECT datname, datdba::regrole as owner FROM pg_database WHERE datname = 'manufacturing_db';"
echo ""
echo "pg_hba.conf authentication:"
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "   Local: $(sudo grep '^local.*all.*all' $PG_HBA_FILE | awk '{print $NF}' || echo 'not found')"
echo "   Host 127.0.0.1: $(sudo grep '^host.*all.*all.*127.0.0.1' $PG_HBA_FILE | awk '{print $NF}' || echo 'not found')"
echo ""

echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
echo ""
echo "If TCP/IP still fails, use Unix socket:"
echo "  Update .env: DB_HOST="
echo "  Or: DB_HOST=/var/run/postgresql"
