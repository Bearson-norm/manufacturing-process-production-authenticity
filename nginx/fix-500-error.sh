#!/bin/bash

# Script to diagnose and fix 500 Internal Server Error

echo "🔍 Diagnosing 500 Internal Server Error..."
echo ""

# Check Nginx error logs
echo "📋 Recent Nginx errors:"
sudo tail -30 /var/log/nginx/manufacturing-app-error.log
echo ""

# Check Nginx access logs
echo "📋 Recent Nginx access:"
sudo tail -10 /var/log/nginx/manufacturing-app-access.log
echo ""

# Check if client-build directory exists
echo "📁 Checking client-build directory:"
CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"
if [ -d "$CLIENT_BUILD" ]; then
    echo "✅ Directory exists"
    ls -la "$CLIENT_BUILD" | head -10
    if [ -f "$CLIENT_BUILD/index.html" ]; then
        echo "✅ index.html exists"
    else
        echo "❌ index.html NOT found!"
    fi
else
    echo "❌ Directory does NOT exist: $CLIENT_BUILD"
    echo ""
    echo "💡 Creating directory and checking alternatives..."
    mkdir -p "$CLIENT_BUILD"
    
    # Check if build exists elsewhere
    if [ -d "/root/deployments/manufacturing-app/client-build" ]; then
        echo "✅ Found in /root/deployments, copying..."
        sudo cp -r /root/deployments/manufacturing-app/client-build/* "$CLIENT_BUILD/"
        sudo chown -R foom:foom "$CLIENT_BUILD"
    elif [ -d "/var/www/manufacturing-process-production-authenticity/client/build" ]; then
        echo "✅ Found in project directory, copying..."
        cp -r /var/www/manufacturing-process-production-authenticity/client/build/* "$CLIENT_BUILD/"
    else
        echo "⚠️  Client build not found. Need to build client."
    fi
fi

echo ""
echo "🔍 Checking Nginx config after Certbot:"
sudo nginx -T | grep -A 20 "server_name mpr.moof-set.web.id" | head -40

echo ""
echo "🔍 Checking file permissions:"
ls -la /home/foom/deployments/manufacturing-app/ 2>/dev/null || echo "Directory not accessible"
ls -la /root/deployments/manufacturing-app/ 2>/dev/null || echo "Root directory not accessible"

echo ""
echo "💡 Common fixes:"
echo "1. Ensure client-build directory exists and has index.html"
echo "2. Check file permissions (should be readable by nginx user)"
echo "3. Verify Nginx config syntax: sudo nginx -t"
echo "4. Check error logs: sudo tail -f /var/log/nginx/manufacturing-app-error.log"

