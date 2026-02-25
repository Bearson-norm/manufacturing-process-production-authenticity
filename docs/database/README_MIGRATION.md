# 🚀 PostgreSQL Migration - Complete Guide

## 📋 Daftar Isi

1. [Overview](#overview)
2. [Local Development](#local-development)
3. [VPS Deployment](#vps-deployment)
4. [Files Reference](#files-reference)
5. [Troubleshooting](#troubleshooting)

---

## Overview

Aplikasi Manufacturing Process telah berhasil dimigrasi dari **SQLite** ke **PostgreSQL** dengan perubahan berikut:

### ✅ Yang Berubah:
- Database: SQLite → PostgreSQL
- Driver: `sqlite3` → `pg`
- Tipe Data: `INTEGER AUTOINCREMENT` → `SERIAL`, `DATETIME` → `TIMESTAMP`

### ✅ Yang TIDAK Berubah:
- Semua API endpoints
- Format request/response
- Business logic
- Client application

---

## Local Development

### Prerequisites
- Node.js 14+
- PostgreSQL 12+ atau Docker

### Quick Start

#### Option A: Docker (Tercepat)
```bash
# 1. Start PostgreSQL
docker run --name postgres -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=Admin123 \
  -e POSTGRES_DB=manufacturing_db -p 5432:5432 -d postgres:15

# 2. Install dependencies
cd server
npm install

# 3. Setup .env (sudah ada contoh di env.example)

# 4. Migrasi data (jika ada SQLite)
npm run migrate

# 5. Test
npm run test:db

# 6. Run
npm start
```

#### Option B: PostgreSQL Installed
```bash
# 1. Create database
psql -U postgres
CREATE USER admin WITH PASSWORD 'Admin123';
CREATE DATABASE manufacturing_db OWNER admin;
\q

# 2. Install & run
cd server
npm install
npm run migrate  # jika ada data SQLite
npm start
```

### Commands
```bash
npm start          # Start server
npm run dev        # Development mode
npm run migrate    # Migrate SQLite → PostgreSQL
npm run test:db    # Test database connection
```

**Documentation**: `POSTGRESQL_MIGRATION_SUMMARY.md`

---

## VPS Deployment

### Method 1: One-Command Deploy (Recommended)

```bash
# Jalankan dari local machine
bash deploy-vps.sh YOUR_VPS_IP VPS_USERNAME

# Contoh:
bash deploy-vps.sh 123.456.789.0 foom
```

Script ini akan:
1. ✅ Upload semua file ke VPS
2. ✅ Setup PostgreSQL (Docker)
3. ✅ Backup database lama
4. ✅ Migrasi data
5. ✅ Restart aplikasi

**Downtime**: ~5-10 menit

---

### Method 2: Manual Deployment

#### 1. Upload Files
```bash
# Upload aplikasi
rsync -avz --progress --exclude 'node_modules' --exclude 'database.sqlite*' \
  server/ user@vps:/home/foom/deployments/manufacturing-app/server/

# Upload script migrasi
scp VPS_MIGRATION_SCRIPT.sh user@vps:/home/foom/
```

#### 2. Run Migration Script di VPS
```bash
# SSH ke VPS
ssh user@vps

# Jalankan script
cd /home/foom
chmod +x VPS_MIGRATION_SCRIPT.sh
bash VPS_MIGRATION_SCRIPT.sh
```

#### 3. Verifikasi
```bash
# Check status
pm2 status

# Check logs
pm2 logs manufacturing-server

# Test health
curl http://localhost:1234/health
```

**Documentation**: `VPS_POSTGRESQL_MIGRATION.md`

---

### Method 3: Fully Manual

Ikuti step-by-step guide di: **VPS_POSTGRESQL_MIGRATION.md**

Termasuk:
- Setup PostgreSQL manual
- Konfigurasi database
- Testing & verification
- Backup automation
- Security hardening

---

## Files Reference

### Migration Files

| File | Description |
|------|-------------|
| **server/database.js** | PostgreSQL wrapper module |
| **server/migrate-to-postgresql.js** | Data migration script |
| **server/test-postgresql.js** | Database testing script |
| **server/config.js** | Updated PostgreSQL config |
| **server/package.json** | Updated dependencies |
| **server/index.js** | Updated main server file |

### Documentation Files

| File | Purpose |
|------|---------|
| **README_MIGRATION.md** | 👈 This file |
| **QUICK_START_POSTGRESQL.md** | Quick reference |
| **POSTGRESQL_MIGRATION_SUMMARY.md** | Complete migration overview |
| **server/MIGRATION_TO_POSTGRESQL.md** | Technical details |
| **VPS_POSTGRESQL_MIGRATION.md** | VPS deployment guide |
| **DEPLOY_TO_VPS.md** | VPS quick deploy guide |

### Scripts

| File | Usage |
|------|-------|
| **deploy-vps.sh** | One-command VPS deployment |
| **VPS_MIGRATION_SCRIPT.sh** | VPS migration automation |

---

## Troubleshooting

### Local Development

#### Can't connect to PostgreSQL
```bash
# Check if running
docker ps  # or
pg_isadmin

# Start PostgreSQL
docker start postgres
# or
sudo systemctl start postgresql
```

#### Migration fails
```bash
# Check SQLite database exists
ls -lh server/database.sqlite

# Test connection first
npm run test:db

# Run migration with logs
npm run migrate 2>&1 | tee migration.log
```

---

### VPS Deployment

#### Deployment script fails
```bash
# SSH to VPS manually
ssh user@vps

# Check logs
cd /home/foom
cat migration.log

# Run script manually
bash VPS_MIGRATION_SCRIPT.sh
```

#### Application won't start
```bash
# Check PM2 logs
pm2 logs manufacturing-server --lines 100

# Check .env
cat /home/foom/deployments/manufacturing-app/server/.env

# Test database
cd /home/foom/deployments/manufacturing-app/server
npm run test:db

# Restart
pm2 restart manufacturing-server
```

#### PostgreSQL issues
```bash
# Check if running
sudo docker ps | grep postgres

# Check logs
sudo docker logs manufacturing-postgres

# Restart
sudo docker restart manufacturing-postgres

# Connect manually
sudo docker exec -it manufacturing-postgres psql -U admin -d manufacturing_db
```

---

### Rollback

#### Local
```bash
cd server
git checkout HEAD -- index.js config.js package.json
npm install sqlite3@^5.1.6
npm install
npm start
```

#### VPS
```bash
# SSH ke VPS
ssh user@vps
cd /home/foom/deployments/manufacturing-app/server

# Stop app
pm2 stop manufacturing-server

# Restore files
cp .env.backup.TIMESTAMP .env
cp database.sqlite.backup.TIMESTAMP database.sqlite

# Reinstall
npm install sqlite3@^5.1.6
npm install

# Restart
pm2 restart manufacturing-server
```

---

## Testing Checklist

### After Local Migration
- [ ] npm run test:db passes
- [ ] npm start successful
- [ ] Health endpoint: `curl http://localhost:1234/health`
- [ ] API endpoints work
- [ ] Frontend connects successfully

### After VPS Deployment
- [ ] PM2 status shows running
- [ ] No errors in PM2 logs
- [ ] Health endpoint: `curl https://mpr.moof-set.web.id/api/health`
- [ ] Test API: `curl https://mpr.moof-set.web.id/api/pic`
- [ ] Frontend loads and works
- [ ] Data integrity verified
- [ ] Monitor for 24-48 hours

---

## Database Credentials

### Development
- Host: localhost
- Port: 5432
- Database: manufacturing_db
- User: admin
- Password: Admin123

### Production (VPS)
- Host: localhost (internal)
- Port: 5432
- Database: manufacturing_db
- User: admin
- Password: Admin123 (⚠️ Ganti di production!)

---

## Backup & Maintenance

### Local Backup
```bash
# Backup database
pg_dump -U admin -d manufacturing_db > backup.sql

# Restore
psql -U admin -d manufacturing_db < backup.sql
```

### VPS Backup
```bash
# Manual backup
sudo docker exec manufacturing-postgres pg_dump -U admin manufacturing_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Setup automated backup (runs daily at 2 AM)
# See VPS_POSTGRESQL_MIGRATION.md for cron setup
```

---

## Support & Resources

### Documentation
- PostgreSQL: https://www.postgresql.org/docs/
- node-postgres: https://node-postgres.com/
- PM2: https://pm2.keymetrics.io/docs/

### Internal Docs
- Full migration guide: `POSTGRESQL_MIGRATION_SUMMARY.md`
- VPS deployment: `VPS_POSTGRESQL_MIGRATION.md`
- Quick reference: `QUICK_START_POSTGRESQL.md`

### Getting Help
1. Check documentation files
2. Check PM2 logs: `pm2 logs`
3. Check PostgreSQL logs
4. Review troubleshooting sections

---

## Timeline Estimasi

### Local Development Setup
- PostgreSQL install: 10-15 minutes
- Dependencies install: 2-3 minutes
- Data migration: 1-5 minutes (depends on data size)
- Testing: 5 minutes
**Total: ~20-30 minutes**

### VPS Deployment
- Preparation: 10 minutes
- File upload: 5-10 minutes
- Migration execution: 15-20 minutes
- Testing & verification: 10 minutes
**Total: ~40-50 minutes**
**Downtime: ~5-10 minutes**

---

## Security Notes

1. **Change default password in production!**
   ```sql
   ALTER USER admin WITH PASSWORD 'strong-password-here';
   ```

2. **Use SSL for production database**

3. **Restrict PostgreSQL access to localhost**

4. **Setup regular backups**

5. **Monitor logs for suspicious activity**

See `VPS_POSTGRESQL_MIGRATION.md` for detailed security hardening.

---

## Status

- ✅ Local migration: Complete
- ✅ VPS deployment: Ready
- ✅ Documentation: Complete
- ✅ Scripts: Ready
- ✅ Testing tools: Ready

**Version**: 1.0.0  
**Last Updated**: 2026-01-08  
**PostgreSQL Version**: 15+  
**Node.js Version**: 14+

---

**Ready to deploy! 🚀**

Start with:
- **Local**: `QUICK_START_POSTGRESQL.md`
- **VPS**: `bash deploy-vps.sh YOUR_VPS_IP`


