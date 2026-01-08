#!/bin/bash
# Fix PostgreSQL dengan md5 authentication (bukan scram-sha-256)

set -e

echo "=========================================="
echo "Fix PostgreSQL dengan MD5 Authentication"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Step 1: Setting password encryption to md5..."
sudo -u postgres psql << 'PSQL'
    -- Set password encryption to md5
    ALTER SYSTEM SET password_encryption = 'md5';
PSQL

echo ""
echo "🔄 Step 2: Updating pg_hba.conf to use md5..."
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "   pg_hba.conf location: $PG_HBA_FILE"

# Backup pg_hba.conf
sudo cp "$PG_HBA_FILE" "${PG_HBA_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
echo "   ✅ Backup created"

# Update pg_hba.conf: change scram-sha-256 to md5
sudo sed -i 's/scram-sha-256/md5/g' "$PG_HBA_FILE"
echo "   ✅ Updated scram-sha-256 to md5"

echo ""
echo "🔄 Step 3: Reassigning ownership and recreating user..."
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
    
    -- Create fresh user (will use md5 encryption)
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

echo ""
echo "🔄 Step 4: Reloading PostgreSQL configuration..."
sudo systemctl reload postgresql
sleep 2

echo ""
echo "🔄 Step 5: Verifying configuration..."
echo "   Password encryption:"
sudo -u postgres psql -tAc "SHOW password_encryption;"
echo ""
echo "   pg_hba.conf authentication methods:"
echo "   Local: $(sudo grep '^local.*all.*all' $PG_HBA_FILE | awk '{print $NF}' || echo 'not found')"
echo "   Host 127.0.0.1: $(sudo grep '^host.*all.*all.*127.0.0.1' $PG_HBA_FILE | awk '{print $NF}' || echo 'not found')"

echo ""
echo "🔄 Step 6: Testing connection..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
    echo "   ✅ Connection successful!"
} || {
    echo "   ❌ Connection failed"
    echo ""
    echo "   Trying restart PostgreSQL..."
    sudo systemctl restart postgresql
    sleep 2
    echo ""
    echo "   Testing again..."
    PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
        echo "   ✅ Connection successful after restart!"
    } || {
        echo "   ❌ Still failed"
        echo ""
        echo "   Check PostgreSQL logs:"
        echo "   sudo tail -20 /var/log/postgresql/postgresql-*-main.log"
    }
}

echo ""
echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
echo ""
echo "If still fails, check:"
echo "1. PostgreSQL logs: sudo tail -f /var/log/postgresql/postgresql-*-main.log"
echo "2. pg_hba.conf: sudo cat $PG_HBA_FILE | grep -E '^local|^host.*127.0.0.1'"
echo "3. Restart PostgreSQL: sudo systemctl restart postgresql"
