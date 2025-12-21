# 🚦 Traefik Setup Guide

Panduan setup Traefik sebagai reverse proxy untuk Manufacturing App dan service lainnya.

## 📋 Overview

Traefik adalah modern reverse proxy yang cocok untuk:
- ✅ Multiple services management
- ✅ Auto-discovery (Docker containers)
- ✅ Automatic SSL certificates (Let's Encrypt)
- ✅ Dynamic configuration
- ✅ Dashboard untuk monitoring

## 🚀 Quick Start

### 1. Setup Traefik

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Upload atau clone traefik folder ke VPS
cd ~
mkdir -p traefik
# Upload semua file dari folder traefik/

# Jalankan setup script
chmod +x traefik/setup-traefik.sh
./traefik/setup-traefik.sh
```

### 2. Verify Traefik is Running

```bash
# Check Traefik container
docker ps | grep traefik

# Check Traefik logs
cd ~/traefik
docker-compose logs -f traefik

# Access dashboard (temporary, sebelum setup auth)
curl http://localhost:8080/api/rawdata
```

### 3. Setup Manufacturing App

Manufacturing app sudah dikonfigurasi di `dynamic.yml`. Pastikan:
- App berjalan di port 1234
- Health check endpoint tersedia di `/health`

```bash
# Check if app is running
pm2 status

# If not running, start it
cd ~/deployments/manufacturing-app/server
pm2 start ecosystem.config.js
```

### 4. Verify Domain

```bash
# Test domain
curl -I https://mpr.moof-set.web.id

# Check SSL certificate (akan auto-generated oleh Traefik)
openssl s_client -connect mpr.moof-set.web.id:443 -servername mpr.moof-set.web.id
```

## 📝 Adding New Services

### Method 1: Using Script (Recommended)

```bash
cd ~/traefik
chmod +x add-service.sh
./add-service.sh my-service myservice.example.com 3000 /
```

### Method 2: Manual Edit dynamic.yml

Edit `~/traefik/dynamic.yml` dan tambahkan:

```yaml
http:
  routers:
    my-service:
      rule: "Host(`myservice.example.com`)"
      entryPoints:
        - websecure
      service: my-service-service
      tls:
        certResolver: letsencrypt

  services:
    my-service-service:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:3000"
```

Kemudian restart Traefik:
```bash
cd ~/traefik
docker-compose restart
```

### Method 3: Docker Labels (For Docker Services)

Jika service Anda dalam Docker container, tambahkan labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.my-service.rule=Host(`myservice.example.com`)"
  - "traefik.http.routers.my-service.entrypoints=websecure"
  - "traefik.http.routers.my-service.tls.certresolver=letsencrypt"
  - "traefik.http.services.my-service.loadbalancer.server.port=3000"
```

## 🔄 Migrate from Nginx

Jika Anda punya service yang sudah pakai Nginx:

```bash
cd ~/traefik
chmod +x migrate-nginx-services.sh
./migrate-nginx-services.sh
```

Script ini akan:
1. Scan Nginx config files
2. Extract domain, port, dan path
3. Generate Traefik configuration
4. Backup existing config

**Note**: Review generated config sebelum apply!

## 🔒 Security

### 1. Secure Traefik Dashboard

Edit `traefik.yml` dan tambahkan basic auth:

```yaml
api:
  dashboard: true
  insecure: false
  middlewares:
    - traefik-auth
```

Dan di `dynamic.yml`:

```yaml
http:
  middlewares:
    traefik-auth:
      basicAuth:
        users:
          - "admin:$2y$10$..." # Generate dengan htpasswd
```

Generate password:
```bash
echo $(htpasswd -nb admin yourpassword) | sed -e s/\\$/\\$\\$/g
```

### 2. Firewall

```bash
# Allow Traefik ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp  # Dashboard (optional, bisa di-restrict)

# Block direct access to app ports (optional)
sudo ufw deny 1234/tcp
```

## 📊 Monitoring

### Traefik Dashboard

Access dashboard:
- **URL**: `http://your-vps-ip:8080` (atau setup domain)
- **API**: `http://your-vps-ip:8080/api/rawdata`

### Logs

```bash
# Traefik logs
cd ~/traefik
docker-compose logs -f traefik

# Access logs
tail -f ~/traefik/logs/access.log

# Application logs
tail -f ~/traefik/logs/traefik.log
```

## 🐛 Troubleshooting

### Traefik tidak start

```bash
# Check logs
cd ~/traefik
docker-compose logs traefik

# Check config
docker-compose config

# Restart
docker-compose restart
```

### SSL Certificate tidak generate

```bash
# Check acme.json permissions
ls -la ~/traefik/acme.json
# Should be 600

# Check logs untuk error
docker-compose logs traefik | grep -i acme

# Manual certificate request (test)
docker exec traefik traefik version
```

### Service tidak accessible

```bash
# Check if service is running
pm2 status  # atau docker ps

# Check Traefik routing
curl -H "Host: your-domain.com" http://localhost/api/health

# Check Traefik dashboard untuk routing table
curl http://localhost:8080/api/http/routers
```

### Port conflict dengan Nginx

Jika Nginx masih running:

```bash
# Stop Nginx
sudo systemctl stop nginx
sudo systemctl disable nginx

# Atau uninstall (jika tidak perlu lagi)
sudo apt-get remove nginx
```

## 📁 File Structure

```
~/traefik/
├── docker-compose.yml      # Traefik container config
├── traefik.yml            # Static Traefik config
├── dynamic.yml            # Dynamic config (services)
├── acme.json              # SSL certificates storage
├── logs/                  # Traefik logs
├── setup-traefik.sh       # Setup script
├── add-service.sh         # Add service script
└── migrate-nginx-services.sh  # Migrate from Nginx
```

## 🔄 Update Configuration

### Reload Dynamic Config

Traefik akan auto-reload `dynamic.yml` jika ada perubahan. Atau manual:

```bash
# Restart Traefik
cd ~/traefik
docker-compose restart

# Atau reload config (SIGHUP)
docker exec traefik kill -SIGHUP 1
```

### Update Static Config

Edit `traefik.yml` dan restart:

```bash
cd ~/traefik
docker-compose restart
```

## 📚 Additional Resources

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Traefik Docker Provider](https://doc.traefik.io/traefik/providers/docker/)
- [Traefik File Provider](https://doc.traefik.io/traefik/providers/file/)

## ✅ Checklist

- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Traefik setup script executed
- [ ] Traefik container running
- [ ] Manufacturing app running on port 1234
- [ ] Domain DNS pointed to VPS
- [ ] SSL certificate generated
- [ ] Dashboard secured (optional)
- [ ] Firewall configured
- [ ] Services migrated from Nginx (if any)

---

**Setup selesai! Traefik siap untuk manage multiple services.** 🎉

