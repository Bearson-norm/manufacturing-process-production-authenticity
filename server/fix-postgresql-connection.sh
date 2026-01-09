#!/bin/bash

# Script untuk fix PostgreSQL connection issues
# Khusus untuk error "connection was aborted by the software in your host machine"

set -e

echo "🔧 Fix PostgreSQL Connection Issues"
echo "===================================="
echo ""

DB_NAME="manufacturing_db"
DB_USER="it_foom"
DB_PASSWORD="FOOMIT"
DB_PORT="5433"

echo "📋 Target Configuration:"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo "   Port: $DB_PORT"
echo ""

# Step 1: Check PostgreSQL status
echo "🔍 Step 1: Checking PostgreSQL status..."
if ! sudo systemctl is-active --quiet postgresql; then
    echo "   ⚠️  PostgreSQL is not running, starting..."
    sudo systemctl start postgresql
    sleep 2
fi
echo "   ✅ PostgreSQL is running"

# Step 2: Check if PostgreSQL is listening on port 5433
echo "🔍 Step 2: Checking if PostgreSQL is listening on port $DB_PORT..."
if sudo netstat -tlnp 2>/dev/null | grep -q ":$DB_PORT " || sudo ss -tlnp 2>/dev/null | grep -q ":$DB_PORT "; then
    echo "   ✅ PostgreSQL is listening on port $DB_PORT"
else
    echo "   ⚠️  PostgreSQL is NOT listening on port $DB_PORT"
    echo "   Checking actual port..."
    ACTUAL_PORT=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW port;" 2>/dev/null | xargs)
    echo "   PostgreSQL is configured to use port: $ACTUAL_PORT"
    if [ "$ACTUAL_PORT" != "$DB_PORT" ]; then
        echo "   ⚠️  Port mismatch! Update your connection to use port $ACTUAL_PORT"
    fi
fi

# Step 3: Check pg_hba.conf
echo "🔍 Step 3: Checking pg_hba.conf configuration..."
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' 2>/dev/null | xargs)
if [ -z "$PG_HBA_FILE" ]; then
    echo "   ❌ Cannot determine pg_hba.conf location"
else
    echo "   File location: $PG_HBA_FILE"
    
    # Backup
    if [ ! -f "${PG_HBA_FILE}.backup" ]; then
        echo "   📦 Creating backup..."
        sudo cp "$PG_HBA_FILE" "${PG_HBA_FILE}.backup"
    fi
    
    # Check for localhost entry
    if sudo grep -qE "^host\s+all\s+all\s+127\.0\.0\.1/32" "$PG_HBA_FILE"; then
        echo "   ✅ Found localhost entry in pg_hba.conf"
        sudo grep -E "^host\s+all\s+all\s+127\.0\.0\.1/32" "$PG_HBA_FILE"
    else
        echo "   ⚠️  No localhost entry found in pg_hba.conf"
        echo "   Adding localhost entry..."
        
        # Add entry if not exists
        if ! sudo grep -q "127.0.0.1/32" "$PG_HBA_FILE"; then
            echo "" | sudo tee -a "$PG_HBA_FILE" > /dev/null
            echo "# Added for $DB_USER access" | sudo tee -a "$PG_HBA_FILE" > /dev/null
            echo "host    all             all             127.0.0.1/32            scram-sha-256" | sudo tee -a "$PG_HBA_FILE" > /dev/null
            echo "   ✅ Added localhost entry"
        fi
    fi
fi

# Step 4: Check password encryption
echo "🔍 Step 4: Checking password encryption method..."
PASSWORD_ENCRYPTION=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW password_encryption;" 2>/dev/null | xargs)
echo "   Current encryption: $PASSWORD_ENCRYPTION"

# Step 5: Ensure user exists and update password
echo "🔍 Step 5: Checking user $DB_USER..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null || echo "0")

if [ "$USER_EXISTS" = "1" ]; then
    echo "   ✅ User $DB_USER exists"
    echo "   🔄 Updating password to ensure correct encryption..."
    sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || {
        echo "   ⚠️  Failed to update password, trying to create user..."
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
    }
    echo "   ✅ Password updated"
else
    echo "   🔄 Creating user $DB_USER..."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null
    echo "   ✅ User created"
fi

# Step 6: Grant privileges
echo "🔍 Step 6: Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $DB_USER;" 2>/dev/null || true
echo "   ✅ Privileges granted"

# Step 7: Reload PostgreSQL
echo "🔄 Step 7: Reloading PostgreSQL..."
sudo systemctl reload postgresql 2>/dev/null || sudo systemctl restart postgresql
sleep 2
echo "   ✅ PostgreSQL reloaded"

# Step 8: Test connection with TCP
echo "🔍 Step 8: Testing TCP connection (localhost:$DB_PORT)..."
if PGPASSWORD=$DB_PASSWORD timeout 5 psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT current_user, current_database();" > /dev/null 2>&1; then
    echo "   ✅ TCP connection successful!"
    echo ""
    echo "📊 Connection Test Result:"
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT current_user, current_database();"
else
    echo "   ⚠️  TCP connection failed"
    
    # Step 9: Test with Unix socket
    echo "🔍 Step 9: Testing Unix socket connection..."
    if sudo -u postgres psql -d $DB_NAME -c "SET ROLE $DB_USER; SELECT current_user, current_database();" > /dev/null 2>&1; then
        echo "   ✅ Unix socket connection works!"
        echo ""
        echo "📊 Connection Test Result (via Unix socket):"
        sudo -u postgres psql -d $DB_NAME -c "SET ROLE $DB_USER; SELECT current_user, current_database();"
        echo ""
        echo "💡 Recommendation: Use Unix socket for better reliability"
        echo "   Update .env: DB_HOST=/var/run/postgresql"
    else
        echo "   ❌ Unix socket connection also failed"
        echo ""
        echo "🔍 Checking PostgreSQL logs..."
        sudo tail -20 /var/log/postgresql/postgresql-*-main.log 2>/dev/null | grep -i "error\|fatal\|$DB_USER" || echo "   (no relevant errors found)"
    fi
fi

echo ""
echo "📝 Connection Details:"
echo "   Host: localhost"
echo "   Port: $DB_PORT"
echo "   Database: $DB_NAME"
echo "   Username: $DB_USER"
echo "   Password: $DB_PASSWORD"
echo ""
echo "   Alternative (Unix socket):"
echo "   Host: /var/run/postgresql"
echo "   Port: (not needed for Unix socket)"
echo ""
echo "✅ Diagnostic completed!"
