#!/bin/bash

# Script untuk setup Uptime Kuma di VPS pada port 1212
# Usage: ./setup-uptime-kuma.sh

set -e

echo "🚀 Starting Uptime Kuma Setup..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please don't run this script as root. Run as your user (foom) and use sudo when needed.${NC}"
   exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is in use
check_port() {
    if sudo lsof -i :$1 >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Check if port 1212 is available
echo "🔍 Checking if port 1212 is available..."
if check_port 1212; then
    echo -e "${YELLOW}⚠️  Port 1212 is already in use!${NC}"
    echo "Processes using port 1212:"
    sudo lsof -i :1212
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 1
    fi
else
    echo -e "${GREEN}✅ Port 1212 is available${NC}"
fi

# Ask for installation method
echo ""
echo "Select installation method:"
echo "1) Docker (Recommended) ⭐"
echo "2) Node.js + PM2"
read -p "Enter choice [1-2]: " -n 1 -r
echo
INSTALL_METHOD=$REPLY

if [ "$INSTALL_METHOD" != "1" ] && [ "$INSTALL_METHOD" != "2" ]; then
    echo -e "${RED}❌ Invalid choice. Exiting...${NC}"
    exit 1
fi

# Method 1: Docker
if [ "$INSTALL_METHOD" == "1" ]; then
    echo ""
    echo "🐳 Installing Uptime Kuma using Docker..."
    
    # Check if Docker is installed
    if ! command_exists docker; then
        echo "📦 Installing Docker..."
        curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
        sudo sh /tmp/get-docker.sh
        sudo usermod -aG docker $USER
        echo -e "${GREEN}✅ Docker installed${NC}"
        echo -e "${YELLOW}⚠️  You need to logout and login again, or run: newgrp docker${NC}"
        echo "Press Enter to continue (after logout/login if needed)..."
        read
    else
        echo -e "${GREEN}✅ Docker is already installed${NC}"
    fi
    
    # Check if Docker Compose is installed
    if ! command_exists docker-compose; then
        echo "📦 Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        echo -e "${GREEN}✅ Docker Compose installed${NC}"
    else
        echo -e "${GREEN}✅ Docker Compose is already installed${NC}"
    fi
    
    # Create directory
    echo "📁 Creating directory..."
    mkdir -p ~/uptime-kuma
    cd ~/uptime-kuma
    
    # Create docker-compose.yml
    echo "📝 Creating docker-compose.yml..."
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    volumes:
      - ./data:/app/data
    ports:
      - "1212:3001"
    restart: unless-stopped
    environment:
      - UPTIME_KUMA_PORT=3001
EOF
    
    # Start container
    echo "🚀 Starting Uptime Kuma container..."
    docker-compose up -d
    
    # Wait a bit for container to start
    sleep 5
    
    # Check status
    if docker ps | grep -q uptime-kuma; then
        echo -e "${GREEN}✅ Uptime Kuma is running!${NC}"
        echo ""
        echo "📊 Container status:"
        docker ps | grep uptime-kuma
        echo ""
        echo "📋 Logs (last 20 lines):"
        docker logs uptime-kuma --tail 20
    else
        echo -e "${RED}❌ Failed to start Uptime Kuma${NC}"
        echo "Check logs:"
        docker logs uptime-kuma
        exit 1
    fi
    
    # Setup systemd service (optional)
    echo ""
    read -p "Do you want to setup systemd service for auto-start? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📝 Creating systemd service..."
        sudo tee /etc/systemd/system/uptime-kuma.service > /dev/null << EOF
[Unit]
Description=Uptime Kuma
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$HOME/uptime-kuma
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable uptime-kuma
        echo -e "${GREEN}✅ Systemd service created and enabled${NC}"
    fi

# Method 2: Node.js + PM2
else
    echo ""
    echo "📦 Installing Uptime Kuma using Node.js + PM2..."
    
    # Check Node.js
    if ! command_exists node; then
        echo "📦 Installing Node.js 18..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
        echo -e "${GREEN}✅ Node.js installed${NC}"
    else
        NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 16 ]; then
            echo -e "${YELLOW}⚠️  Node.js version is too old (need 16+). Installing Node.js 18...${NC}"
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        else
            echo -e "${GREEN}✅ Node.js is installed (version: $(node --version))${NC}"
        fi
    fi
    
    # Check PM2
    if ! command_exists pm2; then
        echo "📦 Installing PM2..."
        sudo npm install -g pm2
        echo -e "${GREEN}✅ PM2 installed${NC}"
    else
        echo -e "${GREEN}✅ PM2 is already installed${NC}"
    fi
    
    # Check git
    if ! command_exists git; then
        echo "📦 Installing git..."
        sudo apt update
        sudo apt install -y git
        echo -e "${GREEN}✅ Git installed${NC}"
    fi
    
    # Clone repository
    echo "📥 Cloning Uptime Kuma repository..."
    if [ -d ~/uptime-kuma ]; then
        echo -e "${YELLOW}⚠️  Directory ~/uptime-kuma already exists${NC}"
        read -p "Do you want to remove it and clone fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf ~/uptime-kuma
        else
            echo "Using existing directory..."
        fi
    fi
    
    if [ ! -d ~/uptime-kuma ]; then
        cd ~
        git clone https://github.com/louislam/uptime-kuma.git
        echo -e "${GREEN}✅ Repository cloned${NC}"
    fi
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    cd ~/uptime-kuma
    npm ci --production || npm install --production
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    
    # Create data directory
    echo "📁 Creating data directory..."
    mkdir -p ~/uptime-kuma-data
    mkdir -p ~/uptime-kuma/logs
    
    # Create ecosystem config
    echo "📝 Creating PM2 ecosystem config..."
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'uptime-kuma',
    script: 'server/server.js',
    cwd: '$HOME/uptime-kuma',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      UPTIME_KUMA_PORT: 1212,
      UPTIME_KUMA_DATA_DIR: '$HOME/uptime-kuma-data'
    },
    error_file: './logs/uptime-kuma-error.log',
    out_file: './logs/uptime-kuma-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF
    
    # Start with PM2
    echo "🚀 Starting Uptime Kuma with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    
    # Setup PM2 startup
    echo ""
    read -p "Do you want to setup PM2 startup script? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 startup
        echo -e "${YELLOW}⚠️  Please run the command shown above with sudo${NC}"
    fi
    
    # Check status
    sleep 3
    if pm2 list | grep -q uptime-kuma; then
        echo -e "${GREEN}✅ Uptime Kuma is running!${NC}"
        echo ""
        echo "📊 PM2 status:"
        pm2 status uptime-kuma
        echo ""
        echo "📋 Logs (last 20 lines):"
        pm2 logs uptime-kuma --lines 20 --nostream
    else
        echo -e "${RED}❌ Failed to start Uptime Kuma${NC}"
        echo "Check logs:"
        pm2 logs uptime-kuma --err
        exit 1
    fi
