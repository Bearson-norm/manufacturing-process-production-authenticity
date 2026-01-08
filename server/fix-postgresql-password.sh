#!/bin/bash
# Script untuk fix PostgreSQL password untuk user admin
# Gunakan script ini jika password authentication failed

set -e

echo "=========================================="
echo "Fix PostgreSQL Password for User 'admin'"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Resetting password for PostgreSQL user 'admin'..."

# Method 1: Using ALTER USER (if user exists)
sudo -u postgres psql << 'PSQL'
    -- Check if user exists
    DO \$\$
    BEGIN
        IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
            ALTER USER admin WITH PASSWORD 'Admin123';
            RAISE NOTICE 'Password updated for existing user admin';
        ELSE
            CREATE USER admin WITH PASSWORD 'Admin123';
            RAISE NOTICE 'Created new user admin';
        END IF;
    END
    \$\$;
    
    -- Ensure database exists
    SELECT 'CREATE DATABASE manufacturing_db OWNER admin' 
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'manufacturing_db')\gexec
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    
    -- Connect and grant schema privileges
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL

echo ""
echo "✅ PostgreSQL password fixed!"
echo ""
echo "Testing connection..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1 as test;" > /dev/null 2>&1 && {
    echo "✅ Connection test successful!"
    echo ""
    echo "You can now run migration:"
    echo "  cd ~/deployments/manufacturing-app/server"
    echo "  node migrate-to-postgresql.js"
} || {
    echo "⚠️  Connection test failed"
    echo "Please check PostgreSQL configuration"
}
