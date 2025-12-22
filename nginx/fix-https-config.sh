#!/bin/bash

# Fix HTTPS server block to include health endpoints
# Certbot adds HTTPS block but may not include all location blocks

set -e

CONFIG_FILE="/etc/nginx/sites-enabled/manufacturing-app"
BACKUP_FILE="/etc/nginx/sites-enabled/manufacturing-app.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Fixing HTTPS configuration..."
echo ""

# Check if HTTPS server block exists
if ! sudo grep -q "listen 443" "$CONFIG_FILE"; then
    echo "⚠️  HTTPS server block not found!"
    echo "   Certbot may not have completed SSL setup."
    echo "   Run: sudo certbot --nginx -d mpr.moof-set.web.id"
    exit 1
fi

echo "✅ HTTPS server block found"
echo ""

# Backup config
echo "📋 Creating backup..."
sudo cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "   Backup saved to: $BACKUP_FILE"
echo ""

# Check if health endpoints exist in HTTPS block
HTTPS_HAS_HEALTH=$(sudo awk '/listen 443/,/^}/ {if (/location = \/health/ || /location = \/api\/health/) found=1} END {print found+0}' "$CONFIG_FILE")

if [ "$HTTPS_HAS_HEALTH" = "1" ]; then
    echo "✅ Health endpoints already exist in HTTPS block"
    echo ""
    echo "📋 Current HTTPS health endpoints:"
    sudo awk '/listen 443/,/^}/ {if (/location.*health/) print}' "$CONFIG_FILE"
    echo ""
else
    echo "⚠️  Health endpoints missing in HTTPS block"
    echo "   Adding health endpoints to HTTPS block..."
    echo ""
    
    # Create temp file with health endpoints
    TEMP_FILE=$(mktemp)
    
    # Extract HTTPS server block and add health endpoints after root/index
    sudo awk '
    BEGIN { in_https = 0; health_added = 0 }
    /listen 443/ { in_https = 1 }
    in_https && /^\s*index index.html;/ && !health_added {
        print $0
        print ""
        print "    # Health check endpoint (direct to backend)"
        print "    # Using exact match (=) to ensure it takes precedence"
        print "    location = /health {"
        print "        proxy_pass http://127.0.0.1:1234/health;"
        print "        proxy_set_header Host $host;"
        print "        access_log off;"
        print "    }"
        print ""
        print "    location = /api/health {"
        print "        proxy_pass http://127.0.0.1:1234/health;"
        print "        proxy_set_header Host $host;"
        print "        access_log off;"
        print "    }"
        print ""
        health_added = 1
        next
    }
    { print }
    ' "$CONFIG_FILE" > "$TEMP_FILE"
    
    # Replace config file
    sudo mv "$TEMP_FILE" "$CONFIG_FILE"
    echo "✅ Health endpoints added to HTTPS block"
    echo ""
fi

# Test Nginx config
echo "📋 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx config is valid"
else
    echo "❌ Nginx config test failed!"
    echo "   Restoring backup..."
    sudo mv "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

# Reload Nginx
echo ""
echo "📋 Reloading Nginx..."
sudo systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# Test endpoints
echo "📋 Testing endpoints..."
echo "   Testing HTTPS /api/health (skip SSL verify):"
API_HEALTH=$(curl -sk https://mpr.moof-set.web.id/api/health 2>/dev/null || echo "ERROR")
if echo "$API_HEALTH" | grep -q "healthy"; then
    echo "   ✅ HTTPS /api/health: OK"
    echo "   Response: $(echo $API_HEALTH | head -c 80)..."
else
    echo "   ⚠️  HTTPS /api/health: $API_HEALTH"
fi

echo ""
echo "   Testing HTTPS /health (skip SSL verify):"
HEALTH=$(curl -sk https://mpr.moof-set.web.id/health 2>/dev/null || echo "ERROR")
if echo "$HEALTH" | grep -q "healthy"; then
    echo "   ✅ HTTPS /health: OK"
    echo "   Response: $(echo $HEALTH | head -c 80)..."
else
    echo "   ⚠️  HTTPS /health: $HEALTH"
fi

echo ""
echo "✅ Fix completed!"
echo ""
echo "If endpoints still don't work, check:"
echo "   sudo tail -20 /var/log/nginx/manufacturing-app-error.log"

