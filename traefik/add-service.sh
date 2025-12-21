#!/bin/bash

# Script untuk menambahkan service baru ke Traefik
# Usage: ./add-service.sh <service-name> <domain> <port> [path]

set -e

if [ $# -lt 3 ]; then
    echo "Usage: $0 <service-name> <domain> <port> [path]"
    echo "Example: $0 my-app myapp.example.com 3000 /"
    exit 1
fi

SERVICE_NAME=$1
DOMAIN=$2
PORT=$3
PATH=${4:-/}
TRAEFIK_DYNAMIC="$HOME/traefik/dynamic.yml"

# Validate service name (alphanumeric and hyphens only)
if [[ ! "$SERVICE_NAME" =~ ^[a-z0-9-]+$ ]]; then
    echo "❌ Service name must be lowercase alphanumeric with hyphens only"
    exit 1
fi

echo "➕ Adding service: $SERVICE_NAME"
echo "   Domain: $DOMAIN"
echo "   Port: $PORT"
echo "   Path: $PATH"

# Backup
cp "$TRAEFIK_DYNAMIC" "${TRAEFIK_DYNAMIC}.backup.$(date +%Y%m%d-%H%M%S)"

# Check if service already exists
if grep -q "${SERVICE_NAME}:" "$TRAEFIK_DYNAMIC"; then
    echo "⚠️  Service $SERVICE_NAME already exists. Updating..."
    # Remove existing service config (simplified - you may need to adjust)
    sed -i "/${SERVICE_NAME}:/,/^  [a-z]/d" "$TRAEFIK_DYNAMIC"
fi

# Add service configuration
cat >> "$TRAEFIK_DYNAMIC" <<EOF

  routers:
    ${SERVICE_NAME}:
      rule: "Host(\`${DOMAIN}\`) && PathPrefix(\`${PATH}\`)"
      entryPoints:
        - websecure
      service: ${SERVICE_NAME}-service
      tls:
        certResolver: letsencrypt
      middlewares:
        - ${SERVICE_NAME}-rate-limit
        - ${SERVICE_NAME}-headers

  services:
    ${SERVICE_NAME}-service:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:${PORT}"
        healthCheck:
          path: "${PATH}health"
          interval: "10s"
          timeout: "3s"

  middlewares:
    ${SERVICE_NAME}-rate-limit:
      rateLimit:
        average: 50
        burst: 30
        period: 1s

    ${SERVICE_NAME}-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: "https"
        customResponseHeaders:
          X-Frame-Options: "SAMEORIGIN"
          X-Content-Type-Options: "nosniff"
          X-XSS-Protection: "1; mode=block"
EOF

echo "✅ Service added to Traefik configuration"
echo ""
echo "🔄 Restart Traefik to apply changes:"
echo "   cd ~/traefik && docker-compose restart"
echo ""
echo "📝 Or reload Traefik config (if using file provider):"
echo "   docker exec traefik kill -SIGHUP 1"

