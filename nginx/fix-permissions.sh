#!/bin/bash

# Script to fix permissions for Nginx

set -e

echo "🔧 Fixing permissions for Manufacturing App..."
echo ""

DEPLOY_DIR="/home/foom/deployments/manufacturing-app"
CLIENT_BUILD="$DEPLOY_DIR/client-build"

# Check if directory exists
if [ ! -d "$DEPLOY_DIR" ]; then
    echo "❌ Deployment directory not found: $DEPLOY_DIR"
    echo "   Please deploy the app first"
    exit 1
fi

# Fix ownership
echo "📝 Setting ownership..."
sudo chown -R foom:foom "$DEPLOY_DIR"

# Fix permissions
echo "📝 Setting permissions..."
# Directories: 755
find "$DEPLOY_DIR" -type d -exec chmod 755 {} \;
# Files: 644
find "$DEPLOY_DIR" -type f -exec chmod 644 {} \;
# Make scripts executable
find "$DEPLOY_DIR" -name "*.sh" -exec chmod 755 {} \;

# Ensure nginx can read
echo "📝 Ensuring Nginx can read files..."
# Nginx runs as www-data, so we need to make files readable
sudo chmod -R o+r "$CLIENT_BUILD" 2>/dev/null || true
sudo chmod o+x "$DEPLOY_DIR" 2>/dev/null || true
sudo chmod o+x "$CLIENT_BUILD" 2>/dev/null || true

# Check if index.html exists
if [ ! -f "$CLIENT_BUILD/index.html" ]; then
    echo "⚠️  index.html not found in $CLIENT_BUILD"
    echo ""
    echo "💡 Building client..."
    if [ -d "/var/www/manufacturing-process-production-authenticity/client" ]; then
        cd /var/www/manufacturing-process-production-authenticity/client
        npm install
        npm run build
        cp -r build/* "$CLIENT_BUILD/"
        echo "✅ Client built and copied"
    else
        echo "❌ Client directory not found. Please build manually."
    fi
fi

echo ""
echo "✅ Permissions fixed!"
echo ""
echo "🔍 Verifying:"
ls -la "$CLIENT_BUILD" | head -5


