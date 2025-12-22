#!/bin/bash

# Setup environment variables on VPS
# This script creates .env file from template if it doesn't exist

set -e

DEPLOY_DIR="/home/foom/deployments/manufacturing-app/server"
ENV_FILE="$DEPLOY_DIR/.env"
ENV_EXAMPLE="$DEPLOY_DIR/.env.example"

echo "🔧 Setting up environment variables..."
echo ""

# Check if .env already exists
if [ -f "$ENV_FILE" ]; then
    echo "✅ .env file already exists at $ENV_FILE"
    echo "   Current configuration:"
    grep -v "^#" "$ENV_FILE" | grep -v "^$" | sed 's/^/   /'
    echo ""
    echo "⚠️  To update, edit: $ENV_FILE"
    echo "   Then restart: pm2 restart manufacturing-app"
    exit 0
fi

# Check if .env.example exists
if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "⚠️  .env.example not found, creating default .env..."
    cat > "$ENV_FILE" << 'EOF'
# Environment Configuration for Production
NODE_ENV=production
PORT=1234
DATABASE_PATH=/home/foom/deployments/manufacturing-app/server/database.sqlite
CORS_ORIGIN=https://mpr.moof-set.web.id
LOG_LEVEL=info
APP_NAME=Manufacturing Process Production Authenticity
APP_VERSION=1.0.0
EOF
else
    echo "📋 Creating .env from .env.example..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    
    # Update production defaults
    sed -i 's/NODE_ENV=development/NODE_ENV=production/' "$ENV_FILE"
    sed -i 's|DATABASE_PATH=./database.sqlite|DATABASE_PATH=/home/foom/deployments/manufacturing-app/server/database.sqlite|' "$ENV_FILE"
    sed -i 's|CORS_ORIGIN=*|CORS_ORIGIN=https://mpr.moof-set.web.id|' "$ENV_FILE"
fi

echo "✅ .env file created at $ENV_FILE"
echo ""
echo "📋 Current configuration:"
grep -v "^#" "$ENV_FILE" | grep -v "^$" | sed 's/^/   /'
echo ""
echo "💡 Edit $ENV_FILE to customize settings"
echo "   Then restart: pm2 restart manufacturing-app"

