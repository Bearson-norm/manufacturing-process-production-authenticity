#!/bin/bash
# Quick verification script untuk VPS

echo "=========================================="
echo "  Verify MO Filter di VPS"
echo "=========================================="
echo ""

VPS_USER="${1:-foom}"
VPS_HOST="${2:-ProductionDashboard}"
APP_PATH="/home/$VPS_USER/deployments/manufacturing-app"
DB_HOST="localhost"
DB_PORT="5433"
DB_NAME="manufacturing_db"
DB_USER="admin"

echo "1. Checking code deployment..."
ssh $VPS_USER@$VPS_HOST << EOF
cd $APP_PATH

echo "   Checking filter code..."
if grep -q "TEAM LIQUID" server/index.js; then
    echo "   ✅ Filter code found"
    grep -n "queryParams.push.*TEAM LIQUID" server/index.js
else
    echo "   ❌ Filter code NOT found!"
    echo "   Code belum ter-deploy!"
    exit 1
fi

echo ""
echo "   Checking query parameter binding..."
if grep -q "LOWER(note) LIKE LOWER(?)" server/index.js; then
    echo "   ✅ Parameter binding correct (using ?)"
else
    echo "   ⚠️  Parameter binding might be wrong"
    grep -n "LOWER(note) LIKE LOWER" server/index.js | head -3
fi
EOF

echo ""
echo "2. Checking database cache..."
ssh $VPS_USER@$VPS_HOST << EOF
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << SQL
SELECT 
  mo_number, 
  SUBSTRING(note, 1, 50) as note_preview,
  create_date,
  fetched_at
FROM odoo_mo_cache 
WHERE mo_number = 'PROD/MO/29928';
SQL
EOF

echo ""
echo "3. Testing query manually..."
ssh $VPS_USER@$VPS_HOST << EOF
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << SQL
SELECT 
  mo_number, 
  CASE 
    WHEN LOWER(note) LIKE '%team liquid%' THEN '✅ MATCH TEAM LIQUID'
    WHEN LOWER(note) LIKE '%liquid%' THEN '✅ MATCH liquid'
    ELSE '❌ NO MATCH'
  END as match_status,
  SUBSTRING(note, 1, 60) as note_preview
FROM odoo_mo_cache 
WHERE mo_number = 'PROD/MO/29928';
SQL
EOF

echo ""
echo "4. Testing full query..."
ssh $VPS_USER@$VPS_HOST << EOF
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME << SQL
SELECT 
  COUNT(*) as total_matching,
  COUNT(CASE WHEN LOWER(note) LIKE '%team liquid%' THEN 1 END) as team_liquid_count,
  COUNT(CASE WHEN LOWER(note) LIKE '%liquid%' THEN 1 END) as liquid_count
FROM odoo_mo_cache
WHERE (
  LOWER(note) LIKE LOWER('%liquid%')
  OR LOWER(note) LIKE LOWER('%TEAM LIQUID%')
)
AND create_date::TIMESTAMP >= NOW() - INTERVAL '30 days';
SQL
EOF

echo ""
echo "5. Checking server logs..."
ssh $VPS_USER@$VPS_HOST << EOF
echo "   Recent logs (last 50 lines with 'liquid' or 'MO List'):"
pm2 logs manufacturing-app --lines 200 --nostream | grep -i "liquid\|MO List" | tail -20
EOF

echo ""
echo "6. Triggering API test..."
ssh $VPS_USER@$VPS_HOST << EOF
echo "   Triggering API call..."
curl -s "http://localhost:1234/api/odoo/mo-list?productionType=liquid" | jq '.count, .data[0:3] | {mo_number, note}' 2>/dev/null || echo "   ⚠️  jq not installed or API error"
EOF

echo ""
echo "=========================================="
echo "Verification Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. If code not found → Deploy code"
echo "  2. If MO not in cache → Trigger sync"
echo "  3. If query fails → Check logs for errors"
echo "  4. If still not working → Compare with localhost"
echo ""
