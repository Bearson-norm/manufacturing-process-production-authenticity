#!/bin/bash
# Comprehensive debug dan fix untuk PostgreSQL authentication

set -e

echo "=========================================="
echo "PostgreSQL Authentication Debug & Fix"
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
sudo systemctl status postgresql --no-pager | head -3
echo ""

echo "🔍 Step 2: Checking password encryption setting..."
PASSWORD_ENCRYPTION=$(sudo -u postgres psql -tAc "SHOW password_encryption;")
echo "   Current: $PASSWORD_ENCRYPTION"
if [ "$PASSWORD_ENCRYPTION" != "md5" ]; then
    echo "   ⚠️  Not md5, setting to md5..."
    sudo -u postgres psql -c "ALTER SYSTEM SET password_encryption = 'md5';"
    echo "   ✅ Set to md5"
fi
echo ""

echo "🔍 Step 3: Checking pg_hba.conf..."
PG_HBA_FILE=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file;' | xargs)
echo "   Location: $PG_HBA_FILE"
echo ""
echo "   Current authentication methods:"
echo "   Local (Unix socket):"
sudo grep '^local.*all.*all' $PG_HBA_FILE | awk '{print "      " $0}' || echo "      (not found)"
echo "   Host 127.0.0.1:"
sudo grep '^host.*all.*all.*127.0.0.1' $PG_HBA_FILE | awk '{print "      " $0}' || echo "      (not found)"
echo ""

# Check if md5 is set
if ! sudo grep -qE '^local.*all.*all.*md5|^host.*all.*all.*127.0.0.1.*md5' $PG_HBA_FILE; then
    echo "   ⚠️  md5 not found, updating..."
    sudo cp $PG_HBA_FILE ${PG_HBA_FILE}.backup.$(date +%Y%m%d-%H%M%S)
    sudo sed -i 's/scram-sha-256/md5/g' $PG_HBA_FILE
    sudo sed -i 's/peer/md5/g' $PG_HBA_FILE
    echo "   ✅ Updated to md5"
    echo ""
    echo "   Updated content:"
    sudo grep -E '^local.*all.*all|^host.*all.*all.*127.0.0.1' $PG_HBA_FILE | awk '{print "      " $0}'
fi
echo ""

echo "🔍 Step 4: Checking user 'admin'..."
USER_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='admin'")
if [ "$USER_EXISTS" = "1" ]; then
    echo "   ✅ User exists"
    echo "   User info:"
    sudo -u postgres psql -c "SELECT usename, usecreatedb, usesuper FROM pg_user WHERE usename = 'admin';"
    
    # Check password hash
    echo ""
    echo "   Password hash (first 10 chars):"
    sudo -u postgres psql -tAc "SELECT substring(passwd, 1, 10) FROM pg_shadow WHERE usename = 'admin';" || echo "   (cannot read password hash)"
else
    echo "   ❌ User does not exist"
fi
echo ""

echo "🔄 Step 5: Recreating user with fresh md5 password..."
sudo -u postgres psql << 'PSQL'
    -- Reassign ownership
    \c manufacturing_db
    REASSIGN OWNED BY admin TO postgres;
    DROP OWNED BY admin;
    
    -- Change database owner
    \c postgres
    ALTER DATABASE manufacturing_db OWNER TO postgres;
    
    -- Drop user
    DROP USER IF EXISTS admin;
    
    -- Create fresh user (will use md5 if password_encryption is md5)
    CREATE USER admin WITH PASSWORD 'Admin123';
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
    ALTER DATABASE manufacturing_db OWNER TO admin;
    
    -- Grant schema privileges
    \c manufacturing_db
    GRANT ALL ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
PSQL

echo ""
echo "🔄 Step 6: Verifying password encryption..."
NEW_ENCRYPTION=$(sudo -u postgres psql -tAc "SHOW password_encryption;")
echo "   Password encryption: $NEW_ENCRYPTION"

# Check password hash format
PASSWORD_HASH=$(sudo -u postgres psql -tAc "SELECT passwd FROM pg_shadow WHERE usename = 'admin';" 2>/dev/null || echo "")
if [ -n "$PASSWORD_HASH" ]; then
    if [[ $PASSWORD_HASH == md5* ]]; then
        echo "   ✅ Password hash format: md5 (correct)"
    else
        echo "   ⚠️  Password hash format: not md5 (might be issue)"
        echo "   Hash: ${PASSWORD_HASH:0:20}..."
    fi
fi
echo ""

echo "🔄 Step 7: Restarting PostgreSQL..."
sudo systemctl restart postgresql
sleep 3

echo ""
echo "🔄 Step 8: Testing connections..."
echo ""

echo "   Test 1: As postgres user (should work)..."
sudo -u postgres psql -d manufacturing_db -c "SELECT current_user, current_database();" > /dev/null 2>&1 && {
    echo "   ✅ OK"
} || {
    echo "   ❌ FAILED"
}

echo ""
echo "   Test 2: As admin via TCP/IP with password..."
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT current_user, current_database();" 2>&1 | head -3 && {
    echo "   ✅ Connection successful!"
} || {
    echo "   ❌ FAILED"
    echo ""
    echo "   Test 3: Checking PostgreSQL logs..."
    echo "   Last 5 lines from log:"
    sudo tail -5 /var/log/postgresql/postgresql-*-main.log 2>/dev/null | grep -i "admin\|authentication\|password" || echo "   (no relevant log entries)"
}

echo ""
echo "=========================================="
echo "Final Verification:"
echo "=========================================="
echo ""
echo "pg_hba.conf entries:"
sudo grep -E '^local.*all.*all|^host.*all.*all.*127.0.0.1' $PG_HBA_FILE | head -3
echo ""
echo "Password encryption:"
sudo -u postgres psql -tAc "SHOW password_encryption;"
echo ""
echo "User exists:"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='admin';" && echo "   ✅ Yes" || echo "   ❌ No"
echo ""

echo "=========================================="
echo "✅ Debug completed!"
echo "=========================================="
echo ""
echo "If still fails, try:"
echo "1. Check full logs: sudo tail -50 /var/log/postgresql/postgresql-*-main.log"
echo "2. Manually verify pg_hba.conf: sudo cat $PG_HBA_FILE | grep -E '^local|^host.*127.0.0.1'"
echo "3. Try Unix socket: sudo -u postgres psql -d manufacturing_db -c \"SET ROLE admin; SELECT 1;\""
