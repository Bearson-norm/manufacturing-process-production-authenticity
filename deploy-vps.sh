#!/bin/bash
# One-command VPS Deployment Script
# Usage: bash deploy-vps.sh [VPS_HOST] [VPS_USER]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

# Configuration
VPS_HOST=${1:-"your-vps-ip"}
VPS_USER=${2:-"foom"}
VPS_APP_DIR="/home/$VPS_USER/deployments/manufacturing-app/server"

echo -e "${BLUE}=========================================="
echo "🚀 VPS PostgreSQL Deployment"
echo -e "==========================================${NC}\n"

if [ "$VPS_HOST" == "your-vps-ip" ]; then
    echo -e "${RED}Error: Please provide VPS host!${NC}"
    echo "Usage: bash deploy-vps.sh VPS_HOST [VPS_USER]"
    echo "Example: bash deploy-vps.sh 123.456.789.0 foom"
    exit 1
fi

echo -e "${YELLOW}Configuration:${NC}"
echo "  VPS Host: $VPS_HOST"
echo "  VPS User: $VPS_USER"
echo "  App Directory: $VPS_APP_DIR"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo -e "\n${YELLOW}Step 1: Uploading application files...${NC}"
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'database.sqlite*' \
  --exclude '.env' \
  --exclude '.git' \
  server/ $VPS_USER@$VPS_HOST:$VPS_APP_DIR/

echo -e "${GREEN}✓ Application files uploaded${NC}\n"

echo -e "${YELLOW}Step 2: Uploading migration script...${NC}"
scp VPS_MIGRATION_SCRIPT.sh $VPS_USER@$VPS_HOST:/home/$VPS_USER/
echo -e "${GREEN}✓ Migration script uploaded${NC}\n"

echo -e "${YELLOW}Step 3: Uploading documentation...${NC}"
scp VPS_POSTGRESQL_MIGRATION.md $VPS_USER@$VPS_HOST:/home/$VPS_USER/
scp DEPLOY_TO_VPS.md $VPS_USER@$VPS_HOST:/home/$VPS_USER/
echo -e "${GREEN}✓ Documentation uploaded${NC}\n"

echo -e "${YELLOW}Step 4: Connecting to VPS and running migration...${NC}\n"

ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
set -e

cd /home/foom

# Make script executable
chmod +x VPS_MIGRATION_SCRIPT.sh

# Run migration
echo "Running migration script..."
bash VPS_MIGRATION_SCRIPT.sh

ENDSSH

echo -e "\n${GREEN}=========================================="
echo "✅ Deployment completed successfully!"
echo -e "==========================================${NC}\n"

echo -e "${BLUE}Next steps:${NC}"
echo "1. SSH to VPS: ssh $VPS_USER@$VPS_HOST"
echo "2. Check status: pm2 status"
echo "3. View logs: pm2 logs manufacturing-server"
echo "4. Test health: curl http://localhost:1234/health"
echo ""
echo -e "${BLUE}Testing:${NC}"
echo "curl https://mpr.moof-set.web.id/api/health"
echo ""
echo -e "${YELLOW}Monitor the application for 24-48 hours${NC}"
echo ""


