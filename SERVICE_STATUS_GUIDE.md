# 🔍 Service Status Check & Fix Guide

**Tanggal**: 2026-01-30  
**Issue**: Beberapa service masih down setelah cleanup

---

## 📊 Quick Status Check

### Option 1: Script Otomatis (Recommended)

```bash
# Upload script ke VPS
# (Copy isi dari check-services-status.sh)

# Berikan permission
chmod +x check-services-status.sh

# Jalankan
./check-services-status.sh
```

### Option 2: Manual Commands

```bash
# 1. Check PM2 Status
pm2 status

# 2. Check Health Endpoints
curl http://localhost:1234/health  # Manufacturing App Production
curl http://localhost:5678/health  # Manufacturing App Staging

# 3. Check Nginx
sudo systemctl status nginx

# 4. Check PostgreSQL
sudo systemctl status postgresql@16-main

# 5. Check Docker
docker ps

# 6. Check Ports
netstat -tlnp | grep -E "1234|5678|80|443"
```

---

## 🔧 Quick Fix Commands

### Fix PM2 Processes

```bash
# Restart semua PM2 processes
pm2 restart all

# Atau restart satu per satu
pm2 restart manufacturing-app
pm2 restart manufacturing-app-staging
pm2 restart mo-receiver
pm2 restart mo-reporting

# Save PM2 state
pm2 save
```

### Fix Nginx

```bash
# Start Nginx
sudo systemctl start nginx

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx

# Check logs jika ada error
sudo journalctl -u nginx -n 50
```

### Fix PostgreSQL

```bash
# Start PostgreSQL
sudo systemctl start postgresql@16-main

# Atau jika service name berbeda
sudo systemctl start postgresql

# Check status
sudo systemctl status postgresql@16-main

# Check logs jika ada error
sudo journalctl -u postgresql@16-main -n 50
```

### Fix Docker Containers

```bash
# List semua containers
docker ps -a

# Start stopped containers
docker start <container-name>

# Restart semua containers
docker restart $(docker ps -q)

# Check logs
docker logs <container-name> --tail 50
```

---

## 🚀 Auto-Fix Script

```bash
# Upload script ke VPS
# (Copy isi dari fix-down-services.sh)

# Berikan permission
chmod +x fix-down-services.sh

# Jalankan (akan otomatis fix semua yang down)
./fix-down-services.sh
```

---

## 🔍 Troubleshooting Specific Issues

### Issue 1: Manufacturing App Production Down

**Symptoms**: Health check `http://localhost:1234/health` fails

**Fix**:
```bash
# Check PM2 status
pm2 status manufacturing-app

# Check logs
pm2 logs manufacturing-app --lines 50

# Restart
pm2 restart manufacturing-app

# Check port
netstat -tlnp | grep 1234
```

**Common causes**:
- Database connection error
- Port already in use
- Missing .env file
- Application crash

---

### Issue 2: Manufacturing App Staging Down

**Symptoms**: Health check `http://localhost:5678/health` fails

**Fix**:
```bash
# Check PM2 status
pm2 status manufacturing-app-staging

# Check logs
pm2 logs manufacturing-app-staging --lines 50

# Restart
pm2 restart manufacturing-app-staging

# Check port
netstat -tlnp | grep 5678
```

---

### Issue 3: Database Connection Error

**Symptoms**: Health endpoint returns "database: disconnected"

**Fix**:
```bash
# Check PostgreSQL
sudo systemctl status postgresql@16-main

# Start if stopped
sudo systemctl start postgresql@16-main

# Test connection
psql -h localhost -U postgres -c "SELECT 1;"

# Check if database exists
psql -h localhost -U postgres -l
```

---

### Issue 4: Port Already in Use

**Symptoms**: Application fails to start, port conflict

**Fix**:
```bash
# Find process using port
sudo lsof -i :1234
sudo lsof -i :5678

# Kill process (HATI-HATI!)
sudo kill -9 <PID>

# Or restart PM2
pm2 restart all
```

---

### Issue 5: Nginx Not Serving

**Symptoms**: Website tidak bisa diakses

**Fix**:
```bash
# Check Nginx status
sudo systemctl status nginx

# Start Nginx
sudo systemctl start nginx

# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Check logs
sudo tail -f /var/log/nginx/error.log
```

---

## 📋 Service Checklist

Setelah fix, verify semua service:

- [ ] PM2: `pm2 status` - semua online
- [ ] Manufacturing App Production: `curl http://localhost:1234/health` - returns 200
- [ ] Manufacturing App Staging: `curl http://localhost:5678/health` - returns 200
- [ ] Nginx: `sudo systemctl status nginx` - active (running)
- [ ] PostgreSQL: `sudo systemctl status postgresql@16-main` - active (running)
- [ ] Docker: `docker ps` - semua containers running
- [ ] Ports: `netstat -tlnp | grep -E "1234|5678"` - listening

---

## 🆘 Emergency Restart All

Jika banyak service down, restart semua sekaligus:

```bash
# Restart PM2
pm2 restart all
pm2 save

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql@16-main

# Restart Docker containers
docker restart $(docker ps -q)

# Wait a bit
sleep 5

# Verify
pm2 status
curl http://localhost:1234/health
curl http://localhost:5678/health
```

---

## 📊 Monitoring Ongoing

```bash
# Watch PM2 status
watch -n 5 'pm2 status'

# Watch health endpoints
watch -n 10 'curl -s http://localhost:1234/health && echo "" && curl -s http://localhost:5678/health'

# Watch system resources
htop
```

---

## 💡 Prevention Tips

1. **Setup PM2 auto-restart**:
   ```bash
   pm2 startup
   pm2 save
   ```

2. **Setup log rotation**:
   - PM2: Already handled by PM2
   - Nginx: Setup logrotate
   - System: Setup journalctl limits

3. **Monitor health endpoints**:
   - Setup cron job untuk check health setiap 5 menit
   - Alert jika health check fails

4. **Regular maintenance**:
   - Weekly: Check PM2 status
   - Weekly: Check disk usage
   - Monthly: Review logs

---

**Update terakhir**: 2026-01-30
