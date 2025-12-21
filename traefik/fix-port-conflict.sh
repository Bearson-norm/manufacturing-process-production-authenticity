#!/bin/bash

# Script untuk fix port conflict dengan Nginx atau service lain

set -e

echo "🔍 Checking for port conflicts..."

# Check what's using port 80
PORT80=$(sudo lsof -i :80 -t 2>/dev/null || echo "")
PORT443=$(sudo lsof -i :443 -t 2>/dev/null || echo "")

if [ -n "$PORT80" ] || [ -n "$PORT443" ]; then
    echo "⚠️  Port 80 or 443 is already in use!"
    echo ""
    
    if [ -n "$PORT80" ]; then
        echo "Port 80 is used by:"
        sudo lsof -i :80
        echo ""
    fi
    
    if [ -n "$PORT443" ]; then
        echo "Port 443 is used by:"
        sudo lsof -i :443
        echo ""
    fi
    
    # Check if Nginx is running
    if systemctl is-active --quiet nginx; then
        echo "📦 Nginx is running. Options:"
        echo "1. Stop Nginx (recommended if migrating to Traefik)"
        echo "2. Keep Nginx and use different ports for Traefik"
        echo ""
        read -p "Choose option (1 or 2): " choice
        
        if [ "$choice" = "1" ]; then
            echo "🛑 Stopping Nginx..."
            sudo systemctl stop nginx
            sudo systemctl disable nginx
            echo "✅ Nginx stopped"
        elif [ "$choice" = "2" ]; then
            echo "⚠️  You'll need to configure Traefik to use different ports"
            echo "   Or configure Nginx to proxy to Traefik"
            exit 1
        fi
    else
        # Other service using the port
        echo "⚠️  Another service is using port 80/443"
        echo "   Please stop it manually or choose different ports"
        exit 1
    fi
else
    echo "✅ Ports 80 and 443 are available"
fi

echo ""
echo "🔄 Now you can start Traefik:"
echo "   cd ~/traefik && docker-compose up -d"

