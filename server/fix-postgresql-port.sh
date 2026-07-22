#!/bin/bash
# Fix PostgreSQL port issue - PostgreSQL running on 5433 instead of 5432

set -e

: "${DB_PASSWORD:?DB_PASSWORD is required}"

echo "=========================================="
echo "Fix PostgreSQL Port Issue"
echo "=========================================="
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  This script needs sudo privileges"
    echo "Running with sudo..."
    sudo DB_PASSWORD="$DB_PASSWORD" bash "$0"
    exit $?
fi

echo "🔍 Step 1: Checking PostgreSQL port..."
CURRENT_PORT=$(sudo -u postgres psql -tAc "SHOW port;")
echo "   Current PostgreSQL port: $CURRENT_PORT"

if [ "$CURRENT_PORT" = "5433" ]; then
    echo "   ⚠️  PostgreSQL is running on port 5433, not 5432!"
    echo ""
    echo "   Option 1: Update .env to use port 5433"
    echo "   Option 2: Change PostgreSQL to use port 5432"
    echo ""
    read -p "   Choose option (1 or 2): " choice
    
    if [ "$choice" = "1" ]; then
        echo ""
        echo "🔄 Updating .env to use port 5433..."
        cd ~/deployments/manufacturing-app/server
        if [ -f .env ]; then
            # Update or add DB_PORT
            if grep -q "DB_PORT" .env; then
                sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env
            else
                echo "DB_PORT=5433" >> .env
            fi
            echo "   ✅ .env updated: DB_PORT=5433"
            echo ""
            echo "   Current DB settings in .env:"
            grep "^DB_" .env || echo "   (no DB_ settings found)"
        else
            echo "   ⚠️  .env file not found"
        fi
    elif [ "$choice" = "2" ]; then
        echo ""
        echo "🔄 Changing PostgreSQL to use port 5432..."
        POSTGRESQL_CONF=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW config_file;' | xargs)
        echo "   PostgreSQL config: $POSTGRESQL_CONF"
        
        # Backup
        sudo cp $POSTGRESQL_CONF ${POSTGRESQL_CONF}.backup.$(date +%Y%m%d-%H%M%S)
        
        # Update port
        if grep -q "^port" $POSTGRESQL_CONF; then
            sudo sed -i 's/^port.*/port = 5432/' $POSTGRESQL_CONF
        else
            echo "port = 5432" | sudo tee -a $POSTGRESQL_CONF
        fi
        
        echo "   ✅ Config updated to port 5432"
        echo ""
        echo "   Restarting PostgreSQL..."
        sudo systemctl restart postgresql
        sleep 3
        
        # Verify
        NEW_PORT=$(sudo -u postgres psql -tAc "SHOW port;")
        echo "   New port: $NEW_PORT"
    fi
else
    echo "   ✅ PostgreSQL is running on port 5432 (correct)"
fi

echo ""
echo "🔄 Step 2: Testing connection with correct port..."
if [ "$CURRENT_PORT" = "5433" ] && [ "$choice" != "2" ]; then
    echo "   Testing with port 5433..."
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
        echo "   ✅ Connection successful with port 5433!"
        echo ""
        echo "   💡 Update your .env file: DB_PORT=5433"
    } || {
        echo "   ❌ Connection failed even with port 5433"
    }
else
    echo "   Testing with port 5432..."
    PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5432 -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
        echo "   ✅ Connection successful!"
    } || {
        echo "   ❌ Connection failed"
    }
fi

echo ""
echo "=========================================="
echo "✅ Fix completed!"
echo "=========================================="
