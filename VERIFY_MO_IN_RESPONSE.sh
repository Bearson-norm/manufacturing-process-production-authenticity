#!/bin/bash
# Verify MO dengan TEAM LIQUID muncul di API response

echo "=========================================="
echo "  Verify MO in API Response"
echo "=========================================="
echo ""

DOMAIN="${1:-http://localhost:1234}"
MO_NUMBER="${2:-PROD/MO/29928}"

echo "1. Fetching mo-list API..."
RESPONSE=$(curl -s "$DOMAIN/api/odoo/mo-list?productionType=liquid")

echo "   Response size: $(echo "$RESPONSE" | wc -c) bytes"
echo "   Total MOs: $(echo "$RESPONSE" | jq -r '.count // 0')"

echo ""
echo "2. Checking for specific MO: $MO_NUMBER"
MO_FOUND=$(echo "$RESPONSE" | jq -r ".data[] | select(.mo_number == \"$MO_NUMBER\") | .mo_number" | head -1)

if [ -n "$MO_FOUND" ]; then
    echo "   ✅ MO FOUND in API response!"
    echo ""
    echo "   MO Details:"
    echo "$RESPONSE" | jq -r ".data[] | select(.mo_number == \"$MO_NUMBER\") | {mo_number, sku_name, note, create_date}"
else
    echo "   ❌ MO NOT FOUND in API response"
    echo ""
    echo "   Checking if any MOs with 'TEAM LIQUID' exist..."
    TEAM_LIQUID_COUNT=$(echo "$RESPONSE" | jq -r '.data[] | select(.note | contains("TEAM LIQUID")) | .mo_number' | wc -l)
    echo "   MOs with 'TEAM LIQUID' in note: $TEAM_LIQUID_COUNT"
    
    if [ "$TEAM_LIQUID_COUNT" -gt 0 ]; then
        echo ""
        echo "   Sample MOs with TEAM LIQUID:"
        echo "$RESPONSE" | jq -r '.data[] | select(.note | contains("TEAM LIQUID")) | "\(.mo_number) - \(.note)"' | head -5
    fi
fi

echo ""
echo "3. Checking first 10 MOs in response..."
echo "$RESPONSE" | jq -r '.data[0:10] | .[] | "\(.mo_number) - \(.note | .[0:50])"'

echo ""
echo "4. Checking if MO is in different position..."
TOTAL=$(echo "$RESPONSE" | jq -r '.data | length')
echo "   Total MOs in response: $TOTAL"

if [ "$TOTAL" -gt 100 ]; then
    echo "   ⚠️  Response has many MOs. MO might be in later pages."
    echo "   Checking last 10 MOs..."
    echo "$RESPONSE" | jq -r '.data[-10:] | .[] | "\(.mo_number) - \(.note | .[0:50])"'
fi

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "If MO not found:"
echo "  1. Check if MO is in response but not visible (large response)"
echo "  2. Check if frontend is filtering the data"
echo "  3. Check if there's pagination limiting results"
echo ""
