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
echo "   Testing /api/health via Nginx (HTTP):"
API_HEALTH_HTTP=$(curl -s http://mpr.moof-set.web.id/api/health 2>/dev/null || echo "ERROR")
if echo "$API_HEALTH_HTTP" | grep -q "healthy"; then
    echo "   ✅ Nginx /api/health (HTTP): OK"
    echo "   Response: $(echo $API_HEALTH_HTTP | head -c 100)..."
else
    echo "   ⚠️  Nginx /api/health (HTTP): $API_HEALTH_HTTP"
fi

echo ""
echo "   Testing /api/health via Nginx (HTTPS, skip SSL verify):"
API_HEALTH_HTTPS=$(curl -sk https://mpr.moof-set.web.id/api/health 2>/dev/null || echo "ERROR")
if echo "$API_HEALTH_HTTPS" | grep -q "healthy"; then
    echo "   ✅ Nginx /api/health (HTTPS): OK"
    echo "   Response: $(echo $API_HEALTH_HTTPS | head -c 100)..."
else
    echo "   ⚠️  Nginx /api/health (HTTPS): $API_HEALTH_HTTPS"
fi

echo ""
echo "   Testing /health via Nginx (HTTP):"
HEALTH_VIA_NGINX_HTTP=$(curl -s http://mpr.moof-set.web.id/health 2>/dev/null || echo "ERROR")
if echo "$HEALTH_VIA_NGINX_HTTP" | grep -q "healthy"; then
    echo "   ✅ Nginx /health (HTTP): OK"
else
    echo "   ⚠️  Nginx /health (HTTP): $HEALTH_VIA_NGINX_HTTP"
fi

echo ""
echo "   Testing /health via Nginx (HTTPS, skip SSL verify):"
HEALTH_VIA_NGINX_HTTPS=$(curl -sk https://mpr.moof-set.web.id/health 2>/dev/null || echo "ERROR")
if echo "$HEALTH_VIA_NGINX_HTTPS" | grep -q "healthy"; then
    echo "   ✅ Nginx /health (HTTPS): OK"
else
    echo "   ⚠️  Nginx /health (HTTPS): $HEALTH_VIA_NGINX_HTTPS"
fi

echo ""
echo "✅ Fix completed!"
echo ""
echo "Test manually:"
echo "   curl -k https://mpr.moof-set.web.id/api/health  # Skip SSL verify"
echo "   curl -k https://mpr.moof-set.web.id/health      # Skip SSL verify"
echo "   curl http://mpr.moof-set.web.id/api/health      # HTTP (will redirect to HTTPS)"
echo "   curl http://localhost:1234/health                # Direct backend"

