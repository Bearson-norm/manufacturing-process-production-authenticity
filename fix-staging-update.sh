#!/bin/bash
# Script untuk troubleshoot staging update di VPS
# File: fix-staging-update.sh
# Cara pakai: ./fix-staging-update.sh

set -e

STAGING_DIR="/home/foom/deployments/manufacturing-app-staging"
STAGING_PORT=5678
DOMAIN="staging.mpr.moof-set.web.id"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Troubleshooting Staging Update...${NC}"
echo ""

# 1. Check directory
echo -e "${YELLOW}1️⃣ Checking staging directory...${NC}"
if [ ! -d "$STAGING_DIR" ]; then
    echo -e "   ${RED}❌ ERROR: Staging directory not found: $STAGING_DIR${NC}"
    exit 1
fi
echo -e "   ${GREEN}✅ Directory exists${NC}"
echo -e "   ${GRAY}Path: $STAGING_DIR${NC}"

# 2. Check files timestamp
echo ""
echo -e "${YELLOW}2️⃣ Checking file timestamps...${NC}"
if [ -f "$STAGING_DIR/client-build/index.html" ]; then
    echo -e "   ${GREEN}✅ index.html exists${NC}"
    echo -e "   ${GRAY}Last modified:${NC}"
    ls -lh "$STAGING_DIR/client-build/index.html" | awk '{print "      " $6, $7, $8, "-", $9}'
else
    echo -e "   ${RED}❌ index.html not found${NC}"
fi

echo ""
echo -e "   ${GRAY}Latest JavaScript files:${NC}"
if ls "$STAGING_DIR/client-build/static/js/"*.js >/dev/null 2>&1; then
    ls -lt "$STAGING_DIR/client-build/static/js/"*.js 2>/dev/null | head -3 | awk '{print "      " $6, $7, $8, "-", $9}'
else
    echo -e "   ${RED}❌ JavaScript files not found${NC}"
fi

echo ""
echo -e "   ${GRAY}Latest CSS files:${NC}"
if ls "$STAGING_DIR/client-build/static/css/"*.css >/dev/null 2>&1; then
    ls -lt "$STAGING_DIR/client-build/static/css/"*.css 2>/dev/null | head -3 | awk '{print "      " $6, $7, $8, "-", $9}'
else
    echo -e "   ${RED}❌ CSS files not found${NC}"
fi

# 3. Check PM2
echo ""
echo -e "${YELLOW}3️⃣ Checking PM2 status...${NC}"
if pm2 list | grep -q "manufacturing-app-staging"; then
    echo -e "   ${GREEN}✅ PM2 process exists${NC}"
    echo ""
    pm2 describe manufacturing-app-staging | grep -E "status|uptime|restarts|cwd" | while read line; do
        echo -e "   ${GRAY}$line${NC}"
    done
else
    echo -e "   ${RED}❌ PM2 process not found${NC}"
fi

# 4. Check port
echo ""
echo -e "${YELLOW}4️⃣ Checking port $STAGING_PORT...${NC}"
if sudo netstat -tlnp 2>/dev/null | grep -q ":$STAGING_PORT "; then
    echo -e "   ${GREEN}✅ Port $STAGING_PORT is listening${NC}"
    PORT_INFO=$(sudo netstat -tlnp 2>/dev/null | grep ":$STAGING_PORT " | head -1)
    echo -e "   ${GRAY}$PORT_INFO${NC}"
else
    echo -e "   ${RED}❌ Port $STAGING_PORT not listening${NC}"
fi

# 5. Test health endpoint
echo ""
echo -e "${YELLOW}5️⃣ Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:$STAGING_PORT/health 2>/dev/null || echo "failed")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "   ${GREEN}✅ Health check passed${NC}"
    echo -e "   ${GRAY}Response: $HEALTH_RESPONSE${NC}"
else
    echo -e "   ${RED}❌ Health check failed${NC}"
    echo -e "   ${GRAY}Response: $HEALTH_RESPONSE${NC}"
fi

# 6. Check nginx
echo ""
echo -e "${YELLOW}6️⃣ Checking nginx...${NC}"
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "   ${GREEN}✅ Nginx config OK${NC}"
else
    echo -e "   ${RED}❌ Nginx config has errors${NC}"
    sudo nginx -t 2>&1 | while read line; do
        echo -e "   ${GRAY}$line${NC}"
    done
fi

# Check nginx is running
if sudo systemctl is-active --quiet nginx; then
    echo -e "   ${GREEN}✅ Nginx is running${NC}"
else
    echo -e "   ${RED}❌ Nginx is not running${NC}"
fi

