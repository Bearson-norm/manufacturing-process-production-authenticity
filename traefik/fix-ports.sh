#!/bin/bash

# Quick fix script untuk update port di docker-compose.yml
# Usage: ./fix-ports.sh [http_port] [https_port]

set -e

cd "$(dirname "$0")"

if [ $# -eq 2 ]; then
    HTTP_PORT=$1
    HTTPS_PORT=$2
elif [ -f .traefik-ports ]; then
    source .traefik-ports
    echo "Using ports from .traefik-ports: HTTP=${HTTP_PORT}, HTTPS=${HTTPS_PORT}"
else
    echo "Usage: $0 [http_port] [https_port]"
    echo "Or ensure .traefik-ports file exists"
    exit 1
fi

echo "🔧 Updating docker-compose.yml ports..."
echo "   HTTP: ${HTTP_PORT}"
echo "   HTTPS: ${HTTPS_PORT}"

# Stop existing container
docker-compose down 2>/dev/null || true
docker stop traefik 2>/dev/null || true
docker rm traefik 2>/dev/null || true

# Update ports in docker-compose.yml
sed -i "s|\"[0-9]*:80\"|\"${HTTP_PORT}:80\"|g" docker-compose.yml
sed -i "s|\"[0-9]*:443\"|\"${HTTPS_PORT}:443\"|g" docker-compose.yml

# Verify
echo ""
echo "🔍 Verifying update..."
if grep -q "\"${HTTP_PORT}:80\"" docker-compose.yml; then
    echo "✅ HTTP port: ${HTTP_PORT}"
else
    echo "❌ Failed to update HTTP port"
    exit 1
fi

if grep -q "\"${HTTPS_PORT}:443\"" docker-compose.yml; then
    echo "✅ HTTPS port: ${HTTPS_PORT}"
else
    echo "❌ Failed to update HTTPS port"
    exit 1
fi

# Check if ports are available
echo ""
echo "🔍 Checking port availability..."
if sudo lsof -i :${HTTP_PORT} -t >/dev/null 2>&1; then
    echo "❌ Port ${HTTP_PORT} is in use!"
    sudo lsof -i :${HTTP_PORT} | head -3
    exit 1
else
    echo "✅ Port ${HTTP_PORT} is available"
fi

if sudo lsof -i :${HTTPS_PORT} -t >/dev/null 2>&1; then
    echo "❌ Port ${HTTPS_PORT} is in use!"
    sudo lsof -i :${HTTPS_PORT} | head -3
    exit 1
else
    echo "✅ Port ${HTTPS_PORT} is available"
fi

echo ""
echo "✅ Ports updated successfully!"
echo ""
echo "🚀 Starting Traefik..."
docker-compose up -d

echo ""
echo "✅ Done! Check status with: docker ps | grep traefik"

