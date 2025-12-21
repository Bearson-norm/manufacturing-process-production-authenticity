# 🔧 Quick Fix - Port 8080 Already in Use

## Problem
Port 8080 masih digunakan oleh service lain atau container Traefik lama.

## Solution

### Step 1: Stop dan Remove Container Traefik Lama

```bash
cd ~/traefik

# Stop dan remove container
docker-compose down
docker stop traefik 2>/dev/null || true
docker rm traefik 2>/dev/null || true

# Check apa yang menggunakan port 8080
sudo lsof -i :8080
```

### Step 2: Check Port 8080

```bash
# Lihat apa yang menggunakan port 8080
sudo lsof -i :8080

# Jika ada service lain, stop atau gunakan port berbeda
```

### Step 3: Gunakan Port Alternatif

Jika port 8080 digunakan service lain, gunakan port alternatif:

```bash
cd ~/traefik

# Gunakan fix-ports.sh dengan port custom
chmod +x fix-ports.sh
./fix-ports.sh 8081 8444
```

Atau edit manual:

```bash
# Edit docker-compose.yml
nano docker-compose.yml

# Change ports dari:
#   - "8080:80"
#   - "8443:443"
# To:
#   - "8081:80"
#   - "8444:443"
```

### Step 4: Start Traefik

```bash
cd ~/traefik
docker-compose up -d
```

### Step 5: Update Nginx Snippet

Jika menggunakan port berbeda, update Nginx snippet:

```bash
sudo nano /etc/nginx/snippets/traefik-proxy.conf
```

Change `proxy_pass http://127.0.0.1:8080;` ke port yang digunakan (misal 8081).

## Alternative: Manual Fix

### 1. Stop Everything

```bash
cd ~/traefik
docker-compose down
docker stop traefik 2>/dev/null || true
docker rm traefik 2>/dev/null || true
```

### 2. Find Available Ports

```bash
# Check available ports
./check-ports.sh

# Atau manual check
for port in 8081 8082 8880 8888; do
    if ! sudo lsof -i :$port >/dev/null 2>&1; then
        echo "Port $port is available"
    fi
done
```

### 3. Update docker-compose.yml

```bash
nano docker-compose.yml
```

Change ports section:
```yaml
ports:
  - "8081:80"   # Change 8080 to available port
  - "8444:443"  # Change 8443 to available port
  - "8080:8080" # Dashboard (keep this)
```

### 4. Update .traefik-ports

```bash
cat > .traefik-ports <<EOF
HTTP_PORT=8081
HTTPS_PORT=8444
Dashboard port: 8080
EOF
```

### 5. Update Nginx Snippet

```bash
sudo nano /etc/nginx/snippets/traefik-proxy.conf
```

Change:
```nginx
proxy_pass http://127.0.0.1:8081;  # Use new port
```

### 6. Start Traefik

```bash
docker-compose up -d
```

### 7. Verify

```bash
# Check Traefik
docker ps | grep traefik

# Check logs
docker-compose logs traefik

# Test
curl http://localhost:8081/api/rawdata
```

## Check What's Using Port 8080

```bash
# Check process
sudo lsof -i :8080

# Check Docker containers
docker ps | grep 8080

# Check systemd services
sudo systemctl list-units | grep -i 8080
```

## Common Issues

### Issue: Port still in use after stopping container

```bash
# Force remove
docker rm -f traefik

# Check Docker networks
docker network ls
docker network prune -f
```

### Issue: Permission denied

```bash
# Use sudo for docker commands if needed
sudo docker-compose down
sudo docker rm -f traefik
```

### Issue: Port conflict persists

```bash
# Use completely different ports
./fix-ports.sh 8880 9443
```

---

**After fixing, Traefik should start successfully!** ✅

