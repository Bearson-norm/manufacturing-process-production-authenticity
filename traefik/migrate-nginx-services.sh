#!/bin/bash

# Script untuk migrate service dari Nginx ke Traefik
# Jalankan script ini untuk convert Nginx config ke Traefik config

set -e

NGINX_CONFIG="/etc/nginx/sites-available"
TRAEFIK_DYNAMIC="$HOME/traefik/dynamic.yml"

echo "🔄 Migrating services from Nginx to Traefik..."
echo ""

# Function to extract domain from Nginx config
extract_domains() {
    local config_file=$1
    grep -E "server_name" "$config_file" | sed 's/.*server_name\s*\(.*\);/\1/' | tr ' ' '\n' | grep -v "^$" | head -1
}

# Function to extract port from Nginx config
extract_port() {
    local config_file=$1
    grep -E "proxy_pass.*localhost" "$config_file" | sed 's/.*localhost:\([0-9]*\).*/\1/' | head -1
}

# Function to extract path from Nginx config
extract_path() {
    local config_file=$1
    grep -E "location.*{" "$config_file" | head -1 | sed 's/location\s*\([^{]*\).*/\1/' | tr -d ' '
}

# Backup existing dynamic.yml
if [ -f "$TRAEFIK_DYNAMIC" ]; then
    cp "$TRAEFIK_DYNAMIC" "${TRAEFIK_DYNAMIC}.backup.$(date +%Y%m%d-%H%M%S)"
fi

# Create new dynamic.yml
cat > "$TRAEFIK_DYNAMIC" <<'EOF'
http:
  routers: {}
  services: {}
  middlewares: {}
EOF

# Process each Nginx config file
for config in "$NGINX_CONFIG"/*; do
    if [ -f "$config" ] && [ "$(basename "$config")" != "default" ]; then
        domain=$(extract_domains "$config")
        port=$(extract_port "$config")
        path=$(extract_path "$config")
        
        if [ -n "$domain" ] && [ -n "$port" ]; then
            service_name=$(basename "$config" | sed 's/\.[^.]*$//' | tr '[:upper:]' '[:lower:]' | tr -cd '[:alnum:]-')
            
            echo "📦 Found service: $service_name"
            echo "   Domain: $domain"
            echo "   Port: $port"
            echo "   Path: ${path:-/}"
            
            # Add to dynamic.yml (this is a simplified version)
            # You may need to manually adjust the configuration
            cat >> "$TRAEFIK_DYNAMIC" <<EOF

  routers:
    ${service_name}:
      rule: "Host(\`${domain}\`)"
      entryPoints:
        - websecure
      service: ${service_name}-service
      tls:
        certResolver: letsencrypt

  services:
    ${service_name}-service:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:${port}"
EOF
        fi
    fi
done

echo ""
echo "✅ Migration completed!"
echo ""
echo "📝 Review and update: $TRAEFIK_DYNAMIC"
echo "🔄 Restart Traefik: cd ~/traefik && docker-compose restart"
echo ""
echo "⚠️  Note: This is a basic migration. You may need to:"
echo "   1. Review the generated configuration"
echo "   2. Add custom middlewares if needed"
echo "   3. Adjust routing rules"
echo "   4. Test each service"

