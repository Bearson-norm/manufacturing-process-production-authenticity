#!/bin/bash
# Setup PostgreSQL User and Database
# Script ini akan create user dan database jika belum ada

set -e

: "${DB_PASSWORD:?DB_PASSWORD is required}"
NEW_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"

echo "=========================================="
echo "Setup PostgreSQL User and Database"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo DB_PASSWORD="$DB_PASSWORD" bash "$0"
    exit $?
fi

echo "🔄 Setting up PostgreSQL user and database..."

# Check if user exists and create/update accordingly
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='admin'" | grep -q 1 && {
    echo "   User 'admin' exists, updating password..."
    sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD '$NEW_PASSWORD';"
} || {
    echo "   User 'admin' does not exist, creating..."
    sudo -u postgres psql -c "CREATE USER admin WITH PASSWORD '$NEW_PASSWORD';"
}

# Check if database exists and create if not
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='manufacturing_db'" | grep -q 1 && {
    echo "   Database 'manufacturing_db' exists"
} || {
    echo "   Database 'manufacturing_db' does not exist, creating..."
    sudo -u postgres psql -c "CREATE DATABASE manufacturing_db OWNER admin;"
}

# Grant privileges
echo "   Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL ON SCHEMA public TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;"
sudo -u postgres psql -d manufacturing_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;"
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;"
sudo -u postgres psql -d manufacturing_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;"

echo ""
echo "✅ PostgreSQL user and database setup completed!"
echo ""
echo "Testing connection..."
PGPASSWORD="$DB_PASSWORD" psql -h localhost -U admin -d manufacturing_db -c "SELECT 1 as test;" > /dev/null 2>&1 && {
    echo "✅ Connection test successful!"
} || {
    echo "⚠️  Connection test failed"
    echo "Please check PostgreSQL configuration"
    exit 1
}
