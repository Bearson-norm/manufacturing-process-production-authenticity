# 📝 Panduan Setup GitHub Repository

Panduan step-by-step untuk membuat repository GitHub dan setup CI/CD.

## 🎯 Step 1: Buat Repository di GitHub

### Via Web Interface:

1. **Login ke GitHub**
   - Buka https://github.com
   - Login dengan akun Anda

2. **Create New Repository**
   - Klik tombol **"+"** di kanan atas
   - Pilih **"New repository"**

3. **Isi Form Repository**
   - **Repository name**: `manufacturing-process-production-authenticity`
     (atau nama lain sesuai keinginan)
   - **Description**: `Manufacturing Process Production Authenticity System`
   - **Visibility**: 
     - ✅ **Private** (disarankan untuk project internal)
     - ⬜ Public (jika ingin open source)
   - **JANGAN centang**:
     - ❌ Add a README file
     - ❌ Add .gitignore
     - ❌ Choose a license
   - Klik **"Create repository"**

4. **Copy Repository URL**
   - Setelah repository dibuat, copy URL repository
   - Contoh: `https://github.com/YOUR_USERNAME/manufacturing-process-production-authenticity.git`

## 🔧 Step 2: Setup Git di Local

### Initialize Git (jika belum)

```bash
# Di folder project
cd Manufacturing-Process-Production-Authenticity

# Initialize git (jika belum)
git init

# Check status
git status
```

### Add Remote Repository

```bash
# Ganti YOUR_USERNAME dengan username GitHub Anda
git remote add origin https://github.com/YOUR_USERNAME/manufacturing-process-production-authenticity.git

# Verify remote
git remote -v
```

## 📤 Step 3: Commit dan Push ke GitHub

### Add Files

```bash
# Add semua file (kecuali yang di .gitignore)
git add .

# Check apa yang akan di-commit
git status
```

### Commit

```bash
git commit -m "Initial commit: Manufacturing Process Production Authenticity System"
```

### Push ke GitHub

```bash
# Set default branch ke main
git branch -M main

# Push ke GitHub
git push -u origin main
```

Jika diminta login:
- Gunakan **Personal Access Token** (bukan password)
- Cara buat token: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token
- Berikan permission: `repo` (full control)

## 🔑 Step 4: Setup GitHub Secrets

### Generate SSH Key untuk VPS

```bash
# Di local machine, generate SSH key
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_actions_vps

# Akan muncul prompt:
# Enter passphrase (optional): [tekan Enter untuk kosong]
# Enter same passphrase again: [tekan Enter]
```

### Copy Public Key ke VPS

```bash
# Copy public key ke VPS
ssh-copy-id -i ~/.ssh/github_actions_vps.pub foom@103.31.39.189

# Atau manual:
cat ~/.ssh/github_actions_vps.pub
# Copy output, lalu paste ke VPS:
# ssh foom@103.31.39.189
# mkdir -p ~/.ssh
# echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
# chmod 600 ~/.ssh/authorized_keys
```

### Test SSH Connection

```bash
# Test koneksi SSH
ssh -i ~/.ssh/github_actions_vps foom@103.31.39.189

# Jika berhasil, keluar dengan: exit
```

### Add Secrets ke GitHub

1. **Buka Repository di GitHub**
   - Pergi ke repository yang baru dibuat

2. **Buka Settings**
   - Klik tab **"Settings"** di menu atas repository

3. **Buka Secrets**
   - Di sidebar kiri, klik **"Secrets and variables"**
   - Pilih **"Actions"**

4. **Add Secrets**

   Klik **"New repository secret"** untuk setiap secret:

   #### Secret 1: VPS_HOST
   - **Name**: `VPS_HOST`
   - **Value**: `103.31.39.189`
   - Klik **"Add secret"**

   #### Secret 2: VPS_USER
   - **Name**: `VPS_USER`
   - **Value**: `foom`
   - Klik **"Add secret"**

   #### Secret 3: VPS_SSH_KEY
   - **Name**: `VPS_SSH_KEY`
   - **Value**: (Copy seluruh isi private key)
     ```bash
     # Di local machine
     cat ~/.ssh/github_actions_vps
     ```
     Copy **SEMUA** output termasuk:
     - `-----BEGIN OPENSSH PRIVATE KEY-----`
     - Semua baris di tengah
     - `-----END OPENSSH PRIVATE KEY-----`
   - Paste ke Value field
   - Klik **"Add secret"**

   #### Secret 4: VPS_PORT (Optional)
   - **Name**: `VPS_PORT`
   - **Value**: `22` (atau port SSH custom Anda)
   - Klik **"Add secret"**

## ✅ Step 5: Verify Setup

### Check GitHub Actions

1. **Buka Tab Actions**
   - Di repository GitHub, klik tab **"Actions"**
   - Anda akan melihat workflow "Deploy to VPS"

2. **Trigger Manual Deployment (Optional)**
   - Klik workflow **"Deploy to VPS"**
   - Klik **"Run workflow"** di kanan
   - Pilih branch **"main"**
   - Klik **"Run workflow"**

3. **Monitor Deployment**
   - Klik run yang baru dibuat
   - Monitor progress deployment
   - Jika ada error, check logs

### Check VPS

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Check aplikasi
pm2 status
pm2 logs manufacturing-app

# Check Nginx
sudo systemctl status nginx

# Test API
curl http://localhost:5000/api/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"production","password":"production123"}'
```

## 🚀 Step 6: Setup VPS (First Time)

Jika ini pertama kali setup VPS, jalankan setup script:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Clone atau upload setup script
# Atau copy-paste isi dari .github/scripts/setup-vps.sh

# Jalankan setup
chmod +x setup-vps.sh
./setup-vps.sh
```

Atau setup manual (lihat `DEPLOYMENT.md` untuk detail).

## 📋 Checklist

- [ ] Repository GitHub dibuat
- [ ] Git initialized di local
- [ ] Remote repository ditambahkan
- [ ] Files di-commit dan di-push
- [ ] SSH key generated
- [ ] Public key di-copy ke VPS
- [ ] GitHub Secrets ditambahkan (VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_PORT)
- [ ] VPS setup script dijalankan
- [ ] GitHub Actions workflow berjalan
- [ ] Deployment berhasil
- [ ] Aplikasi bisa diakses di VPS

## 🆘 Troubleshooting

### Error: Permission denied (publickey)
- Pastikan public key sudah di-copy ke VPS `~/.ssh/authorized_keys`
- Check permission: `chmod 600 ~/.ssh/authorized_keys`

### Error: Connection refused
- Check firewall: `sudo ufw status`
- Check SSH service: `sudo systemctl status ssh`

### Error: PM2 command not found
- Install PM2: `sudo npm install -g pm2`
- Setup PM2 startup: `pm2 startup systemd`

### Error: Nginx 502 Bad Gateway
- Check PM2 status: `pm2 status`
- Check PM2 logs: `pm2 logs manufacturing-app`
- Check Nginx config: `sudo nginx -t`

## 📞 Next Steps

Setelah setup selesai:
1. ✅ Setiap push ke `main` branch akan trigger deployment otomatis
2. ✅ Monitor deployment di GitHub Actions tab
3. ✅ Check aplikasi di `http://103.31.39.189`
4. ✅ Setup domain name (optional)
5. ✅ Setup SSL certificate (optional)

---

**Selamat! CI/CD setup selesai! 🎉**

