#!/bin/bash

# Script untuk update aplikasi di VPS
# Usage: ./update-app.sh [method]
# Methods: git (default), manual, rollback

set -e

METHOD=${1:-git}
REPO_DIR="/var/www/manufacturing-process-production-authenticity"
DEPLOY_DIR="$HOME/deployments/manufacturing-app"
BACKUP_DIR="$HOME/deployments/manufacturing-app-backup-$(date +%Y%m%d-%H%M%S)"

echo "🔄 Starting update process..."
echo "   Method: $METHOD"
echo ""

# Function: Backup current deployment
backup_deployment() {
    if [ -d "$DEPLOY_DIR" ]; then
        echo "📦 Creating backup..."
        cp -r "$DEPLOY_DIR" "$BACKUP_DIR"
        echo "   ✅ Backup created: $BACKUP_DIR"
    fi
}

# Function: Build client
build_client() {
    echo "🔨 Building client..."
    cd "$REPO_DIR/client"
    npm install
    npm run build
    echo "   ✅ Client built successfully"
}

# Function: Deploy files
deploy_files() {
    echo "📦 Deploying files..."
    
    # Create directories
    mkdir -p "$DEPLOY_DIR/server"
    mkdir -p "$DEPLOY_DIR/client-build"
    
    # Copy server files
    cp -r "$REPO_DIR/server"/* "$DEPLOY_DIR/server/"
    
    # Copy client build
    cp -r "$REPO_DIR/client/build"/* "$DEPLOY_DIR/client-build/"
    
    echo "   ✅ Files deployed"
}

# Function: Install dependencies
install_dependencies() {
    echo "📦 Installing server dependencies..."
    cd "$DEPLOY_DIR/server"
    npm install --production
    echo "   ✅ Dependencies installed"
}

# Function: Restart application
restart_app() {
    echo "🔄 Restarting application..."
    
    cd "$DEPLOY_DIR/server"
    mkdir -p logs
    
    # Stop old process
    pm2 delete manufacturing-app || true
    
    # Start new process
    if [ -f ecosystem.config.js ]; then
        pm2 start ecosystem.config.js
    else
        pm2 start index.js --name manufacturing-app --instances max --exec-mode cluster
    fi
    
    pm2 save
    
    echo "   ✅ Application restarted"
}

# Function: Verify deployment
verify_deployment() {
    echo "✅ Verifying deployment..."
    
    # Wait a bit for app to start
    sleep 3
    
    # Check PM2 status
    echo ""
    echo "📋 PM2 Status:"
    pm2 status | grep manufacturing-app || echo "   ⚠️  App not running!"
    
    # Test health endpoint
    echo ""
    echo "📋 Testing health endpoint:"
    HEALTH=$(curl -s http://localhost:1234/health || echo "ERROR")
    if echo "$HEALTH" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"healthy"'; then
        echo "   ✅ Health check: OK"
        echo "   Response: $(echo $HEALTH | head -c 80)..."
    else
        echo "   ⚠️  Health check: FAILED"
        echo "   Response: $HEALTH"
    fi
}

# Function: Git update
update_git() {
    echo "📥 Pulling latest code from Git..."
    cd "$REPO_DIR"
    git pull origin main
    echo "   ✅ Code updated"
}

# Function: Rollback
rollback() {
    echo "⏪ Rolling back to previous backup..."
    
    # List backups
    echo ""
    echo "📋 Available backups:"
    ls -dt "$HOME/deployments/manufacturing-app-backup-"* 2>/dev/null | head -5 | nl
    
    echo ""
    read -p "Enter backup number (or press Enter for latest): " BACKUP_NUM
    
    if [ -z "$BACKUP_NUM" ]; then
        LATEST_BACKUP=$(ls -dt "$HOME/deployments/manufacturing-app-backup-"* 2>/dev/null | head -1)
    else
        LATEST_BACKUP=$(ls -dt "$HOME/deployments/manufacturing-app-backup-"* 2>/dev/null | sed -n "${BACKUP_NUM}p")
    fi
    
    if [ -z "$LATEST_BACKUP" ]; then
        echo "   ❌ No backup found!"
        exit 1
    fi
    
    echo "   Using backup: $LATEST_BACKUP"
    
    # Remove current deployment
    rm -rf "$DEPLOY_DIR"
    
    # Restore backup
    cp -r "$LATEST_BACKUP" "$DEPLOY_DIR"
    
    echo "   ✅ Backup restored"
    
    # Restart app
    restart_app
    verify_deployment
}

# Main execution
case $METHOD in
    git)
        backup_deployment
        update_git
        build_client
        deploy_files
        install_dependencies
        restart_app
        verify_deployment
        ;;
    manual)
        backup_deployment
        build_client
        deploy_files
        install_dependencies
        restart_app
        verify_deployment
        ;;
    rollback)
        rollback
        ;;
    *)
        echo "❌ Unknown method: $METHOD"
        echo ""
        echo "Usage: ./update-app.sh [method]"
        echo "Methods:"
        echo "  git     - Pull from Git, build, and deploy (default)"
        echo "  manual - Build and deploy current code (no git pull)"
        echo "  rollback - Rollback to previous backup"
        exit 1
        ;;
esac

echo ""
echo "✅ Update completed!"
echo ""
echo "📍 Next steps:"
echo "   1. Test website: curl -I https://mpr.moof-set.web.id"
echo "   2. Check logs: pm2 logs manufacturing-app"
echo "   3. Monitor: pm2 monit"

