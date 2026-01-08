#!/bin/bash

# Script untuk mencari lokasi database di VPS
# Jalankan di VPS: bash find-database.sh

echo "🔍 Mencari lokasi database..."
echo ""

# Warna
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 1. Cari file database.sqlite
echo -e "${BLUE}1. Mencari file database.sqlite...${NC}"
echo ""

FOUND_DB=$(find ~ -name "database.sqlite" -type f 2>/dev/null | head -1)

if [ -n "$FOUND_DB" ]; then
    echo -e "${GREEN}✅ Database ditemukan di:${NC}"
    echo "   $FOUND_DB"
    echo ""
    echo "   Ukuran file:"
    ls -lh "$FOUND_DB" | awk '{print "   " $5}'
    echo ""
    echo "   Untuk akses database:"
    echo "   cd $(dirname "$FOUND_DB")"
    echo "   sqlite3 database.sqlite"
else
    echo -e "${YELLOW}⚠️  Database tidak ditemukan di home directory${NC}"
    echo ""
fi

# 2. Cek PM2 processes
echo -e "${BLUE}2. Cek PM2 processes...${NC}"
echo ""

if command -v pm2 &> /dev/null; then
    PM2_APPS=$(pm2 list | grep -E "manufacturing|backend|api" | awk '{print $2}' | head -1)
    if [ -n "$PM2_APPS" ]; then
        echo -e "${GREEN}✅ PM2 process ditemukan: $PM2_APPS${NC}"
        echo ""
        echo "   Detail process:"
        pm2 describe "$PM2_APPS" | grep -E "cwd|script|name" | sed 's/^/   /'
        echo ""
    else
        echo -e "${YELLOW}⚠️  Tidak ada PM2 process dengan nama manufacturing/backend/api${NC}"
        echo ""
        echo "   Semua PM2 processes:"
        pm2 list | sed 's/^/   /'
        echo ""
    fi
else
    echo -e "${YELLOW}⚠️  PM2 tidak terinstall${NC}"
    echo ""
fi

# 3. Cek folder deployments
echo -e "${BLUE}3. Cek folder deployments...${NC}"
echo ""

if [ -d ~/deployments ]; then
    echo -e "${GREEN}✅ Folder deployments ditemukan${NC}"
    echo ""
    echo "   Isi folder deployments:"
    ls -la ~/deployments/ | sed 's/^/   /'
    echo ""
    
    if [ -d ~/deployments/manufacturing-app ]; then
        echo -e "${GREEN}✅ Folder manufacturing-app ditemukan${NC}"
        echo ""
        echo "   Isi folder:"
        ls -la ~/deployments/manufacturing-app/ | sed 's/^/   /'
        echo ""
        
        if [ -f ~/deployments/manufacturing-app/server/database.sqlite ]; then
            echo -e "${GREEN}✅✅✅ DATABASE DITEMUKAN!${NC}"
            echo ""
            echo "   Lokasi: ~/deployments/manufacturing-app/server/database.sqlite"
            echo "   Path lengkap: $(realpath ~/deployments/manufacturing-app/server/database.sqlite)"
            echo ""
            echo "   Untuk akses:"
            echo "   cd ~/deployments/manufacturing-app/server"
            echo "   sqlite3 database.sqlite"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Folder deployments tidak ditemukan${NC}"
    echo ""
fi

# 4. Cek /var/www
echo -e "${BLUE}4. Cek /var/www...${NC}"
echo ""

if [ -d /var/www ]; then
    echo "   Isi folder /var/www:"
    ls -la /var/www/ 2>/dev/null | sed 's/^/   /' || echo "   (Tidak bisa akses)"
    echo ""
    
    if [ -f /var/www/manufacturing-api/server/database.sqlite ]; then
        echo -e "${GREEN}✅✅✅ DATABASE DITEMUKAN!${NC}"
        echo ""
        echo "   Lokasi: /var/www/manufacturing-api/server/database.sqlite"
        echo ""
        echo "   Untuk akses:"
        echo "   cd /var/www/manufacturing-api/server"
        echo "   sqlite3 database.sqlite"
    fi
else
    echo -e "${YELLOW}⚠️  Folder /var/www tidak ditemukan atau tidak bisa diakses${NC}"
    echo ""
fi

# 5. Cek process yang running
echo -e "${BLUE}5. Cek Node.js processes...${NC}"
echo ""

NODE_PROCS=$(ps aux | grep "node.*index.js" | grep -v grep)
if [ -n "$NODE_PROCS" ]; then
    echo "   Node.js processes yang running:"
    echo "$NODE_PROCS" | sed 's/^/   /'
    echo ""
else
    echo -e "${YELLOW}⚠️  Tidak ada Node.js process yang running${NC}"
    echo ""
fi

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ -n "$FOUND_DB" ]; then
    echo -e "${GREEN}✅ Database ditemukan di:${NC}"
    echo "   $FOUND_DB"
    echo ""
    echo "   Command untuk akses:"
    echo "   cd $(dirname "$FOUND_DB")"
    echo "   sqlite3 database.sqlite"
else
    echo -e "${YELLOW}⚠️  Database tidak ditemukan dengan pencarian otomatis${NC}"
    echo ""
    echo "   Coba jalankan manual:"
    echo "   find ~ -name 'database.sqlite' -type f"
    echo "   find /var/www -name 'database.sqlite' -type f 2>/dev/null"
fi

echo ""

