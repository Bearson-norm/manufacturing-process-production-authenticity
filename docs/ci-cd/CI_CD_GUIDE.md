# 🚀 CI/CD Configuration Guide

Panduan lengkap untuk setup dan menggunakan CI/CD pipeline dengan staging environment.

## 📋 Overview

Sistem CI/CD ini menyediakan:
- ✅ **CI Pipeline**: Parallel gates (secret scan, syntax, unit tests, npm audit, client build) on `main`/`master`/`staging`/`develop` and PRs; docs-only changes are skipped
- ✅ **Staging Deployment**: Auto-deploy ke staging environment (port 3467)
- ✅ **Production Deployment**: Auto-deploy ke production dengan safety checks (port 1234)
- ✅ **Health Checks**: Automatic health verification setelah deployment
- ✅ **Auto Rollback**: Production akan auto-rollback jika health check gagal
- ✅ **Branch protection**: Require GitHub status check named **`ci`** (aggregate job) before merge

## 🔄 Workflow Diagram

```
┌─────────────┐
│   Push Code │
└──────┬──────┘
       │
       ├──► ┌──────────────────┐
       │    │  CI Pipeline     │
       │    │  (Test & Build)  │
       │    └────────┬─────────┘
       │             │
       ├─── staging ─► ┌──────────────────┐
       │             │  Deploy Staging   │
       │             │  Port: 3467       │
       │             └───────────────────┘
       │
       └─── main ───► ┌──────────────────┐
                      │ Deploy Production│
                      │ Port: 1234       │
                      │ (After CI Pass)  │
                      │                  │
                      ├─► Health Check   │
                      │                  │
                      └─► Rollback if ❌ │
```

## 📁 File Structure

```
.github/
├── workflows/
│   ├── ci.yml              # CI pipeline (parallel jobs + aggregate ci)
│   ├── deploy-staging.yml  # Staging deployment (build once + artifact)
│   └── deploy.yml          # Production deployment (build once + artifact)
└── scripts/
    └── deploy.sh           # Deployment helper script

nginx/
├── manufacturing-app.conf         # Production nginx config
└── manufacturing-app-staging.conf # Staging nginx config
```

## 🔧 Setup GitHub Secrets

Sebelum menggunakan CI/CD, setup GitHub Secrets di repository settings:

### Required Secrets

1. **VPS_HOST**
   ```
   103.31.39.189
   ```

2. **VPS_USER**
   ```
   foom
   ```

