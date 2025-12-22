#!/bin/bash

# Fix API health endpoint routing issue

set -e

echo "🔧 Fixing API health endpoint..."
echo ""

# Check current Nginx config
echo "📋 Checking current Nginx config..."
if sudo grep -q "location = /api/health" /etc/nginx/sites-enabled/manufacturing-app; then
    echo "✅ Config already updated"
else
    echo "⚠️  Config needs update"
    echo "   Copying updated config..."
    sudo cp /var/www/manufacturing-process-production-authenticity/nginx/manufacturing-app.conf /etc/nginx/sites-enabled/manufacturing-app
    echo "✅ Config updated"
fi

# Test Nginx config
echo ""
echo "📋 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx config is valid"
else
    echo "❌ Nginx config test failed!"
    exit 1
fi

# Reload Nginx
echo ""
echo "📋 Reloading Nginx..."
sudo systemctl reload nginx
echo "✅ Nginx reloaded"

# Test endpoints
echo ""
echo "📋 Testing endpoints..."
echo "   Testing /health:"
HEALTH_RESPONSE=$(curl -s http://localhost:1234/health || echo "ERROR")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Backend /health: OK"
else
    echo "   ⚠️  Backend /health: $HEALTH_RESPONSE"
fi

echo ""
echo "   Testing /api/health via Nginx:"
API_HEALTH_RESPONSE=$(curl -s https://mpr.moof-set.web.id/api/health || echo "ERROR")
if echo "$API_HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "   ✅ Nginx /api/health: OK"
    echo "   Response: $(echo $API_HEALTH_RESPONSE | head -c 100)..."
else
    echo "   ⚠️  Nginx /api/health: $API_HEALTH_RESPONSE"
fi

echo ""
echo "   Testing /health via Nginx:"
HEALTH_VIA_NGINX=$(curl -s https://mpr.moof-set.web.id/health || echo "ERROR")
if echo "$HEALTH_VIA_NGINX" | grep -q "healthy"; then
    echo "   ✅ Nginx /health: OK"
else
    echo "   ⚠️  Nginx /health: $HEALTH_VIA_NGINX"
fi

echo ""
echo "✅ Fix completed!"
echo ""
echo "Test manually:"
echo "   curl https://mpr.moof-set.web.id/api/health"
echo "   curl https://mpr.moof-set.web.id/health"

