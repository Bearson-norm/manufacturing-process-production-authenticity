#!/bin/bash
# Deployment Script dari Git Repository
# Script ini akan pull dari git repo lalu deploy ke running directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VPS_USER="foom"
VPS_HOST="103.31.39.189"
GIT_REPO_PATH="/var/www/manufacturing-process-production-authenticity"
DEPLOY_PATH="~/deployments/manufacturing-app"
BACKUP_DIR="~/backups/manufacturing-app"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Manufacturing App - Git Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Git Repo: ${GIT_REPO_PATH}"
echo "Deploy Path: ${DEPLOY_PATH}"
echo ""

# Step 1: Backup existing database
echo -e "${YELLOW}[1/8] Creating backup...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    mkdir -p ~/backups/manufacturing-app
    BACKUP_DIR=~/backups/manufacturing-app
    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    
    if [ -f ~/deployments/manufacturing-app/server/database.sqlite ]; then
        cp ~/deployments/manufacturing-app/server/database.sqlite $BACKUP_DIR/database.sqlite.$TIMESTAMP
        cp ~/deployments/manufacturing-app/server/database.sqlite-wal $BACKUP_DIR/database.sqlite-wal.$TIMESTAMP 2>/dev/null || true
        cp ~/deployments/manufacturing-app/server/database.sqlite-shm $BACKUP_DIR/database.sqlite-shm.$TIMESTAMP 2>/dev/null || true
        echo "✅ Database backup created: database.sqlite.$TIMESTAMP"
    else
        echo "⚠️  No SQLite database found to backup"
    fi
ENDSSH

# Step 2: Stop application
echo -e "${YELLOW}[2/8] Stopping application...${NC}"
ssh ${VPS_USER}@${VPS_HOST} "cd ${DEPLOY_PATH}/server && pm2 stop manufacturing-app || true"
echo "✅ Application stopped"

# Step 3: Pull from git and copy to deployment directory
echo -e "${YELLOW}[3/8] Pulling from git repository...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd /var/www/manufacturing-process-production-authenticity
    
    # Pull latest changes
    echo "📥 Pulling latest changes from git..."
    git pull origin main || git pull origin master || {
        echo "⚠️  Git pull failed, using existing code"
    }
    
    # Show current commit
    echo "📌 Current commit:"
    git log -1 --oneline || echo "⚠️  Cannot get git info"
    
    # Copy to deployment directory
    echo "📋 Copying files to deployment directory..."
    mkdir -p ~/deployments/manufacturing-app
    rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        /var/www/manufacturing-process-production-authenticity/ ~/deployments/manufacturing-app/
    echo "✅ Code updated from git repository"
ENDSSH

# Step 4: Install PostgreSQL if not exists
echo -e "${YELLOW}[4/8] Checking PostgreSQL installation...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    if ! command -v psql &> /dev/null; then
        echo "Installing PostgreSQL..."
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        
        # Create database and user
        sudo -u postgres psql << 'PSQL'
            CREATE USER admin WITH PASSWORD 'Admin123';
            CREATE DATABASE manufacturing_db OWNER admin;
            GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO admin;
            \c manufacturing_db
            GRANT ALL ON SCHEMA public TO admin;
PSQL
        echo "✅ PostgreSQL installed and configured"
    else
        echo "✅ PostgreSQL already installed"
    fi
ENDSSH

# Step 5: Install Node.js dependencies
echo -e "${YELLOW}[5/8] Installing dependencies...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app
    npm install
    
    cd ~/deployments/manufacturing-app/server
    npm install
    
    cd ~/deployments/manufacturing-app/client
    npm install
ENDSSH
echo "✅ Dependencies installed"

# Step 6: Run migration
echo -e "${YELLOW}[6/8] Running database migration...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Copy .env if not exists
    if [ ! -f .env ]; then
        cp env.example .env
        echo "✅ Created .env file from env.example"
    fi
    
    # Run migration
    node migrate-to-postgresql.js
ENDSSH
echo "✅ Migration completed"

# Step 7: Build client
echo -e "${YELLOW}[7/8] Building client...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/client
    npm run build
ENDSSH
echo "✅ Client built"

# Step 8: Start application
echo -e "${YELLOW}[8/8] Starting application...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    pm2 save
ENDSSH
echo "✅ Application started"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Check application status: ssh ${VPS_USER}@${VPS_HOST} 'pm2 status'"
echo "2. Check logs: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs manufacturing-app'"
echo "3. Verify database: ssh ${VPS_USER}@${VPS_HOST} 'cd ~/deployments/manufacturing-app/server && node check-data.js'"
