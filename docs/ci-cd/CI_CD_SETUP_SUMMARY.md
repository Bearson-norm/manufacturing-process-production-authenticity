# 📋 Ringkasan Setup CI/CD dengan Staging Environment

## ✅ Yang Sudah Dibuat

### 1. CI Pipeline (`.github/workflows/ci.yml`)
- ✅ Parallel jobs: `instant_gates`, `server`, `client`, optional `migrate_smoke`, aggregate **`ci`**
- ✅ Gitleaks secret scan, server syntax + health route check
- ✅ Server/client unit tests and `npm audit` (high+)
- ✅ Client CRA build (ESLint runs during build; no separate lint toolchain)
- ✅ Concurrency cancel-in-progress; path filters skip docs/md-only changes
- ✅ Node pinned via `.nvmrc` (18)
- ✅ Required status check name for branch protection: **`ci`**

### 2. Staging Deployment (`.github/workflows/deploy-staging.yml`)
- ✅ Auto-deploy ke staging environment saat push ke branch `staging`
- ✅ Build once → artifact → deploy (no double client rebuild)
- ✅ Port terpisah: **3467** (production: 1234)
- ✅ Directory terpisah: `/home/foom/deployments/manufacturing-app-staging`
- ✅ PM2 process terpisah: `manufacturing-app-staging` (+ worker)
- ✅ Health check fail-closed

### 3. Production Deployment (`.github/workflows/deploy.yml`)
- ✅ Build once → artifact → deploy (`npm ci` on runner)
- ✅ **Backup**: Backup otomatis sebelum deploy
- ✅ **Health Check**: Verifikasi health endpoint setelah deploy
- ✅ **Auto Rollback**: Otomatis rollback jika health check gagal setelah 5 attempts
- ✅ Port: **1234** (production)
- ✅ PM2 process: `manufacturing-app` (+ worker)

### 4. Staging Nginx Config (`nginx/manufacturing-app-staging.conf`)
- ✅ Konfigurasi nginx untuk staging environment
- ✅ Domain: `staging.mpr.moof-set.web.id` (atau `stg.mpr.moof-set.web.id`)
- ✅ Backend port: **3467**
- ✅ Staging indicator headers
- ✅ Separate logs

### 5. Dokumentasi
- ✅ **CI_CD_GUIDE.md**: Panduan lengkap CI/CD
- ✅ **STAGING_SETUP.md**: Panduan setup staging environment
- ✅ **README.md**: Updated dengan info CI/CD

## 🚀 Cara Penggunaan

### Setup Awal (Sekali)

1. **Setup Branch Staging**
   ```bash
   git checkout -b staging
   git push -u origin staging
   ```

2. **Setup GitHub Secrets** (di GitHub repository settings)
   - `VPS_HOST`: `103.31.39.189`
   - `VPS_USER`: `foom`
   - `VPS_SSH_KEY`: Private SSH key (lihat DEPLOYMENT.md untuk cara generate)
   - `VPS_PORT`: `22` (optional)
   - Staging DB secrets: `STAGING_DB_PASSWORD` (required), `STAGING_DB_USER`, `STAGING_DB_PORT`

3. **Branch protection** (recommended)
   - Settings → Branches → require status check **`ci`** (CI Pipeline aggregate job)

4. **Setup Nginx Staging di VPS** (optional, jika mau pakai domain)
   ```bash
   ssh foom@103.31.39.189
   sudo cp nginx/manufacturing-app-staging.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/manufacturing-app-staging.conf /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Setup DNS** (optional, untuk domain staging)
   - Tambahkan A record: `staging.mpr.moof-set.web.id` → `103.31.39.189`

### Workflow Harian

#### Deploy ke Staging (Testing)
```bash
# 1. Buat/update branch staging
git checkout staging
git merge feature/your-feature  # atau langsung commit
git add .
git commit -m "Feature: New feature"
git push origin staging

# 2. GitHub Actions otomatis deploy ke staging
# 3. Test di: http://staging.mpr.moof-set.web.id (atau http://103.31.39.189:3467)
```

#### Deploy ke Production (Setelah Testing)
```bash
# 1. Setelah testing di staging berhasil
git checkout main
git merge staging
git push origin main

