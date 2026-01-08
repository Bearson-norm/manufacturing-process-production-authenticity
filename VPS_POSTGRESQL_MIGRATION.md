# 🚀 Migrasi PostgreSQL di VPS

Panduan lengkap untuk migrasi aplikasi manufacturing yang sedang running di VPS dari SQLite ke PostgreSQL.

## ⚠️ Persiapan Sebelum Migrasi

### 1. Backup Data Existing

```bash
# Login ke VPS
ssh user@your-vps-ip

# Navigasi ke direktori aplikasi
cd /home/foom/deployments/manufacturing-app/server

# Backup database SQLite
cp database.sqlite database.sqlite.backup.$(date +%Y%m%d_%H%M%S)

# Backup semua file penting
tar -czf ~/manufacturing-backup-$(date +%Y%m%d).tar.gz \
  database.sqlite* \
  .env \
  ecosystem.config.js

# Verifikasi backup
ls -lh ~/manufacturing-backup-*.tar.gz
```

## 📦 Step 1: Install PostgreSQL di VPS

### Option A: Install PostgreSQL Langsung di VPS

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Verifikasi instalasi
sudo systemctl status postgresql

# Enable auto-start
sudo systemctl enable postgresql
```

### Option B: Menggunakan Docker (Recommended)

```bash
# Install Docker jika belum ada
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose -y

# Buat directory untuk PostgreSQL data
sudo mkdir -p /opt/postgresql/data

# Create docker-compose.yml
cat > /opt/postgresql/docker-compose.yml <<'EOF'
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    container_name: manufacturing-postgres
    restart: always
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: Admin123
      POSTGRES_DB: manufacturing_db
    ports:
      - "5432:5432"
    volumes:
      - /opt/postgresql/data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 10s
      timeout: 5s
      retries: 5
EOF

# Start PostgreSQL
cd /opt/postgresql
sudo docker-compose up -d

# Verifikasi
sudo docker ps
sudo docker logs manufacturing-postgres
```

## 🔐 Step 2: Setup Database dan User

### Jika Install Langsung:

```bash
# Switch ke user postgres
sudo -u postgres psql

# Di dalam psql prompt:
CREATE USER admin WITH PASSWORD 'Admin123';
CREATE DATABASE manufacturing_db OWNER admin;
\c manufacturing_db
GRANT ALL ON SCHEMA public TO admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
\q
```

### Jika Menggunakan Docker:

```bash
# Connect ke PostgreSQL container
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db

# Verifikasi connection
SELECT version();
\l
\q
```

## 📤 Step 3: Upload File Migration ke VPS

Di **local machine**, upload file-file baru ke VPS:

```bash
# Dari direktori project local
cd Manufacturing-Process-Production-Authenticity

# Upload file-file baru ke VPS
scp server/database.js user@your-vps:/home/foom/deployments/manufacturing-app/server/
scp server/migrate-to-postgresql.js user@your-vps:/home/foom/deployments/manufacturing-app/server/
scp server/test-postgresql.js user@your-vps:/home/foom/deployments/manufacturing-app/server/
scp server/config.js user@your-vps:/home/foom/deployments/manufacturing-app/server/
scp server/package.json user@your-vps:/home/foom/deployments/manufacturing-app/server/
scp server/env.example user@your-vps:/home/foom/deployments/manufacturing-app/server/
scp server/MIGRATION_TO_POSTGRESQL.md user@your-vps:/home/foom/deployments/manufacturing-app/server/

# Update index.js
scp server/index.js user@your-vps:/home/foom/deployments/manufacturing-app/server/
```

### Atau menggunakan rsync (lebih efisien):

```bash
# Sync semua file server
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'database.sqlite*' \
  --exclude '.env' \
  server/ user@your-vps:/home/foom/deployments/manufacturing-app/server/
```

## 🔧 Step 4: Update Konfigurasi di VPS

```bash
# SSH ke VPS
ssh user@your-vps

# Navigasi ke direktori aplikasi
cd /home/foom/deployments/manufacturing-app/server

# Backup .env lama
cp .env .env.backup

# Update .env untuk PostgreSQL
cat > .env <<'EOF'
# Server Configuration
NODE_ENV=production
PORT=1234

