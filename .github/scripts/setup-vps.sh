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
# Upstream for load balancing (multiple PM2 instances)
upstream backend {
    least_conn; # Use least connections load balancing
    server 127.0.0.1:1234 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=50r/s;
limit_req_zone \$binary_remote_addr zone=general_limit:10m rate=100r/s;

server {
    listen 80;
    listen [::]:80;
    server_name mpr.moof-set.web.id;

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mpr.moof-set.web.id;

    # SSL Configuration (will be set up by Certbot)
    # ssl_certificate /etc/letsencrypt/live/mpr.moof-set.web.id/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/mpr.moof-set.web.id/privkey.pem;
    # ssl_protocols TLSv1.2 TLSv1.3;
    # ssl_ciphers HIGH:!aNULL:!MD5;
    # ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size limit
    client_max_body_size 10M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Client (React build)
    location / {
        limit_req zone=general_limit burst=20 nodelay;
        root /home/$USER/deployments/manufacturing-app/client-build;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API Proxy with rate limiting and load balancing
    location /api {
        limit_req zone=api_limit burst=30 nodelay;
        
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        # Connection keep-alive
        proxy_set_header Connection "";
        
        # Headers
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$server_name;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Cache bypass for dynamic content
        proxy_cache_bypass \$http_upgrade;
        
        # Error handling
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
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
    sudo ufw allow 1234/tcp
    sudo ufw --force enable
fi

# Setup SSL with Let's Encrypt (optional but recommended)
echo "🔒 SSL Setup (Optional)..."
echo "To setup SSL, run after DNS is configured:"
echo "  sudo apt-get install certbot python3-certbot-nginx -y"
echo "  sudo certbot --nginx -d mpr.moof-set.web.id"
echo ""

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

