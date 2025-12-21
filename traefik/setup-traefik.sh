#!/bin/bash

# Setup script untuk Traefik di VPS
# Jalankan script ini untuk setup Traefik sebagai reverse proxy

set -e

echo "🚀 Setting up Traefik..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo "✅ Docker installed. Please logout and login again, then run this script again."
    exit 0
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create Traefik directory
TRAEFIK_DIR="$HOME/traefik"
mkdir -p "$TRAEFIK_DIR"
cd "$TRAEFIK_DIR"

# Create acme.json with proper permissions
touch acme.json
chmod 600 acme.json

# Create logs directory
mkdir -p logs

# Copy Traefik configuration files
echo "📝 Creating Traefik configuration..."

# Create traefik.yml
cat > traefik.yml <<'EOF'
api:
  dashboard: true
  insecure: false

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik-network
  file:
    directory: /etc/traefik/dynamic
    watch: true

certificatesResolvers:
  letsencrypt:
    acme:
      email: admin@moof-set.web.id
      storage: /acme.json
      httpChallenge:
        entryPoint: web

log:
  level: INFO
  filePath: /var/log/traefik/traefik.log

accessLog:
  filePath: /var/log/traefik/access.log
EOF

# Create dynamic.yml for non-Docker services
cat > dynamic.yml <<'EOF'
http:
  routers:
    manufacturing-app:
      rule: "Host(`mpr.moof-set.web.id`)"
      entryPoints:
        - websecure
      service: manufacturing-app-service
      tls:
        certResolver: letsencrypt
      middlewares:
        - manufacturing-rate-limit
        - manufacturing-headers

  services:
    manufacturing-app-service:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:1234"
        healthCheck:
          path: "/health"
          interval: "10s"
          timeout: "3s"

  middlewares:
    manufacturing-rate-limit:
      rateLimit:
        average: 50
        burst: 30
        period: 1s

    manufacturing-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        customResponseHeaders:
          X-Frame-Options: "SAMEORIGIN"
          X-Content-Type-Options: "nosniff"
          X-XSS-Protection: "1; mode=block"
          Strict-Transport-Security: "max-age=31536000; includeSubDomains"
EOF

# Create docker-compose.yml
cat > docker-compose.yml <<'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./dynamic.yml:/dynamic.yml:ro
      - ./acme.json:/acme.json
      - ./logs:/var/log/traefik
    networks:
      - traefik-network
    command:
      - --api.dashboard=true
      - --api.insecure=false
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --providers.file.directory=/etc/traefik/dynamic
      - --entrypoints.web.address=:80
      - --entrypoints.websecure.address=:443
      - --entrypoints.web.http.redirections.entrypoint.to=websecure
      - --entrypoints.web.http.redirections.entrypoint.scheme=https
      - --certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL:-admin@moof-set.web.id}
      - --certificatesresolvers.letsencrypt.acme.storage=/acme.json
      - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
      - --log.level=INFO
      - --accesslog=true
      - --accesslog.filepath=/var/log/traefik/access.log
      - --log.filepath=/var/log/traefik/traefik.log
    extra_hosts:
      - "host.docker.internal:host-gateway"

networks:
  traefik-network:
    driver: bridge
EOF

# Check for port conflicts
echo "🔍 Checking for port conflicts..."
PORT80=$(sudo lsof -i :80 -t 2>/dev/null || echo "")
PORT443=$(sudo lsof -i :443 -t 2>/dev/null || echo "")

