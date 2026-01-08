#!/bin/bash
# Backup Script untuk Database di VPS
# Backup SQLite database sebelum migrasi ke PostgreSQL

set -e

BACKUP_DIR="$HOME/backups/manufacturing-app"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DB_PATH="$HOME/deployments/manufacturing-app/server"

echo "=========================================="
echo "Database Backup Script"
echo "=========================================="
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup SQLite database
if [ -f "$DB_PATH/database.sqlite" ]; then
    echo "📦 Backing up SQLite database..."
    cp "$DB_PATH/database.sqlite" "$BACKUP_DIR/database.sqlite.$TIMESTAMP"
    
    # Backup WAL files if exist
    if [ -f "$DB_PATH/database.sqlite-wal" ]; then
        cp "$DB_PATH/database.sqlite-wal" "$BACKUP_DIR/database.sqlite-wal.$TIMESTAMP"
    fi
    
    if [ -f "$DB_PATH/database.sqlite-shm" ]; then
        cp "$DB_PATH/database.sqlite-shm" "$BACKUP_DIR/database.sqlite-shm.$TIMESTAMP"
    fi
    
    echo "✅ Backup created: database.sqlite.$TIMESTAMP"
    echo "   Location: $BACKUP_DIR"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_DIR/database.sqlite.$TIMESTAMP" | cut -f1)
    echo "   Size: $SIZE"
else
    echo "⚠️  SQLite database not found at: $DB_PATH/database.sqlite"
    exit 1
fi

# Backup PostgreSQL database (if exists)
if command -v pg_dump &> /dev/null; then
    echo ""
    echo "📦 Backing up PostgreSQL database..."
    pg_dump -h localhost -U admin -d manufacturing_db > "$BACKUP_DIR/postgresql-backup.$TIMESTAMP.sql" 2>/dev/null || {
        echo "⚠️  PostgreSQL backup skipped (database might not exist yet)"
    }
    
    if [ -f "$BACKUP_DIR/postgresql-backup.$TIMESTAMP.sql" ]; then
        echo "✅ PostgreSQL backup created: postgresql-backup.$TIMESTAMP.sql"
        SIZE=$(du -h "$BACKUP_DIR/postgresql-backup.$TIMESTAMP.sql" | cut -f1)
        echo "   Size: $SIZE"
    fi
fi

echo ""
echo "=========================================="
echo "✅ Backup completed successfully!"
echo "=========================================="
echo ""
echo "Backup location: $BACKUP_DIR"
echo "Timestamp: $TIMESTAMP"
