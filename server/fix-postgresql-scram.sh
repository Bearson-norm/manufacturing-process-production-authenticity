#!/bin/bash
# Fix PostgreSQL untuk scram-sha-256 authentication
# PostgreSQL menggunakan scram-sha-256, bukan md5

set -e

echo "=========================================="
echo "Fix PostgreSQL Password (scram-sha-256)"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Step 1: Setting password for scram-sha-256..."

# Update password (PostgreSQL akan otomatis hash dengan scram-sha-256)
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';" 2>/dev/null || {
    echo "   Creating user 'admin'..."
    sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Admin123';"
}

echo "   ✅ Password set"

echo ""
echo "🔄 Step 2: Ensuring database exists..."

sudo -u postgres psql -c "CREATE DATABASE manufacturing_db OWNER admin;" 2>/dev/null || {
    echo "   Database 'manufacturing_db' already exists"
}

echo ""
echo "🔄 Step 3: Granting privileges..."

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL ON SCHEMA public TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;" 2>/dev/null || true
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;" 2>/dev/null || true
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;"
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;"

echo ""
echo "🔄 Step 4: Reloading PostgreSQL..."

sudo systemctl reload postgresql || {
    echo "   ⚠️  Reload failed, trying restart..."
    sudo systemctl restart postgresql
    sleep 2
}

echo ""
echo "🔄 Step 5: Testing connection..."

# Test 1: Via TCP/IP dengan scram-sha-256
echo "   Test 1: TCP/IP connection (scram-sha-256)..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
    echo "   ✅ TCP/IP connection: OK"
} || {
    echo "   ❌ TCP/IP connection: FAILED"
    echo ""
    echo "   Test 2: Unix socket connection (peer)..."
    # Test 2: Via Unix socket dengan peer auth
    sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT current_user, current_database();" 2>&1 && {
        echo "   ✅ Unix socket connection: OK"
        echo ""
        echo "   💡 Tip: Aplikasi bisa connect via Unix socket tanpa password"
        echo "      Update .env: DB_HOST=/var/run/postgresql (atau kosongkan)"
    } || {
        echo "   ❌ Unix socket connection: FAILED"
    }
}

echo ""
echo "=========================================="
echo "Diagnostic Information:"
echo "=========================================="
echo ""
echo "PostgreSQL authentication method:"
sudo -u postgres psql -c "SHOW password_encryption;"
echo ""
echo "User info:"
sudo -u postgres psql -c "SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename = 'admin';"
echo ""
echo "pg_hba.conf authentication methods:"
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "   Local (Unix socket): $(sudo grep '^local.*all.*all' $PG_HBA_FILE | awk '{print $NF}')"
echo "   Host 127.0.0.1: $(sudo grep '^host.*all.*all.*127.0.0.1' $PG_HBA_FILE | awk '{print $NF}')"
echo ""

echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
echo ""
echo "If TCP/IP connection still fails, you can:"
echo "1. Use Unix socket (peer auth) - no password needed"
echo "2. Or check PostgreSQL logs: sudo tail -f /var/log/postgresql/postgresql-*-main.log"
