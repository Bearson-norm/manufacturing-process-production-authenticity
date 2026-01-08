#!/bin/bash
# Setup PostgreSQL User and Database
# Script ini akan create user dan database jika belum ada

set -e

echo "=========================================="
echo "Setup PostgreSQL User and Database"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Setting up PostgreSQL user and database..."

sudo -u postgres psql << 'PSQL'
    -- Create user if not exists
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
            CREATE USER admin WITH PASSWORD 'Admin123';
            RAISE NOTICE 'Created new user admin';
        ELSE
            ALTER USER admin WITH PASSWORD 'Admin123';
            RAISE NOTICE 'Updated password for existing user admin';
        END IF;
    END
    \$\$;
    
    -- Create database if not exists
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
echo "✅ PostgreSQL user and database setup completed!"
echo ""
echo "Testing connection..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1 as test;" > /dev/null 2>&1 && {
    echo "✅ Connection test successful!"
} || {
    echo "⚠️  Connection test failed"
    echo "Please check PostgreSQL configuration"
    exit 1
}
