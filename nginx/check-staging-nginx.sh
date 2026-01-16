#!/bin/bash

# Script to check and fix staging nginx configuration

echo "🔍 Checking staging nginx configuration..."
echo ""

# Check if staging config exists
STAGING_CONF="/etc/nginx/sites-available/manufacturing-app-staging.conf"
STAGING_ENABLED="/etc/nginx/sites-enabled/manufacturing-app-staging.conf"
STAGING_CLIENT_BUILD="/home/foom/deployments/manufacturing-app-staging/client-build"

echo "📋 Step 1: Check nginx config files"
if [ -f "$STAGING_CONF" ]; then
    echo "   ✅ Config exists: $STAGING_CONF"
else
    echo "   ❌ Config NOT found: $STAGING_CONF"
    echo "   💡 Need to copy from nginx/manufacturing-app-staging.conf"
fi

if [ -L "$STAGING_ENABLED" ] || [ -f "$STAGING_ENABLED" ]; then
    echo "   ✅ Config is enabled: $STAGING_ENABLED"
else
    echo "   ❌ Config is NOT enabled"
    echo "   💡 Need to create symlink: sudo ln -s $STAGING_CONF $STAGING_ENABLED"
fi

echo ""
echo "📋 Step 2: Check client-build directory"
if [ -d "$STAGING_CLIENT_BUILD" ]; then
    echo "   ✅ Directory exists: $STAGING_CLIENT_BUILD"
    if [ -f "$STAGING_CLIENT_BUILD/index.html" ]; then
        echo "   ✅ index.html exists"
        echo "   📊 Directory contents:"
        ls -la "$STAGING_CLIENT_BUILD" | head -10
    else
        echo "   ❌ index.html NOT found!"
    fi
else
    echo "   ❌ Directory NOT found: $STAGING_CLIENT_BUILD"
    echo "   💡 Need to copy client/build to this location"
fi

echo ""
echo "📋 Step 3: Check nginx syntax"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Nginx configuration is valid"
else
    echo "   ❌ Nginx configuration has errors:"
    sudo nginx -t
fi

echo ""
echo "📋 Step 4: Check for conflicting server blocks"
echo "   Checking for default_server or catch-all:"
sudo grep -r "default_server\|server_name _" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^#" | head -5

echo ""
echo "📋 Step 5: Check staging domain configuration"
echo "   Server names configured for staging:"
sudo grep -r "staging.mpr.moof-set.web.id" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null

echo ""
echo "📋 Step 6: Check if nginx is running staging on port 80"
echo "   Active nginx server blocks:"
sudo nginx -T 2>/dev/null | grep -A 3 "server_name.*staging" | head -10

echo ""
echo "✅ Check complete!"
echo ""
echo "🔧 To fix issues, run:"
echo "   1. Copy config: sudo cp nginx/manufacturing-app-staging.conf /etc/nginx/sites-available/"
echo "   2. Enable config: sudo ln -s /etc/nginx/sites-available/manufacturing-app-staging.conf /etc/nginx/sites-enabled/"
echo "   3. Ensure client-build exists: ls -la $STAGING_CLIENT_BUILD"
echo "   4. Test config: sudo nginx -t"
echo "   5. Reload nginx: sudo systemctl reload nginx"
