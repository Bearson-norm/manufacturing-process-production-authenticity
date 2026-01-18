#!/bin/bash
# Safe Restart Script - After Emergency Fix
# Use this to restart manufacturing-app safely

echo "=========================================="
echo "SAFE RESTART - Manufacturing App"
echo "=========================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOY_DIR="/home/foom/deployments/manufacturing-app/server"
BACKUP_DIR="/home/foom/backups"

echo -e "${BLUE}=== STEP 1: BACKUP CURRENT CONFIG ===${NC}"
mkdir -p $BACKUP_DIR
cp $DEPLOY_DIR/ecosystem.config.js $BACKUP_DIR/ecosystem.config.js.backup-$(date +%Y%m%d-%H%M%S)
echo -e "${GREEN}✓ Config backed up${NC}"
echo ""

echo -e "${BLUE}=== STEP 2: CREATE SAFE CONFIG ===${NC}"
cat > $DEPLOY_DIR/ecosystem.safe.config.js << 'EOF'
// Safe PM2 Configuration - Reduced Instances
// Use this after crash loop to test stability

module.exports = {
  apps: [
    {
      name: 'manufacturing-app',
      script: './index.js',
      instances: 2,  // REDUCED from 'max' (16) to 2
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 1234
      },
      // Auto restart with limits
      autorestart: true,
      max_restarts: 5,           // Stop after 5 restarts
      min_uptime: '30s',         // Must stay up 30s
      restart_delay: 5000,       // Wait 5s before restart
      exp_backoff_restart_delay: 100,  // Exponential backoff
      
      // Memory
      max_memory_restart: '500M',  // Restart if exceed 500MB
      
      // Logging
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
EOF
echo -e "${GREEN}✓ Safe config created: ecosystem.safe.config.js${NC}"
echo ""

echo -e "${BLUE}=== STEP 3: STOP EXISTING INSTANCES ===${NC}"
pm2 stop manufacturing-app 2>/dev/null || echo "Already stopped"
pm2 delete manufacturing-app 2>/dev/null || echo "Already deleted"
echo -e "${GREEN}✓ Cleaned up${NC}"
echo ""

echo -e "${BLUE}=== STEP 4: CHECK DATABASE ===${NC}"
echo "Restarting PostgreSQL for clean state..."
docker restart whac-postgres
echo "Waiting for database to be ready..."
sleep 10

until docker exec whac-postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo -e "${GREEN}✓ Database ready${NC}"
echo ""

echo -e "${BLUE}=== STEP 5: START WITH SAFE CONFIG ===${NC}"
cd $DEPLOY_DIR
pm2 start ecosystem.safe.config.js
echo ""

echo -e "${BLUE}=== STEP 6: MONITOR FOR 30 SECONDS ===${NC}"
echo "Watching for stability..."
for i in {1..6}; do
    sleep 5
    echo "[$i/6] Status:"
    pm2 status | grep manufacturing-app
    
    # Check if crashed
    STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="manufacturing-app") | .pm2_env.status' | head -1)
    if [ "$STATUS" != "online" ]; then
        echo -e "${RED}❌ App crashed during startup!${NC}"
        echo ""
        echo "Showing last errors:"
        pm2 logs manufacturing-app --lines 30 --err --nostream
        echo ""
        echo "App is not stable. Manual investigation needed."
        exit 1
    fi
done
echo ""

echo -e "${BLUE}=== STEP 7: CHECK RESTART COUNT ===${NC}"
RESTART_COUNT=$(pm2 jlist | jq -r '.[] | select(.name=="manufacturing-app") | .pm2_env.restart_time' | head -1)
echo "Restart count: $RESTART_COUNT"

if [ "$RESTART_COUNT" -le 1 ]; then
    echo -e "${GREEN}✓ App is stable!${NC}"
else
    echo -e "${YELLOW}⚠️  App restarted $RESTART_COUNT times in 30 seconds${NC}"
    echo "Check logs: pm2 logs manufacturing-app"
fi
echo ""

echo -e "${BLUE}=== STEP 8: SAVE PM2 STATE ===${NC}"
pm2 save
echo -e "${GREEN}✓ PM2 state saved${NC}"
echo ""

echo "=========================================="
echo -e "${GREEN}SAFE RESTART COMPLETE${NC}"
echo "=========================================="
echo ""

pm2 status
echo ""

echo -e "${YELLOW}POST-RESTART CHECKLIST:${NC}"
echo ""
echo "1. Monitor for next 5 minutes:"
echo "   watch -n 5 'pm2 status'"
echo ""
echo "2. Check logs for errors:"
echo "   pm2 logs manufacturing-app"
echo ""
echo "3. Test health endpoint:"
echo "   curl http://localhost:1234/health"
echo ""
echo "4. Test website:"
echo "   curl -I https://mpr.moof-set.web.id"
echo ""
echo "5. If stable after 5 minutes, gradually increase instances:"
echo "   pm2 scale manufacturing-app 4"
echo "   # Wait and monitor"
echo "   pm2 scale manufacturing-app 8"
echo "   # Continue until desired instance count"
echo ""
echo "6. If crashes again, check root cause in logs:"
echo "   pm2 logs manufacturing-app --lines 100 --err"
echo ""
echo -e "${GREEN}Good luck! Monitor closely for stability.${NC}"
