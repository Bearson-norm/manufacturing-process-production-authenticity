#!/bin/bash
# VPS Migration Script - SQLite to PostgreSQL
# Usage: bash VPS_MIGRATION_SCRIPT.sh

set -e  # Exit on error

echo "=========================================="
echo "VPS PostgreSQL Migration Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/foom/deployments/manufacturing-app/server"
BACKUP_DIR="/home/foom/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# PostgreSQL Configuration
PG_USER="admin"
PG_PASSWORD="Admin123"
PG_DATABASE="manufacturing_db"
PG_PORT="5432"

echo -e "${YELLOW}Step 1: Creating backup directory...${NC}"
mkdir -p $BACKUP_DIR

echo -e "${YELLOW}Step 2: Backing up existing SQLite database...${NC}"
if [ -f "$APP_DIR/database.sqlite" ]; then
    cp "$APP_DIR/database.sqlite" "$BACKUP_DIR/database.sqlite.backup.$TIMESTAMP"
    echo -e "${GREEN}✓ SQLite database backed up${NC}"
else
    echo -e "${RED}⚠ SQLite database not found, skipping backup${NC}"
fi

echo -e "${YELLOW}Step 3: Backing up .env file...${NC}"
if [ -f "$APP_DIR/.env" ]; then
    cp "$APP_DIR/.env" "$APP_DIR/.env.backup.$TIMESTAMP"
    echo -e "${GREEN}✓ .env file backed up${NC}"
else
    echo -e "${RED}⚠ .env file not found${NC}"
fi

echo -e "${YELLOW}Step 4: Checking if PostgreSQL is running...${NC}"
if sudo docker ps | grep -q "manufacturing-postgres"; then
    echo -e "${GREEN}✓ PostgreSQL is already running${NC}"
else
    echo -e "${YELLOW}PostgreSQL not running. Starting PostgreSQL container...${NC}"
    
    # Create PostgreSQL directory
    sudo mkdir -p /opt/postgresql/data
    
    # Create docker-compose.yml if not exists
    if [ ! -f "/opt/postgresql/docker-compose.yml" ]; then
        cat > /tmp/docker-compose.yml <<EOF
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: manufacturing-postgres
    restart: always
    environment:
      POSTGRES_USER: $PG_USER
      POSTGRES_PASSWORD: $PG_PASSWORD
      POSTGRES_DB: $PG_DATABASE
    ports:
      - "$PG_PORT:5432"
    volumes:
      - /opt/postgresql/data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $PG_USER"]
      interval: 10s
      timeout: 5s
      retries: 5
EOF
        sudo mv /tmp/docker-compose.yml /opt/postgresql/docker-compose.yml
    fi
    
    # Start PostgreSQL
    cd /opt/postgresql
    sudo docker-compose up -d
    
    # Wait for PostgreSQL to be ready
    echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
    sleep 10
    
    # Check if PostgreSQL is ready
    for i in {1..30}; do
        if sudo docker exec manufacturing-postgres pg_isready -U $PG_USER > /dev/null 2>&1; then
            echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
fi

echo -e "${YELLOW}Step 5: Verifying PostgreSQL connection...${NC}"
if sudo docker exec manufacturing-postgres psql -U $PG_USER -d $PG_DATABASE -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL connection verified${NC}"
else
    echo -e "${RED}✗ Failed to connect to PostgreSQL${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 6: Installing npm dependencies...${NC}"
cd $APP_DIR
npm install --production > /dev/null 2>&1
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Step 7: Updating .env file...${NC}"
cat > $APP_DIR/.env <<EOF
# Server Configuration
NODE_ENV=production
PORT=1234

# Database Configuration - PostgreSQL
DB_HOST=localhost
DB_PORT=$PG_PORT
DB_NAME=$PG_DATABASE
DB_USER=$PG_USER
DB_PASSWORD=$PG_PASSWORD
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# CORS Configuration
CORS_ORIGIN=https://mpr.moof-set.web.id

# Logging
LOG_LEVEL=info

# Application Settings
APP_NAME=Manufacturing Process Production Authenticity
APP_VERSION=1.0.0
EOF

chmod 600 $APP_DIR/.env
echo -e "${GREEN}✓ .env file updated${NC}"

echo -e "${YELLOW}Step 8: Testing database connection...${NC}"
cd $APP_DIR
if npm run test:db > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database connection test passed${NC}"
else
    echo -e "${RED}✗ Database connection test failed${NC}"
    echo -e "${YELLOW}Check the logs and try manually: cd $APP_DIR && npm run test:db${NC}"
fi

echo -e "${YELLOW}Step 9: Migrating data from SQLite to PostgreSQL...${NC}"
if [ -f "$APP_DIR/database.sqlite" ]; then
    cd $APP_DIR
    npm run migrate
    echo -e "${GREEN}✓ Data migration completed${NC}"
else
    echo -e "${YELLOW}⚠ No SQLite database found, skipping migration${NC}"
    echo -e "${YELLOW}  Tables will be created automatically on first run${NC}"
fi

echo -e "${YELLOW}Step 10: Stopping current PM2 processes...${NC}"
pm2 stop all > /dev/null 2>&1 || true
echo -e "${GREEN}✓ PM2 processes stopped${NC}"

echo -e "${YELLOW}Step 11: Starting application with PostgreSQL...${NC}"
cd $APP_DIR
pm2 start index.js --name manufacturing-server --time
pm2 save
echo -e "${GREEN}✓ Application started${NC}"

echo -e "${YELLOW}Step 12: Waiting for application to initialize...${NC}"
sleep 5

echo -e "${YELLOW}Step 13: Testing health endpoint...${NC}"
if curl -s http://localhost:1234/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo -e "${YELLOW}Check PM2 logs: pm2 logs manufacturing-server${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Migration completed successfully!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Monitor logs: pm2 logs manufacturing-server"
echo "2. Check status: pm2 status"
echo "3. Test endpoints: curl http://localhost:1234/api/pic"
echo "4. Verify from frontend: https://mpr.moof-set.web.id"
echo ""
echo "Backup locations:"
echo "- SQLite backup: $BACKUP_DIR/database.sqlite.backup.$TIMESTAMP"
echo "- .env backup: $APP_DIR/.env.backup.$TIMESTAMP"
echo ""
echo "PostgreSQL management:"
echo "- Connect: sudo docker exec -it manufacturing-postgres psql -U $PG_USER -d $PG_DATABASE"
echo "- Logs: sudo docker logs manufacturing-postgres"
echo "- Restart: sudo docker restart manufacturing-postgres"
echo ""


