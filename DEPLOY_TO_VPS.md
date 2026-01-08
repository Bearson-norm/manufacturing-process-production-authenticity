# 🚀 Deploy PostgreSQL ke VPS - Quick Guide

## Metode 1: Menggunakan Script Otomatis (Recommended)

### 1. Upload Script ke VPS

```bash
# Dari local machine
scp VPS_MIGRATION_SCRIPT.sh user@your-vps-ip:/home/foom/

# Atau jika menggunakan specific user
scp VPS_MIGRATION_SCRIPT.sh foom@your-vps-ip:~/
```

### 2. Upload File-file Aplikasi

```bash
# Upload semua file yang dibutuhkan
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'database.sqlite*' \
  --exclude '.env' \
  server/ user@your-vps:/home/foom/deployments/manufacturing-app/server/
```

### 3. Jalankan Script di VPS

```bash
# SSH ke VPS
ssh user@your-vps-ip

# Jalankan script
cd /home/foom
chmod +x VPS_MIGRATION_SCRIPT.sh
bash VPS_MIGRATION_SCRIPT.sh
```

Script akan otomatis:
- ✅ Backup database SQLite
- ✅ Setup PostgreSQL (Docker)
- ✅ Migrasi data
- ✅ Update konfigurasi
- ✅ Restart aplikasi

### 4. Verifikasi

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs manufacturing-server --lines 50

# Test health
curl http://localhost:1234/health
```

---

## Metode 2: Manual Step-by-Step

Ikuti panduan lengkap di: **VPS_POSTGRESQL_MIGRATION.md**

---

## Checklist Deployment

### Pre-deployment:
- [ ] Backup database SQLite existing
- [ ] Backup .env file
- [ ] Inform team tentang downtime (5-10 menit)

### Deployment:
- [ ] Upload file-file baru ke VPS
- [ ] Install PostgreSQL (Docker atau langsung)
- [ ] Update .env configuration
- [ ] Install npm dependencies
- [ ] Migrasi data
- [ ] Restart aplikasi

### Post-deployment:
- [ ] Test health endpoint
- [ ] Test API endpoints
- [ ] Test dari frontend
- [ ] Monitor logs (24 jam)
- [ ] Setup backup automation

---

## Command Reference

### Upload Files
```bash
# Upload semua file server
rsync -avz --progress --exclude 'node_modules' --exclude 'database.sqlite*' \
  server/ user@vps:/home/foom/deployments/manufacturing-app/server/
```

### PostgreSQL Commands (Docker)
```bash
# Start PostgreSQL
sudo docker-compose -f /opt/postgresql/docker-compose.yml up -d

# Stop PostgreSQL
sudo docker-compose -f /opt/postgresql/docker-compose.yml down

# Restart PostgreSQL
sudo docker restart manufacturing-postgres

# Connect to PostgreSQL
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db

# View logs
sudo docker logs manufacturing-postgres -f

# Backup database
sudo docker exec manufacturing-postgres pg_dump -U admin manufacturing_db > backup.sql
```

### PM2 Commands
```bash
# Start app
pm2 start index.js --name manufacturing-server

# Stop app
pm2 stop manufacturing-server

# Restart app
pm2 restart manufacturing-server

# View logs
pm2 logs manufacturing-server

# Monitor
pm2 monit

# Save config
pm2 save
```

### Testing
```bash
# Test database
cd /home/foom/deployments/manufacturing-app/server
npm run test:db

# Test health endpoint
curl http://localhost:1234/health

# Test from outside
curl https://mpr.moof-set.web.id/api/health

# Test API endpoints
curl http://localhost:1234/api/pic
curl http://localhost:1234/api/production/liquid
```

---

## Troubleshooting

### PostgreSQL tidak bisa connect
```bash
# Check if running
sudo docker ps | grep postgres

# Check logs
sudo docker logs manufacturing-postgres

# Restart
sudo docker restart manufacturing-postgres
```

### Aplikasi error setelah restart
```bash
# Check logs
pm2 logs manufacturing-server --lines 100

# Check .env
cat /home/foom/deployments/manufacturing-app/server/.env

# Test connection
cd /home/foom/deployments/manufacturing-app/server
npm run test:db
```

### Rollback ke SQLite
```bash
# Stop app
pm2 stop manufacturing-server

# Restore .env
cp .env.backup.TIMESTAMP .env

# Install sqlite3
npm install sqlite3

# Restore database
cp /home/foom/backups/database.sqlite.backup.TIMESTAMP database.sqlite

# Restart
pm2 restart manufacturing-server
```

---

## Support Files

1. **VPS_POSTGRESQL_MIGRATION.md** - Panduan lengkap manual
2. **VPS_MIGRATION_SCRIPT.sh** - Script otomatis migrasi
3. **server/MIGRATION_TO_POSTGRESQL.md** - Technical details
4. **POSTGRESQL_MIGRATION_SUMMARY.md** - Overview migrasi

---

## Timeline

- **Preparation**: 10 minutes
- **Execution**: 20-30 minutes
- **Testing**: 10 minutes
- **Monitoring**: 24-48 hours

**Total Downtime**: ~5-10 minutes

---

## Contact

Jika ada masalah saat deployment:
1. Check PM2 logs: `pm2 logs manufacturing-server`
2. Check PostgreSQL logs: `sudo docker logs manufacturing-postgres`
3. Refer to troubleshooting section
4. Rollback jika diperlukan

Good luck! 🚀


