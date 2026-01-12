#!/bin/bash

# Script untuk cek dan set password user postgres

echo "🔍 Check PostgreSQL postgres User Password"
echo "=========================================="
echo ""

# Check if postgres user has password
echo "🔍 Step 1: Checking if postgres user has password..."
HAS_PASSWORD=$(sudo -u postgres psql -t -P format=unaligned -c "SELECT passwd IS NOT NULL FROM pg_shadow WHERE usename = 'postgres';" 2>/dev/null | xargs)

if [ "$HAS_PASSWORD" = "t" ]; then
    echo "   ✅ User postgres has a password set"
else
    echo "   ℹ️  User postgres does NOT have a password (normal for Unix socket access)"
fi

# Check password encryption
echo ""
echo "🔍 Step 2: Checking password encryption method..."
PASSWORD_ENCRYPTION=$(sudo -u postgres psql -t -P format=unaligned -c "SHOW password_encryption;" 2>/dev/null | xargs)
echo "   Current encryption: $PASSWORD_ENCRYPTION"

# Check pg_hba.conf for postgres user
echo ""
echo "🔍 Step 3: Checking pg_hba.conf for postgres authentication..."
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' 2>/dev/null | xargs)
if [ -n "$PG_HBA_FILE" ]; then
    echo "   File location: $PG_HBA_FILE"
    echo "   Entries for postgres user:"
    sudo grep -E "postgres" "$PG_HBA_FILE" 2>/dev/null | grep -v "^#" | head -5 || echo "   (no specific entries for postgres)"
fi

# Test access methods
echo ""
echo "🔍 Step 4: Testing access methods..."
echo "   Testing Unix socket access (should work):"
sudo -u postgres psql -c "SELECT current_user, 'Unix socket access works' as status;" > /dev/null 2>&1 && {
    echo "   ✅ Unix socket access: OK"
} || {
    echo "   ❌ Unix socket access: FAILED"
}

echo "   Testing TCP access (may require password):"
if PGPASSWORD="" psql -h localhost -p 5433 -U postgres -d postgres -c "SELECT current_user;" > /dev/null 2>&1; then
    echo "   ✅ TCP access without password: OK (no password required)"
else
    echo "   ⚠️  TCP access without password: FAILED (password may be required)"
fi

# Summary
echo ""
echo "📋 Summary:"
echo "   User postgres is typically accessed via:"
echo "   1. Unix socket: sudo -u postgres psql (no password needed)"
echo "   2. TCP: psql -h localhost -U postgres (may require password)"
echo ""
echo "   If you need to set password for postgres user:"
echo "   sudo -u postgres psql -c \"ALTER USER postgres WITH PASSWORD 'YOUR_PASSWORD';\""
echo ""

echo "✅ Check completed!"
