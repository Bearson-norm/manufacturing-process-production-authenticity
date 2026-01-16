#!/bin/bash

# Script to verify staging deployment and clear caches

set -e

STAGING_DIR="/home/foom/deployments/manufacturing-app-staging"
STAGING_PORT=5678

echo "🔍 Verifying staging deployment..."

# Check if staging directory exists
if [ ! -d "$STAGING_DIR" ]; then
    echo "❌ ERROR: Staging directory not found: $STAGING_DIR"
    exit 1
fi

# Check if client-build exists
if [ ! -d "$STAGING_DIR/client-build" ]; then
    echo "❌ ERROR: client-build directory not found"
    exit 1
fi

# Check if index.html exists
if [ ! -f "$STAGING_DIR/client-build/index.html" ]; then
    echo "❌ ERROR: index.html not found in client-build"
    exit 1
fi

# Check file timestamps
echo "📅 Checking file timestamps..."
echo "   index.html: $(stat -c %y $STAGING_DIR/client-build/index.html)"
echo "   static/js files: $(ls -lt $STAGING_DIR/client-build/static/js/*.js 2>/dev/null | head -1 | awk '{print $6, $7, $8}')"
echo "   static/css files: $(ls -lt $STAGING_DIR/client-build/static/css/*.css 2>/dev/null | head -1 | awk '{print $6, $7, $8}')"

# Check PM2 process
echo "📊 Checking PM2 process..."
pm2 list | grep manufacturing-app-staging || echo "⚠️  PM2 process not found"

# Check if server is responding
echo "🏥 Checking server health..."
HEALTH=$(curl -s http://localhost:$STAGING_PORT/health || echo "failed")
if echo "$HEALTH" | grep -q "healthy"; then
    echo "   ✅ Server is healthy"
else
    echo "   ⚠️  Server health check failed: $HEALTH"
fi

# Clear nginx cache (if any)
echo "🧹 Clearing nginx cache..."
sudo rm -rf /var/cache/nginx/* 2>/dev/null || true
sudo systemctl reload nginx
echo "   ✅ Nginx cache cleared and reloaded"

# Check nginx config
echo "📋 Checking nginx config..."
if [ -f "/etc/nginx/sites-enabled/manufacturing-app-staging.conf" ]; then
    echo "   ✅ Nginx config exists"
    # Check cache headers in config
    if grep -q "no-cache" /etc/nginx/sites-enabled/manufacturing-app-staging.conf; then
        echo "   ✅ Nginx config has no-cache headers"
    else
        echo "   ⚠️  Nginx config may have caching enabled"
    fi
else
    echo "   ⚠️  Nginx config not found"
fi

# List recent files in client-build
echo "📁 Recent files in client-build:"
ls -lt $STAGING_DIR/client-build/static/js/*.js 2>/dev/null | head -3
ls -lt $STAGING_DIR/client-build/static/css/*.css 2>/dev/null | head -3

echo ""
echo "✅ Verification complete!"
echo "💡 If files are old, check:"
echo "   1. GitHub Actions deployment logs"
echo "   2. PM2 logs: pm2 logs manufacturing-app-staging"
echo "   3. Nginx logs: sudo tail -f /var/log/nginx/manufacturing-app-staging-error.log"
