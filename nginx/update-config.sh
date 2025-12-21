#!/bin/bash

# Script to update Nginx config with correct location block order

set -e

CONFIG_FILE="/etc/nginx/sites-available/manufacturing-app"
BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d-%H%M%S)"

echo "🔄 Updating Nginx configuration..."

# Backup existing config
if [ -f "$CONFIG_FILE" ]; then
    echo "📦 Creating backup..."
    sudo cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo "✅ Backup created: $BACKUP_FILE"
fi

# Check if config needs update
if grep -q "location = /api/health" "$CONFIG_FILE" 2>/dev/null; then
    echo "✅ Config already has correct location blocks"
else
    echo "📝 Config needs update - please update manually or re-run setup-nginx.sh"
    echo "   The config file location blocks need to be in correct order:"
    echo "   1. location = /health (exact match)"
    echo "   2. location = /api/health (exact match)"
    echo "   3. location /api (prefix match)"
    echo "   4. location / (catch-all for React Router)"
fi

# Test config
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
    echo ""
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded"
else
    echo "❌ Nginx configuration has errors!"
    echo "   Restore backup: sudo cp $BACKUP_FILE $CONFIG_FILE"
    exit 1
fi

echo ""
echo "✅ Configuration updated!"
echo ""
echo "🧪 Test endpoints:"
echo "   curl http://mpr.moof-set.web.id/health"
echo "   curl http://mpr.moof-set.web.id/api/health"
echo "   curl http://mpr.moof-set.web.id/api/login -X POST -H 'Content-Type: application/json' -d '{\"username\":\"production\",\"password\":\"production123\"}'"

