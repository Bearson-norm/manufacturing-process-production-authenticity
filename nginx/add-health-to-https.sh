#!/bin/bash

# Add health endpoints to HTTPS server block if missing

set -e

CONFIG_FILE="/etc/nginx/sites-enabled/manufacturing-app"
BACKUP_FILE="/etc/nginx/sites-enabled/manufacturing-app.backup.$(date +%Y%m%d_%H%M%S)"

echo "🔧 Adding health endpoints to HTTPS block..."
echo ""

# Check if HTTPS server block exists
if ! sudo grep -q "listen 443" "$CONFIG_FILE"; then
    echo "❌ HTTPS server block not found!"
    echo "   Run: sudo certbot --nginx -d mpr.moof-set.web.id"
    exit 1
fi

# Check if already has health endpoints
if sudo awk '/listen 443/,/^}/ {if (/location = \/health/) found=1} END {print found+0}' "$CONFIG_FILE" | grep -q "1"; then
    echo "✅ Health endpoints already exist in HTTPS block"
    exit 0
fi

# Backup
echo "📋 Creating backup..."
sudo cp "$CONFIG_FILE" "$BACKUP_FILE"
echo "   Backup: $BACKUP_FILE"
echo ""

# Find line number where to insert (after "index index.html;" in HTTPS block)
INSERT_LINE=$(sudo awk '/listen 443/,/^}/ {if (/^\s*index index.html;/) {print NR; exit}}' "$CONFIG_FILE")

if [ -z "$INSERT_LINE" ]; then
    echo "❌ Could not find insertion point (index index.html in HTTPS block)"
    exit 1
fi

echo "📋 Found insertion point at line $INSERT_LINE"
echo ""

# Create health endpoints block
HEALTH_BLOCK=$(cat <<'EOF'
    # Health check endpoint (direct to backend)
    # Using exact match (=) to ensure it takes precedence
    location = /health {
        proxy_pass http://127.0.0.1:1234/health;
        proxy_set_header Host $host;
        access_log off;
    }
    
    location = /api/health {
        proxy_pass http://127.0.0.1:1234/health;
        proxy_set_header Host $host;
        access_log off;
    }

EOF
)

# Insert health endpoints after index line
echo "📋 Adding health endpoints..."
sudo sed -i "${INSERT_LINE}a\\${HEALTH_BLOCK}" "$CONFIG_FILE"
echo "✅ Health endpoints added"
echo ""

# Test config
echo "📋 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx config is valid"
else
    echo "❌ Nginx config test failed!"
    echo "   Restoring backup..."
    sudo mv "$BACKUP_FILE" "$CONFIG_FILE"
    exit 1
fi

# Reload
echo ""
echo "📋 Reloading Nginx..."
sudo systemctl reload nginx
echo "✅ Nginx reloaded"
echo ""

# Test
echo "📋 Testing endpoints..."
curl -sk https://mpr.moof-set.web.id/api/health 2>/dev/null | head -1 && echo "✅ /api/health works" || echo "⚠️  /api/health failed"
curl -sk https://mpr.moof-set.web.id/health 2>/dev/null | head -1 && echo "✅ /health works" || echo "⚠️  /health failed"

echo ""
echo "✅ Done!"

