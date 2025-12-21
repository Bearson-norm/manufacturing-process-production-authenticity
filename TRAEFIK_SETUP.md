# 🚦 Traefik Setup Guide - Complete

Panduan lengkap setup Traefik untuk Manufacturing App dan service lainnya di VPS.

## 🎯 Overview

Traefik akan menggantikan Nginx sebagai reverse proxy dengan keuntungan:
- ✅ Auto-discovery untuk Docker containers
- ✅ Automatic SSL certificates (Let's Encrypt)
- ✅ Dynamic configuration (tidak perlu restart)
- ✅ Dashboard untuk monitoring
- ✅ Mudah menambah service baru

## 📋 Prerequisites

1. VPS dengan akses root/sudo
2. Domain sudah di-point ke VPS IP
3. Docker dan Docker Compose installed (akan di-install otomatis oleh script)

## 🚀 Quick Setup

### Step 1: Upload Traefik Files ke VPS

```bash
# Di local machine, upload folder traefik ke VPS
scp -r traefik foom@103.31.39.189:~/traefik
```

Atau clone dari GitHub jika sudah di-push.

### Step 2: Run Setup Script

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Jalankan setup
cd ~/traefik
chmod +x setup-traefik.sh
./setup-traefik.sh
```

Script akan:
- Install Docker (jika belum ada)
- Install Docker Compose (jika belum ada)
- Create Traefik configuration
- Start Traefik container

### Step 3: Verify Traefik

```bash
# Check Traefik container
docker ps | grep traefik

# Check logs
cd ~/traefik
docker-compose logs -f traefik

# Test dashboard (temporary)
curl http://localhost:8080/api/rawdata
```

### Step 4: Verify Manufacturing App

```bash
# Check if app is running
pm2 status

# If not, start it
cd ~/deployments/manufacturing-app/server
pm2 start ecosystem.config.js

# Test health endpoint
curl http://localhost:1234/health
```

### Step 5: Test Domain

```bash
# Test domain (SSL akan auto-generate)
curl -I https://mpr.moof-set.web.id

# Check SSL certificate
openssl s_client -connect mpr.moof-set.web.id:443 -servername mpr.moof-set.web.id
```

## 📝 Adding New Services

### Method 1: Using Script (Easiest)

```bash
cd ~/traefik
chmod +x add-service.sh
./add-service.sh service-name domain.com 3000 /
```

Contoh:
```bash
./add-service.sh api api.example.com 3000 /api
./add-service.sh frontend app.example.com 8080 /
```

### Method 2: Manual Edit dynamic.yml

Edit `~/traefik/dynamic.yml`:

```yaml
http:
  routers:
    my-new-service:
      rule: "Host(`myservice.example.com`)"
      entryPoints:
        - websecure
      service: my-new-service-service
      tls:
        certResolver: letsencrypt
      middlewares:
        - my-new-service-rate-limit

  services:
    my-new-service-service:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:3000"

  middlewares:
    my-new-service-rate-limit:
      rateLimit:
        average: 50
        burst: 30
```

Kemudian restart:
```bash
cd ~/traefik
docker-compose restart
```

### Method 3: Docker Labels (For Docker Services)

Jika service dalam Docker container, tambahkan labels di `docker-compose.yml`:

```yaml
services:
  my-service:
    image: my-service:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.my-service.rule=Host(`myservice.example.com`)"
      - "traefik.http.routers.my-service.entrypoints=websecure"
      - "traefik.http.routers.my-service.tls.certresolver=letsencrypt"
      - "traefik.http.services.my-service.loadbalancer.server.port=3000"
    networks:
      - traefik-network
```

## 🔄 Migrate Existing Services from Nginx

Jika Anda punya service yang masih pakai Nginx:

### Step 1: Backup Nginx Config

```bash
sudo cp -r /etc/nginx/sites-available ~/nginx-backup
```

### Step 2: Run Migration Script

```bash
cd ~/traefik
chmod +x migrate-nginx-services.sh
./migrate-nginx-services.sh
```

### Step 3: Review Generated Config

```bash
cat ~/traefik/dynamic.yml
```

### Step 4: Apply Configuration

```bash
cd ~/traefik
docker-compose restart
```

### Step 5: Test Services

Test setiap service untuk memastikan routing benar.

### Step 6: Stop Nginx (Optional)

Setelah semua service migrated dan tested:

```bash
# Stop Nginx
sudo systemctl stop nginx
sudo systemctl disable nginx

# Atau keep it running untuk backup (recommended)
```

## 🔒 Security

### 1. Secure Traefik Dashboard

Edit `~/traefik/traefik.yml`:

```yaml
api:
  dashboard: true
  insecure: false
  middlewares:
    - traefik-auth
```

Generate password hash:
```bash
# Install htpasswd
sudo apt-get install apache2-utils -y

# Generate hash
htpasswd -nb admin yourpassword
# Output: admin:$apr1$...
```

Add ke `dynamic.yml`:
```yaml
http:
  middlewares:
    traefik-auth:
      basicAuth:
        users:
          - "admin:$apr1$..." # Paste hash di sini
```

Add router untuk dashboard:
```yaml
http:
  routers:
    traefik-dashboard:
      rule: "Host(`traefik.mpr.moof-set.web.id`)"
      entryPoints:
        - websecure
      service: api@internal
      tls:
        certResolver: letsencrypt
      middlewares:
        - traefik-auth
```

### 2. Firewall Configuration

```bash
# Allow Traefik ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp  # Dashboard (optional)

# Block direct access to app ports (recommended)
sudo ufw deny 1234/tcp
sudo ufw deny 3000/tcp  # Block other service ports
```

## 📊 Monitoring

### Traefik Dashboard

Access dashboard:
- **Local**: `http://localhost:8080`
- **Domain**: `https://traefik.mpr.moof-set.web.id` (setelah setup auth)

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

### Health Checks

```bash
# Manufacturing app health
curl http://localhost:1234/health

# Traefik API
curl http://localhost:8080/api/rawdata | jq
```

## 🐛 Troubleshooting

### Traefik tidak start

```bash
# Check logs
cd ~/traefik
docker-compose logs traefik

# Check config syntax
docker-compose config

# Check Docker
docker ps
docker network ls
```

### SSL Certificate tidak generate

```bash
# Check acme.json permissions
ls -la ~/traefik/acme.json
# Should be 600
chmod 600 ~/traefik/acme.json

# Check DNS
nslookup mpr.moof-set.web.id

# Check logs
docker-compose logs traefik | grep -i acme
```

### Service tidak accessible

```bash
# Check if service is running
pm2 status
# atau
docker ps

# Check Traefik routing
curl -H "Host: mpr.moof-set.web.id" http://localhost/api/health

# Check Traefik dashboard
curl http://localhost:8080/api/http/routers | jq
```

### Port conflict

```bash
# Check what's using port 80/443
sudo netstat -tulpn | grep -E ':(80|443)'

# Stop Nginx if needed
sudo systemctl stop nginx
```

## 📁 File Structure

```
~/traefik/
├── docker-compose.yml           # Traefik container config
├── traefik.yml                  # Static Traefik config
├── dynamic.yml                   # Dynamic config (services)
├── acme.json                     # SSL certificates storage
├── logs/                         # Traefik logs
│   ├── access.log
│   └── traefik.log
├── setup-traefik.sh             # Setup script
├── add-service.sh                # Add service script
├── migrate-nginx-services.sh     # Migrate from Nginx
└── README.md                     # Detailed documentation
```

## 🔄 Update & Maintenance

### Update Traefik

```bash
cd ~/traefik
docker-compose pull
docker-compose up -d
```

### Reload Configuration

Traefik auto-reloads `dynamic.yml`. Untuk force reload:

```bash
# Restart Traefik
docker-compose restart

# Or send SIGHUP
docker exec traefik kill -SIGHUP 1
```

### Backup Configuration

```bash
# Backup config
cp ~/traefik/dynamic.yml ~/traefik/dynamic.yml.backup.$(date +%Y%m%d)
cp ~/traefik/acme.json ~/traefik/acme.json.backup.$(date +%Y%m%d)
```

## ✅ Checklist

- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Traefik setup script executed
- [ ] Traefik container running
- [ ] Manufacturing app running on port 1234
- [ ] Health endpoint working (`/health`)
- [ ] Domain DNS pointed to VPS
- [ ] SSL certificate generated
- [ ] Dashboard accessible (optional)
- [ ] Existing services migrated (if any)
- [ ] Firewall configured
- [ ] Monitoring setup

## 🎯 Next Steps

1. **Add more services** menggunakan `add-service.sh`
2. **Secure dashboard** dengan basic auth
3. **Setup monitoring** dengan Prometheus/Grafana (optional)
4. **Configure backup** untuk acme.json dan configs
5. **Document services** yang sudah di-add

---

**Traefik setup selesai! Ready untuk manage multiple services.** 🎉

Lihat `traefik/README.md` untuk dokumentasi lebih detail.

