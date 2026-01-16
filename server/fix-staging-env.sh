#!/bin/bash

# Script to fix staging .env file with correct database credentials
# Run this on the VPS in the staging deployment directory

STAGING_DIR="/home/$(whoami)/deployments/manufacturing-app-staging/server"

if [ ! -d "$STAGING_DIR" ]; then
    echo "❌ ERROR: Staging directory not found: $STAGING_DIR"
    exit 1
fi

cd "$STAGING_DIR" || exit 1

echo "🔧 Fixing staging .env file..."
echo "📍 Directory: $(pwd)"

# Backup existing .env
if [ -f .env ]; then
    cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
    echo "✅ Backed up existing .env"
fi

# Update or create .env with correct values
echo "📝 Updating .env file..."

# Ensure all required variables are set
grep -q "^NODE_ENV=" .env 2>/dev/null && sed -i 's/^NODE_ENV=.*/NODE_ENV=staging/' .env || echo "NODE_ENV=staging" >> .env
grep -q "^PORT=" .env 2>/dev/null && sed -i 's/^PORT=.*/PORT=5678/' .env || echo "PORT=5678" >> .env
grep -q "^DB_HOST=" .env 2>/dev/null && sed -i 's/^DB_HOST=.*/DB_HOST=localhost/' .env || echo "DB_HOST=localhost" >> .env
grep -q "^DB_PORT=" .env 2>/dev/null && sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
grep -q "^DB_NAME=" .env 2>/dev/null && sed -i 's/^DB_NAME=.*/DB_NAME=manufacturing_db/' .env || echo "DB_NAME=manufacturing_db" >> .env
grep -q "^DB_USER=" .env 2>/dev/null && sed -i 's/^DB_USER=.*/DB_USER=admin/' .env || echo "DB_USER=admin" >> .env
grep -q "^DB_PASSWORD=" .env 2>/dev/null && sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=Admin123/' .env || echo "DB_PASSWORD=Admin123" >> .env

echo "✅ .env file updated"
echo ""
echo "📋 Current .env content:"
cat .env

echo ""
echo "🔄 Restarting staging app with PM2..."
pm2 restart manufacturing-app-staging || pm2 start ecosystem.config.js --only manufacturing-app-staging

echo ""
echo "⏳ Waiting 3 seconds..."
sleep 3

echo "📊 PM2 Status:"
pm2 status | grep manufacturing-app-staging

echo ""
echo "📋 Checking logs for errors..."
pm2 logs manufacturing-app-staging --err --lines 10 --nostream

echo ""
echo "✅ Done! Check if the app is running correctly."
