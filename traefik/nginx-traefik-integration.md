# 🔗 Nginx + Traefik Integration Guide

Panduan untuk menjalankan Nginx dan Traefik bersamaan di VPS yang sama.

## 🎯 Scenario

Anda ingin:
- ✅ Keep Nginx running (untuk service existing)
- ✅ Use Traefik untuk service baru
- ✅ Atau use Traefik untuk semua service dengan Nginx sebagai frontend

## 📋 Setup Options

### Option 1: Traefik on Different Ports (Recommended)

Traefik berjalan di port 8080 (HTTP) dan 8443 (HTTPS), Nginx tetap di 80/443.

#### Step 1: Update Traefik Ports

Edit `docker-compose.yml`:
```yaml
ports:
  - "8080:80"   # HTTP
  - "8443:443"  # HTTPS
  - "8080:8080" # Dashboard
```

#### Step 2: Configure Nginx to Proxy to Traefik

Untuk service baru yang ingin di-handle Traefik, tambahkan di Nginx:

```nginx
# /etc/nginx/sites-available/new-service
server {
    listen 80;
    server_name new-service.example.com;
    
    # Proxy to Traefik
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
    }
}
```

#### Step 3: Update Traefik dynamic.yml

Traefik akan handle routing berdasarkan Host header dari Nginx:

```yaml
http:
  routers:
    new-service:
      rule: "Host(`new-service.example.com`)"
      entryPoints:
        - websecure
      service: new-service-service
      tls:
        certResolver: letsencrypt
```

### Option 2: Nginx as Frontend, Traefik as Backend

Nginx di port 80/443, proxy ke Traefik untuk service tertentu.

#### Nginx Configuration

```nginx
# Service yang di-handle Traefik
server {
    listen 80;
    server_name mpr.moof-set.web.id;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Service yang tetap di-handle Nginx
server {
    listen 80;
    server_name old-service.example.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... existing config
    }
}
```

### Option 3: Gradual Migration

1. Setup Traefik di port 8080/8443
2. Migrate service satu per satu dari Nginx ke Traefik
3. Update Nginx untuk proxy ke Traefik untuk migrated services
4. Eventually, semua service di Traefik, Nginx hanya sebagai frontend

## 🔧 Configuration Examples

### Example 1: Manufacturing App via Traefik

**Nginx Config:**
```nginx
server {
    listen 80;
    server_name mpr.moof-set.web.id;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Traefik dynamic.yml:**
```yaml
http:
  routers:
    manufacturing-app:
      rule: "Host(`mpr.moof-set.web.id`)"
      entryPoints:
        - websecure
      service: manufacturing-app-service
      tls:
        certResolver: letsencrypt
```

### Example 2: Multiple Services

**Nginx Config:**
```nginx
# Service 1 - via Traefik
server {
    listen 80;
    server_name service1.example.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        # ... proxy headers
    }
}

# Service 2 - via Traefik
server {
    listen 80;
    server_name service2.example.com;
    location / {
        proxy_pass http://127.0.0.1:8080;
        # ... proxy headers
    }
}

# Service 3 - Direct Nginx (not via Traefik)
server {
    listen 80;
    server_name service3.example.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        # ... direct config
    }
}
```

## 🔒 SSL Certificate Handling

### Option A: Nginx handles SSL

Nginx mendapatkan SSL dari Let's Encrypt, proxy ke Traefik (HTTP):

```nginx
server {
    listen 443 ssl;
    server_name mpr.moof-set.web.id;
    
    ssl_certificate /etc/letsencrypt/live/mpr.moof-set.web.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mpr.moof-set.web.id/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8080;  # HTTP to Traefik
        # ... headers
    }
}
```

### Option B: Traefik handles SSL

Traefik mendapatkan SSL, Nginx hanya proxy HTTP:

```nginx
server {
    listen 80;
    server_name mpr.moof-set.web.id;
    
    location / {
        proxy_pass https://127.0.0.1:8443;  # HTTPS to Traefik
        proxy_ssl_verify off;  # Since it's localhost
        # ... headers
    }
}
```

## 📝 Step-by-Step Setup

### 1. Update Traefik Ports

```bash
cd ~/traefik
# Edit docker-compose.yml, change ports to 8080:80 and 8443:443
nano docker-compose.yml
```

### 2. Restart Traefik

```bash
docker-compose down
docker-compose up -d
```

### 3. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/manufacturing-app
# Add proxy config to Traefik
```

### 4. Test

```bash
# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Test service
curl -I http://mpr.moof-set.web.id
```

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Check what's using port 80
sudo lsof -i :80

# Check Traefik ports
docker ps | grep traefik
docker port traefik
```

### SSL Issues

Jika Nginx handle SSL:
- Generate cert dengan Certbot untuk Nginx
- Nginx proxy HTTP ke Traefik

Jika Traefik handle SSL:
- Traefik akan auto-generate cert
- Nginx proxy HTTPS ke Traefik (port 8443)

### Routing Issues

```bash
# Check Traefik routing
curl http://localhost:8080/api/http/routers

# Test direct Traefik
curl -H "Host: mpr.moof-set.web.id" http://localhost:8080/health

# Test via Nginx
curl -H "Host: mpr.moof-set.web.id" http://localhost/health
```

## ✅ Best Practices

1. **Use Nginx for SSL termination** jika sudah setup
2. **Use Traefik for new services** untuk easier management
3. **Gradually migrate** service dari Nginx ke Traefik
4. **Keep Nginx configs** sebagai backup
5. **Monitor both** Nginx dan Traefik logs

## 📊 Monitoring

```bash
# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Traefik logs
cd ~/traefik
docker-compose logs -f traefik

# Traefik dashboard
curl http://localhost:8080/api/rawdata | jq
```

---

**Setup selesai! Nginx dan Traefik berjalan bersamaan.** 🎉

