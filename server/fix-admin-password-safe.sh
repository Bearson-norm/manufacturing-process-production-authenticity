#!/bin/bash
# Safe fix untuk admin password - reassign ownership dulu

set -e

: "${DB_PASSWORD:?DB_PASSWORD is required}"
NEW_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"

echo "=========================================="
echo "Safe Fix Admin Password"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo DB_PASSWORD="$DB_PASSWORD" bash "$0"
    exit $?
fi

echo "🔄 Step 1: Reassigning ownership to postgres..."
sudo -u postgres psql -d manufacturing_db << 'PSQL'
    -- Reassign all objects owned by admin to postgres
    REASSIGN OWNED BY admin TO postgres;
    
    -- Drop owned objects
    DROP OWNED BY admin;
PSQL

echo ""
echo "🔄 Step 2: Changing database owner..."
sudo -u postgres psql << 'PSQL'
    -- Change database owner to postgres
    ALTER DATABASE manufacturing_db OWNER TO postgres;
PSQL

echo ""
echo "🔄 Step 3: Dropping and recreating user..."
sudo -u postgres psql <<PSQL
    -- Now we can drop the user
    DROP USER IF EXISTS admin;
    
    -- Create fresh user
    CREATE USER admin WITH PASSWORD '${NEW_PASSWORD}';
PSQL

echo ""
echo "🔄 Step 4: Granting privileges..."
sudo -u postgres psql << 'PSQL'
    -- Grant database privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    
    -- Change owner back to admin
    ALTER DATABASE manufacturing_db OWNER TO admin;
    
    -- Connect and grant schema privileges
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL

echo ""
echo "🔄 Step 5: Reloading PostgreSQL..."
sudo systemctl reload postgresql
sleep 1

echo ""
echo "🔄 Step 6: Testing connection..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
    echo "   ✅ Connection successful!"
} || {
    echo "   ❌ Connection failed"
    echo ""
    echo "   Trying Unix socket..."
    sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT current_user, current_database();" && {
        echo "   ✅ Unix socket works!"
        echo ""
        echo "   💡 Use Unix socket: Update .env with DB_HOST="
    } || {
        echo "   ❌ Unix socket also failed"
    }
}

echo ""
echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
