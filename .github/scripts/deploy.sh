#!/bin/bash

# Deployment script yang dijalankan di VPS
# Script ini dipanggil oleh GitHub Actions

set -e

DEPLOY_DIR="/home/$USER/deployments"
APP_DIR="$DEPLOY_DIR/manufacturing-app"
BACKUP_DIR="$DEPLOY_DIR/manufacturing-app-backup-$(date +%Y%m%d-%H%M%S)"

echo "🚀 Starting deployment..."

# Backup existing deployment
if [ -d "$APP_DIR" ]; then
    echo "📦 Creating backup..."
    mv "$APP_DIR" "$BACKUP_DIR"
fi

# Extract new deployment
echo "📦 Extracting deployment package..."
cd "$DEPLOY_DIR"
tar -xzf deploy.tar.gz

# Move to app directory
mkdir -p "$APP_DIR"
mv deploy/* "$APP_DIR/"

# Install server dependencies
echo "📦 Installing server dependencies..."
cd "$APP_DIR/server"
npm install --production

# Restart application with PM2 using ecosystem config
echo "🔄 Restarting application with PM2 cluster mode..."
cd "$APP_DIR/server"

# Create logs directory
mkdir -p logs

# Delete old PM2 process
pm2 delete manufacturing-app || true

# Start with ecosystem config for cluster mode
if [ -f ecosystem.config.js ]; then
    pm2 start ecosystem.config.js
else
    # Fallback to direct start with cluster mode
    pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster --cwd "$APP_DIR/server" --env production
fi

pm2 save

# Cleanup old backups (keep last 5)
echo "🧹 Cleaning up old backups..."
cd "$DEPLOY_DIR"
ls -dt manufacturing-app-backup-* 2>/dev/null | tail -n +6 | xargs rm -rf || true

# Cleanup deployment files
rm -f deploy.tar.gz
rm -rf deploy

echo "✅ Deployment completed successfully!"
echo "📍 Application running at: http://$(hostname -I | awk '{print $1}')"
pm2 status

