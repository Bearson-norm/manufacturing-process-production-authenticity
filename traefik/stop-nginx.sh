#!/bin/bash

# Quick script to stop Nginx for Traefik setup

set -e

echo "🛑 Stopping Nginx..."

if systemctl is-active --quiet nginx; then
    sudo systemctl stop nginx
    echo "✅ Nginx stopped"
    
    read -p "Disable Nginx from starting on boot? (y/n, default y): " disable
    disable=${disable:-y}
    
    if [ "$disable" = "y" ] || [ "$disable" = "Y" ]; then
        sudo systemctl disable nginx
        echo "✅ Nginx disabled from auto-start"
    fi
else
    echo "ℹ️  Nginx is not running"
fi

echo ""
echo "✅ You can now start Traefik:"
echo "   cd ~/traefik && docker-compose up -d"

