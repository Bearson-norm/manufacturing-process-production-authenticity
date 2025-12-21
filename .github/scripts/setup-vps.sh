#!/bin/bash

# Setup script untuk VPS
# Jalankan script ini sekali di VPS untuk setup awal

set -e

echo "🚀 Setting up VPS for Manufacturing App..."

# Update system
echo "📦 Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Node.js 18.x
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing Nginx..."
    sudo apt-get install -y nginx
fi

# Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p ~/deployments
mkdir -p ~/deployments/manufacturing-app

# Setup PM2 startup script
echo "⚙️ Setting up PM2 startup..."
pm2 startup systemd -u $USER --hp $HOME
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# Create Nginx configuration
echo "⚙️ Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/manufacturing-app > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Client (React build)
    location / {
        root /home/$USER/deployments/manufacturing-app/client-build;
        try_files \$uri \$uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/manufacturing-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
echo "🔄 Testing Nginx configuration..."
sudo nginx -t
sudo systemctl reload nginx

# Setup firewall (if ufw is installed)
if command -v ufw &> /dev/null; then
    echo "🔥 Configuring firewall..."
    sudo ufw allow 22/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
fi

echo "✅ VPS setup completed!"
echo ""
echo "📝 Next steps:"
echo "1. Setup SSH key in GitHub Secrets"
echo "2. Configure GitHub Actions secrets:"
echo "   - VPS_HOST: 103.31.39.189"
echo "   - VPS_USER: foom"
echo "   - VPS_SSH_KEY: (your private SSH key)"
echo "   - VPS_PORT: 22 (or your custom port)"
echo "3. Push to main/master branch to trigger deployment"

