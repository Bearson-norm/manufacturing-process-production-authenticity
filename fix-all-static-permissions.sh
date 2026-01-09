#!/bin/bash
# Fix ALL static files permissions - including newly deployed files

set -e

CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"

echo "=========================================="
echo "Fix ALL Static Files Permissions"
echo "=========================================="
echo ""

# Fix ownership
echo "[1/4] Fixing ownership..."
sudo chown -R foom:www-data "$CLIENT_BUILD"
echo "✅ Ownership fixed"

# Fix directory permissions
echo "[2/4] Fixing directory permissions..."
find "$CLIENT_BUILD" -type d -exec sudo chmod 755 {} \;
echo "✅ Directory permissions fixed"

# Fix file permissions
echo "[3/4] Fixing file permissions..."
find "$CLIENT_BUILD" -type f -exec sudo chmod 644 {} \;
echo "✅ File permissions fixed"

# Ensure nginx can read everything
echo "[4/4] Ensuring nginx can read all files..."
sudo chmod -R o+r "$CLIENT_BUILD"
echo "✅ Nginx read access ensured"

# Check specific files that browser is requesting
echo ""
echo "Checking files browser is requesting..."
if [ -f "$CLIENT_BUILD/static/js/main.a81033a4.js" ]; then
    echo "✅ main.a81033a4.js found"
    ls -la "$CLIENT_BUILD/static/js/main.a81033a4.js"
else
    echo "❌ main.a81033a4.js NOT found"
    echo "   Available JS files:"
    ls -la "$CLIENT_BUILD/static/js/" | grep "\.js$" | head -5
fi

if [ -f "$CLIENT_BUILD/static/css/main.23a4024a.css" ]; then
    echo "✅ main.23a4024a.css found"
    ls -la "$CLIENT_BUILD/static/css/main.23a4024a.css"
else
    echo "❌ main.23a4024a.css NOT found"
    echo "   Available CSS files:"
    ls -la "$CLIENT_BUILD/static/css/" | grep "\.css$" | head -5
fi

# Test nginx access
echo ""
echo "Testing nginx access..."
sudo -u www-data test -r "$CLIENT_BUILD/static/js" && echo "✅ Nginx can read /static/js" || echo "❌ Nginx CANNOT read /static/js"
sudo -u www-data test -r "$CLIENT_BUILD/static/css" && echo "✅ Nginx can read /static/css" || echo "❌ Nginx CANNOT read /static/css"

# List all files in static directories
echo ""
echo "All JS files:"
ls -la "$CLIENT_BUILD/static/js/" | grep "\.js$"

echo ""
echo "All CSS files:"
ls -la "$CLIENT_BUILD/static/css/" | grep "\.css$"

echo ""
echo "=========================================="
echo "✅ Permission fix completed!"
echo "=========================================="
echo ""
echo "Next: sudo systemctl reload nginx"