# Database Configuration - PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=manufacturing_db
DB_USER=admin
DB_PASSWORD=Admin123
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

# API Key (jika ada)
API_KEY=your_existing_api_key_here
EOF

# Set permissions
chmod 600 .env
```

## 📦 Step 5: Install Dependencies

```bash
# Masih di direktori server
cd /home/foom/deployments/manufacturing-app/server

# Install/update npm packages
npm install

# Verifikasi pg package terinstall
npm list pg
```

## 🔄 Step 6: Migrasi Data

```bash
# Test koneksi PostgreSQL dulu
npm run test:db

# Jika test berhasil, jalankan migrasi
npm run migrate

# Output yang diharapkan:
# ✓ Migration completed successfully!
# Migrating data from SQLite to PostgreSQL...
# Processing table: production_liquid
# Migrating 150 rows to production_liquid...
# ... dst

# Verifikasi data termigrasi
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db

# Di psql:
SELECT COUNT(*) FROM production_liquid;
SELECT COUNT(*) FROM production_device;
SELECT COUNT(*) FROM production_cartridge;
SELECT COUNT(*) FROM pic_list;
\q
```

## 🔄 Step 7: Stop Aplikasi

```bash
# Stop PM2 processes
pm2 stop all
pm2 delete all

# Atau jika menggunakan PM2 dengan nama spesifik:
pm2 stop manufacturing-server
pm2 delete manufacturing-server
```

## 🚀 Step 8: Start Aplikasi dengan PostgreSQL

```bash
# Pastikan masih di direktori server
cd /home/foom/deployments/manufacturing-app/server

# Start dengan PM2
pm2 start index.js --name manufacturing-server

# Atau jika punya ecosystem.config.js:
pm2 start ecosystem.config.js

# Save PM2 config
pm2 save

# Setup PM2 startup
pm2 startup
# Copy dan jalankan command yang muncul

# Monitor logs
pm2 logs manufacturing-server --lines 50
```

## ✅ Step 9: Verifikasi

```bash
# 1. Check PM2 status
pm2 status

# 2. Check logs
pm2 logs manufacturing-server --lines 20

# 3. Test health endpoint
curl http://localhost:1234/health

# Expected output:
# {"status":"healthy","database":"connected","uptime":...}

# 4. Test dari luar VPS
curl https://mpr.moof-set.web.id/api/health

# 5. Check database connections
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db \
  -c "SELECT count(*) FROM pg_stat_activity WHERE datname='manufacturing_db';"
```

## 🔍 Step 10: Testing Fungsionalitas

```bash
# Test beberapa endpoint penting
# (Ganti dengan API key jika diperlukan)

# 1. Get PIC list
curl http://localhost:1234/api/pic

# 2. Get production data
curl http://localhost:1234/api/production/liquid

# 3. Get combined production
curl http://localhost:1234/api/combined-production

# Jika semua berhasil, coba dari frontend
```

## 🔄 Step 11: Update Nginx (Jika Perlu)

```bash
# Check nginx config
sudo nginx -t

# Reload nginx jika perlu update
sudo systemctl reload nginx

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 📊 Monitoring PostgreSQL

```bash
# 1. Check PostgreSQL status
sudo docker ps | grep postgres

# 2. Check disk usage
sudo docker exec manufacturing-postgres du -sh /var/lib/postgresql/data

# 3. Check active connections
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db \
  -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 4. Check table sizes
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db \
  -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

## 🔒 Security Hardening

```bash
# 1. Update PostgreSQL password (IMPORTANT!)
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db \
  -c "ALTER USER admin WITH PASSWORD 'your-strong-password-here';"

# Update .env dengan password baru
nano /home/foom/deployments/manufacturing-app/server/.env

# Restart aplikasi
pm2 restart manufacturing-server

# 2. Firewall - hanya allow localhost access ke PostgreSQL
sudo ufw status
# PostgreSQL sudah terbatas ke localhost via docker mapping

# 3. Setup SSL untuk PostgreSQL (Optional untuk production)
# Lihat dokumentasi PostgreSQL SSL configuration
```

## 📦 Backup Automation

```bash
# Buat script backup otomatis
cat > /home/foom/backup-postgres.sh <<'EOF'
#!/bin/bash
BACKUP_DIR="/home/foom/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker exec manufacturing-postgres pg_dump -U admin manufacturing_db | gzip > $BACKUP_DIR/postgres_backup_$TIMESTAMP.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "postgres_backup_*.sql.gz" -mtime +7 -delete