# 7. Check .env file
echo ""
echo -e "${YELLOW}7️⃣ Checking .env configuration...${NC}"
if [ -f "$STAGING_DIR/server/.env" ]; then
    echo -e "   ${GREEN}✅ .env file exists${NC}"
    echo -e "   ${GRAY}Configuration:${NC}"
    cat "$STAGING_DIR/server/.env" | grep -E "NODE_ENV|PORT|DB_" | while read line; do
        # Hide password
        if echo "$line" | grep -q "DB_PASSWORD"; then
            echo -e "   ${GRAY}DB_PASSWORD=******${NC}"
        else
            echo -e "   ${GRAY}$line${NC}"
        fi
    done
else
    echo -e "   ${RED}❌ .env file not found${NC}"
fi

# 8. Check recent deployment
echo ""
echo -e "${YELLOW}8️⃣ Checking recent deployment...${NC}"
if [ -f "/home/foom/deployments/deploy.tar.gz" ]; then
    echo -e "   ${GRAY}Last deployment package:${NC}"
    ls -lh /home/foom/deployments/deploy.tar.gz | awk '{print "      " $6, $7, $8, "-", $5}'
fi

# Check backups
BACKUPS=$(ls -dt /home/foom/deployments/manufacturing-app-staging-backup-* 2>/dev/null | head -3)
if [ -n "$BACKUPS" ]; then
    echo ""
    echo -e "   ${GRAY}Recent backups:${NC}"
    echo "$BACKUPS" | while read backup; do
        BACKUP_NAME=$(basename "$backup")
        echo -e "      ${GRAY}$BACKUP_NAME${NC}"
    done
fi