# 2. GitHub Actions otomatis:
#    - CI Pipeline (parallel jobs; require check name ci on PRs)
#    - Deploy: build_package once → artifact → VPS
#    - Health check + auto rollback jika gagal
```

## 🔒 Safety Features

### Production Protection
1. ✅ **Branch protection `ci`**: Merge gate via aggregate CI job
2. ✅ **Health Check**: Verify aplikasi berjalan dengan benar
3. ✅ **Auto Rollback**: Rollback otomatis jika health check gagal
4. ✅ **Backup**: Backup otomatis sebelum deploy
5. ✅ **Build once**: No duplicate client rebuild between validate and deploy

### Staging Benefits
1. ✅ **Separate Environment**: Port, directory, dan PM2 process terpisah
2. ✅ **Safe Testing**: Test tanpa risiko ke production
3. ✅ **Quick Deploy**: Auto-deploy untuk quick testing
4. ✅ **No Impact**: Tidak mengganggu production

## 📊 Perbedaan Staging vs Production

| Aspek | Staging | Production |
|-------|---------|------------|
| Branch | `staging` | `main`/`master` |
| Port | **3467** | **1234** |
| Domain | `staging.mpr.moof-set.web.id` | `mpr.moof-set.web.id` |
| Deploy Directory | `/home/foom/deployments/manufacturing-app-staging` | `/home/foom/deployments/manufacturing-app` |
| PM2 Name | `manufacturing-app-staging` | `manufacturing-app` |
| Auto Deploy | ✅ Yes (on push) | ✅ Yes (on push; prefer `ci` required on merge) |
| Health Check | ❌ CRITICAL (fail-closed) | ❌ CRITICAL - Auto rollback |
| Backup Retention | 3 backups | 5 backups |

## ⚠️ Penting!

### Jawaban Pertanyaan Anda

**Q: Apakah jika saya push repo ini akan diupdate di server melalui git action?**

**A: Ya, TAPI:**
- ✅ Push ke branch `staging` → Auto-deploy ke **staging** environment (port 3467); docs/md-only pushes are skipped
- ✅ Push ke branch `main`/`master` → Auto-deploy ke **production** (port 1234)
- ✅ Production deployment memiliki safety checks:
  - Health check setelah deploy
  - Auto rollback jika health check gagal
  - Prefer requiring status check **`ci`** before merge

**Q: Saya takut jika terdapat error ketika di up**

**A: Tidak perlu khawatir karena:**
1. ✅ **Staging First**: Test di staging dulu sebelum production
2. ✅ **CI Pipeline**: Parallel tests/audit/build before merge (when `ci` is required)
3. ✅ **Health Check**: Verify aplikasi berjalan setelah deploy
4. ✅ **Auto Rollback**: Production auto-rollback jika health check gagal
5. ✅ **Backup**: Backup otomatis sebelum update

## 📝 Checklist Setup

### Sebelum Menggunakan
- [ ] GitHub Secrets sudah di-setup (VPS_HOST, VPS_USER, VPS_SSH_KEY)
- [ ] Branch `staging` sudah dibuat
- [ ] SSH key sudah di-setup dan di-copy ke VPS
- [ ] Test SSH connection: `ssh foom@103.31.39.189`
- [ ] Branch protection requires status check **`ci`**

### Setup Staging (Optional, Recommended)
- [ ] Nginx config staging sudah di-setup di VPS
- [ ] DNS record untuk staging domain (optional)
- [ ] Database staging dibuat (optional)
- [ ] Test deploy pertama ke staging

### Verifikasi
- [ ] Test push ke staging branch → Verify auto-deploy
- [ ] Test push ke main branch → Verify CI runs dan deploy
- [ ] Verify staging accessible: `http://staging.mpr.moof-set.web.id/health`
- [ ] Verify production accessible: `http://mpr.moof-set.web.id/health`

## 🔍 Monitoring

### Check Deployment Status
```bash
# GitHub Actions
https://github.com/[USERNAME]/[REPO]/actions

# VPS
ssh foom@103.31.39.189
pm2 status
pm2 logs manufacturing-app-staging  # Staging
pm2 logs manufacturing-app          # Production
```

### Health Check
```bash
# Staging
curl http://localhost:3467/health
curl http://staging.mpr.moof-set.web.id/health

# Production
curl http://localhost:1234/health
curl http://mpr.moof-set.web.id/health
```

## 🐛 Troubleshooting

### Jika Staging Tidak Deploy
1. Check GitHub Actions logs
2. Verify branch name adalah `staging`
3. Check GitHub Secrets
4. Confirm the push was not docs/md-only (`paths-ignore`)

### Jika Production Rollback Otomatis
1. Check PM2 logs: `pm2 logs manufacturing-app`
2. Check health endpoint: `curl http://localhost:1234/health`
3. Fix issues di staging first
4. Deploy lagi setelah fix

### Manual Rollback (Jika Diperlukan)
```bash
ssh foom@103.31.39.189
cd /home/foom/deployments
ls -dt manufacturing-app-backup-*  # List backups
LATEST_BACKUP=$(ls -dt manufacturing-app-backup-* | head -1)
rm -rf manufacturing-app
cp -r "$LATEST_BACKUP" manufacturing-app
cd manufacturing-app/server
pm2 restart manufacturing-app
```

## 📚 Dokumentasi Lengkap

- 📘 **[CI_CD_GUIDE.md](CI_CD_GUIDE.md)**: Panduan lengkap CI/CD
- 🧪 **[STAGING_SETUP.md](STAGING_SETUP.md)**: Panduan setup staging
- 🚀 **[DEPLOYMENT.md](DEPLOYMENT.md)**: Manual deployment procedures

## ✅ Kesimpulan

Sekarang Anda memiliki:
1. ✅ **CI Pipeline** untuk testing otomatis (parallel + aggregate `ci`)
2. ✅ **Staging Environment** untuk testing sebelum production
3. ✅ **Production Deployment** dengan safety checks dan auto-rollback
4. ✅ **Dokumentasi lengkap** untuk setup dan penggunaan

**Workflow Recommended**:
```
1. Develop → Push ke feature branch / open PR (CI runs; require check ci)
2. Merge ke staging → Auto-deploy ke staging (port 3467)
3. Test di staging → Verify semua fitur berfungsi
4. Merge ke main → Auto-deploy ke production (port 1234)
5. Production memiliki auto-rollback jika ada masalah
```

**Anda tidak perlu khawatir tentang error karena:**
- ✅ Staging untuk testing dulu
- ✅ CI checks sebelum merge (when `ci` is required)
- ✅ Health check setelah deploy
- ✅ Auto rollback jika ada masalah
- ✅ Backup otomatis

Selamat menggunakan CI/CD dengan staging environment!
