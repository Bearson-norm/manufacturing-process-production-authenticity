#!/bin/bash

# Deployment script dijalankan di VPS (manual atau dipanggil workflow).
# Menyalin server/.env dari release sebelumnya agar tidak perlu set ulang di terminal.

set -e

DEPLOY_DIR="/home/$USER/deployments"
APP_DIR="$DEPLOY_DIR/manufacturing-app"
ENV_CANONICAL="$DEPLOY_DIR/.manufacturing-app.env"
BACKUP_DIR="$DEPLOY_DIR/manufacturing-app-backup-$(date +%Y%m%d-%H%M%S)"

echo "🚀 Starting deployment..."

cd "$DEPLOY_DIR"
if [ -d "$APP_DIR" ]; then
  echo "📦 Creating backup..."
  mv "$APP_DIR" "$BACKUP_DIR"
fi

echo "📦 Extracting deployment package..."
tar -xzf deploy.tar.gz

mkdir -p "$APP_DIR"
mv deploy/* "$APP_DIR/"
mkdir -p "$APP_DIR/server"

if [ -d "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/server/.env" ]; then
  echo "📋 Restoring server/.env from $BACKUP_DIR"
  cp -f "$BACKUP_DIR/server/.env" "$APP_DIR/server/.env"
  chmod 600 "$APP_DIR/server/.env" || true
elif [ -f "$ENV_CANONICAL" ]; then
  echo "📋 Using $ENV_CANONICAL"
  cp -f "$ENV_CANONICAL" "$APP_DIR/server/.env"
  chmod 600 "$APP_DIR/server/.env" || true
elif [ -f "$APP_DIR/server/.env" ]; then
  echo "📋 Using packaged server/.env"
else
  echo "❌ No server/.env — place one at $ENV_CANONICAL or keep a manufacturing-app-backup-*/server/.env"
  exit 1
fi

echo "📦 Installing server dependencies..."
cd "$APP_DIR/server"
npm install --production

mkdir -p logs
pm2 delete manufacturing-app || true

echo "🔄 Restarting application with PM2..."
if [ -f ecosystem.config.js ]; then
  pm2 start ecosystem.config.js --only manufacturing-app
else
  pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster --cwd "$APP_DIR/server" --env production
fi

pm2 save

echo "🧹 Cleaning up old backups..."
cd "$DEPLOY_DIR"
ls -dt manufacturing-app-backup-* 2>/dev/null | tail -n +6 | xargs rm -rf || true

rm -f deploy.tar.gz
rm -rf deploy

echo "✅ Deployment completed successfully!"
pm2 status
