#!/bin/bash

# Manual deployment script for Manufacturing App
# Use this if GitHub Actions deployment hasn't run yet

set -e

# Detect current user
CURRENT_USER=${SUDO_USER:-$USER}
if [ "$CURRENT_USER" = "root" ]; then
    CURRENT_USER="foom"
fi

DEPLOY_DIR="/home/$CURRENT_USER/deployments"
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
    # Fix permissions
    chmod -R 755 "$APP_DIR/client-build"
    find "$APP_DIR/client-build" -type f -exec chmod 644 {} \;
else
    echo "⚠️  Client build not found. Building now..."
    if [ -d "$PROJECT_DIR/client" ]; then
        cd "$PROJECT_DIR/client"
        if [ -f "package.json" ]; then
            echo "📦 Installing client dependencies..."
            npm install
            
            echo "🔨 Building client..."
            npm run build
            
            if [ -d "build" ]; then
                echo "📦 Copying build..."
                cp -r build/* "$APP_DIR/client-build/"
                # Fix permissions
                chmod -R 755 "$APP_DIR/client-build"
                find "$APP_DIR/client-build" -type f -exec chmod 644 {} \;
                echo "✅ Client build copied and permissions set"
            else
                echo "❌ Build directory not created!"
            fi
        else
            echo "⚠️  package.json not found, skipping client build"
        fi
    else
        echo "⚠️  Client directory not found, skipping client build"
    fi
fi

# Ensure nginx can read the files
echo "🔧 Setting permissions for Nginx..."
if [ -d "$APP_DIR/client-build" ]; then
    # Make readable by www-data (nginx user)
    sudo chmod -R o+r "$APP_DIR/client-build" 2>/dev/null || true
    sudo chmod o+x "$APP_DIR" 2>/dev/null || true
    sudo chmod o+x "$APP_DIR/client-build" 2>/dev/null || true
    echo "✅ Permissions set for Nginx"
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

# Start with PM2 (use sudo if running as root, otherwise use current user)
echo "🔄 Starting application with PM2..."
if [ "$(id -u)" -eq 0 ]; then
    # Running as root
    PM2_CMD="pm2"
    PM2_HOME="/root/.pm2"
else
    # Running as regular user
    PM2_CMD="pm2"
    PM2_HOME="$HOME/.pm2"
fi

$PM2_CMD delete manufacturing-app || true

# Check if ecosystem.config.js exists
if [ -f "ecosystem.config.js" ]; then
    $PM2_CMD start ecosystem.config.js
else
    # Fallback: start directly with cluster mode
    $PM2_CMD start index.js --name manufacturing-app --instances max --exec-mode cluster --env production
fi

$PM2_CMD save

echo ""
echo "📊 PM2 Status:"
$PM2_CMD status | grep manufacturing-app || $PM2_CMD list | grep manufacturing-app

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

