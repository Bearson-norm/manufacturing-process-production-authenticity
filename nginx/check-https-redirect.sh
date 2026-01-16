#!/bin/bash

# Script to check for HTTPS redirects that might affect staging

echo "🔍 Checking for HTTPS redirects and SSL configuration..."
echo ""

# Check production config for redirects
echo "📋 Step 1: Check production nginx config for redirects"
PROD_CONF="/etc/nginx/sites-enabled/manufacturing-app.conf"
if [ -f "$PROD_CONF" ] || [ -L "$PROD_CONF" ]; then
    echo "   Checking $PROD_CONF:"
    if sudo grep -q "return 301 https" "$PROD_CONF" 2>/dev/null; then
        echo "   ⚠️  Found HTTPS redirect in production config"
        sudo grep "return 301 https" "$PROD_CONF" | head -3
    else
        echo "   ✅ No redirect found in production config"
    fi
    
    # Check if production has HTTPS block
    if sudo grep -q "listen 443" "$PROD_CONF" 2>/dev/null; then
        echo "   ✅ Production has HTTPS (port 443) configured"
    else
        echo "   ℹ️  Production doesn't have HTTPS block yet"
    fi
else
    echo "   ℹ️  Production config not found"
fi

echo ""
echo "📋 Step 2: Check staging config"
STAGING_CONF="/etc/nginx/sites-enabled/manufacturing-app-staging.conf"
if [ -f "$STAGING_CONF" ] || [ -L "$STAGING_CONF" ]; then
    echo "   Checking $STAGING_CONF:"
    if sudo grep -q "return 301 https" "$STAGING_CONF" 2>/dev/null; then
        echo "   ⚠️  Found HTTPS redirect in staging config"
        sudo grep "return 301 https" "$STAGING_CONF"
    else
        echo "   ✅ No redirect in staging config (correct for HTTP)"
    fi
    
    if sudo grep -q "listen 443" "$STAGING_CONF" 2>/dev/null; then
        echo "   ✅ Staging has HTTPS configured"
    else
        echo "   ℹ️  Staging only has HTTP (port 80) - this is OK if SSL not set up yet"
    fi
else
    echo "   ❌ Staging config not found or not enabled"
fi

echo ""
echo "📋 Step 3: Check for default_server or catch-all"
if sudo grep -r "default_server\|server_name _" /etc/nginx/sites-enabled/ 2>/dev/null | grep -v "^#" | grep -v "^$"; then
    echo "   ⚠️  Found default_server or catch-all - this might redirect staging"
else
    echo "   ✅ No default_server found"
fi

echo ""
echo "📋 Step 4: Check active nginx server blocks"
echo "   Server blocks listening on port 80:"
sudo nginx -T 2>/dev/null | grep -A 2 "listen.*80" | grep -E "listen|server_name" | head -10

echo ""
echo "📋 Step 5: Test staging domain (from server)"
echo "   Testing HTTP request to staging:"
curl -I -H "Host: staging.mpr.moof-set.web.id" http://localhost 2>&1 | head -10

echo ""
echo "✅ Check complete!"
echo ""
echo "💡 If staging redirects to HTTPS but SSL not set up:"
echo "   1. Setup SSL for staging: sudo certbot --nginx -d staging.mpr.moof-set.web.id"
echo "   2. Or ensure staging HTTP config takes precedence"
echo ""
echo "💡 If production redirects all HTTP to HTTPS:"
echo "   This is normal, but staging should have its own server block that doesn't redirect"
