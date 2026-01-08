#!/bin/bash
# Script untuk verifikasi path dan permission database SQLite di VPS
# Jalankan script ini di VPS: bash verify-database-path.sh

echo "=== Verifikasi Database SQLite Path ==="
echo ""

# Check current user
echo "1. Current User:"
whoami
echo ""

# Check home directory
echo "2. Home Directory:"
echo $HOME
echo ""

# Check if database directory exists
echo "3. Checking database directory:"
DB_DIR="$HOME/deployments/manufacturing-app/server"
if [ -d "$DB_DIR" ]; then
    echo "✓ Directory exists: $DB_DIR"
    echo "  Full path: $(realpath $DB_DIR)"
else
    echo "✗ Directory NOT found: $DB_DIR"
    echo "  Trying to find database location..."
    find $HOME -name "database.sqlite" -type f 2>/dev/null | head -5
fi
echo ""

# Check database file
echo "4. Checking database file:"
DB_FILE="$DB_DIR/database.sqlite"
if [ -f "$DB_FILE" ]; then
    echo "✓ Database file exists: $DB_FILE"
    echo "  Full path: $(realpath $DB_FILE)"
    echo "  File size: $(du -h "$DB_FILE" | cut -f1)"
    echo "  Permissions: $(ls -l "$DB_FILE" | awk '{print $1, $3, $4}')"
else
    echo "✗ Database file NOT found: $DB_FILE"
    echo "  Searching for database.sqlite..."
    find $HOME -name "database.sqlite" -type f 2>/dev/null
fi
echo ""

# Check WAL files
echo "5. Checking WAL files:"
if [ -f "$DB_FILE-wal" ]; then
    echo "✓ WAL file exists: $DB_FILE-wal"
    ls -lh "$DB_FILE-wal" 2>/dev/null
fi
if [ -f "$DB_FILE-shm" ]; then
    echo "✓ SHM file exists: $DB_FILE-shm"
    ls -lh "$DB_FILE-shm" 2>/dev/null
fi
echo ""

# Check permissions
echo "6. Permission Check:"
if [ -f "$DB_FILE" ]; then
    if [ -r "$DB_FILE" ]; then
        echo "✓ Database is readable"
    else
        echo "✗ Database is NOT readable"
        echo "  Current permissions: $(stat -c '%a %n' "$DB_FILE")"
    fi
    
    if [ -w "$DB_FILE" ]; then
        echo "✓ Database is writable"
    else
        echo "⚠ Database is NOT writable (read-only mode OK)"
    fi
    
    # Check directory permissions
    if [ -r "$DB_DIR" ] && [ -x "$DB_DIR" ]; then
        echo "✓ Directory is readable and executable"
    else
        echo "✗ Directory permission issue"
    fi
fi
echo ""

# Get absolute path
echo "7. Absolute Paths:"
if [ -f "$DB_FILE" ]; then
    echo "Database absolute path:"
    realpath "$DB_FILE"
    echo ""
    echo "Alternative paths to try in DBeaver:"
    echo "  - $(realpath "$DB_FILE")"
    echo "  - $DB_FILE"
    echo "  - $(cd "$DB_DIR" && pwd)/database.sqlite"
fi
echo ""

# Check if process is using database
echo "8. Checking if database is locked by process:"
if command -v lsof &> /dev/null; then
    LOCKED_BY=$(lsof "$DB_FILE" 2>/dev/null | grep -v COMMAND | head -3)
    if [ -n "$LOCKED_BY" ]; then
        echo "⚠ Database is being used by:"
        echo "$LOCKED_BY"
    else
        echo "✓ Database is not locked"
    fi
else
    echo "  (lsof not available, skipping lock check)"
fi
echo ""

echo "=== Summary ==="
if [ -f "$DB_FILE" ]; then
    echo "✓ Database found at: $(realpath "$DB_FILE")"
    echo ""
    echo "Use this path in DBeaver:"
    echo "  $(realpath "$DB_FILE")"
else
    echo "✗ Database file not found!"
    echo "  Please check the path and ensure the file exists."
fi

