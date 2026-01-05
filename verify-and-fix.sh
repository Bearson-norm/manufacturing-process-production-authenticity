#!/bin/bash
# Script untuk verifikasi dan fix masalah 404 pada generate-api-key endpoint

echo "🔍 Verifying and fixing 404 error on /api/admin/generate-api-key"
echo "================================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on VPS
if [ ! -d "$HOME/deployments/manufacturing-app" ]; then
    echo -e "${RED}❌ Error: This script should be run on VPS${NC}"
    echo "Expected directory: ~/deployments/manufacturing-app"
    exit 1
fi

cd ~/deployments/manufacturing-app/server

echo ""
echo "1️⃣ Checking if route exists in index.js..."
if grep -q "app.post('/api/admin/generate-api-key'" index.js; then
    echo -e "${GREEN}✅ Route found in index.js${NC}"
else
    echo -e "${RED}❌ Route NOT found in index.js${NC}"
    echo "File needs to be updated!"
    exit 1
fi

echo ""
echo "2️⃣ Checking static middleware position..."
STATIC_LINE=$(grep -n "Serve static files AFTER all API routes" index.js | cut -d: -f1)
if [ -z "$STATIC_LINE" ]; then
    echo -e "${RED}❌ Static middleware fix NOT found${NC}"
    echo "File needs to be updated with the fix!"
    exit 1
else
    echo -e "${GREEN}✅ Static middleware fix found at line $STATIC_LINE${NC}"
fi

# Check if static middleware is after the route
ROUTE_LINE=$(grep -n "app.post('/api/admin/generate-api-key'" index.js | cut -d: -f1)
if [ ! -z "$ROUTE_LINE" ] && [ ! -z "$STATIC_LINE" ]; then
    if [ "$STATIC_LINE" -gt "$ROUTE_LINE" ]; then
        echo -e "${GREEN}✅ Static middleware is correctly placed AFTER the route${NC}"
    else
        echo -e "${YELLOW}⚠️  Static middleware might be before the route${NC}"
    fi
fi

echo ""
echo "3️⃣ Checking PM2 status..."
if pm2 list | grep -q "manufacturing-app"; then
    echo -e "${GREEN}✅ PM2 process found${NC}"
    PM2_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="manufacturing-app") | .pm2_env.status')
    echo "   Status: $PM2_STATUS"
    
    if [ "$PM2_STATUS" != "online" ]; then
        echo -e "${YELLOW}⚠️  Process is not online. Restarting...${NC}"
        pm2 restart manufacturing-app
        sleep 3
    fi
else
    echo -e "${RED}❌ PM2 process not found${NC}"
    echo "Starting application..."
    pm2 start index.js --name manufacturing-app
    sleep 3
fi

echo ""
echo "4️⃣ Testing endpoint locally..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:1234/api/admin/generate-api-key 2>/dev/null)

if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Endpoint responds with 200 OK${NC}"
    echo "   The fix is working!"
elif [ "$RESPONSE" = "404" ]; then
    echo -e "${RED}❌ Endpoint still returns 404${NC}"
    echo ""
    echo "🔧 Troubleshooting steps:"
    echo "   1. Check PM2 logs: pm2 logs manufacturing-app --lines 50"
    echo "   2. Verify file was updated: grep -n 'generate-api-key' index.js"
    echo "   3. Restart PM2: pm2 restart manufacturing-app"
    echo "   4. Check if route is registered: pm2 logs manufacturing-app | grep 'generate-api-key'"
    exit 1
else
    echo -e "${YELLOW}⚠️  Endpoint returned: $RESPONSE${NC}"
    echo "   Check logs for more details"
fi

echo ""
echo "5️⃣ Checking recent PM2 logs for errors..."
echo "   Last 20 lines:"
pm2 logs manufacturing-app --lines 20 --nostream | tail -20

echo ""
echo "================================================================"
echo -e "${GREEN}✅ Verification complete!${NC}"
echo ""
echo "If endpoint still returns 404, check:"
echo "   1. File was properly updated: grep 'generate-api-key' index.js"
echo "   2. PM2 was restarted: pm2 restart manufacturing-app"
echo "   3. No syntax errors: node -c index.js"
echo "   4. Nginx configuration: sudo nginx -t"

