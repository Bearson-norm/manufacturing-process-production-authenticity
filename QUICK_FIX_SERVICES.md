# ⚡ Quick Fix Services - Copy Paste

## 🚀 Quick Status Check (1 Command)

```bash
pm2 status && echo "" && echo "=== Health Checks ===" && curl -s http://localhost:1234/health && echo "" && curl -s http://localhost:5678/health && echo "" && echo "=== Nginx ===" && sudo systemctl is-active nginx && echo "=== PostgreSQL ===" && sudo systemctl is-active postgresql@16-main
```

---

## 🔧 Quick Fix All (Copy-Paste Sekaligus)

```bash
# Restart PM2
pm2 restart all && pm2 save

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql@16-main

# Wait
sleep 3

# Verify
pm2 status
curl http://localhost:1234/health
curl http://localhost:5678/health
```

---

## 📋 Individual Service Fix

### Fix Manufacturing App Production

```bash
pm2 restart manufacturing-app
pm2 logs manufacturing-app --lines 20
curl http://localhost:1234/health
```

### Fix Manufacturing App Staging

```bash
pm2 restart manufacturing-app-staging
pm2 logs manufacturing-app-staging --lines 20
curl http://localhost:5678/health
```

### Fix MO Receiver

```bash
pm2 restart mo-receiver
pm2 logs mo-receiver --lines 20
```

### Fix MO Reporting

```bash
pm2 restart mo-reporting
pm2 logs mo-reporting --lines 20
```

### Fix Nginx

```bash
sudo systemctl restart nginx
sudo systemctl status nginx
sudo nginx -t
```

### Fix PostgreSQL

```bash
sudo systemctl restart postgresql@16-main
sudo systemctl status postgresql@16-main
```

---

## 🔍 Check What's Down

```bash
# PM2 processes
pm2 status | grep -E "stopped|errored"

# Health endpoints
echo "Production:" && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1234/health
echo "Staging:" && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5678/health

# Services
systemctl is-active nginx || echo "Nginx DOWN"
systemctl is-active postgresql@16-main || echo "PostgreSQL DOWN"

# Ports
netstat -tlnp | grep -E "1234|5678" || echo "Ports NOT LISTENING"
```

---

## 🆘 Emergency: Restart Everything

```bash
pm2 restart all && pm2 save && sudo systemctl restart nginx && sudo systemctl restart postgresql@16-main && sleep 5 && pm2 status && echo "" && echo "Health Checks:" && curl -s http://localhost:1234/health && echo "" && curl -s http://localhost:5678/health
```

---

## 📊 Check Logs for Errors

```bash
# PM2 error logs
pm2 logs --lines 50 --err --nostream

# Nginx error logs
sudo tail -50 /var/log/nginx/error.log

# PostgreSQL logs
sudo journalctl -u postgresql@16-main -n 50

# System logs
sudo journalctl -xe | tail -50
```

---

## ✅ Verify All Services

```bash
echo "=== PM2 ===" && pm2 status && echo "" && echo "=== Health Endpoints ===" && echo "Production: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:1234/health)" && echo "Staging: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:5678/health)" && echo "" && echo "=== Services ===" && echo "Nginx: $(systemctl is-active nginx)" && echo "PostgreSQL: $(systemctl is-active postgresql@16-main)" && echo "" && echo "=== Ports ===" && netstat -tlnp | grep -E "1234|5678"
```

---

**Gunakan script otomatis untuk hasil lebih detail:**
- `check-services-status.sh` - Comprehensive status check
- `fix-down-services.sh` - Auto-fix semua yang down
