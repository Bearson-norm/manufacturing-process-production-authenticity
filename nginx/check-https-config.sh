#!/bin/bash

# Check and show HTTPS configuration

CONFIG_FILE="/etc/nginx/sites-enabled/manufacturing-app"

echo "🔍 Checking HTTPS configuration..."
echo ""

# Check if HTTPS server block exists
if sudo grep -q "listen 443" "$CONFIG_FILE"; then
    echo "✅ HTTPS server block found"
    echo ""
    echo "📋 HTTPS server block content:"
    echo "---"
    sudo awk '/listen 443/,/^}/' "$CONFIG_FILE" | head -50
    echo "---"
    echo ""
    
    # Check for health endpoints
    if sudo awk '/listen 443/,/^}/ {if (/location.*health/) found=1} END {print found+0}' "$CONFIG_FILE" | grep -q "1"; then
        echo "✅ Health endpoints found in HTTPS block:"
        sudo awk '/listen 443/,/^}/ {if (/location.*health/) print}' "$CONFIG_FILE"
    else
        echo "⚠️  Health endpoints NOT found in HTTPS block"
        echo ""
        echo "To fix, run:"
        echo "   sudo ./fix-https-config.sh"
    fi
else
    echo "⚠️  HTTPS server block NOT found!"
    echo ""
    echo "Certbot may not have completed SSL setup."
    echo "Run: sudo certbot --nginx -d mpr.moof-set.web.id"
fi

echo ""
echo "📋 Testing endpoints:"
echo "   Backend direct:"
curl -s http://localhost:1234/health | head -1
echo ""
echo "   HTTPS /api/health (skip SSL verify):"
curl -sk https://mpr.moof-set.web.id/api/health 2>&1 | head -3
echo ""
echo "   HTTPS /health (skip SSL verify):"
curl -sk https://mpr.moof-set.web.id/health 2>&1 | head -3

