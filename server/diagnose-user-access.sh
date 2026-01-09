#!/bin/bash

# Script untuk diagnose perbedaan antara user admin dan it_foom

echo "🔍 Diagnose User Access Issue"
echo "=============================="
echo ""

DB_NAME="manufacturing_db"
DB_USER="it_foom"
DB_PASSWORD="FOOMIT"
ADMIN_USER="admin"
ADMIN_PASSWORD="Admin123"
DB_PORT="5433"

echo "📋 Configuration:"
echo "   Database: $DB_NAME"
echo "   Port: $DB_PORT"
echo "   Test User: $DB_USER"
echo "   Admin User: $ADMIN_USER"
echo ""

# Step 1: Check if users exist
echo "🔍 Step 1: Checking if users exist..."
echo "   Checking $ADMIN_USER:"
sudo -u postgres psql -c "\du $ADMIN_USER" 2>/dev/null | head -3 || echo "   ❌ User $ADMIN_USER not found"

echo "   Checking $DB_USER:"
sudo -u postgres psql -c "\du $DB_USER" 2>/dev/null | head -3 || echo "   ❌ User $DB_USER not found"

# Step 2: Check password encryption
echo ""
echo "🔍 Step 2: Checking password encryption method..."
PASSWORD_ENCRYPTION=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW password_encryption;" 2>/dev/null | xargs)
echo "   Current encryption: $PASSWORD_ENCRYPTION"

# Step 3: Check if passwords are set
echo ""
echo "🔍 Step 3: Checking if passwords are set..."
echo "   $ADMIN_USER password hash:"
sudo -u postgres psql -t -P format=unaligned -c "SELECT substring(passwd::text, 1, 20) FROM pg_shadow WHERE usename = '$ADMIN_USER';" 2>/dev/null || echo "   ❌ Cannot check password"

echo "   $DB_USER password hash:"
sudo -u postgres psql -t -P format=unaligned -c "SELECT substring(passwd::text, 1, 20) FROM pg_shadow WHERE usename = '$DB_USER';" 2>/dev/null || echo "   ❌ Cannot check password"

# Step 4: Test admin connection
echo ""
echo "🔍 Step 4: Testing admin connection..."
if PGPASSWORD=$ADMIN_PASSWORD timeout 5 psql -h localhost -p $DB_PORT -U $ADMIN_USER -d $DB_NAME -c "SELECT current_user, current_database();" > /dev/null 2>&1; then
    echo "   ✅ Admin connection successful"
    PGPASSWORD=$ADMIN_PASSWORD psql -h localhost -p $DB_PORT -U $ADMIN_USER -d $DB_NAME -c "SELECT current_user, current_database();" 2>&1 | head -3
else
    echo "   ❌ Admin connection failed"
    PGPASSWORD=$ADMIN_PASSWORD psql -h localhost -p $DB_PORT -U $ADMIN_USER -d $DB_NAME -c "SELECT 1;" 2>&1 | head -5
fi

# Step 5: Test it_foom connection
echo ""
echo "🔍 Step 5: Testing it_foom connection..."
if PGPASSWORD=$DB_PASSWORD timeout 5 psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT current_user, current_database();" > /dev/null 2>&1; then
    echo "   ✅ it_foom connection successful"
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT current_user, current_database();" 2>&1 | head -3
else
    echo "   ❌ it_foom connection failed"
    echo "   Error details:"
    PGPASSWORD=$DB_PASSWORD psql -h localhost -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;" 2>&1 | head -5
fi

# Step 6: Check pg_hba.conf
echo ""
echo "🔍 Step 6: Checking pg_hba.conf..."
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' 2>/dev/null | xargs)
if [ -n "$PG_HBA_FILE" ]; then
    echo "   File location: $PG_HBA_FILE"
    echo "   Relevant entries for localhost:"
    sudo grep -E "^(host|local).*127\.0\.0\.1|localhost|all" "$PG_HBA_FILE" 2>/dev/null | grep -v "^#" | head -10 || echo "   (no relevant entries found)"
else
    echo "   ❌ Cannot determine pg_hba.conf location"
fi

# Step 7: Check database privileges
echo ""
echo "🔍 Step 7: Checking database privileges..."
echo "   $ADMIN_USER privileges on $DB_NAME:"
sudo -u postgres psql -d $DB_NAME -c "SELECT has_database_privilege('$ADMIN_USER', '$DB_NAME', 'CONNECT');" 2>/dev/null || echo "   ❌ Cannot check"

echo "   $DB_USER privileges on $DB_NAME:"
sudo -u postgres psql -d $DB_NAME -c "SELECT has_database_privilege('$DB_USER', '$DB_NAME', 'CONNECT');" 2>/dev/null || echo "   ❌ Cannot check"

# Step 8: Check recent PostgreSQL logs
echo ""
echo "🔍 Step 8: Checking recent PostgreSQL logs for authentication errors..."
sudo tail -30 /var/log/postgresql/postgresql-*-main.log 2>/dev/null | grep -iE "$DB_USER|authentication|password|fatal" | tail -10 || echo "   (no relevant errors found)"

# Step 9: Test with Unix socket
echo ""
echo "🔍 Step 9: Testing with Unix socket (bypass network)..."
echo "   Admin via Unix socket:"
sudo -u postgres psql -d $DB_NAME -c "SET ROLE $ADMIN_USER; SELECT current_user, current_database();" > /dev/null 2>&1 && {
    echo "   ✅ Admin works via Unix socket"
} || echo "   ❌ Admin failed via Unix socket"

echo "   $DB_USER via Unix socket:"
sudo -u postgres psql -d $DB_NAME -c "SET ROLE $DB_USER; SELECT current_user, current_database();" > /dev/null 2>&1 && {
    echo "   ✅ $DB_USER works via Unix socket"
    sudo -u postgres psql -d $DB_NAME -c "SET ROLE $DB_USER; SELECT current_user, current_database();" 2>&1 | head -3
} || {
    echo "   ❌ $DB_USER failed via Unix socket"
    sudo -u postgres psql -d $DB_NAME -c "SET ROLE $DB_USER; SELECT 1;" 2>&1 | head -3
}

# Step 10: Recommendations
echo ""
echo "💡 Recommendations:"
echo "   If admin works but it_foom doesn't:"
echo "   1. Update it_foom password: sudo -u postgres psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';\""
echo "   2. Check pg_hba.conf for user-specific rules"
echo "   3. Verify password encryption method matches"
echo "   4. Try using Unix socket: DB_HOST=/var/run/postgresql"
echo ""

echo "✅ Diagnostic completed!"
