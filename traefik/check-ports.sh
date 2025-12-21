#!/bin/bash

# Script to check what ports are in use and suggest available ports for Traefik

echo "🔍 Checking port availability..."

# Check common ports
PORTS_TO_CHECK=(80 443 8080 8443 8081 8082 8444 8445 8880 8888 9443 9444)

echo ""
echo "Port Status:"
echo "-----------"

for port in "${PORTS_TO_CHECK[@]}"; do
    if sudo lsof -i :$port -t >/dev/null 2>&1; then
        PROCESS=$(sudo lsof -i :$port | tail -1 | awk '{print $1}')
        echo "❌ Port $port: IN USE by $PROCESS"
    else
        echo "✅ Port $port: AVAILABLE"
    fi
done

echo ""
echo "💡 Suggested ports for Traefik (if 80/443 are in use):"
echo "   HTTP: 8080, 8081, 8082, 8880, or 8888"
echo "   HTTPS: 8443, 8444, 8445, 9443, or 9444"
echo ""

