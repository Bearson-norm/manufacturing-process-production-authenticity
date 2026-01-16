#!/bin/bash

# Quick script to setup staging nginx config on VPS
# This creates the nginx config file directly

echo "🔧 Setting up staging nginx configuration..."
echo ""

STAGING_CONF="/etc/nginx/sites-available/manufacturing-app-staging.conf"
STAGING_ENABLED="/etc/nginx/sites-enabled/manufacturing-app-staging.conf"

# Create nginx config file
echo "📝 Creating nginx config file..."
sudo tee "$STAGING_CONF" > /dev/null <<'EOF'
# Nginx configuration for Manufacturing Process Production Authenticity - STAGING
# Domain: staging.mpr.moof-set.web.id (or stg.mpr.moof-set.web.id)
# Backend: http://localhost:5678
#
# This is the STAGING environment for testing before production deployment

# HTTP Server for Staging
server {
    listen 80;
    listen [::]:80;
    server_name staging.mpr.moof-set.web.id stg.mpr.moof-set.web.id;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    # Staging indicator header
    add_header X-Environment "STAGING" always;
    add_header X-Staging-Warning "This is a testing environment - data may be reset" always;

    # Client body size limit
    client_max_body_size 10M;
    client_body_buffer_size 128k;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Root directory for static files (React build) - STAGING
    root /home/foom/deployments/manufacturing-app-staging/client-build;
    index index.html;

    # Logging - separate logs for staging
    access_log /var/log/nginx/manufacturing-app-staging-access.log;
    error_log /var/log/nginx/manufacturing-app-staging-error.log;

    # Health check endpoint (direct to staging backend)
    location = /health {
        proxy_pass http://127.0.0.1:5678/health;
        proxy_set_header Host $host;
        access_log off;
    }
    
    location = /api/health {
        proxy_pass http://127.0.0.1:5678/health;
        proxy_set_header Host $host;
        access_log off;
    }

    # API Proxy - All /api requests go to staging backend
    location /api {
        proxy_pass http://127.0.0.1:5678;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header X-Environment "STAGING";
        
        # WebSocket support (if needed)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_busy_buffers_size 8k;
        
        # Cache bypass for dynamic content
        proxy_cache_bypass $http_upgrade;
        
        # Error handling
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 10s;
    }

    # Static files (React build) - Cache for 1 year
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|map)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # React Router - All other requests serve index.html
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache control for HTML - no cache for staging
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Staging info endpoint (optional - for debugging)
    location = /staging-info {
        add_header Content-Type text/plain;
        return 200 "STAGING ENVIRONMENT\nServer: staging.mpr.moof-set.web.id\nBackend Port: 5678\nEnvironment: STAGING\n";
        access_log off;
    }
}

# HTTPS Server block for staging (optional - after SSL setup)
# After running: sudo certbot --nginx -d staging.mpr.moof-set.web.id
# Certbot will automatically add HTTPS configuration
EOF

echo "   ✅ Config file created"

# Enable config
echo ""
echo "📋 Enabling nginx config"
if [ ! -L "$STAGING_ENABLED" ] && [ ! -f "$STAGING_ENABLED" ]; then
    sudo ln -s "$STAGING_CONF" "$STAGING_ENABLED"
    echo "   ✅ Config enabled"
else
    echo "   ✅ Config already enabled"
fi

# Test nginx config
echo ""
echo "📋 Testing nginx configuration"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo "   ✅ Nginx configuration is valid"
    
    # Reload nginx
    echo ""
    echo "📋 Reloading nginx"
    sudo systemctl reload nginx
    echo "   ✅ Nginx reloaded"
else
    echo "   ❌ ERROR: Nginx configuration has errors:"
    sudo nginx -t
    exit 1
fi

echo ""
echo "✅ Staging nginx configuration setup complete!"
echo ""
echo "🌐 Test staging domain:"
echo "   http://staging.mpr.moof-set.web.id"
echo ""
echo "📋 Next steps:"
echo "   1. Ensure client-build exists: ls -la /home/foom/deployments/manufacturing-app-staging/client-build"
echo "   2. Check nginx logs if issues: sudo tail -f /var/log/nginx/manufacturing-app-staging-error.log"
