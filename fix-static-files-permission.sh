#!/bin/bash
# Fix 403 Forbidden Error untuk Static Files
# Script ini akan memperbaiki permission untuk client-build directory

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Fix 403 Forbidden - Static Files${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Paths
CLIENT_BUILD="/home/foom/deployments/manufacturing-app/client-build"
NGINX_USER="www-data"

echo -e "${YELLOW}[1/5] Checking client-build directory...${NC}"
if [ ! -d "$CLIENT_BUILD" ]; then
    echo -e "${RED}❌ Directory tidak ditemukan: $CLIENT_BUILD${NC}"
    echo "   Pastikan client sudah di-build dan di-deploy"
    exit 1
fi
echo -e "${GREEN}✅ Directory ditemukan${NC}"

echo -e "${YELLOW}[2/5] Checking static files...${NC}"
if [ ! -d "$CLIENT_BUILD/static" ]; then
    echo -e "${RED}❌ Static directory tidak ditemukan${NC}"
    echo "   Pastikan build sudah benar"
    exit 1
fi
echo -e "${GREEN}✅ Static directory ditemukan${NC}"

echo -e "${YELLOW}[3/5] Fixing ownership...${NC}"
# Set ownership to current user (foom) and nginx group
sudo chown -R foom:www-data "$CLIENT_BUILD"
echo -e "${GREEN}✅ Ownership fixed${NC}"

echo -e "${YELLOW}[4/5] Fixing permissions...${NC}"
# Set directory permissions (755 = rwxr-xr-x)
find "$CLIENT_BUILD" -type d -exec sudo chmod 755 {} \;

# Set file permissions (644 = rw-r--r--)
find "$CLIENT_BUILD" -type f -exec sudo chmod 644 {} \;

# Make sure nginx can read
sudo chmod -R o+r "$CLIENT_BUILD"
echo -e "${GREEN}✅ Permissions fixed${NC}"

echo -e "${YELLOW}[5/5] Verifying files...${NC}"
# Check if static files exist
if [ -f "$CLIENT_BUILD/index.html" ]; then
    echo -e "${GREEN}✅ index.html found${NC}"
else
    echo -e "${RED}❌ index.html NOT found${NC}"
fi

if [ -d "$CLIENT_BUILD/static/css" ] && [ "$(ls -A $CLIENT_BUILD/static/css)" ]; then
    echo -e "${GREEN}✅ CSS files found${NC}"
    ls -lh "$CLIENT_BUILD/static/css" | head -3
else
    echo -e "${RED}❌ CSS files NOT found${NC}"
fi

if [ -d "$CLIENT_BUILD/static/js" ] && [ "$(ls -A $CLIENT_BUILD/static/js)" ]; then
    echo -e "${GREEN}✅ JS files found${NC}"
    ls -lh "$CLIENT_BUILD/static/js" | head -3
else
    echo -e "${RED}❌ JS files NOT found${NC}"
fi

echo ""
echo -e "${YELLOW}[6/6] Testing nginx access...${NC}"
# Test if nginx can read
if sudo -u www-data test -r "$CLIENT_BUILD/index.html"; then
    echo -e "${GREEN}✅ Nginx can read index.html${NC}"
else
    echo -e "${RED}❌ Nginx CANNOT read index.html${NC}"
    echo "   Fixing permissions..."
    sudo chmod o+r "$CLIENT_BUILD/index.html"
fi

if sudo -u www-data test -r "$CLIENT_BUILD/static"; then
    echo -e "${GREEN}✅ Nginx can read static directory${NC}"
else
    echo -e "${RED}❌ Nginx CANNOT read static directory${NC}"
    sudo chmod -R o+r "$CLIENT_BUILD/static"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Permission fix completed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Reload nginx: sudo systemctl reload nginx"
echo "2. Clear browser cache and hard refresh"
echo "3. Check nginx error log: sudo tail -f /var/log/nginx/manufacturing-app-error.log"
echo ""
