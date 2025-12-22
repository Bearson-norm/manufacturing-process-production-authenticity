#!/bin/bash

# Complete fix for permission issues - fixes ALL parent directories

set -e

echo "🔧 Fixing ALL permission issues..."
echo ""

CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"
DEPLOY_DIR="/home/foom/deployments/manufacturing-app"
DEPLOYMENTS_DIR="/home/foom/deployments"
HOME_FOOM="/home/foom"

# Step 1: Fix ownership of parent directories
echo "📋 Step 1: Fixing ownership of parent directories..."
echo "   Fixing: $DEPLOY_DIR"
sudo chown -R foom:foom "$DEPLOY_DIR"
sudo chmod 755 "$DEPLOY_DIR"

echo "   Fixing: $DEPLOYMENTS_DIR"
sudo chown -R foom:foom "$DEPLOYMENTS_DIR" 2>/dev/null || true
sudo chmod 755 "$DEPLOYMENTS_DIR"

echo "   Ensuring: $HOME_FOOM is accessible"
sudo chmod 755 "$HOME_FOOM"

# Step 2: Fix client-build directory
echo ""
echo "📋 Step 2: Fixing client-build directory..."
if [ -d "$CLIENT_BUILD" ]; then
    sudo chown -R foom:foom "$CLIENT_BUILD"
    sudo find "$CLIENT_BUILD" -type d -exec chmod 755 {} \;
    sudo find "$CLIENT_BUILD" -type f -exec chmod 644 {} \;
    
    # Ensure www-data (nginx) can read
    sudo chmod -R o+r "$CLIENT_BUILD"
    sudo chmod o+x "$CLIENT_BUILD"
    sudo chmod o+x "$DEPLOY_DIR"
    sudo chmod o+x "$DEPLOYMENTS_DIR"
    sudo chmod o+x "$HOME_FOOM"
    
    echo "✅ Client-build permissions fixed"
else
    echo "❌ Client build directory not found!"
    exit 1
fi

# Step 3: Verify permissions
echo ""
echo "📋 Step 3: Verifying permissions..."
echo "   Parent directories:"
ls -ld "$HOME_FOOM" "$DEPLOYMENTS_DIR" "$DEPLOY_DIR" "$CLIENT_BUILD" 2>/dev/null | awk '{print $1, $3, $4, $9}'

echo ""
echo "   Client-build contents:"
ls -la "$CLIENT_BUILD" | head -5

# Step 4: Test as www-data user
echo ""
echo "📋 Step 4: Testing access as www-data..."
if sudo -u www-data test -r "$CLIENT_BUILD/index.html"; then
    echo "✅ www-data can read index.html"
else
    echo "❌ www-data CANNOT read index.html!"
    echo "   Trying alternative: set ACL or move to /var/www"
    exit 1
fi

# Step 5: Reload Nginx
echo ""
echo "📋 Step 5: Reloading Nginx..."
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
echo "   Testing HTTPS root:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://mpr.moof-set.web.id || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ HTTPS root: $HTTP_CODE"
else
    echo "   ⚠️  HTTPS root: $HTTP_CODE (expected 200)"
fi

echo ""
echo "   Testing API health:"
HEALTH_RESPONSE=$(curl -s https://mpr.moof-set.web.id/api/health || echo "ERROR")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ API health: OK"
    echo "   Response: $(echo $HEALTH_RESPONSE | head -c 100)..."
else
    echo "   ⚠️  API health: $HEALTH_RESPONSE"
fi

echo ""
echo "✅ Complete fix finished!"
echo ""
echo "If still getting 500 error, check:"
echo "   sudo tail -50 /var/log/nginx/manufacturing-app-error.log"