if [ -n "$PORT80" ] || [ -n "$PORT443" ]; then
    echo "⚠️  Port 80 or 443 is already in use!"
    echo ""
    
    if [ -n "$PORT80" ]; then
        echo "Port 80 is used by:"
        sudo lsof -i :80 | head -5
        echo ""
    fi
    
    if [ -n "$PORT443" ]; then
        echo "Port 443 is used by:"
        sudo lsof -i :443 | head -5
        echo ""
    fi
    
    # Check if Nginx is running
    if systemctl is-active --quiet nginx; then
        echo "📦 Nginx is running and will be kept running."
        echo ""
        echo "Options:"
        echo "1. Configure Traefik to work with Nginx (Traefik on different ports, Nginx proxies to Traefik)"
        echo "2. Use Traefik only for new services (configure Nginx to proxy specific services to Traefik)"
        echo "3. Exit and configure manually"
        echo ""
        read -p "Choose option (1, 2, or 3, default 1): " choice
        choice=${choice:-1}
        
        if [ "$choice" = "1" ]; then
            echo "🔧 Configuring Traefik to work alongside Nginx..."
            
            # Find available ports
            echo "🔍 Finding available ports..."
            HTTP_PORT=8080
            HTTPS_PORT=8443
            
            # Check if 8080 is available
            if sudo lsof -i :8080 -t >/dev/null 2>&1; then
                echo "⚠️  Port 8080 is also in use, trying alternative ports..."
                # Try to find available port starting from 8081
                for port in 8081 8082 8083 8880 8888; do
                    if ! sudo lsof -i :$port -t >/dev/null 2>&1; then
                        HTTP_PORT=$port
                        echo "✅ Found available HTTP port: $HTTP_PORT"
                        break
                    fi
                done
            else
                echo "✅ Port 8080 is available for HTTP"
            fi
            
            # Check if 8443 is available
            if sudo lsof -i :8443 -t >/dev/null 2>&1; then
                echo "⚠️  Port 8443 is also in use, trying alternative ports..."
                # Try to find available port starting from 8444
                for port in 8444 8445 8446 9443 9444; do
                    if ! sudo lsof -i :$port -t >/dev/null 2>&1; then
                        HTTPS_PORT=$port
                        echo "✅ Found available HTTPS port: $HTTPS_PORT"
                        break
                    fi
                done
            else
                echo "✅ Port 8443 is available for HTTPS"
            fi
            
            echo ""
            echo "   Traefik will use ports $HTTP_PORT (HTTP) and $HTTPS_PORT (HTTPS)"
            echo "   Nginx will proxy to Traefik for specific services"
            echo ""
            
            # Update docker-compose.yml to use different ports
            sed -i "s/\"80:80\"/\"${HTTP_PORT}:80\"/" docker-compose.yml
            sed -i "s/\"443:443\"/\"${HTTPS_PORT}:443\"/" docker-compose.yml
            
            # Save ports to a file for reference
            echo "HTTP_PORT=$HTTP_PORT" > .traefik-ports
            echo "HTTPS_PORT=$HTTPS_PORT" >> .traefik-ports
            echo "Dashboard port: 8080" >> .traefik-ports
            
            # Create Nginx config snippet for Traefik
            echo ""
            echo "📝 Creating Nginx configuration snippet for Traefik..."
            sudo tee /etc/nginx/snippets/traefik-proxy.conf > /dev/null <<NGINXEOF
# Traefik Proxy Configuration
# Traefik is running on port ${HTTP_PORT} (HTTP) and ${HTTPS_PORT} (HTTPS)
# Add this to your Nginx server blocks that should proxy to Traefik