# 9. Check PM2 logs for errors
echo ""
echo -e "${YELLOW}9️⃣ Checking PM2 logs for recent errors...${NC}"
if pm2 list | grep -q "manufacturing-app-staging"; then
    ERROR_COUNT=$(pm2 logs manufacturing-app-staging --lines 50 --nostream 2>/dev/null | grep -i "error" | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "   ${RED}⚠️  Found $ERROR_COUNT error(s) in recent logs${NC}"
        echo -e "   ${GRAY}Recent errors:${NC}"
        pm2 logs manufacturing-app-staging --lines 50 --nostream 2>/dev/null | grep -i "error" | tail -5 | while read line; do
            echo -e "      ${GRAY}$line${NC}"
        done
    else
        echo -e "   ${GREEN}✅ No recent errors in logs${NC}"
    fi
    
    echo ""
    echo -e "   ${GRAY}Last 5 log lines:${NC}"
    pm2 logs manufacturing-app-staging --lines 5 --nostream 2>/dev/null | tail -5 | while read line; do
        echo -e "      ${GRAY}$line${NC}"
    done
else
    echo -e "   ${RED}❌ Cannot check logs - PM2 process not found${NC}"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${CYAN}📋 Summary & Suggested Actions:${NC}"
echo ""

# Determine issues
ISSUES_FOUND=0

if ! pm2 list | grep -q "manufacturing-app-staging"; then
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    echo -e "${RED}❌ Issue $ISSUES_FOUND: PM2 process not running${NC}"
    echo -e "   ${GRAY}Fix:${NC}"
    echo -e "   ${GRAY}pm2 restart manufacturing-app-staging${NC}"
    echo -e "   ${GRAY}# Or if not exists:${NC}"
    echo -e "   ${GRAY}cd $STAGING_DIR/server && pm2 start index.js --name manufacturing-app-staging${NC}"
    echo ""
fi

if ! sudo netstat -tlnp 2>/dev/null | grep -q ":$STAGING_PORT "; then
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    echo -e "${RED}❌ Issue $ISSUES_FOUND: Port $STAGING_PORT not listening${NC}"
    echo -e "   ${GRAY}Fix:${NC}"
    echo -e "   ${GRAY}pm2 restart manufacturing-app-staging${NC}"
    echo ""
fi

if ! echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
    echo -e "${RED}❌ Issue $ISSUES_FOUND: Health check failing${NC}"
    echo -e "   ${GRAY}Fix:${NC}"
    echo -e "   ${GRAY}pm2 logs manufacturing-app-staging --lines 30${NC}"
    echo -e "   ${GRAY}# Check for database connection errors${NC}"
    echo ""
fi

if [ "$ISSUES_FOUND" -eq 0 ]; then
    echo -e "${GREEN}✅ No critical issues found!${NC}"
    echo ""
    echo -e "${CYAN}🎯 If changes are not visible in browser:${NC}"
    echo ""
    echo -e "   ${YELLOW}1. Clear nginx cache:${NC}"
    echo -e "   ${GRAY}sudo rm -rf /var/cache/nginx/*${NC}"
    echo -e "   ${GRAY}sudo systemctl reload nginx${NC}"
    echo ""
    echo -e "   ${YELLOW}2. Force PM2 restart with new environment:${NC}"
    echo -e "   ${GRAY}pm2 restart manufacturing-app-staging --update-env${NC}"
    echo ""
    echo -e "   ${YELLOW}3. In browser:${NC}"
    echo -e "   ${GRAY}- Hard Reload: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)${NC}"
    echo -e "   ${GRAY}- Test in Incognito/Private window${NC}"
    echo -e "   ${GRAY}- Clear browser cache${NC}"
    echo ""
else
    echo -e "${YELLOW}⚠️  Found $ISSUES_FOUND issue(s) that need attention${NC}"
    echo ""
fi

# Common fixes
echo -e "${CYAN}🔧 Common Fixes:${NC}"
echo ""
echo -e "${YELLOW}A. Force restart everything:${NC}"
echo -e "${GRAY}pm2 restart manufacturing-app-staging --update-env${NC}"
echo -e "${GRAY}sudo rm -rf /var/cache/nginx/*${NC}"
echo -e "${GRAY}sudo systemctl reload nginx${NC}"
echo ""

echo -e "${YELLOW}B. Re-deploy from GitHub:${NC}"
echo -e "${GRAY}# Trigger re-deployment by updating and pushing to staging branch${NC}"
echo -e "${GRAY}# Or manually run deployment workflow in GitHub Actions${NC}"
echo ""

echo -e "${YELLOW}C. View detailed logs:${NC}"
echo -e "${GRAY}pm2 logs manufacturing-app-staging --lines 100${NC}"
echo -e "${GRAY}sudo tail -f /var/log/nginx/manufacturing-app-staging-error.log${NC}"
echo ""

# Auto-fix option
echo ""
read -p "$(echo -e ${CYAN}Do you want to auto-fix? \(restart PM2 and clear caches\) \[y/N\]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${CYAN}🔧 Applying fixes...${NC}"
    echo ""
    
    # Stop PM2
    echo -e "${GRAY}Stopping PM2...${NC}"
    pm2 stop manufacturing-app-staging 2>/dev/null || echo "Process not running"
    
    # Clear nginx cache
    echo -e "${GRAY}Clearing nginx cache...${NC}"
    sudo rm -rf /var/cache/nginx/* 2>/dev/null || true
    
    # Restart PM2
    echo -e "${GRAY}Restarting PM2...${NC}"
    cd "$STAGING_DIR/server"
    pm2 restart manufacturing-app-staging --update-env
    
    # Wait for startup
    echo -e "${GRAY}Waiting for application to start...${NC}"
    sleep 5
    
    # Reload nginx
    echo -e "${GRAY}Reloading nginx...${NC}"
    sudo systemctl reload nginx
    
    echo ""
    echo -e "${GREEN}✅ Fixes applied!${NC}"
    echo ""
    
    # Test again
    echo -e "${CYAN}📊 Testing after fix...${NC}"
    echo ""
    
    # PM2 status
    echo -e "${YELLOW}PM2 Status:${NC}"
    pm2 status | grep manufacturing-app-staging || echo -e "${RED}Process not found${NC}"
    echo ""
    
    # Health check
    echo -e "${YELLOW}Health Check:${NC}"
    sleep 2
    HEALTH_RESPONSE=$(curl -s http://localhost:$STAGING_PORT/health 2>/dev/null || echo "failed")
    if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
        echo -e "   ${GREEN}✅ Health check: PASSED${NC}"
        echo -e "   ${GRAY}$HEALTH_RESPONSE${NC}"
    else
        echo -e "   ${RED}❌ Health check: FAILED${NC}"
        echo -e "   ${GRAY}$HEALTH_RESPONSE${NC}"
    fi
    echo ""
    
    echo -e "${GREEN}✅ Done!${NC}"
    echo ""
    echo -e "${CYAN}📱 Try accessing:${NC}"
    echo -e "   ${GRAY}http://$DOMAIN${NC}"
    echo -e "   ${GRAY}Remember to hard reload browser: Ctrl+Shift+R${NC}"
else
    echo ""
    echo -e "${GRAY}Skipped auto-fix. You can apply fixes manually using commands above.${NC}"
fi

echo ""
echo -e "${CYAN}📚 Full troubleshooting guide: STAGING_NOT_UPDATING_TROUBLESHOOT.md${NC}"
echo ""
echo -e "${GREEN}✅ Diagnosis complete!${NC}"