fi

# Configure firewall
echo ""
read -p "Do you want to configure firewall to allow port 1212? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command_exists ufw; then
        echo "🔥 Configuring UFW firewall..."
        sudo ufw allow 1212/tcp
        echo -e "${GREEN}✅ Firewall configured${NC}"
    else
        echo -e "${YELLOW}⚠️  UFW not found. Please configure firewall manually${NC}"
    fi
fi

# Final instructions
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Uptime Kuma Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "🌐 Access Uptime Kuma at:"
echo "   - Local: http://localhost:1212"
echo "   - External: http://103.31.39.189:1212"
echo ""
echo "📝 Next steps:"
echo "   1. Open Uptime Kuma in your browser"
echo "   2. Create your admin account (first time only)"
echo "   3. Start adding monitors for your services"
echo ""
echo "📚 Useful commands:"
if [ "$INSTALL_METHOD" == "1" ]; then
    echo "   - View logs: docker logs -f uptime-kuma"
    echo "   - Restart: cd ~/uptime-kuma && docker-compose restart"
    echo "   - Stop: cd ~/uptime-kuma && docker-compose down"
    echo "   - Update: cd ~/uptime-kuma && docker-compose pull && docker-compose up -d"
else
    echo "   - View logs: pm2 logs uptime-kuma"
    echo "   - Restart: pm2 restart uptime-kuma"
    echo "   - Stop: pm2 stop uptime-kuma"
    echo "   - Status: pm2 status uptime-kuma"
fi
echo ""
echo -e "${GREEN}Happy Monitoring! 🎉${NC}"







