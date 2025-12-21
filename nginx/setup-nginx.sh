#!/bin/bash

# Setup script untuk konfigurasi Nginx untuk Manufacturing App
# Jalankan script ini untuk setup Nginx

set -e

echo "🚀 Setting up Nginx for Manufacturing App..."
echo ""

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt-get update -y
    sudo apt-get install -y nginx
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "🔄 Starting Nginx..."
    sudo systemctl start nginx
    sudo systemctl enable nginx
fi

# Create Nginx config directory if not exists
NGINX_CONFIG_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"

echo "📝 Creating Nginx configuration..."

# Copy config file
sudo cp manufacturing-app.conf $NGINX_CONFIG_DIR/manufacturing-app

# Create symlink to enable site
echo "🔗 Enabling site..."
sudo ln -sf $NGINX_CONFIG_DIR/manufacturing-app $NGINX_ENABLED_DIR/manufacturing-app

# Remove default site if exists
if [ -f $NGINX_ENABLED_DIR/default ]; then
    echo "🗑️  Removing default Nginx site..."
    sudo rm -f $NGINX_ENABLED_DIR/default
fi

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
if sudo nginx -t; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration has errors!"
    exit 1
fi

# Reload Nginx
echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo ""
echo "✅ Nginx setup completed!"
echo ""
echo "📍 Next steps:"
echo "1. Ensure your app is running on port 1234:"
echo "   pm2 status"
echo "   # If not running: cd ~/deployments/manufacturing-app/server && pm2 start ecosystem.config.js"
echo ""
echo "2. Setup SSL certificate (recommended):"
echo "   sudo apt-get install certbot python3-certbot-nginx -y"
echo "   sudo certbot --nginx -d mpr.moof-set.web.id"
echo ""
echo "3. Test the setup:"
echo "   curl http://localhost/api/health"
echo "   curl -I http://mpr.moof-set.web.id"
echo ""
echo "4. Check Nginx status:"
echo "   sudo systemctl status nginx"
echo "   sudo tail -f /var/log/nginx/manufacturing-app-access.log"

