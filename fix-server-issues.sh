#!/bin/bash

# Script untuk memperbaiki masalah server
# Author: System Administrator
# Date: 2026-01-17

echo "======================================"
echo "FIX SERVER ISSUES - VPS"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Remove warehouse-ui from PM2 (karena seharusnya pakai Docker)
echo -e "${YELLOW}[1/5] Menghapus warehouse-ui dari PM2...${NC}"
pm2 delete warehouse-ui 2>/dev/null || echo "warehouse-ui tidak ada di PM2 atau sudah dihapus"
pm2 save
echo -e "${GREEN}✓ Selesai${NC}"
echo ""

# 2. Restart manufacturing-app-staging
echo -e "${YELLOW}[2/5] Restart manufacturing-app-staging...${NC}"
pm2 restart manufacturing-app-staging
echo -e "${GREEN}✓ Selesai${NC}"
echo ""

# 3. Check Docker containers
echo -e "${YELLOW}[3/5] Memeriksa Docker containers...${NC}"
docker ps -a
echo ""

# 4. Check if warehouse-ui Docker container exists
echo -e "${YELLOW}[4/5] Mencari warehouse-ui di Docker...${NC}"
if docker ps -a | grep -q "warehouse-ui"; then
    echo -e "${GREEN}✓ warehouse-ui ditemukan di Docker${NC}"
    
    # Check if it's running
    if docker ps | grep -q "warehouse-ui"; then
        echo -e "${GREEN}✓ warehouse-ui sedang berjalan${NC}"
    else
        echo -e "${RED}✗ warehouse-ui tidak berjalan, mencoba start...${NC}"
        docker start warehouse-ui
    fi
else
    echo -e "${RED}✗ warehouse-ui TIDAK ditemukan di Docker${NC}"
    echo -e "${YELLOW}  Anda perlu membuat Docker container untuk warehouse-ui${NC}"
fi
echo ""

# 5. Display PM2 status
echo -e "${YELLOW}[5/5] Status PM2 setelah fix:${NC}"
pm2 status
echo ""

echo "======================================"
echo "REKOMENDASI:"
echo "======================================"
echo ""
echo -e "${YELLOW}1. Fork mode untuk staging adalah NORMAL${NC}"
echo "   - Fork: 1 instance, lebih mudah debug"
echo "   - Cluster: multiple instances, untuk production"
echo ""
echo -e "${YELLOW}2. Untuk warehouse-ui:${NC}"
echo "   - Seharusnya running di Docker, bukan PM2"
echo "   - Jika belum ada, buat Docker container"
echo "   - Port default warehouse-ui biasanya 4545 atau 5000"
echo ""
echo -e "${YELLOW}3. Untuk monitoring Uptime Kuma:${NC}"
echo "   - Tambahkan endpoint warehouse-ui ke Uptime Kuma"
echo "   - URL: http://localhost:[PORT]/health atau /"
echo "   - Contoh: http://localhost:4545 atau http://localhost:5000"
echo ""
echo -e "${GREEN}Selesai!${NC}"