echo "Backup completed: postgres_backup_$TIMESTAMP.sql.gz"
EOF

chmod +x /home/foom/backup-postgres.sh

# Setup cron job (backup setiap hari jam 2 pagi)
crontab -e
# Tambahkan:
# 0 2 * * * /home/foom/backup-postgres.sh >> /home/foom/backup.log 2>&1
```

## 🆘 Rollback (Jika Ada Masalah)

```bash
# 1. Stop aplikasi
pm2 stop manufacturing-server

# 2. Restore .env lama
cp /home/foom/deployments/manufacturing-app/server/.env.backup \
   /home/foom/deployments/manufacturing-app/server/.env

# 3. Install sqlite3 kembali
cd /home/foom/deployments/manufacturing-app/server
npm install sqlite3@^5.1.6

# 4. Restore file-file lama dari git
git checkout HEAD -- index.js config.js package.json

# 5. Restore database
cp database.sqlite.backup.* database.sqlite

# 6. Reinstall dependencies
npm install

# 7. Restart
pm2 restart manufacturing-server
```

## 📊 Performance Tuning PostgreSQL

```bash
# Edit PostgreSQL config (jika install langsung)
sudo nano /etc/postgresql/15/main/postgresql.conf

# Recommended settings untuk VPS dengan 2-4GB RAM:
# shared_buffers = 512MB
# effective_cache_size = 1GB
# maintenance_work_mem = 128MB
# checkpoint_completion_target = 0.9
# wal_buffers = 16MB
# default_statistics_target = 100
# random_page_cost = 1.1
# effective_io_concurrency = 200
# work_mem = 4MB
# min_wal_size = 1GB
# max_wal_size = 4GB

# Restart PostgreSQL
sudo systemctl restart postgresql

# Atau untuk Docker, update docker-compose.yml dengan command:
# command:
#   - "postgres"
#   - "-c"
#   - "shared_buffers=512MB"
#   - "-c"
#   - "effective_cache_size=1GB"
```

## ✅ Checklist Migrasi

- [ ] Backup data SQLite existing
- [ ] Install PostgreSQL di VPS
- [ ] Create database dan user
- [ ] Upload file-file baru ke VPS
- [ ] Update .env configuration
- [ ] Install npm dependencies
- [ ] Test PostgreSQL connection
- [ ] Migrasi data dari SQLite
- [ ] Verifikasi data termigrasi
- [ ] Stop aplikasi lama
- [ ] Start aplikasi dengan PostgreSQL
- [ ] Test health endpoint
- [ ] Test API endpoints
- [ ] Test dari frontend
- [ ] Monitor logs dan performance
- [ ] Setup backup automation
- [ ] Update documentation

## 📞 Troubleshooting VPS

### Aplikasi tidak bisa connect ke PostgreSQL

```bash
# Check PostgreSQL running
sudo docker ps | grep postgres

# Check logs
sudo docker logs manufacturing-postgres

# Test connection dari server
telnet localhost 5432

# Check firewall
sudo ufw status
```

### Memory issues

```bash
# Check memory
free -h

# Check PostgreSQL memory usage
sudo docker stats manufacturing-postgres

# Adjust shared_buffers jika perlu
```

### Slow queries

```bash
# Enable query logging
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db \
  -c "ALTER SYSTEM SET log_statement = 'all';"
  
# Check slow queries
sudo docker logs manufacturing-postgres | grep "duration:"
```

## 🎯 Next Steps

1. **Monitor untuk 24-48 jam pertama**
   - Check logs setiap beberapa jam
   - Monitor memory dan CPU usage
   - Verifikasi semua fitur berfungsi

2. **Update documentation internal**
   - Update deployment procedures
   - Update architecture diagram

3. **Inform team**
   - Notifikasi perubahan database
   - Share credentials PostgreSQL (secure channel)

---

**Status**: Ready for VPS Migration  
**Estimated Time**: 30-60 minutes  
**Downtime**: ~5-10 minutes  
**Difficulty**: Intermediate


