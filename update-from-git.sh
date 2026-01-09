#!/bin/bash
# Script untuk update sistem dari git repository ke running directory
# Git repo: /var/www/manufacturing-process-production-authenticity
# Running: ~/deployments/manufacturing-app

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_USER="foom"
VPS_HOST="103.31.39.189"
GIT_REPO="/var/www/manufacturing-process-production-authenticity"
DEPLOY_PATH="~/deployments/manufacturing-app"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Update System dari Git Repository${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Git Repo: ${GIT_REPO}"
echo "Deploy Path: ${DEPLOY_PATH}"
echo ""

# Step 1: Pull dari git
echo -e "${YELLOW}[1/6] Pulling from git repository...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd /var/www/manufacturing-process-production-authenticity
    
    echo "📥 Pulling latest changes..."
    git pull origin main || git pull origin master || {
        echo "⚠️  Git pull failed, using existing code"
    }
    
    echo "📌 Current commit:"
    git log -1 --oneline || echo "⚠️  Cannot get git info"
ENDSSH
echo "✅ Code pulled from git"

# Step 2: Stop aplikasi
echo -e "${YELLOW}[2/6] Stopping application...${NC}"
ssh ${VPS_USER}@${VPS_HOST} "cd ${DEPLOY_PATH}/server && pm2 stop manufacturing-app || true"
echo "✅ Application stopped"

# Step 3: Copy ke running directory
echo -e "${YELLOW}[3/6] Copying files to deployment directory...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ \
        ~/deployments/manufacturing-app/
    echo "✅ Files copied"
ENDSSH

# Step 4: Install dependencies
echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install
ENDSSH
echo "✅ Dependencies installed"

# Step 5: Setup .env dan build client
echo -e "${YELLOW}[5/6] Setting up .env and building client...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Ensure .env exists and has correct settings
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Ensure DB_PORT=5433
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    
    # Build client
    cd ~/deployments/manufacturing-app/client
    npm run build
ENDSSH
echo "✅ Client built"

# Step 6: Start aplikasi
echo -e "${YELLOW}[6/6] Starting application...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    pm2 restart manufacturing-app || pm2 start ecosystem.config.js
    pm2 save
    
    echo ""
    echo "📊 PM2 Status:"
    pm2 status
ENDSSH
echo "✅ Application started"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Update completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Verification:"
echo "1. Check status: ssh ${VPS_USER}@${VPS_HOST} 'pm2 status'"
echo "2. Check health: curl http://103.31.39.189:1234/health"
echo "3. Check logs: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs manufacturing-app --lines 30'"
