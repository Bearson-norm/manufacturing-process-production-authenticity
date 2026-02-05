#!/bin/bash
# Quick Cleanup Script - Manufacturing App VPS
# Cleans Docker, old deployments, npm cache, and nginx logs
# WARNING: Review before running!

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=========================================="
echo "QUICK CLEANUP SCRIPT"
echo "==========================================${NC}"
echo ""

# Show current disk usage
echo -e "${BLUE}=== Current Disk Usage ===${NC}"
df -h /
echo ""

# Safety check: Verify PM2 status
echo -e "${BLUE}=== Safety Check: PM2 Status ===${NC}"
pm2 status
echo ""
echo -e "${YELLOW}⚠️  Please verify that all deployments are running correctly above.${NC}"
read -p "Are deployments running correctly? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted. Please check PM2 status first.${NC}"
    exit 1
fi

# Show what will be cleaned
echo ""
echo -e "${BLUE}=== What Will Be Cleaned ===${NC}"
echo "1. Docker unused images: ~5.892GB"
echo "2. Old deployments (2026-01-22): ~906MB"
echo "3. NPM cache: ~92MB"
echo "4. Nginx logs: ~17MB"
echo ""
echo -e "${YELLOW}Total expected to free: ~6.9GB${NC}"
echo ""
read -p "Proceed with cleanup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted.${NC}"
    exit 1
fi

# 1. Clean Docker (5.892GB)
echo ""
echo -e "${BLUE}=== 1. Cleaning Docker (5.892GB) ===${NC}"
if command -v docker &> /dev/null; then
    echo "Current Docker usage:"
    docker system df
    echo ""
    read -p "Proceed with Docker cleanup? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleaning unused Docker images..."
        docker image prune -a -f
        echo "Cleaning Docker build cache..."
        docker builder prune -f
        echo -e "${GREEN}✅ Docker cleaned${NC}"
        echo ""
        echo "Docker usage after cleanup:"
        docker system df
    else
        echo -e "${YELLOW}Skipped Docker cleanup${NC}"
    fi
else
    echo -e "${YELLOW}Docker not found, skipping...${NC}"
fi

# 2. Remove old deployments (906MB)
echo ""
echo -e "${BLUE}=== 2. Removing Old Deployments (906MB) ===${NC}"
cd /home/foom/deployments
echo "Current deployments:"
ls -lh | grep backup | head -10
echo ""
echo -e "${YELLOW}Will remove:${NC}"
echo "  - manufacturing-app-backup-20260122-164024 (453M)"
echo "  - manufacturing-app-backup-20260122-162129 (453M)"
echo ""
read -p "Remove these old backups? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "manufacturing-app-backup-20260122-164024" ]; then
        echo "Removing manufacturing-app-backup-20260122-164024..."
        rm -rf manufacturing-app-backup-20260122-164024
    fi
    if [ -d "manufacturing-app-backup-20260122-162129" ]; then
        echo "Removing manufacturing-app-backup-20260122-162129..."
        rm -rf manufacturing-app-backup-20260122-162129
    fi
    echo -e "${GREEN}✅ Old deployments removed${NC}"
    echo ""
    echo "Remaining deployments:"
    du -sh /home/foom/deployments/* 2>/dev/null | sort -hr | head -10
else
    echo -e "${YELLOW}Skipped deployment cleanup${NC}"
fi

# 3. Clean npm cache (92MB)
echo ""
echo -e "${BLUE}=== 3. Cleaning NPM Cache (92MB) ===${NC}"
if command -v npm &> /dev/null; then
    echo "Current NPM cache size:"
    du -sh ~/.npm 2>/dev/null || echo "NPM cache not found"
    echo ""
    read -p "Clean NPM cache? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm cache clean --force
        echo -e "${GREEN}✅ NPM cache cleaned${NC}"
        echo "NPM cache size after cleanup:"
        du -sh ~/.npm 2>/dev/null || echo "NPM cache not found"
    else
        echo -e "${YELLOW}Skipped NPM cache cleanup${NC}"
    fi
else
    echo -e "${YELLOW}NPM not found, skipping...${NC}"
fi

# 4. Rotate nginx logs (17MB)
echo ""
echo -e "${BLUE}=== 4. Rotating Nginx Logs (17MB) ===${NC}"
if [ -d "/var/log/nginx" ]; then
    echo "Current Nginx logs size:"
    sudo du -sh /var/log/nginx 2>/dev/null || echo "Need sudo to check"
    echo ""
    read -p "Rotate Nginx logs? (requires sudo) (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo truncate -s 0 /var/log/nginx/*.log 2>/dev/null || echo "Some logs may require different permissions"
        sudo systemctl reload nginx 2>/dev/null || echo "Nginx reload may have failed, but logs are cleared"
        echo -e "${GREEN}✅ Nginx logs rotated${NC}"
    else
        echo -e "${YELLOW}Skipped Nginx log rotation${NC}"
    fi
else
    echo -e "${YELLOW}Nginx logs directory not found, skipping...${NC}"
fi

# Final check
echo ""
echo -e "${CYAN}=========================================="
echo "CLEANUP COMPLETE"
echo "==========================================${NC}"
echo ""

echo -e "${BLUE}=== Final Disk Usage ===${NC}"
df -h /
echo ""

echo -e "${BLUE}=== Final Deployments Size ===${NC}"
du -sh /home/foom/deployments/* 2>/dev/null | sort -hr | head -10
echo ""

echo -e "${BLUE}=== PM2 Status (Verify Apps Still Running) ===${NC}"
pm2 status
echo ""

echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify PM2 status above"
echo "2. Test health endpoint: curl http://localhost:5678/health"
echo "3. Monitor disk usage: watch -n 60 'df -h /'"
