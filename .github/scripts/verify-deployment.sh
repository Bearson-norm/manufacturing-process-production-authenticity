#!/bin/bash

# Script to verify deployment and troubleshoot issues

echo "🔍 Verifying Manufacturing App Deployment..."
echo ""

# Check PM2 processes (as current user and root)
echo "📊 PM2 Status (current user):"
pm2 status || echo "PM2 not running for current user"

echo ""
echo "📊 PM2 Status (root):"
sudo pm2 status || echo "PM2 not running for root"

echo ""
echo "🔍 Checking processes on port 1234:"
sudo lsof -i :1234 || echo "No process found on port 1234"

echo ""
echo "🔍 Checking if app directory exists:"
if [ -d "/home/foom/deployments/manufacturing-app" ]; then
    echo "✅ Directory exists"
    ls -la /home/foom/deployments/manufacturing-app/
else
    echo "❌ Directory does not exist"
fi

echo ""
echo "🔍 Checking if app is running:"
if [ -d "/root/deployments/manufacturing-app" ]; then
    echo "✅ Directory exists in /root"
    ls -la /root/deployments/manufacturing-app/
else
    echo "❌ Directory does not exist in /root"
fi

echo ""
echo "🧪 Testing endpoints:"
echo "1. Direct app (port 1234):"
curl -v http://localhost:1234/health 2>&1 | head -20

echo ""
echo "2. Via Nginx:"
curl -v http://mpr.moof-set.web.id/api/health 2>&1 | head -20

echo ""
echo "3. Check Nginx error logs:"
sudo tail -20 /var/log/nginx/manufacturing-app-error.log 2>/dev/null || echo "No error log found"

echo ""
echo "4. Check app logs:"
if sudo pm2 list | grep -q manufacturing-app; then
    echo "App found in PM2, showing logs:"
    sudo pm2 logs manufacturing-app --lines 20 --nostream
else
    echo "App not found in PM2"
fi

