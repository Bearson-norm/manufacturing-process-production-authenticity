#!/bin/bash

# Script to fix staging nginx configuration
# This ensures staging.mpr.moof-set.web.id works correctly

set -e

echo "🔧 Fixing staging nginx configuration..."
echo ""

STAGING_CONF_SOURCE="$(dirname "$0")/manufacturing-app-staging.conf"
STAGING_CONF="/etc/nginx/sites-available/manufacturing-app-staging.conf"
STAGING_ENABLED="/etc/nginx/sites-enabled/manufacturing-app-staging.conf"
STAGING_DIR="/home/$(whoami)/deployments/manufacturing-app-staging"
STAGING_CLIENT_BUILD="$STAGING_DIR/client-build"

# Step 1: Copy nginx config if needed
echo "📋 Step 1: Setting up nginx config"
if [ ! -f "$STAGING_CONF" ]; then
    if [ -f "$STAGING_CONF_SOURCE" ]; then
        echo "   Copying nginx config..."
        sudo cp "$STAGING_CONF_SOURCE" "$STAGING_CONF"
        echo "   ✅ Config copied"
    else
        echo "   ❌ ERROR: Source config not found: $STAGING_CONF_SOURCE"
        echo "   💡 Make sure you're running this from the project root or nginx directory"
        exit 1
    fi
else
    echo "   ✅ Config already exists"
fi

# Step 2: Enable config
echo ""
echo "📋 Step 2: Enabling nginx config"
if [ ! -L "$STAGING_ENABLED" ] && [ ! -f "$STAGING_ENABLED" ]; then
    echo "   Creating symlink..."
    sudo ln -s "$STAGING_CONF" "$STAGING_ENABLED"
    echo "   ✅ Config enabled"
else
    echo "   ✅ Config already enabled"
fi

# Step 3: Check client-build directory
echo ""
echo "📋 Step 3: Checking client-build directory"
if [ ! -d "$STAGING_CLIENT_BUILD" ]; then
    echo "   ❌ WARNING: client-build directory not found: $STAGING_CLIENT_BUILD"
    echo "   💡 This needs to be created during deployment"
    echo "   💡 Expected location: $STAGING_CLIENT_BUILD"
    echo "   💡 Should contain: index.html and other React build files"
else
    echo "   ✅ Directory exists: $STAGING_CLIENT_BUILD"
    if [ -f "$STAGING_CLIENT_BUILD/index.html" ]; then
        echo "   ✅ index.html found"
        FILE_COUNT=$(find "$STAGING_CLIENT_BUILD" -type f | wc -l)
        echo "   📊 Files in directory: $FILE_COUNT"
    else
        echo "   ❌ WARNING: index.html not found in client-build"
    fi
fi

# Step 4: Fix permissions
echo ""
echo "📋 Step 4: Fixing permissions"
if [ -d "$STAGING_CLIENT_BUILD" ]; then
    echo "   Setting permissions for client-build..."
    sudo chown -R $(whoami):$(whoami) "$STAGING_CLIENT_BUILD" 2>/dev/null || true
    sudo find "$STAGING_CLIENT_BUILD" -type d -exec chmod 755 {} \; 2>/dev/null || true
    sudo find "$STAGING_CLIENT_BUILD" -type f -exec chmod 644 {} \; 2>/dev/null || true
    sudo chmod -R o+r "$STAGING_CLIENT_BUILD" 2>/dev/null || true
    sudo chmod o+x "$STAGING_CLIENT_BUILD" 2>/dev/null || true
    echo "   ✅ Permissions fixed"
fi

# Step 5: Test nginx config
echo ""
echo "📋 Step 5: Testing nginx configuration"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Nginx configuration is valid"
else
    echo "   ❌ ERROR: Nginx configuration has errors:"
    sudo nginx -t
    exit 1
fi

# Step 6: Reload nginx
echo ""
echo "📋 Step 6: Reloading nginx"
sudo systemctl reload nginx
echo "   ✅ Nginx reloaded"

echo ""
echo "✅ Staging nginx configuration fixed!"
echo ""
echo "📋 Summary:"
echo "   Config file: $STAGING_CONF"
echo "   Enabled: $STAGING_ENABLED"
echo "   Client build: $STAGING_CLIENT_BUILD"
echo ""
echo "🌐 Test staging domain:"
echo "   http://staging.mpr.moof-set.web.id"
echo "   http://stg.mpr.moof-set.web.id"
echo ""
echo "🔍 If still having issues, check:"
echo "   1. DNS points to this server: dig staging.mpr.moof-set.web.id"
echo "   2. Nginx logs: sudo tail -f /var/log/nginx/manufacturing-app-staging-error.log"
echo "   3. Client build exists: ls -la $STAGING_CLIENT_BUILD"
