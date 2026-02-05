#!/bin/bash
# Script untuk verify filter MO bekerja setelah deploy

echo "=========================================="
echo "  Verify MO Filter After Deploy"
echo "=========================================="
echo ""

DOMAIN="${1:-http://localhost:3000}"

echo "1. Checking if server is running..."
if curl -s "$DOMAIN/health" > /dev/null; then
    echo "   ✅ Server is running"
else
    echo "   ❌ Server is NOT running!"
    exit 1
fi

echo ""
echo "2. Checking if filter code exists..."
if grep -q "TEAM LIQUID" server/index.js 2>/dev/null; then
    echo "   ✅ Filter code found in server/index.js"
    grep -n "TEAM LIQUID" server/index.js | head -3
else
    echo "   ❌ Filter code NOT found!"
    echo "   Code mungkin belum ter-deploy"
    exit 1
fi

echo ""
echo "3. Triggering MO sync..."
SYNC_RESPONSE=$(curl -s -X POST "$DOMAIN/api/admin/sync-mo")
if echo "$SYNC_RESPONSE" | grep -q "success"; then
    echo "   ✅ Sync triggered successfully"
    echo "   Response: $SYNC_RESPONSE"
else
    echo "   ⚠️  Sync response: $SYNC_RESPONSE"
fi

echo ""
echo "4. Waiting 60 seconds for sync to complete..."
for i in {60..1}; do
    echo -ne "   ⏳ $i seconds remaining...\r"
    sleep 1
done
echo "   ✅ Wait complete"

echo ""
echo "5. Checking liquid MO list..."
LIQUID_RESPONSE=$(curl -s "$DOMAIN/api/odoo/mo-list?productionType=liquid")

if echo "$LIQUID_RESPONSE" | grep -q "TEAM LIQUID"; then
    echo "   ✅ Found MOs with 'TEAM LIQUID' in note!"
    echo "$LIQUID_RESPONSE" | grep -o '"note":"[^"]*TEAM LIQUID[^"]*"' | head -5
else
    echo "   ⚠️  No MOs with 'TEAM LIQUID' found"
    echo "   Checking if any liquid MOs exist..."
    MO_COUNT=$(echo "$LIQUID_RESPONSE" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')
    echo "   Total liquid MOs: $MO_COUNT"
fi

echo ""
echo "6. Sample MO data:"
echo "$LIQUID_RESPONSE" | grep -o '"mo_number":"[^"]*"' | head -5

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "If filter not working:"
echo "  1. Check server logs: pm2 logs server"
echo "  2. Verify code deployed: git log"
echo "  3. Restart server: pm2 restart server"
echo "  4. Trigger sync again: curl -X POST $DOMAIN/api/admin/sync-mo"
echo ""
