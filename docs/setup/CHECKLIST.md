# ✅ Deployment Checklist

## Status Setup

### ✅ SSH Key Setup
- [x] SSH key pair generated
- [x] Public key copied to VPS
- [x] SSH connection tested successfully

### ⏳ GitHub Setup
- [ ] Repository created di GitHub
- [ ] Code pushed ke GitHub
- [ ] GitHub Secrets ditambahkan:
  - [ ] `VPS_HOST` = `103.31.39.189`
  - [ ] `VPS_USER` = `foom`
  - [ ] `VPS_SSH_KEY` = (private key)
  - [ ] `VPS_PORT` = `22` (optional)

### ⏳ VPS Setup
- [ ] Node.js 18.x installed
- [ ] PM2 installed
- [ ] Nginx installed
- [ ] Setup script dijalankan (atau setup manual)

### ⏳ Deployment
- [ ] GitHub Actions workflow berjalan
- [ ] Deployment berhasil
- [ ] Aplikasi bisa diakses di VPS

## 📋 Langkah Selanjutnya

### 1. Pastikan Repository di GitHub
```bash
# Push code ke GitHub (jika belum)
git push -u origin main
```

### 2. Tambahkan GitHub Secrets
Buka: https://github.com/Bearson-norm/manufacturing-process-production-authenticity/settings/secrets/actions

Tambahkan:
- `VPS_HOST` = `103.31.39.189`
- `VPS_USER` = `foom`
- `VPS_SSH_KEY` = (copy dari output di atas)
- `VPS_PORT` = `22`

### 3. Setup VPS (jika belum)
SSH ke VPS dan jalankan:
```bash
ssh foom@103.31.39.189

# Upload atau copy-paste setup-vps.sh
# Atau setup manual (lihat DEPLOYMENT.md)
```

### 4. Test Deployment
- Push ke branch `main` akan trigger deployment otomatis
- Atau trigger manual di GitHub Actions → Run workflow

### 5. Verify
- Check aplikasi di: `http://103.31.39.189`
- Check API: `http://103.31.39.189/api/login`
- Check PM2: `pm2 status`
- Check logs: `pm2 logs manufacturing-app`

## 🎯 Quick Commands

### Test SSH
```powershell
ssh -i "$env:USERPROFILE\.ssh\github_actions_vps" foom@103.31.39.189
```

### Check GitHub Secrets
Buka: https://github.com/Bearson-norm/manufacturing-process-production-authenticity/settings/secrets/actions

### Check Deployment Status
Buka: https://github.com/Bearson-norm/manufacturing-process-production-authenticity/actions

### Check VPS Status
```bash
ssh foom@103.31.39.189
pm2 status
pm2 logs manufacturing-app
sudo systemctl status nginx
```

