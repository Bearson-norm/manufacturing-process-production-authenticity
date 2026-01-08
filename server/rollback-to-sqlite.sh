#!/bin/bash
# Rollback Script: PostgreSQL ke SQLite
# Gunakan script ini jika migrasi gagal dan perlu rollback

set -e

BACKUP_DIR="$HOME/backups/manufacturing-app"
DB_PATH="$HOME/deployments/manufacturing-app/server"

echo "=========================================="
echo "Rollback Script: PostgreSQL → SQLite"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will restore SQLite database from backup"
echo "    Make sure you have a backup before proceeding!"
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled."
    exit 0
fi

# Find latest backup
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/database.sqlite.* 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup found in $BACKUP_DIR"
    exit 1
fi

echo ""
echo "📦 Restoring from backup: $(basename $LATEST_BACKUP)"

# Stop application
echo "🛑 Stopping application..."
pm2 stop manufacturing-app || true

# Restore database
echo "📥 Restoring database..."
cp "$LATEST_BACKUP" "$DB_PATH/database.sqlite"

# Restore WAL files if exist
WAL_BACKUP="${LATEST_BACKUP%-*}-wal.${LATEST_BACKUP##*.}"
SHM_BACKUP="${LATEST_BACKUP%-*}-shm.${LATEST_BACKUP##*.}"

if [ -f "$WAL_BACKUP" ]; then
    cp "$WAL_BACKUP" "$DB_PATH/database.sqlite-wal"
    echo "   ✅ Restored WAL file"
fi

if [ -f "$SHM_BACKUP" ]; then
    cp "$SHM_BACKUP" "$DB_PATH/database.sqlite-shm"
    echo "   ✅ Restored SHM file"
fi

# Update .env to use SQLite (if needed)
# Note: You may need to modify database.js to support SQLite again

echo ""
echo "✅ Database restored successfully!"
echo ""
echo "⚠️  IMPORTANT: You need to:"
echo "   1. Update server/database.js to use SQLite instead of PostgreSQL"
echo "   2. Update server/config.js to use SQLite"
echo "   3. Restart application: pm2 start manufacturing-app"
