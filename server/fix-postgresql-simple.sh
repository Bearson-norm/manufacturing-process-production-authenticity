#!/bin/bash
# Simple script untuk fix PostgreSQL password
# Versi sederhana tanpa DO block

set -e

echo "=========================================="
echo "Fix PostgreSQL Password (Simple Version)"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔄 Fixing PostgreSQL password for user 'admin'..."

# Update password (will work even if user exists)
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';" 2>/dev/null || {
    echo "   User 'admin' does not exist, creating..."
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
    echo ""
    echo "Try manual test:"
    echo "  PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c \"SELECT 1;\""
}
