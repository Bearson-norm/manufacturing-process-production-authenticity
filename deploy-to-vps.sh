#!/bin/bash
# Deployment Script untuk VPS
# Script ini akan: backup, update code, install dependencies, setup PostgreSQL, dan migrasi database

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
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Deployment mode: 'git' (pull from git repo) or 'direct' (upload from local)
DEPLOY_MODE="${1:-direct}"  # Default to 'direct'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Manufacturing App - VPS Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Deployment Mode: ${DEPLOY_MODE}"
echo "  - Git Repo: ${GIT_REPO_PATH}"
echo "  - Deploy Path: ${DEPLOY_PATH}"
echo ""
echo "Usage:"
echo "  ./deploy-to-vps.sh          # Direct upload from local"
echo "  ./deploy-to-vps.sh git      # Pull from git repo"
echo ""

# Step 1: Backup existing database
echo -e "${YELLOW}[1/6] Creating backup...${NC}"
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

# Step 3: Update code
echo -e "${YELLOW}[3/8] Updating code...${NC}"
if [ "$DEPLOY_MODE" = "git" ]; then
    echo "📥 Pulling from git repository..."
    ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
        cd /var/www/manufacturing-process-production-authenticity
        git pull origin main || git pull origin master || echo "⚠️  Git pull failed, continuing..."
        
        # Copy to deployment directory
        echo "📋 Copying files to deployment directory..."
        mkdir -p ~/deployments/manufacturing-app
        rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
            /var/www/manufacturing-process-production-authenticity/ ~/deployments/manufacturing-app/
        echo "✅ Code updated from git repository"
ENDSSH
else
    echo "📤 Uploading code from local..."
    rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
        ./ ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/
    
    # Also update git repo if exists
    ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
        if [ -d /var/www/manufacturing-process-production-authenticity/.git ]; then
            echo "📋 Updating git repository..."
            rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'database.sqlite*' \
                ~/deployments/manufacturing-app/ /var/www/manufacturing-process-production-authenticity/
            cd /var/www/manufacturing-process-production-authenticity
            git add -A || true
            git commit -m "Deployment update $(date +%Y%m%d-%H%M%S)" || true
        fi
ENDSSH
    echo "✅ Code uploaded"
fi

# Step 4: Install PostgreSQL if not exists
echo -e "${YELLOW}[4/8] Checking PostgreSQL installation...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    if ! command -v psql &> /dev/null; then
        echo "Installing PostgreSQL..."
        sudo apt-get update
        sudo apt-get install -y postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        
        # Do not bootstrap DB passwords from this script (no hardcoded secrets).
        echo "⚠️  PostgreSQL installed. Create role/db manually (no password is written by this script):"
        echo "   sudo -u postgres createuser -P admin"
        echo "   sudo -u postgres createdb -O admin manufacturing_db"
        echo "   Then set DB_* in server/.env on the VPS."
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

# Step 6: Setup PostgreSQL user and test connection
echo -e "${YELLOW}[6/8] Setting up PostgreSQL user...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Copy .env if not exists
    if [ ! -f .env ]; then
        cp env.example .env
        echo "✅ Created .env file from env.example"
    fi
    
    # Ensure .env has correct PostgreSQL config
    if ! grep -q "DB_USER=admin" .env; then
        echo "DB_USER=admin" >> .env
    fi
    if ! grep -q "^DB_PASSWORD=" .env 2>/dev/null || grep -q "^DB_PASSWORD=$" .env 2>/dev/null; then
        echo "❌ server/.env must set DB_PASSWORD (no default). Aborting."
        exit 1
    fi
    if ! grep -q "DB_NAME=manufacturing_db" .env; then
        echo "DB_NAME=manufacturing_db" >> .env
    fi
    if ! grep -q "DB_HOST=localhost" .env; then
        echo "DB_HOST=localhost" >> .env
    fi
    # IMPORTANT: Set DB_PORT to 5433 (PostgreSQL running port)
    if ! grep -q "DB_PORT=5433" .env; then
        sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    fi
    
    # Setup PostgreSQL user (fix password if needed)
    if [ -f setup-postgresql-user.sh ]; then
        chmod +x setup-postgresql-user.sh
        sudo bash setup-postgresql-user.sh || {
            echo "⚠️  Setup script failed, trying fix-password script..."
            if [ -f fix-postgresql-password.sh ]; then
                chmod +x fix-postgresql-password.sh
                sudo bash fix-postgresql-password.sh
            fi
        }
    elif [ -f fix-postgresql-password.sh ]; then
        chmod +x fix-postgresql-password.sh
        sudo bash fix-postgresql-password.sh
    fi
    
    # Test connection
    if [ -f test-postgresql-connection.js ]; then
        echo "🔍 Testing PostgreSQL connection..."
        node test-postgresql-connection.js || {
            echo "⚠️  Connection test failed, but continuing..."
        }
    fi
ENDSSH

# Step 7: Verify Dependencies Installed
echo -e "${YELLOW}[7/9] Verifying dependencies...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Check if pg module exists
    if ! npm list pg > /dev/null 2>&1; then
        echo "   Installing pg module..."
        npm install pg
    else
        echo "   ✅ pg module installed"
    fi
ENDSSH

# Step 8: Run migration
echo -e "${YELLOW}[8/9] Running database migration...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Run migration
    node migrate-to-postgresql.js || {
        echo "⚠️  Migration failed, trying alternative script..."
        node migrate-sqlite-to-postgresql-vps.js || {
            echo "❌ Migration failed with both scripts"
            exit 1
        }
    }
ENDSSH
echo "✅ Migration completed"

# Step 9: Build client
echo -e "${YELLOW}[9/10] Building client...${NC}"
ssh ${VPS_USER}@${VPS_HOST} << 'ENDSSH'
    cd ~/deployments/manufacturing-app/client
    npm run build
ENDSSH
echo "✅ Client built"

# Step 10: Start application
echo -e "${YELLOW}[10/10] Starting application...${NC}"
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
