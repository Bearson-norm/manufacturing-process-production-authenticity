#!/bin/bash

# Quick diagnosis script for 500 error

echo "🔍 Diagnosing 500 Internal Server Error..."
echo ""

# Check Nginx error logs
echo "📋 Nginx Error Log (last 20 lines):"
sudo tail -20 /var/log/nginx/manufacturing-app-error.log
echo ""

# Check if client-build exists
CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"
echo "📁 Checking client-build directory:"
if [ -d "$CLIENT_BUILD" ]; then
    echo "✅ Directory exists: $CLIENT_BUILD"
    echo "   Files:"
    ls -la "$CLIENT_BUILD" | head -10
    echo ""
    if [ -f "$CLIENT_BUILD/index.html" ]; then
        echo "✅ index.html exists"
        echo "   Size: $(du -h $CLIENT_BUILD/index.html | cut -f1)"
    else
        echo "❌ index.html NOT FOUND!"
    fi
else
    echo "❌ Directory does NOT exist: $CLIENT_BUILD"
fi

echo ""
echo "🔍 Checking Nginx config (after Certbot):"
sudo cat /etc/nginx/sites-enabled/manufacturing-app | grep -A 5 "root\|index" | head -10

echo ""
echo "🔍 Checking permissions:"
if [ -d "$CLIENT_BUILD" ]; then
    ls -ld "$CLIENT_BUILD"
    ls -l "$CLIENT_BUILD/index.html" 2>/dev/null || echo "index.html not found"
fi

echo ""
echo "💡 Quick fixes to try:"
echo "1. Run: cd /var/www/manufacturing-process-production-authenticity/nginx && ./fix-permissions.sh"
echo "2. Check: ls -la /home/foom/deployments/manufacturing-app/client-build/"
echo "3. Build client if missing: cd client && npm run build"


