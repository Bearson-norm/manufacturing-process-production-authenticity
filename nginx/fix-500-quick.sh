#!/bin/bash

# Quick fix for 500 error - Permission issue

set -e

echo "🔧 Fixing 500 Internal Server Error..."
echo ""

CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"

# Check error log first
echo "📋 Checking Nginx error log:"
sudo tail -20 /var/log/nginx/manufacturing-app-error.log
echo ""

# Fix ownership and permissions
echo "🔧 Fixing permissions..."
if [ -d "$CLIENT_BUILD" ]; then
    # Change ownership to foom
    sudo chown -R foom:foom "$CLIENT_BUILD"
    
    # Set directory permissions (755)
    find "$CLIENT_BUILD" -type d -exec chmod 755 {} \;
    
    # Set file permissions (644)
    find "$CLIENT_BUILD" -type f -exec chmod 644 {} \;
    
    # Ensure nginx (www-data) can read
    sudo chmod -R o+r "$CLIENT_BUILD"
    sudo chmod o+x "$CLIENT_BUILD"
    sudo chmod o+x "$(dirname $CLIENT_BUILD)"
    
    echo "✅ Permissions fixed"
    echo ""
    echo "📁 Verifying:"
    ls -la "$CLIENT_BUILD" | head -5
    ls -la "$CLIENT_BUILD/index.html"
else
    echo "❌ Client build directory not found!"
    exit 1
fi

# Check Nginx config
echo ""
echo "🔍 Checking Nginx config after Certbot:"
sudo cat /etc/nginx/sites-enabled/manufacturing-app | grep -A 3 "root\|index" | head -10

# Reload Nginx
echo ""
echo "🔄 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ Done! Test with:"
echo "   curl -I https://mpr.moof-set.web.id"
echo "   curl https://mpr.moof-set.web.id/api/health"

