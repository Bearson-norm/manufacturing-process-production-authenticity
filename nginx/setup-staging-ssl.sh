#!/bin/bash

# Script to setup SSL/HTTPS for staging domain
# This will use Let's Encrypt (Certbot) to get SSL certificate

set -e

echo "🔒 Setting up SSL/HTTPS for staging domain..."
echo ""

STAGING_DOMAIN="staging.mpr.moof-set.web.id"
STAGING_CONF="/etc/nginx/sites-available/manufacturing-app-staging.conf"

# Check if nginx config exists
if [ ! -f "$STAGING_CONF" ]; then
    echo "❌ ERROR: Staging nginx config not found: $STAGING_CONF"
    echo "   Please setup nginx config first"
    exit 1
fi

# Check if config is enabled
STAGING_ENABLED="/etc/nginx/sites-enabled/manufacturing-app-staging.conf"
if [ ! -L "$STAGING_ENABLED" ] && [ ! -f "$STAGING_ENABLED" ]; then
    echo "⚠️  Staging config not enabled, enabling now..."
    sudo ln -s "$STAGING_CONF" "$STAGING_ENABLED"
fi

# Test nginx config
echo "📋 Testing nginx configuration..."
if ! sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "❌ ERROR: Nginx configuration has errors:"
    sudo nginx -t
    exit 1
fi

# Reload nginx to ensure staging config is active
echo "📋 Reloading nginx..."
sudo systemctl reload nginx

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "📦 Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Run certbot for staging domain
echo ""
echo "🔒 Running Certbot for staging domain: $STAGING_DOMAIN"
echo "   This will:"
echo "   1. Get SSL certificate from Let's Encrypt"
echo "   2. Automatically configure HTTPS in nginx"
echo "   3. Add redirect from HTTP to HTTPS"
echo ""

sudo certbot --nginx -d "$STAGING_DOMAIN" --non-interactive --agree-tos --email admin@moof-set.web.id || {
    echo ""
    echo "⚠️  Certbot failed. This might be because:"
    echo "   1. Domain DNS not pointing to this server"
    echo "   2. Port 80 not accessible from internet"
    echo "   3. Domain already has certificate"
    echo ""
    echo "💡 To run interactively:"
    echo "   sudo certbot --nginx -d $STAGING_DOMAIN"
    exit 1
}

echo ""
echo "✅ SSL setup complete!"
echo ""
echo "🌐 Staging should now be accessible via:"
echo "   https://$STAGING_DOMAIN"
echo ""
echo "📋 Verify SSL:"
echo "   curl -I https://$STAGING_DOMAIN"
echo ""
echo "🔄 Certbot will auto-renew certificates. To test renewal:"
echo "   sudo certbot renew --dry-run"
