#!/bin/bash

# ========================================
# Manufacturing App - VPS Deployment Script
# ========================================
# Script ini untuk memudahkan deployment update ke VPS
# 
# Usage:
#   ./deploy-to-vps.sh
#
# Prerequisites:
#   - SSH access ke VPS (foom@103.31.39.189)
#   - Git repository sudah di-push
# ========================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# VPS Configuration
VPS_USER="foom"
VPS_HOST="103.31.39.189"
VPS_APP_PATH="~/deployments/manufacturing-app"
PM2_APP_NAME="manufacturing-backend"

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${GREEN}==>${NC} ${BLUE}$1${NC}\n"
}

# Function to execute remote command
remote_exec() {
    ssh ${VPS_USER}@${VPS_HOST} "$1"
}

# Start deployment
print_step "🚀 Starting Deployment to VPS"

# Step 0: Check if repository is pushed
print_step "Step 0: Checking local repository status"
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes. Please commit and push first."
    exit 1
fi

UNPUSHED=$(git log origin/main..HEAD --oneline | wc -l)
if [ $UNPUSHED -gt 0 ]; then
    print_warning "You have $UNPUSHED unpushed commit(s). Please push to origin first."
    print_info "Run: git push origin main"
    exit 1
fi

print_success "Local repository is clean and pushed"

# Step 1: Backup database
print_step "Step 1: Backing up database"
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
remote_exec "cd ${VPS_APP_PATH}/server && cp database.sqlite database.sqlite.backup-${BACKUP_DATE}" && \
    print_success "Database backed up as: database.sqlite.backup-${BACKUP_DATE}" || \
    print_error "Failed to backup database"

# Step 2: Stop PM2 service
print_step "Step 2: Stopping backend service"
remote_exec "pm2 stop ${PM2_APP_NAME}" && \
    print_success "Backend service stopped" || \
    print_warning "Backend service may not be running"

# Step 3: Pull latest code
print_step "Step 3: Pulling latest code from Git"
remote_exec "cd ${VPS_APP_PATH} && git pull origin main" && \
    print_success "Code pulled successfully" || {
        print_error "Failed to pull code"
        remote_exec "pm2 restart ${PM2_APP_NAME}"
        exit 1
    }

# Step 4: Install backend dependencies
print_step "Step 4: Installing backend dependencies"
remote_exec "cd ${VPS_APP_PATH}/server && npm install" && \
    print_success "Backend dependencies installed" || \
    print_error "Failed to install backend dependencies"

# Step 5: Install frontend dependencies
print_step "Step 5: Installing frontend dependencies"
remote_exec "cd ${VPS_APP_PATH}/client && npm install" && \
    print_success "Frontend dependencies installed" || {
        print_error "Failed to install frontend dependencies"
        remote_exec "pm2 restart ${PM2_APP_NAME}"
        exit 1
    }

# Step 6: Build frontend
print_step "Step 6: Building frontend"
remote_exec "cd ${VPS_APP_PATH}/client && npm run build" && \
    print_success "Frontend built successfully" || {
        print_error "Failed to build frontend"
        remote_exec "pm2 restart ${PM2_APP_NAME}"
        exit 1
    }

# Step 7: Restart backend service
print_step "Step 7: Restarting backend service"
remote_exec "pm2 restart ${PM2_APP_NAME}" && \
    print_success "Backend service restarted" || {
        print_error "Failed to restart backend service"
        print_info "Trying to start service..."
        remote_exec "cd ${VPS_APP_PATH}/server && pm2 start npm --name '${PM2_APP_NAME}' -- start && pm2 save"
    }

# Step 8: Check service status
print_step "Step 8: Checking service status"
remote_exec "pm2 status ${PM2_APP_NAME}"

# Step 9: Show recent logs
print_step "Step 9: Showing recent logs"
print_info "Last 20 lines of logs:"
remote_exec "pm2 logs ${PM2_APP_NAME} --lines 20 --nostream"

# Completion
print_step "✅ Deployment Completed Successfully!"

echo ""
print_info "Next steps:"
echo "  1. Test the application: http://103.31.39.189"
echo "  2. Test Manufacturing Report: http://103.31.39.189/report-dashboard"
echo "  3. Test Production Chart: http://103.31.39.189/production-chart"
echo "  4. Add PIC data in Admin panel: http://103.31.39.189/admin"
echo ""
print_info "To monitor logs: ssh ${VPS_USER}@${VPS_HOST} 'pm2 logs ${PM2_APP_NAME}'"
print_info "To check status: ssh ${VPS_USER}@${VPS_HOST} 'pm2 status'"
echo ""
print_success "Deployment backup saved as: database.sqlite.backup-${BACKUP_DATE}"
echo ""

