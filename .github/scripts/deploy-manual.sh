#!/bin/bash

# Manual deployment script for Manufacturing App
# Use this if GitHub Actions deployment hasn't run yet

set -e

DEPLOY_DIR="/home/foom/deployments"
APP_DIR="$DEPLOY_DIR/manufacturing-app"
PROJECT_DIR="/var/www/manufacturing-process-production-authenticity"

echo "🚀 Starting manual deployment..."

# Create deployment directory
echo "📁 Creating deployment directory..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/server"
mkdir -p "$APP_DIR/client-build"

# Copy server files
echo "📦 Copying server files..."
if [ -d "$PROJECT_DIR/server" ]; then
    cp -r "$PROJECT_DIR/server"/* "$APP_DIR/server/"
else
    echo "❌ Server directory not found at $PROJECT_DIR/server"
    echo "   Please ensure project is cloned or files are available"
    exit 1
fi

# Copy client build (if exists)
echo "📦 Checking for client build..."
if [ -d "$PROJECT_DIR/client/build" ]; then
    echo "✅ Found client build, copying..."
    cp -r "$PROJECT_DIR/client/build"/* "$APP_DIR/client-build/"
else
    echo "⚠️  Client build not found. Building now..."
    if [ -d "$PROJECT_DIR/client" ]; then
        cd "$PROJECT_DIR/client"
        if [ -f "package.json" ]; then
            echo "📦 Installing client dependencies..."
            npm install
            
            echo "🔨 Building client..."
            npm run build
            
            echo "📦 Copying build..."
            cp -r build/* "$APP_DIR/client-build/"
        else
            echo "⚠️  package.json not found, skipping client build"
        fi
    else
        echo "⚠️  Client directory not found, skipping client build"
    fi
fi

# Install server dependencies
echo "📦 Installing server dependencies..."
cd "$APP_DIR/server"
if [ -f "package.json" ]; then
    npm install --production
else
    echo "❌ package.json not found in server directory"
    exit 1
fi

# Create logs directory
mkdir -p logs

# Start with PM2
echo "🔄 Starting application with PM2..."
pm2 delete manufacturing-app || true

# Check if ecosystem.config.js exists
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js
else
    # Fallback: start directly with cluster mode
    pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster --env production
fi

pm2 save

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📍 Application status:"
pm2 status | grep manufacturing-app || echo "   Check: pm2 status"
echo ""
echo "📍 Application logs:"
echo "   pm2 logs manufacturing-app"
echo ""
echo "📍 Test application:"
echo "   curl http://localhost:1234/health"
echo "   curl http://mpr.moof-set.web.id/api/health"

