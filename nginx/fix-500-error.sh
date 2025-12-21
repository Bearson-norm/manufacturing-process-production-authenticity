#!/bin/bash

# Comprehensive fix for 500 Internal Server Error

set -e

echo "🔧 Fixing 500 Internal Server Error..."
echo ""

# Step 1: Check error logs
echo "📋 Step 1: Checking Nginx error logs..."
sudo tail -30 /var/log/nginx/manufacturing-app-error.log
echo ""

# Step 2: Check client-build directory
CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"
echo "📋 Step 2: Checking client-build directory..."
if [ -d "$CLIENT_BUILD" ]; then
    echo "✅ Directory exists"
    echo "   Current permissions:"
    ls -ld "$CLIENT_BUILD"
    echo ""
    if [ -f "$CLIENT_BUILD/index.html" ]; then
        echo "✅ index.html exists"
        ls -l "$CLIENT_BUILD/index.html"
    else
        echo "❌ index.html NOT FOUND!"
    fi
else
    echo "❌ Directory does NOT exist!"
    exit 1
fi

# Step 3: Fix permissions
echo ""
echo "📋 Step 3: Fixing permissions..."
sudo chown -R foom:foom "$CLIENT_BUILD"
find "$CLIENT_BUILD" -type d -exec chmod 755 {} \;
find "$CLIENT_BUILD" -type f -exec chmod 644 {} \;

# Ensure nginx can read
sudo chmod -R o+r "$CLIENT_BUILD"
sudo chmod o+x "$CLIENT_BUILD"
sudo chmod o+x "$(dirname $CLIENT_BUILD)"

echo "✅ Permissions fixed"
echo "   New permissions:"
ls -ld "$CLIENT_BUILD"
ls -l "$CLIENT_BUILD/index.html"

# Step 4: Check Nginx config
echo ""
echo "📋 Step 4: Checking Nginx config..."
ROOT_PATH=$(sudo grep -E "^\s*root\s+" /etc/nginx/sites-enabled/manufacturing-app | head -1 | awk '{print $2}' | tr -d ';')
echo "   Root path in config: $ROOT_PATH"
echo "   Actual path: $CLIENT_BUILD"

if [ "$ROOT_PATH" != "$CLIENT_BUILD" ]; then
    echo "⚠️  Path mismatch! Need to update Nginx config"
fi

# Step 5: Test and reload
echo ""
echo "📋 Step 5: Testing and reloading Nginx..."
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx config test failed!"
    exit 1
fi

# Step 6: Test endpoints
echo ""
echo "📋 Step 6: Testing endpoints..."
echo "   Testing HTTPS:"
curl -I https://mpr.moof-set.web.id 2>&1 | head -5
echo ""
echo "   Testing API health:"
curl https://mpr.moof-set.web.id/api/health 2>&1 | head -5

echo ""
echo "✅ Fix completed!"
