#!/bin/bash
# Fix PostgreSQL yang tidak start setelah perubahan port

set -e

echo "=========================================="
echo "Fix PostgreSQL Restart Issue"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo bash "$0"
    exit $?
fi

echo "🔍 Step 1: Checking PostgreSQL status..."
sudo systemctl status postgresql --no-pager | head -10 || {
    echo "   ⚠️  PostgreSQL is not running"
}

echo ""
echo "🔍 Step 2: Checking PostgreSQL logs..."
echo "   Last 10 lines from log:"
sudo tail -10 /var/log/postgresql/postgresql-*-main.log 2>/dev/null | tail -5 || {
    echo "   (no log file found)"
}

echo ""
echo "🔄 Step 3: Checking configuration..."
POSTGRESQL_CONF=$(sudo find /etc/postgresql -name postgresql.conf 2>/dev/null | head -1)
if [ -z "$POSTGRESQL_CONF" ]; then
    echo "   ⚠️  Cannot find postgresql.conf"
    echo "   Searching in common locations..."
    POSTGRESQL_CONF="/etc/postgresql/16/main/postgresql.conf"
fi

if [ -f "$POSTGRESQL_CONF" ]; then
    echo "   Config file: $POSTGRESQL_CONF"
    echo "   Current port setting:"
    sudo grep "^port" $POSTGRESQL_CONF || echo "   (not found)"
    
    # Check if port is commented or has wrong value
    PORT_LINE=$(sudo grep "^port\|^#port" $POSTGRESQL_CONF | head -1)
    if echo "$PORT_LINE" | grep -q "^#port\|port = 5433"; then
        echo "   ⚠️  Port might be wrong, fixing..."
        sudo sed -i 's/^#port\|^port.*/port = 5432/' $POSTGRESQL_CONF
        echo "   ✅ Fixed to port 5432"
    fi
else
    echo "   ⚠️  Config file not found at $POSTGRESQL_CONF"
fi

echo ""
echo "🔄 Step 4: Trying to start PostgreSQL..."
sudo systemctl start postgresql || {
    echo "   ⚠️  Start failed, checking logs..."
    sudo journalctl -u postgresql -n 20 --no-pager
    exit 1
}

sleep 2

echo ""
echo "🔍 Step 5: Verifying PostgreSQL is running..."
if sudo systemctl is-active --quiet postgresql; then
    echo "   ✅ PostgreSQL is running"
    
    # Check port
    ACTUAL_PORT=$(sudo -u postgres psql -tAc "SHOW port;" 2>/dev/null || echo "unknown")
    echo "   Port: $ACTUAL_PORT"
    
    if [ "$ACTUAL_PORT" = "5432" ]; then
        echo "   ✅ Port is correct (5432)"
        
        echo ""
        echo "🔄 Step 6: Testing connection..."
        PGPASSWORD=Admin123 psql -h localhost -p 5432 -U admin -d manufacturing_db -c "SELECT 1;" 2>&1 && {
            echo "   ✅ Connection successful!"
        } || {
            echo "   ⚠️  Connection failed, but PostgreSQL is running"
            echo "   Try: PGPASSWORD=Admin123 psql -h localhost -p $ACTUAL_PORT -U admin -d manufacturing_db -c \"SELECT 1;\""
        }
    else
        echo "   ⚠️  Port is $ACTUAL_PORT (not 5432)"
        echo "   Update .env: DB_PORT=$ACTUAL_PORT"
    fi
else
    echo "   ❌ PostgreSQL is not running"
    echo ""
    echo "   Checking error logs..."
    sudo journalctl -u postgresql -n 30 --no-pager
fi

echo ""
echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
