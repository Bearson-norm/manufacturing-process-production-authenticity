#!/bin/bash
# Backup script sebelum update sistem
# Usage: ./backup-before-update.sh

BACKUP_DIR="/home/foom/backups/manufacturing-app"
DATE=$(date +%Y%m%d-%H%M%S)
DEPLOYMENT_DIR="/home/foom/deployments/manufacturing-app"
SERVER_DIR="$DEPLOYMENT_DIR/server"

echo "🔄 Starting backup process..."
echo "📅 Backup date: $DATE"
echo ""

# Create backup directory
mkdir -p $BACKUP_DIR

# Check if deployment directory exists
if [ ! -d "$DEPLOYMENT_DIR" ]; then
  echo "⚠️  Deployment directory not found: $DEPLOYMENT_DIR"
  echo "   Trying alternative location..."
  DEPLOYMENT_DIR="/var/www/manufacturing-process-production-authenticity"
  SERVER_DIR="$DEPLOYMENT_DIR/server"
fi

if [ ! -d "$DEPLOYMENT_DIR" ]; then
  echo "❌ Deployment directory not found. Please check the path."
  exit 1
fi

echo "📁 Deployment directory: $DEPLOYMENT_DIR"
echo ""

# Backup database
if [ -f "$SERVER_DIR/database.sqlite" ]; then
  cp "$SERVER_DIR/database.sqlite" "$BACKUP_DIR/database_$DATE.sqlite"
  echo "✅ Database backed up: database_$DATE.sqlite ($(du -h "$BACKUP_DIR/database_$DATE.sqlite" | cut -f1))"
else
  echo "⚠️  Database file not found: $SERVER_DIR/database.sqlite"
fi

# Backup WAL files
if [ -f "$SERVER_DIR/database.sqlite-wal" ]; then
  cp "$SERVER_DIR/database.sqlite-wal" "$BACKUP_DIR/database_$DATE.sqlite-wal"
  echo "✅ WAL file backed up"
fi

# Backup SHM files
if [ -f "$SERVER_DIR/database.sqlite-shm" ]; then
  cp "$SERVER_DIR/database.sqlite-shm" "$BACKUP_DIR/database_$DATE.sqlite-shm"
  echo "✅ SHM file backed up"
fi

# Backup entire deployment folder
if [ -d "$DEPLOYMENT_DIR" ]; then
  echo "📦 Creating full deployment backup (this may take a while)..."
  cd "$(dirname $DEPLOYMENT_DIR)"
  tar -czf "$BACKUP_DIR/manufacturing-app-full_$DATE.tar.gz" "$(basename $DEPLOYMENT_DIR)/" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "✅ Full deployment backed up: manufacturing-app-full_$DATE.tar.gz ($(du -h "$BACKUP_DIR/manufacturing-app-full_$DATE.tar.gz" | cut -f1))"
  else
    echo "⚠️  Full backup failed (may need sudo for some files)"
  fi
fi

# Backup environment file
if [ -f "$SERVER_DIR/.env" ]; then
  cp "$SERVER_DIR/.env" "$BACKUP_DIR/env_$DATE.env"
  echo "✅ Environment file backed up"
else
  echo "ℹ️  Environment file not found (may not exist yet)"
fi

# Backup PM2 ecosystem config
if [ -f "$SERVER_DIR/ecosystem.config.js" ]; then
  cp "$SERVER_DIR/ecosystem.config.js" "$BACKUP_DIR/ecosystem_$DATE.config.js"
  echo "✅ PM2 ecosystem config backed up"
fi

# Keep only last 10 backups
echo ""
echo "🧹 Cleaning old backups (keeping last 10)..."
cd $BACKUP_DIR
ls -t | tail -n +11 | xargs rm -f 2>/dev/null || true

# Summary
echo ""
echo "✅ Backup completed!"
echo "📋 Backup location: $BACKUP_DIR"
echo ""
echo "📊 Backup summary:"
ls -lh $BACKUP_DIR | grep $DATE | awk '{print "   " $9 " (" $5 ")"}'
echo ""
echo "💾 Total backup size:"
du -sh $BACKUP_DIR
echo ""
echo "✅ Ready for update!"