3. **VPS_SSH_KEY**
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   [Your private SSH key content]
   -----END OPENSSH PRIVATE KEY-----
   ```
   
   Cara generate:
   ```bash
   ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_vps
   ssh-copy-id -i ~/.ssh/github_actions_vps.pub foom@103.31.39.189
   cat ~/.ssh/github_actions_vps  # Copy semua output untuk GitHub Secret
   ```

4. **VPS_PORT** (Optional, default: 22)
   ```
   22
   ```

### Setup di GitHub

1. Buka repository di GitHub
2. Settings → Secrets and variables → Actions
3. New repository secret
4. Masukkan name dan value untuk setiap secret di atas

## 🔄 Branch Strategy

### 1. Staging Branch (`staging`)

**Purpose**: Testing sebelum production

**Auto Deploy**: ✅ Yes (on push)

**Environment**:
- Port: `3467`
- Domain: `staging.mpr.moof-set.web.id` (setelah DNS setup)
- Directory: `/home/foom/deployments/manufacturing-app-staging`
- PM2 Name: `manufacturing-app-staging`

**Usage**:
```bash
git checkout staging
git merge feature/my-feature  # atau langsung commit
git push origin staging
```

### 2. Main Branch (`main`/`master`)

**Purpose**: Production

**Auto Deploy**: ✅ Yes (after CI pass)

**Safety Features**:
- ✅ CI tests must pass
- ✅ Health check after deploy
- ✅ Auto rollback if health check fails
- ✅ Backup sebelum deploy

**Environment**:
- Port: `1234`
- Domain: `mpr.moof-set.web.id`
- Directory: `/home/foom/deployments/manufacturing-app`
- PM2 Name: `manufacturing-app`

**Usage**:
```bash
# Setelah testing di staging berhasil
git checkout main
git merge staging
git push origin main
```

## 📊 CI Pipeline Details

File: `.github/workflows/ci.yml`

**Triggers**:
- Push ke `main` / `master` / `staging` / `develop` (skips `**/*.md`, `docs/**`, `LICENSE`)
- Pull requests ke `main` / `master` / `staging` (same path filters)
- Concurrency: cancel in-progress runs on the same ref

**Jobs** (parallel, then aggregate):
1. `instant_gates` — Gitleaks, server syntax check, health route grep
2. `server` — `npm ci`, unit tests, `npm audit` (high+)
3. `client` — `npm ci`, `npm audit` (high+), unit tests, CRA build (includes ESLint during build)
4. `migrate_smoke` — on push to `main`/`master`/`staging` only; apply migrations on ephemeral Postgres
5. `ci` — aggregate gate (required status check name: **`ci`**)

Node version is pinned via `.nvmrc` (18).

**Result**: Pass/Fail (tidak deploy, hanya verifikasi)

## 🧪 Staging Deployment Details

File: `.github/workflows/deploy-staging.yml`

**Triggers**:
- Push ke branch `staging` (docs/md ignored)
- Manual workflow dispatch
- Concurrency: cancel in-progress staging deploys

**Process**:
1. ✅ `build_package` once (`npm ci`, client build, pack `deploy.tar.gz`, upload artifact)
2. ✅ `deploy-staging` downloads artifact (no second build)
3. ✅ Deploy ke VPS staging directory
4. ✅ Install production dependencies on VPS
5. ✅ Setup `.env` dengan port 3467
6. ✅ Restart PM2 (`manufacturing-app-staging` + worker)
7. ✅ Health check (fail-closed)

**Access**:
- Direct: `http://103.31.39.189:3467` (jika port dibuka)
- Domain: `http://staging.mpr.moof-set.web.id` (setelah DNS setup)

## 🚀 Production Deployment Details

File: `.github/workflows/deploy.yml`

**Triggers**:
- Push ke branch `main`/`master` (docs/md ignored)
- Manual workflow dispatch
- Concurrency: cancel in-progress production deploys

**Safety Features**:
1. ✅ **Build once**: `build_package` → artifact → deploy (no duplicate client rebuild)
2. ✅ **Backup**: Backup deployment yang ada sebelum update
3. ✅ **Health Check**: Verify health endpoint setelah deploy
4. ✅ **Auto Rollback**: Jika health check gagal setelah 5 attempts, auto-rollback ke backup sebelumnya
5. ✅ Prefer requiring branch-protection check **`ci`** so merges to `main` are gated by CI Pipeline

**Process**:
1. ✅ `build_package` (`npm ci`, syntax check, client build, pack artifact)
2. ✅ Download artifact and SCP to VPS
3. ✅ Backup existing production deployment
4. ✅ Deploy ke VPS production directory
5. ✅ Install dependencies
6. ✅ Restart PM2 (`manufacturing-app` + worker)
7. ✅ **CRITICAL Health Check**:
   - Retry 5 times dengan interval 3 seconds
   - Jika semua gagal → Auto rollback ke backup
   - Jika success → Deployment complete

**Access**:
- Domain: `http://mpr.moof-set.web.id`
- Health: `http://mpr.moof-set.web.id/health`

## 🔍 Monitoring & Verification

### Check Deployment Status

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

### Check GitHub Actions

1. Buka repository di GitHub
2. Klik tab **Actions**
3. Pilih workflow run yang ingin di-check
4. Expand jobs dan steps untuk detail logs

### Health Check Manual

```bash
# Production
curl http://localhost:1234/health
curl http://mpr.moof-set.web.id/health

# Staging
curl http://localhost:3467/health
curl http://staging.mpr.moof-set.web.id/health
```

## 🛡️ Safety & Rollback

### Production Safety

1. **CI Must Pass**: Prefer requiring GitHub status check **`ci`** on protected branches; deploy workflows build once and health-check on the VPS
2. **Health Check**: Verify aplikasi berjalan dengan benar setelah deploy
3. **Auto Rollback**: Jika health check gagal, otomatis restore backup
4. **Backup Retention**: Keep last 5 backups

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

## 🐛 Troubleshooting

### CI Pipeline Fails

**Symptom**: CI tests fail, production deployment tidak jalan

**Check**:
1. GitHub Actions logs untuk error detail
2. Local test: Run `npm install` dan `npm run build` di local
3. Syntax errors: Check `node -c server/index.js`

**Fix**: Fix errors, commit, dan push lagi

### Staging Deploy Fails

**Symptom**: Staging deployment gagal di GitHub Actions

**Check**:
1. GitHub Actions logs
2. SSH connection ke VPS
3. GitHub Secrets (VPS_HOST, VPS_USER, VPS_SSH_KEY)

**Fix**:
- Verify SSH key di GitHub Secrets
- Test SSH connection manual
- Check VPS disk space

### Production Health Check Fails (Auto Rollback)

**Symptom**: Production deploy, tapi auto-rollback karena health check gagal

**Check**:
1. PM2 logs: `pm2 logs manufacturing-app`
2. Health endpoint: `curl http://localhost:1234/health`
3. Database connection
4. Environment variables

**Fix**:
1. Fix issues di staging first
2. Test di staging sampai berhasil
3. Merge ke main dan deploy lagi

### Production Deploy Stuck

**Symptom**: GitHub Actions workflow stuck atau timeout

**Check**:
1. GitHub Actions logs
2. VPS resources (CPU, memory, disk)
3. Network connectivity

**Fix**:
- Cancel workflow di GitHub Actions
- Check VPS manually
- Retry deployment

## ✅ Best Practices

1. **Always test di staging first**: Jangan langsung push ke main
2. **Review changes**: Pastikan perubahan sudah ditest dengan baik
3. **Monitor after deploy**: Check logs dan health check setelah deployment
4. **Use meaningful commits**: Commit messages yang jelas untuk tracking
5. **Keep staging updated**: Merge main ke staging secara berkala
6. **Document breaking changes**: Catat perubahan yang mempengaruhi production

## 📝 Quick Reference

### Deploy ke Staging
```bash
git checkout staging
git add .
git commit -m "Feature: New feature"
git push origin staging
# Auto deploy via GitHub Actions
```

### Deploy ke Production
```bash
git checkout main
git merge staging
git push origin main
# Auto deploy via GitHub Actions (after CI pass)
```

### Check Status
```bash
# GitHub Actions
https://github.com/[USERNAME]/[REPO]/actions

# VPS
ssh foom@103.31.39.189
pm2 status
```

## 🔗 Related Documentation

- [Staging Setup Guide](STAGING_SETUP.md) - Detailed staging setup
- [Deployment Guide](DEPLOYMENT.md) - Manual deployment procedures
- [Troubleshooting Guide](TROUBLESHOOTING.md) - Common issues and fixes

---

**Catatan Penting**: 
- Production deployment memiliki safety checks yang ketat
- Health check gagal akan trigger auto-rollback
- Selalu test di staging sebelum production
- Monitor deployments di GitHub Actions
