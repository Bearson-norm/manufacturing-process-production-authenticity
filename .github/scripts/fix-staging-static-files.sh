#!/bin/bash

# Script to fix staging static files serving issue

set -e

STAGING_DIR="/home/foom/deployments/manufacturing-app-staging"
NGINX_CONF="/etc/nginx/sites-enabled/manufacturing-app-staging.conf"

echo "🔍 Diagnosing static files issue..."

# 1. Check if file exists
echo "📁 Checking if JS file exists..."
JS_FILE=$(find $STAGING_DIR/client-build/static/js/ -name "main.*.js" | head -1)
if [ -z "$JS_FILE" ]; then
    echo "❌ ERROR: JS file not found!"
    exit 1
fi
echo "   ✅ Found: $JS_FILE"

# 2. Check file permissions
echo "🔐 Checking file permissions..."
ls -la "$JS_FILE"
if [ ! -r "$JS_FILE" ]; then
    echo "❌ ERROR: File is not readable!"
    exit 1
fi
echo "   ✅ File is readable"

# 3. Check nginx config
echo "📋 Checking nginx config..."
if [ ! -f "$NGINX_CONF" ]; then
    echo "❌ ERROR: Nginx config not found: $NGINX_CONF"
    exit 1
fi

# Check if location /static/ exists
if ! grep -q "location.*/static/" "$NGINX_CONF"; then
    echo "❌ ERROR: location /static/ not found in nginx config!"
    exit 1
fi
echo "   ✅ location /static/ found in config"

# Check root directory
ROOT_DIR=$(grep -E "^\s*root\s+" "$NGINX_CONF" | head -1 | awk '{print $2}' | tr -d ';')
echo "   📍 Root directory in config: $ROOT_DIR"

if [ ! -d "$ROOT_DIR" ]; then
    echo "❌ ERROR: Root directory does not exist: $ROOT_DIR"
    exit 1
fi
echo "   ✅ Root directory exists"

# 4. Test nginx config
echo "🧪 Testing nginx config..."
if ! sudo nginx -t; then
    echo "❌ ERROR: Nginx config test failed!"
    exit 1
fi
echo "   ✅ Nginx config is valid"

# 5. Check nginx error log
echo "📋 Checking nginx error log (last 10 lines)..."
sudo tail -10 /var/log/nginx/manufacturing-app-staging-error.log || echo "   ⚠️  No error log found"

# 6. Get actual JS filename
JS_FILENAME=$(basename "$JS_FILE")
echo "📝 JS filename: $JS_FILENAME"

# 7. Test with curl
echo "🌐 Testing with curl..."
echo "   Testing: http://localhost/static/js/$JS_FILENAME"
curl -I "http://localhost/static/js/$JS_FILENAME" 2>&1 | head -15

# 8. Check if file is accessible via direct path
echo "📂 Testing direct file access..."
if [ -f "$ROOT_DIR/static/js/$JS_FILENAME" ]; then
    echo "   ✅ File exists at: $ROOT_DIR/static/js/$JS_FILENAME"
    ls -lh "$ROOT_DIR/static/js/$JS_FILENAME"
else
    echo "   ❌ ERROR: File does NOT exist at: $ROOT_DIR/static/js/$JS_FILENAME"
    echo "   Expected path based on root + /static/js/$JS_FILENAME"
    echo "   Actual file location: $JS_FILE"
    echo ""
    echo "   💡 The root directory in nginx config might be wrong!"
    echo "   Current root: $ROOT_DIR"
    echo "   File is at: $STAGING_DIR/client-build/static/js/$JS_FILENAME"
fi

echo ""
echo "✅ Diagnosis complete!"
echo ""
echo "💡 If file path doesn't match, update nginx config root to:"
echo "   root $STAGING_DIR/client-build;"
