#!/bin/bash

# Script untuk menambahkan user database PostgreSQL
# Usage: ./add-database-user.sh

set -e

: "${DB_PASSWORD:?DB_PASSWORD is required}"
NEW_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"

echo "🔧 Menambahkan User Database PostgreSQL"
echo "========================================"
echo ""

# Konfigurasi
DB_NAME="manufacturing_db"
NEW_USER="it_foom"

echo "📋 Informasi User:"
echo "   Username: $NEW_USER"
echo "   Database: $DB_NAME"
echo ""

# Check PostgreSQL status
echo "🔍 Step 1: Checking PostgreSQL status..."
sudo systemctl status postgresql --no-pager | head -3 || {
    echo "   ⚠️  PostgreSQL not running, starting..."
    sudo systemctl start postgresql
}

# Check if user already exists
echo "🔍 Step 2: Checking if user exists..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$NEW_USER'")

if [ "$USER_EXISTS" = "1" ]; then
    echo "   ⚠️  User '$NEW_USER' already exists"
    read -p "   Do you want to update password? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "   🔄 Updating password..."
        sudo -u postgres psql -c "ALTER USER $NEW_USER WITH PASSWORD '$NEW_PASSWORD';"
        echo "   ✅ Password updated"
    else
        echo "   ℹ️  Skipping password update"
    fi
else
    echo "   🔄 Creating new user..."
    sudo -u postgres psql -c "CREATE USER $NEW_USER WITH PASSWORD '$NEW_PASSWORD';"
    echo "   ✅ User created"
fi

# Grant privileges
echo "🔍 Step 3: Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $NEW_USER;" || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $NEW_USER;" || true
echo "   ✅ Privileges granted"

# Reload PostgreSQL
echo "🔄 Step 4: Reloading PostgreSQL..."
sudo systemctl reload postgresql || sudo systemctl restart postgresql
echo "   ✅ PostgreSQL reloaded"

# Test connection
echo "🔍 Step 5: Testing connection..."
PGPASSWORD=$NEW_PASSWORD psql -h localhost -p 5433 -U $NEW_USER -d $DB_NAME -c "SELECT current_user, current_database();" > /dev/null 2>&1 && {
    echo "   ✅ Connection test successful!"
    echo ""
    echo "📊 User Information:"
    PGPASSWORD=$NEW_PASSWORD psql -h localhost -p 5433 -U $NEW_USER -d $DB_NAME -c "SELECT current_user, current_database();"
} || {
    echo "   ⚠️  Connection test failed. Trying with Unix socket..."
    sudo -u postgres psql -d $DB_NAME -c "SET ROLE $NEW_USER; SELECT current_user, current_database();" && {
        echo "   ✅ Connection works with Unix socket"
        echo "   💡 Tip: Use DB_HOST=/var/run/postgresql in .env file"
    } || {
        echo "   ❌ Connection test failed"
        echo "   Please check PostgreSQL logs: sudo tail -f /var/log/postgresql/postgresql-*-main.log"
    }
}

echo ""
echo "✅ Setup completed!"
echo ""
echo "📝 Connection Details:"
echo "   Host: localhost (atau /var/run/postgresql untuk Unix socket)"
echo "   Port: 5433"
echo "   Database: $DB_NAME"
echo "   Username: $NEW_USER"
echo "   Password: $NEW_PASSWORD"
