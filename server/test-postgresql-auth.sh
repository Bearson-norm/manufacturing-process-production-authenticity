#!/bin/bash
# Test berbagai metode authentication PostgreSQL

echo "=========================================="
echo "PostgreSQL Authentication Test"
echo "=========================================="
echo ""

echo "1. Testing as postgres user (should work):"
sudo -u postgres psql -d manufacturing_db -c "SELECT current_user, current_database();" && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
}
echo ""

echo "2. Testing with PGPASSWORD environment variable:"
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
    echo "   Error output shown above"
}
echo ""

echo "3. Testing with Unix socket (peer authentication):"
sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT current_user, current_database();" && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
}
echo ""

echo "4. Testing direct connection:"
sudo -u postgres psql << 'SQL'
\c manufacturing_db admin
SELECT current_user, current_database();
SQL

echo ""
echo "5. Checking pg_hba.conf:"
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "   Location: $PG_HBA_FILE"
echo "   Relevant entries:"
sudo grep -E "^local|^host.*127.0.0.1|^host.*localhost" "$PG_HBA_FILE" 2>/dev/null | head -5 || echo "   (none found)"
echo ""

echo "6. Checking if admin user can connect via postgres role:"
sudo -u postgres psql -d manufacturing_db -c "SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename = 'admin';"
echo ""
