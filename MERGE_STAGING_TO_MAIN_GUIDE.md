# 📋 Panduan Merge Staging ke Main & Konfigurasi CI/CD

## ✅ Yang Sudah Dilakukan

1. ✅ Merge conflict di `server/index.js` sudah diselesaikan
2. ✅ Branch `staging` sudah di-merge ke `main`
3. ✅ Semua perubahan dari staging sudah ada di main

## 🚀 Langkah Selanjutnya

### 1. Push ke Remote Repository

```bash
# Pastikan Anda di branch main
git checkout main

# Push ke remote
git push origin main
```

**⚠️ PENTING**: Setelah push ke `main`, GitHub Actions akan otomatis:
1. ✅ Menjalankan CI tests
2. ✅ Jika CI pass → Deploy ke production (port 1234)
3. ✅ Health check setelah deploy
4. ✅ Auto rollback jika health check gagal

## 📊 Konfigurasi CI/CD yang Sudah Ada

### Branch Strategy

| Branch | Environment | Port | Database | Auto Deploy |
|--------|-------------|------|----------|-------------|
| `staging` | Staging | **3467** | `Staging_Manufacturing_Order` | ✅ Yes (on push) |
| `main` | Production | **1234** | `manufacturing_db` | ✅ Yes (after CI pass) |

### Workflow Files

#### 1. `.github/workflows/ci.yml`
- **Trigger**: Push ke semua branches, PR ke main/staging
- **Fungsi**: 
  - Install dependencies
  - Build client
  - Syntax check server
  - Verify health endpoint

#### 2. `.github/workflows/deploy-staging.yml`
- **Trigger**: Push ke branch `staging`
- **Fungsi**:
  - Quick validation
  - Build client
  - Deploy ke VPS staging directory
  - Setup database staging (`Staging_Manufacturing_Order`)
  - Restart PM2 process (`manufacturing-app-staging`)
  - Health check (warning jika gagal, tidak rollback)
- **Environment**:
  - Directory: `/home/foom/deployments/manufacturing-app-staging`
  - Port: `3467`
  - Database: `Staging_Manufacturing_Order` (PostgreSQL port 5433)
  - PM2 Name: `manufacturing-app-staging`

#### 3. `.github/workflows/deploy.yml`
- **Trigger**: Push ke branch `main` (setelah CI pass)
- **Fungsi**:
  - Wait for CI to pass
  - Build client
  - Backup existing deployment
  - Deploy ke VPS production directory
  - Restart PM2 process (`manufacturing-app`)
  - **CRITICAL Health Check** (5 retries)
  - **Auto Rollback** jika health check gagal
- **Environment**:
  - Directory: `/home/foom/deployments/manufacturing-app`
  - Port: `1234`
  - Database: `manufacturing_db` (PostgreSQL port 5433)
  - PM2 Name: `manufacturing-app`

## 🔒 Safety Features Production

1. ✅ **CI Must Pass**: Production deployment hanya jalan jika CI tests pass
2. ✅ **Backup**: Backup otomatis sebelum deploy (keep last 5)
3. ✅ **Health Check**: Verify health endpoint setelah deploy (5 retries)
4. ✅ **Auto Rollback**: Jika health check gagal → otomatis restore backup

## 🔄 Workflow Recommended

```
1. Develop → Push ke feature branch
2. Merge ke staging → Auto-deploy ke staging (port 3467)
3. Test di staging → Verify semua fitur berfungsi
4. Merge ke main → Auto-deploy ke production (port 1234, after CI pass)
5. Production memiliki auto-rollback jika ada masalah
```

## 📝 Perbedaan Staging vs Production

### Staging Environment
- **Port**: 3467
- **Database**: `Staging_Manufacturing_Order`
- **Directory**: `/home/foom/deployments/manufacturing-app-staging`
- **PM2**: `manufacturing-app-staging`
- **Health Check**: Warning jika gagal (tidak rollback)
- **Backup Retention**: 3 backups

### Production Environment
- **Port**: 1234
- **Database**: `manufacturing_db`
- **Directory**: `/home/foom/deployments/manufacturing-app`
- **PM2**: `manufacturing-app`
- **Health Check**: CRITICAL - Auto rollback jika gagal
- **Backup Retention**: 5 backups

## 🔍 Monitoring Deployment

### Check GitHub Actions
1. Buka repository di GitHub
2. Klik tab **Actions**
3. Pilih workflow run yang ingin di-check
4. Expand jobs dan steps untuk detail logs

### Check VPS Status
```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Check PM2 processes
pm2 status

# Check logs
pm2 logs manufacturing-app          # Production
pm2 logs manufacturing-app-staging  # Staging

# Check ports
sudo netstat -tlnp | grep 1234  # Production
sudo netstat -tlnp | grep 3467  # Staging
```

### Health Check Manual
```bash
# Production
curl http://localhost:1234/health
curl http://mpr.moof-set.web.id/health

# Staging
curl http://localhost:3467/health
```

## ⚙️ GitHub Secrets yang Diperlukan

Pastikan GitHub Secrets sudah di-setup di repository settings:

1. **VPS_HOST**: `103.31.39.189`
2. **VPS_USER**: `foom`
3. **VPS_SSH_KEY**: Private SSH key untuk akses VPS
4. **VPS_PORT**: `22` (optional)

## 🐛 Troubleshooting

### Jika Production Rollback Otomatis
1. Check PM2 logs: `pm2 logs manufacturing-app`
2. Check health endpoint: `curl http://localhost:1234/health`
3. Fix issues di staging first
4. Deploy lagi setelah fix

### Jika Staging Tidak Deploy
1. Check GitHub Actions logs
2. Verify branch name adalah `staging`
3. Check GitHub Secrets

### Manual Rollback (Jika Diperlukan)
```bash
ssh foom@103.31.39.189
cd /home/foom/deployments

# List backups
ls -dt manufacturing-app-backup-*

# Restore backup
LATEST_BACKUP=$(ls -dt manufacturing-app-backup-* | head -1)
rm -rf manufacturing-app
cp -r "$LATEST_BACKUP" manufacturing-app
cd manufacturing-app/server
pm2 restart manufacturing-app
pm2 save
```

## ✅ Checklist Sebelum Push ke Main

- [ ] Semua perubahan sudah di-test di staging
- [ ] Staging deployment berhasil dan health check pass
- [ ] Tidak ada breaking changes yang belum didokumentasikan
- [ ] Database migration (jika ada) sudah di-test di staging
- [ ] Environment variables sudah sesuai untuk production

## 📚 Dokumentasi Terkait

- [CI_CD_GUIDE.md](CI_CD_GUIDE.md) - Panduan lengkap CI/CD
- [CI_CD_SETUP_SUMMARY.md](CI_CD_SETUP_SUMMARY.md) - Ringkasan setup CI/CD
- [STAGING_SETUP.md](STAGING_SETUP.md) - Panduan setup staging
- [DEPLOYMENT.md](DEPLOYMENT.md) - Manual deployment procedures

---

**Catatan Penting**: 
- Production deployment memiliki safety checks yang ketat
- Health check gagal akan trigger auto-rollback
- Selalu test di staging sebelum production
- Monitor deployments di GitHub Actions