location / {
    proxy_pass http://127.0.0.1:${HTTP_PORT};
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Host \$server_name;
    
    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
NGINXEOF
            
            echo "✅ Nginx snippet created at /etc/nginx/snippets/traefik-proxy.conf"
            echo ""
            echo "💡 To use Traefik for a service, add this to your Nginx config:"
            echo "   include /etc/nginx/snippets/traefik-proxy.conf;"
            echo ""
            echo "📝 Example Nginx server block:"
            cat <<NGINXEXAMPLE

server {
    listen 80;
    server_name your-service.example.com;
    
    include /etc/nginx/snippets/traefik-proxy.conf;
}
NGINXEXAMPLE
            echo ""
            
        elif [ "$choice" = "2" ]; then
            echo "🔧 Configuring Traefik for new services only..."
            
            # Find available ports
            echo "🔍 Finding available ports..."
            HTTP_PORT=8080
            HTTPS_PORT=8443
            
            # Check if 8080 is available
            if sudo lsof -i :8080 -t >/dev/null 2>&1; then
                echo "⚠️  Port 8080 is also in use, trying alternative ports..."
                for port in 8081 8082 8083 8880 8888; do
                    if ! sudo lsof -i :$port -t >/dev/null 2>&1; then
                        HTTP_PORT=$port
                        echo "✅ Found available HTTP port: $HTTP_PORT"
                        break
                    fi
                done
            fi
            
            # Check if 8443 is available
            if sudo lsof -i :8443 -t >/dev/null 2>&1; then
                echo "⚠️  Port 8443 is also in use, trying alternative ports..."
                for port in 8444 8445 8446 9443 9444; do
                    if ! sudo lsof -i :$port -t >/dev/null 2>&1; then
                        HTTPS_PORT=$port
                        echo "✅ Found available HTTPS port: $HTTPS_PORT"
                        break
                    fi
                done
            fi
            
            echo ""
            echo "   Traefik will use ports $HTTP_PORT (HTTP) and $HTTPS_PORT (HTTPS)"
            echo "   You can configure Nginx to proxy specific domains to Traefik"
            
            # Update docker-compose.yml to use different ports
            sed -i "s/\"80:80\"/\"${HTTP_PORT}:80\"/" docker-compose.yml
            sed -i "s/\"443:443\"/\"${HTTPS_PORT}:443\"/" docker-compose.yml
            
            # Save ports to a file for reference
            echo "HTTP_PORT=$HTTP_PORT" > .traefik-ports
            echo "HTTPS_PORT=$HTTPS_PORT" >> .traefik-ports
            echo "Dashboard port: 8080" >> .traefik-ports
            
            echo ""
            echo "📝 Example Nginx config to proxy to Traefik:"
            echo ""
            cat <<'NGINXEXAMPLE'
server {
    listen 80;
    server_name new-service.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINXEXAMPLE
            echo ""
        else
            echo "❌ Exiting. Please configure manually."
            exit 1
        fi
    else
        echo "⚠️  Another service is using port 80/443"
        echo "   Please configure Traefik to use different ports"
        echo "   Edit docker-compose.yml and change ports 80:80 to 8080:80 and 443:443 to 8443:443"
        exit 1
    fi
else
    echo "✅ Ports 80 and 443 are available"
fi

# Stop and remove existing Traefik container if exists
echo "🧹 Cleaning up existing Traefik container (if any)..."
docker-compose down 2>/dev/null || true
docker stop traefik 2>/dev/null || true
docker rm traefik 2>/dev/null || true

# Verify docker-compose.yml was updated correctly
if [ -f .traefik-ports ]; then
    source .traefik-ports
    echo "🔍 Verifying docker-compose.yml ports..."
    if grep -q "\"${HTTP_PORT}:80\"" docker-compose.yml; then
        echo "✅ HTTP port correctly set to ${HTTP_PORT}"
    else
        echo "⚠️  HTTP port not correctly set, fixing..."
        sed -i "s/\"[0-9]*:80\"/\"${HTTP_PORT}:80\"/" docker-compose.yml
    fi
    
    if grep -q "\"${HTTPS_PORT}:443\"" docker-compose.yml; then
        echo "✅ HTTPS port correctly set to ${HTTPS_PORT}"
    else
        echo "⚠️  HTTPS port not correctly set, fixing..."
        sed -i "s/\"[0-9]*:443\"/\"${HTTPS_PORT}:443\"/" docker-compose.yml
    fi
fi

# Create network
docker network create traefik-network 2>/dev/null || true

# Double check ports are available
if [ -f .traefik-ports ]; then
    source .traefik-ports
    if sudo lsof -i :${HTTP_PORT} -t >/dev/null 2>&1; then
        echo "❌ Port ${HTTP_PORT} is still in use!"
        echo "   Please stop the service using this port or choose a different port"
        exit 1
    fi
    if sudo lsof -i :${HTTPS_PORT} -t >/dev/null 2>&1; then
        echo "❌ Port ${HTTPS_PORT} is still in use!"
        echo "   Please stop the service using this port or choose a different port"
        exit 1
    fi
fi

# Start Traefik
echo "🚀 Starting Traefik..."
docker-compose up -d

# Wait for Traefik to be ready
echo "⏳ Waiting for Traefik to start..."
sleep 5

# Check Traefik status
if docker ps | grep -q traefik; then
    echo "✅ Traefik is running!"
    echo ""
    
    # Check which ports are being used
    TRAEFIK_HTTP_PORT=$(docker port traefik 2>/dev/null | grep "80/tcp" | cut -d: -f2 | head -1)
    TRAEFIK_HTTPS_PORT=$(docker port traefik 2>/dev/null | grep "443/tcp" | cut -d: -f2 | head -1)
    
    if [ "$TRAEFIK_HTTP_PORT" = "8080" ] || [ "$TRAEFIK_HTTPS_PORT" = "8443" ]; then
        echo "📍 Traefik is running on alternative ports (working with Nginx)"
        echo "   HTTP: http://$(hostname -I | awk '{print $1}'):${TRAEFIK_HTTP_PORT:-8080}"
        echo "   HTTPS: https://$(hostname -I | awk '{print $1}'):${TRAEFIK_HTTPS_PORT:-8443}"
        echo "   Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
        echo ""
        echo "📝 Next steps:"
        echo "1. Configure Nginx to proxy to Traefik (see nginx-traefik-integration.md)"
        echo "2. Update DNS untuk point domain ke VPS"
        echo "3. Add services to Traefik via dynamic.yml or add-service.sh"
    else
        echo "📍 Traefik Dashboard: http://$(hostname -I | awk '{print $1}'):8080"
        echo "📍 Manufacturing App: https://mpr.moof-set.web.id"
        echo ""
        echo "📝 Next steps:"
        echo "1. Update DNS untuk point domain ke VPS"
        echo "2. Traefik akan otomatis generate SSL certificate"
        echo "3. Add more services dengan menambahkan labels atau config di dynamic.yml"
    fi
    
    echo ""
    echo "📚 Documentation:"
    echo "   - traefik/README.md - Full Traefik documentation"
    echo "   - traefik/nginx-traefik-integration.md - Nginx + Traefik integration guide"
else
    echo "❌ Traefik failed to start. Check logs:"
    docker-compose logs
    echo ""
    echo "💡 If port conflict, check:"
    echo "   sudo lsof -i :80"
    echo "   sudo lsof -i :443"
    echo "   sudo systemctl status nginx"
fi

