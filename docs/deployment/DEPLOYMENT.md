# 🚀 Deployment Guide

Panduan lengkap untuk deploy aplikasi Manufacturing Process ke VPS menggunakan GitHub Actions CI/CD.

## 📋 Prerequisites

1. VPS dengan akses SSH (103.31.39.189)
2. User dengan sudo access (foom)
3. GitHub repository
4. SSH key pair untuk akses VPS

## 🔧 Setup Awal VPS

### 1. Login ke VPS
```bash
ssh foom@103.31.39.189
```

### 2. Jalankan Setup Script
```bash
# Clone repository atau upload setup script
# Kemudian jalankan:
chmod +x setup-vps.sh
./setup-vps.sh
```

Atau setup manual:

#### Install Node.js 18.x
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Verify installation
```

#### Install PM2
```bash
sudo npm install -g pm2
pm2 --version
```

#### Install Nginx
```bash
sudo apt-get update
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### Setup PM2 untuk auto-start
```bash
pm2 startup systemd -u foom --hp /home/foom
# Jalankan perintah yang di-output oleh command di atas
```

## 🔑 Setup GitHub Secrets

1. Buka repository di GitHub
2. Pergi ke **Settings** → **Secrets and variables** → **Actions**
3. Klik **New repository secret**
4. Tambahkan secrets berikut:

### VPS_HOST
```
103.31.39.189
```

### VPS_USER
```
foom
```

### VPS_SSH_KEY
Generate SSH key pair jika belum ada:
```bash
# Di local machine
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_vps

# Copy public key ke VPS
ssh-copy-id -i ~/.ssh/github_actions_vps.pub foom@103.31.39.189

# Copy private key untuk GitHub Secret
cat ~/.ssh/github_actions_vps
# Copy seluruh output (termasuk -----BEGIN dan -----END)
```

Paste seluruh private key ke GitHub Secret `VPS_SSH_KEY`.

### VPS_PORT (Optional)
```
22
```
Default adalah 22, sesuaikan jika menggunakan port lain.

## 📦 Setup GitHub Repository

### 1. Initialize Git Repository (jika belum)
```bash
cd Manufacturing-Process-Production-Authenticity
git init
git add .
git commit -m "Initial commit"
```

### 2. Create Repository di GitHub
1. Login ke GitHub
2. Klik **New repository**
3. Nama: `manufacturing-process-production-authenticity` (atau sesuai keinginan)
4. Pilih **Private** atau **Public**
5. Jangan centang "Initialize with README"
6. Klik **Create repository**

### 3. Push ke GitHub
```bash
# Tambahkan remote
git remote add origin https://github.com/YOUR_USERNAME/manufacturing-process-production-authenticity.git

# Push ke main branch
git branch -M main
git push -u origin main
```

## 🔄 Workflow CI/CD

GitHub Actions akan otomatis:
1. ✅ Checkout code
2. ✅ Setup Node.js
3. ✅ Install dependencies
4. ✅ Build React client
5. ✅ Create deployment package
6. ✅ Deploy ke VPS via SCP
7. ✅ Execute deployment script
8. ✅ Restart aplikasi dengan PM2

### Trigger Deployment

Deployment otomatis trigger ketika:
- Push ke branch `main` atau `master`
- Manual trigger via GitHub Actions UI (workflow_dispatch)

## 🧪 Testing Deployment

### 1. Test API
```bash
curl http://103.31.39.189/api/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"production","password":"production123"}'
```

### 2. Test Frontend
Buka browser: `http://103.31.39.189`

### 3. Check PM2 Status
```bash
ssh foom@103.31.39.189
pm2 status
pm2 logs manufacturing-app
```

## 🔍 Troubleshooting

### PM2 tidak restart
```bash
ssh foom@103.31.39.189
pm2 restart manufacturing-app
pm2 save
```

### Nginx error
```bash
sudo nginx -t
sudo systemctl status nginx
sudo systemctl restart nginx
```

### Check logs
```bash
# PM2 logs
pm2 logs manufacturing-app

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Application logs
cd ~/deployments/manufacturing-app/server
cat logs/*.log
```

### Rollback ke backup sebelumnya
```bash
ssh foom@103.31.39.189
cd ~/deployments
ls -la manufacturing-app-backup-*
# Pilih backup yang ingin di-restore
rm -rf manufacturing-app
cp -r manufacturing-app-backup-YYYYMMDD-HHMMSS manufacturing-app
cd manufacturing-app/server
pm2 restart manufacturing-app
```

## 🔐 Security Best Practices

1. **Ganti default credentials** di production
2. **Setup SSL/HTTPS** dengan Let's Encrypt
3. **Firewall**: Hanya buka port yang diperlukan
4. **SSH**: Disable password authentication, gunakan key only
5. **Database**: Backup secara berkala

### Setup SSL dengan Let's Encrypt
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring

### PM2 Monitoring
```bash
pm2 monit
pm2 status
```

### Setup monitoring dengan PM2 Plus (optional)
```bash
pm2 link <secret_key> <public_key>
```

## 🔄 Manual Deployment (Alternative)

Jika CI/CD tidak bekerja, deploy manual:

```bash
# Di local machine
cd client
npm run build

# Copy ke VPS
scp -r build foom@103.31.39.189:~/deployments/manufacturing-app/client-build
scp -r ../server foom@103.31.39.189:~/deployments/manufacturing-app/

# Di VPS
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server
npm install --production
pm2 restart manufacturing-app
```

## 📝 Notes

- Database SQLite akan dibuat otomatis di `server/database.sqlite`
- Pastikan folder `server` memiliki write permission untuk database
- Backup database secara berkala
- PM2 akan auto-restart aplikasi jika crash

## 🆘 Support

Jika ada masalah:
1. Check GitHub Actions logs
2. Check PM2 logs
3. Check Nginx logs
4. Verify SSH connection
5. Verify GitHub Secrets configuration

