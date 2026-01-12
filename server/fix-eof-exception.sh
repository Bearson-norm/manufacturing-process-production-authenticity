#!/bin/bash

# Script untuk fix EOFException / Connection reset issues

echo "🔧 Fix EOFException / Connection Reset Issues"
echo "=============================================="
echo ""

DB_NAME="manufacturing_db"
DB_USER="it_foom"
DB_PASSWORD="FOOMIT"
DB_PORT="5433"

# Step 1: Check PostgreSQL status
echo "🔍 Step 1: Checking PostgreSQL status..."
if ! sudo systemctl is-active --quiet postgresql; then
    echo "   ⚠️  PostgreSQL is not running, starting..."
    sudo systemctl start postgresql
    sleep 3
fi
echo "   ✅ PostgreSQL is running"

# Step 2: Check current connections
echo ""
echo "🔍 Step 2: Checking current connections..."
CURRENT_CONN=$(sudo -u postgres psql -t -P format=unaligned -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs)
MAX_CONN=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW max_connections;" 2>/dev/null | xargs)
echo "   Current connections: $CURRENT_CONN"
echo "   Max connections: $MAX_CONN"
echo "   Available: $((MAX_CONN - CURRENT_CONN))"

if [ "$CURRENT_CONN" -gt $((MAX_CONN * 90 / 100)) ]; then
    echo "   ⚠️  Connection pool almost full!"
fi

# Step 3: Check idle connections
echo ""
echo "🔍 Step 3: Checking idle connections..."
IDLE_CONN=$(sudo -u postgres psql -t -P format=unaligned -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';" 2>/dev/null | xargs)
echo "   Idle connections: $IDLE_CONN"

if [ "$IDLE_CONN" -gt 10 ]; then
    echo "   🔄 Cleaning up idle connections..."
    sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND state_change < now() - interval '30 minutes';" 2>/dev/null || true
    echo "   ✅ Idle connections cleaned"
fi

# Step 4: Check timeout settings
echo ""
echo "🔍 Step 4: Checking timeout settings..."
STATEMENT_TIMEOUT=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW statement_timeout;" 2>/dev/null | xargs)
IDLE_TIMEOUT=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW idle_in_transaction_session_timeout;" 2>/dev/null | xargs)
echo "   Statement timeout: $STATEMENT_TIMEOUT"
echo "   Idle in transaction timeout: $IDLE_TIMEOUT"

# Step 5: Optimize timeout settings
echo ""
echo "🔄 Step 5: Optimizing timeout settings..."
sudo -u postgres psql << 'EOF' 2>/dev/null || true
ALTER SYSTEM SET statement_timeout = '300s';
ALTER SYSTEM SET idle_in_transaction_session_timeout = '600s';
ALTER SYSTEM SET tcp_keepalives_idle = 60;
ALTER SYSTEM SET tcp_keepalives_interval = 10;
ALTER SYSTEM SET tcp_keepalives_count = 3;
EOF
echo "   ✅ Timeout settings updated"

# Step 6: Check max_connections
echo ""
echo "🔍 Step 6: Checking max_connections..."
CURRENT_MAX=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW max_connections;" 2>/dev/null | xargs)
if [ "$CURRENT_MAX" -lt 100 ]; then
    echo "   ⚠️  max_connections is low ($CURRENT_MAX), increasing..."
    sudo -u postgres psql -c "ALTER SYSTEM SET max_connections = 200;" 2>/dev/null || true
    echo "   ✅ max_connections increased to 200 (restart required)"
fi

# Step 7: Reload PostgreSQL
echo ""
echo "🔄 Step 7: Reloading PostgreSQL..."
sudo systemctl reload postgresql 2>/dev/null || sudo systemctl restart postgresql
sleep 3
echo "   ✅ PostgreSQL reloaded"

# Step 8: Test connection
echo ""
echo "🔍 Step 8: Testing connection..."
if PGPASSWORD=$DB_PASSWORD timeout 10 psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT current_user, current_database();" > /dev/null 2>&1; then
    echo "   ✅ Connection test successful!"
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT current_user, current_database();" 2>&1 | head -3
else
    echo "   ⚠️  Connection test failed, trying Unix socket..."
    if sudo -u postgres psql -d $DB_NAME -c "SET ROLE $DB_USER; SELECT current_user, current_database();" > /dev/null 2>&1; then
        echo "   ✅ Unix socket connection works!"
        echo "   💡 Use DB_HOST=/var/run/postgresql for better reliability"
    else
        echo "   ❌ Connection failed"
    fi
fi

# Step 9: Check PostgreSQL logs
echo ""
echo "🔍 Step 9: Checking recent PostgreSQL logs..."
RECENT_ERRORS=$(sudo tail -20 /var/log/postgresql/postgresql-*-main.log 2>/dev/null | grep -iE "eof|connection.*reset|fatal.*connection" | tail -5)
if [ -n "$RECENT_ERRORS" ]; then
    echo "   Recent connection errors:"
    echo "$RECENT_ERRORS" | sed 's/^/   /'
else
    echo "   ✅ No recent connection errors found"
fi

# Step 10: Recommendations
echo ""
echo "💡 Recommendations:"
echo "   1. If using tools (DBeaver/pgAdmin), increase connection timeout to 30-60 seconds"
echo "   2. Enable connection pooling in your application"
echo "   3. Use Unix socket for local connections: DB_HOST=/var/run/postgresql"
echo "   4. Monitor connection count: sudo -u postgres psql -c \"SELECT count(*) FROM pg_stat_activity;\""
echo "   5. If max_connections was increased, restart PostgreSQL: sudo systemctl restart postgresql"
echo ""

echo "✅ Fix completed!"
