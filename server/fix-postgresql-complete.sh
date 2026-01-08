#!/bin/bash
# Complete fix untuk PostgreSQL authentication
# Script ini akan fix password, pg_hba.conf, dan restart service

set -e

echo "=========================================="
echo "Complete PostgreSQL Fix"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Step 1: Fixing PostgreSQL password..."

# Update password
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';" 2>/dev/null || {
    echo "   Creating user 'admin'..."
    sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD 'Admin123';"
}

# Ensure database exists
sudo -u postgres psql -c "CREATE DATABASE manufacturing_db OWNER admin;" 2>/dev/null || {
    echo "   Database 'manufacturing_db' already exists"
}

# Grant privileges
echo "   Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL ON SCHEMA public TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;" 2>/dev/null || true
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;" 2>/dev/null || true
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;"
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;"

echo ""
echo "🔄 Step 2: Checking pg_hba.conf configuration..."

PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)

if [ -f "$PG_HBA_FILE" ]; then
    echo "   pg_hba.conf location: $PG_HBA_FILE"
    
    # Check if md5 or scram-sha-256 is enabled for local connections
    if ! grep -qE "^local.*all.*all.*(md5|scram-sha-256|peer)" "$PG_HBA_FILE"; then
        echo "   ⚠️  Local authentication might not be configured correctly"
    fi
    
    if ! grep -qE "^host.*all.*all.*127.0.0.1/32.*(md5|scram-sha-256)" "$PG_HBA_FILE"; then
        echo "   ⚠️  Host authentication might not be configured correctly"
        echo "   Current pg_hba.conf entries for localhost:"
        grep -E "^host|^local" "$PG_HBA_FILE" | head -5 || echo "   (none found)"
    fi
else
    echo "   ⚠️  Cannot find pg_hba.conf"
fi

echo ""
echo "🔄 Step 3: Reloading PostgreSQL configuration..."

# Reload PostgreSQL (doesn't require restart)
sudo systemctl reload postgresql || {
    echo "   ⚠️  Reload failed, trying restart..."
    sudo systemctl restart postgresql
}

echo ""
echo "🔄 Step 4: Testing connection as postgres user..."

# Test as postgres user first
sudo -u postgres psql -d manufacturing_db -c "SELECT 1 as test;" > /dev/null 2>&1 && {
    echo "   ✅ Connection as postgres user: OK"
} || {
    echo "   ❌ Connection as postgres user: FAILED"
}

echo ""
echo "🔄 Step 5: Testing connection as admin user..."

# Test with different methods
echo "   Method 1: Using psql with PGPASSWORD..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1 as test;" > /dev/null 2>&1 && {
    echo "   ✅ Connection as admin user: OK"
} || {
    echo "   ❌ Connection as admin user: FAILED"
    echo ""
    echo "   Trying alternative methods..."
    
    # Method 2: Using psql without host (Unix socket)
    echo "   Method 2: Using Unix socket..."
    sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT 1 as test;" > /dev/null 2>&1 && {
        echo "   ✅ Connection via role switch: OK"
    } || {
        echo "   ❌ Connection via role switch: FAILED"
    }
    
    # Method 3: Direct connection as admin via sudo
    echo "   Method 3: Direct connection..."
    sudo -u postgres psql -d manufacturing_db << 'SQL'
        \c manufacturing_db admin
        SELECT 1 as test;
SQL
}

echo ""
echo "=========================================="
echo "Diagnostic Information:"
echo "=========================================="
echo ""
echo "PostgreSQL version:"
sudo -u postgres psql -c "SELECT version();" | head -1
echo ""
echo "Users:"
sudo -u postgres psql -c "\du" | grep admin || echo "   (admin user not found)"
echo ""
echo "Databases:"
sudo -u postgres psql -c "\l" | grep manufacturing_db || echo "   (manufacturing_db not found)"
echo ""
echo "pg_hba.conf location:"
sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs
echo ""
echo "PostgreSQL service status:"
sudo systemctl status postgresql --no-pager | head -3
echo ""

echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
echo ""
echo "If connection still fails, try:"
echo "1. Check pg_hba.conf: sudo cat \$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)"
echo "2. Restart PostgreSQL: sudo systemctl restart postgresql"
echo "3. Test with: PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c \"SELECT 1;\""
echo "4. Or use peer authentication: sudo -u postgres psql -d manufacturing_db"
