# 🚀 Panduan Setup Uptime Kuma di VPS

Panduan lengkap untuk menginstall dan mengkonfigurasi Uptime Kuma di VPS pada port 1212.

## 📋 Daftar Isi

1. [Persyaratan](#persyaratan)
2. [Metode Instalasi](#metode-instalasi)
3. [Konfigurasi PM2](#konfigurasi-pm2)
4. [Konfigurasi Nginx (Opsional)](#konfigurasi-nginx-opsional)
5. [Konfigurasi Firewall](#konfigurasi-firewall)
6. [Verifikasi](#verifikasi)
7. [Troubleshooting](#troubleshooting)

---

## ✅ Persyaratan

- VPS dengan Ubuntu/Debian Linux
- Node.js 16+ atau Docker (jika menggunakan Docker)
- PM2 terinstall (sudah ada di VPS Anda)
- Akses root atau sudo
- Port 1212 tersedia

---

## 🛠️ Metode Instalasi

### Metode 1: Menggunakan Docker (Recommended) ⭐

**Ini adalah cara TERMUDAH dan TERAMAN!**

#### Langkah 1: Install Docker (jika belum ada)

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Update package list
sudo apt update

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user ke docker group (agar bisa run docker tanpa sudo)
sudo usermod -aG docker $USER

# Logout dan login lagi, atau jalankan:
newgrp docker

# Verify installation
docker --version
```

#### Langkah 2: Install Docker Compose (jika belum ada)

```bash
# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

#### Langkah 3: Buat Directory untuk Uptime Kuma

```bash
# Buat directory untuk data Uptime Kuma
mkdir -p ~/uptime-kuma
cd ~/uptime-kuma
```

#### Langkah 4: Buat Docker Compose File

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    volumes:
      - ./data:/app/data
    ports:
      - "1212:3001"
    restart: unless-stopped
    environment:
      - UPTIME_KUMA_PORT=3001
EOF
```

#### Langkah 5: Start Uptime Kuma

```bash
# Start container
docker-compose up -d

# Check status
docker ps | grep uptime-kuma

# Check logs
docker logs uptime-kuma
```

#### Langkah 6: Setup Auto-start dengan Systemd (Opsional)

```bash
# Buat systemd service untuk auto-start
sudo tee /etc/systemd/system/uptime-kuma.service > /dev/null << 'EOF'
[Unit]
Description=Uptime Kuma
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/foom/uptime-kuma
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable dan start service
sudo systemctl daemon-reload
sudo systemctl enable uptime-kuma
sudo systemctl start uptime-kuma

# Check status
sudo systemctl status uptime-kuma
```

---

### Metode 2: Menggunakan Node.js + PM2

Jika Anda lebih suka menggunakan PM2 (seperti aplikasi manufacturing Anda):

#### Langkah 1: Install Node.js (jika belum ada)

```bash
# Check Node.js version
node --version

# Jika belum ada atau versi lama, install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

#### Langkah 2: Clone Uptime Kuma Repository

```bash
# Install git jika belum ada
sudo apt install git -y

# Clone repository
cd ~
git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma
```

#### Langkah 3: Install Dependencies

```bash
# Install dependencies
npm ci --production

# Atau jika npm ci gagal:
npm install --production
```

#### Langkah 4: Setup Environment

```bash
# Buat directory untuk data
mkdir -p ~/uptime-kuma-data

# Set environment variable
export UPTIME_KUMA_PORT=1212
export UPTIME_KUMA_DATA_DIR=~/uptime-kuma-data
```

#### Langkah 5: Buat PM2 Ecosystem Config

```bash
cd ~/uptime-kuma
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'uptime-kuma',
    script: 'server/server.js',
    cwd: '/home/foom/uptime-kuma',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      UPTIME_KUMA_PORT: 1212,
      UPTIME_KUMA_DATA_DIR: '/home/foom/uptime-kuma-data'
    },
    error_file: './logs/uptime-kuma-error.log',
    out_file: './logs/uptime-kuma-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# Buat directory untuk logs
mkdir -p logs
```

#### Langkah 6: Start dengan PM2

```bash
# Start aplikasi
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Check status
pm2 status
pm2 logs uptime-kuma --lines 50
```

---

## 🔧 Konfigurasi PM2

Jika menggunakan Metode 2 (Node.js + PM2), pastikan PM2 sudah dikonfigurasi dengan benar:

```bash
# Check PM2 status
pm2 status

# Setup PM2 startup script (jika belum)
pm2 startup
# Jalankan command yang muncul (biasanya sudo ...)

# Save current PM2 processes
pm2 save
```

---

## 🌐 Konfigurasi Nginx (Opsional)

Jika Anda ingin mengakses Uptime Kuma melalui domain/subdomain dengan HTTPS:

### Langkah 1: Buat Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/uptime-kuma << 'EOF'
server {
    listen 80;
    server_name uptime.yourdomain.com;  # Ganti dengan domain Anda

    location / {
        proxy_pass http://localhost:1212;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF
```

### Langkah 2: Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/uptime-kuma /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Langkah 3: Setup SSL dengan Certbot (Opsional)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d uptime.yourdomain.com

# Auto-renewal sudah otomatis setup
```

---

## 🔥 Konfigurasi Firewall

Pastikan port 1212 terbuka di firewall:

### UFW (Ubuntu Firewall)

```bash
# Check UFW status
sudo ufw status

# Allow port 1212
sudo ufw allow 1212/tcp

# Atau jika ingin lebih spesifik (hanya dari IP tertentu)
# sudo ufw allow from YOUR_IP to any port 1212

# Reload firewall
sudo ufw reload
```

### Firewalld (CentOS/RHEL)

```bash
# Allow port 1212
sudo firewall-cmd --permanent --add-port=1212/tcp
sudo firewall-cmd --reload
```

### iptables (jika menggunakan iptables langsung)

```bash
# Allow port 1212
sudo iptables -A INPUT -p tcp --dport 1212 -j ACCEPT
sudo iptables-save
```

---

## ✅ Verifikasi

### 1. Check Service Status

**Jika menggunakan Docker:**
```bash
# Check container status
docker ps | grep uptime-kuma

# Check logs
docker logs uptime-kuma --tail 50
```

**Jika menggunakan PM2:**
```bash
# Check PM2 status
pm2 status uptime-kuma

# Check logs
pm2 logs uptime-kuma --lines 50
```

### 2. Test Port Accessibility

```bash
# Test dari VPS sendiri
curl http://localhost:1212

# Atau test dengan telnet
telnet localhost 1212
```

### 3. Test dari Browser

Buka browser dan akses:
- **Langsung via IP**: `http://103.31.39.189:1212`
- **Via Domain** (jika sudah setup Nginx): `http://uptime.yourdomain.com` atau `https://uptime.yourdomain.com`

### 4. Setup Awal Uptime Kuma

1. Buka Uptime Kuma di browser
2. Buat admin account pertama kali
3. Login dengan akun yang baru dibuat
4. Mulai tambahkan monitor untuk service Anda

---

## 🐛 Troubleshooting

### Problem: Port 1212 sudah digunakan

**Solution:**
```bash
# Check apa yang menggunakan port 1212
sudo lsof -i :1212
# atau
sudo netstat -tulpn | grep 1212

# Kill process jika perlu (ganti <PID> dengan PID yang ditemukan)
sudo kill -9 <PID>

# Atau gunakan port lain, edit konfigurasi:
# - Docker: edit docker-compose.yml, ubah "1212:3001" menjadi "PORT_LAIN:3001"
# - PM2: edit ecosystem.config.js, ubah UPTIME_KUMA_PORT
```

### Problem: Uptime Kuma tidak bisa diakses dari luar

**Solution:**
```bash
# 1. Check firewall
sudo ufw status

# 2. Check apakah service listening di 0.0.0.0 atau hanya 127.0.0.1
sudo netstat -tulpn | grep 1212

# 3. Jika menggunakan Docker, pastikan port mapping benar
docker ps | grep uptime-kuma

# 4. Check Nginx (jika menggunakan reverse proxy)
sudo nginx -t
sudo systemctl status nginx
```

### Problem: Docker container tidak start

**Solution:**
```bash
# Check logs
docker logs uptime-kuma

# Check apakah Docker service running
sudo systemctl status docker

# Restart Docker
sudo systemctl restart docker

# Try start lagi
cd ~/uptime-kuma
docker-compose up -d
```

### Problem: PM2 tidak start Uptime Kuma

**Solution:**
```bash
# Check logs
pm2 logs uptime-kuma --err

# Check apakah Node.js version compatible
node --version  # Harus 16+

# Check apakah dependencies terinstall
cd ~/uptime-kuma
npm list --depth=0

# Reinstall dependencies jika perlu
rm -rf node_modules package-lock.json
npm install --production

# Restart PM2
pm2 restart uptime-kuma
```

### Problem: Permission denied

**Solution:**
```bash
# Fix permission untuk data directory (Docker)
sudo chown -R $USER:$USER ~/uptime-kuma/data

# Fix permission untuk uptime-kuma directory (PM2)
sudo chown -R $USER:$USER ~/uptime-kuma
sudo chown -R $USER:$USER ~/uptime-kuma-data
```

### Problem: Database error atau data tidak tersimpan

**Solution:**
```bash
# Check permission data directory
ls -la ~/uptime-kuma/data  # untuk Docker
ls -la ~/uptime-kuma-data  # untuk PM2

# Fix permission
sudo chown -R $USER:$USER ~/uptime-kuma/data
# atau
sudo chown -R $USER:$USER ~/uptime-kuma-data

# Restart service
# Docker:
docker-compose restart

# PM2:
pm2 restart uptime-kuma
```

---

## 📝 Quick Reference

### Docker Commands

```bash
# Start
cd ~/uptime-kuma && docker-compose up -d

# Stop
cd ~/uptime-kuma && docker-compose down

# Restart
cd ~/uptime-kuma && docker-compose restart

# Logs
docker logs -f uptime-kuma

# Update
cd ~/uptime-kuma
docker-compose pull
docker-compose up -d
```

### PM2 Commands

```bash
# Start
pm2 start ecosystem.config.js

# Stop
pm2 stop uptime-kuma

# Restart
pm2 restart uptime-kuma

# Logs
pm2 logs uptime-kuma

# Delete
pm2 delete uptime-kuma
```

### Useful Commands

```bash
# Check port
sudo lsof -i :1212

# Check firewall
sudo ufw status

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check Docker
docker ps
sudo systemctl status docker
```

---

## 🎯 Setup Monitor untuk Aplikasi Manufacturing

Setelah Uptime Kuma berjalan, Anda bisa menambahkan monitor untuk aplikasi manufacturing Anda:

1. **Login ke Uptime Kuma**
2. **Klik "Add New Monitor"**
3. **Pilih tipe monitor:**
   - **HTTP(s)**: Untuk monitor website/API
   - **Keyword**: Untuk monitor apakah halaman mengandung keyword tertentu
   - **TCP Port**: Untuk monitor port tertentu
4. **Konfigurasi monitor:**
   - **Name**: Manufacturing App
   - **URL**: `https://mpr.moof-set.web.id` atau `http://localhost:1234/health`
   - **Interval**: 60 detik (atau sesuai kebutuhan)
   - **Retry**: 3 kali
5. **Save monitor**

Contoh monitor yang bisa ditambahkan:
- Manufacturing App Main: `https://mpr.moof-set.web.id`
- Manufacturing App Health: `https://mpr.moof-set.web.id/health`
- Manufacturing App API: `https://mpr.moof-set.web.id/api/health`

---

## 🔐 Security Recommendations

1. **Gunakan HTTPS** jika mengakses dari internet
2. **Setup authentication** di Uptime Kuma (wajib saat first setup)
3. **Gunakan firewall** untuk membatasi akses ke port 1212
4. **Backup data** Uptime Kuma secara berkala:
   ```bash
   # Backup data (Docker)
   tar -czf uptime-kuma-backup-$(date +%Y%m%d).tar.gz ~/uptime-kuma/data
   
   # Backup data (PM2)
   tar -czf uptime-kuma-backup-$(date +%Y%m%d).tar.gz ~/uptime-kuma-data
   ```
5. **Update Uptime Kuma** secara berkala:
   ```bash
   # Docker
   cd ~/uptime-kuma
   docker-compose pull
   docker-compose up -d
   ```

---

## 📞 Support

Jika ada masalah:

1. **Check logs**: `docker logs uptime-kuma` atau `pm2 logs uptime-kuma`
2. **Check documentation**: https://github.com/louislam/uptime-kuma
3. **Check firewall dan port**: `sudo ufw status` dan `sudo lsof -i :1212`
4. **Restart service**: `docker-compose restart` atau `pm2 restart uptime-kuma`

---

**Happy Monitoring! 🎉**

**PENTING**: 
- Backup data Uptime Kuma secara berkala
- Update Uptime Kuma untuk mendapatkan security patches terbaru
- Monitor resource usage (CPU, Memory, Disk) secara berkala












