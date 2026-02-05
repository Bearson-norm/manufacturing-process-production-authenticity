# 🚨 Fix Massive Downtime - All Services Down

**Issue**: Semua service di Uptime Kuma down secara bersamaan

---

## 🔍 Kemungkinan Penyebab

### 1. **Malware/Backdoor** 🔴 **CRITICAL - DITEMUKAN!**
- Proses mencurigakan: `p1eNsfx` dan `curl` ke domain tor2web
- Ini adalah **MALWARE/BACKDOOR** yang sangat berbahaya!
- Bisa menyebabkan semua service down

### 2. **Network Issues**
- Firewall blocking
- Network connectivity problems
- DNS resolution failures

### 3. **Resource Exhaustion**
- Memory full
- Disk full
- CPU overloaded

### 4. **DDoS Attack**
- High connection count
- Network saturation

### 5. **Service Crashes**
- All services crashed simultaneously
- System reboot

---

## 🚨 IMMEDIATE ACTION - KILL MALWARE!

### Step 1: Kill Suspicious Processes (DO THIS FIRST!)

```bash
# Find suspicious processes
ps aux | grep -E "p1eNsfx|curl.*tor2web" | grep -v grep

# Kill them immediately
sudo kill -9 $(ps aux | grep -E "p1eNsfx|curl.*tor2web" | grep -v grep | awk '{print $2}')

# Verify they're gone
ps aux | grep -E "p1eNsfx|curl.*tor2web" | grep -v grep
```

### Step 2: Check for More Malware

```bash
# Check all processes
ps aux | awk '{print $11}' | sort | uniq -c | sort -rn | head -20

# Look for random names, suspicious patterns
ps aux | grep -E "^[a-zA-Z0-9]{8,}$" | grep -vE "systemd|dockerd|node"

# Check network connections
netstat -anp | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
```

---

## 🔧 Fix Network Issues

### Check 1: Local Services

```bash
# Test localhost
curl http://localhost:1234/health
curl http://localhost:5678/health

# Check if ports are listening
netstat -tlnp | grep -E "1234|5678"
```

### Check 2: External Connectivity

```bash
# Test internet
ping -c 3 8.8.8.8

# Test DNS
nslookup google.com

# Test external access to your services
curl http://your-domain.com/health
```

### Check 3: Firewall

```bash
# Check UFW
sudo ufw status

# Check iptables
sudo iptables -L -n

# If blocking, allow ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 1234/tcp
sudo ufw allow 5678/tcp
```

---

## 🔧 Fix Service Issues

### Step 1: Restart All Services

```bash
# Restart PM2
pm2 restart all
pm2 save

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql@16-main

# Restart Docker (if needed)
sudo systemctl restart docker
```

### Step 2: Verify Services

```bash
# Check PM2
pm2 status

# Check services
sudo systemctl status nginx
sudo systemctl status postgresql@16-main

# Test health endpoints
curl http://localhost:1234/health
curl http://localhost:5678/health
```

---

## 🛡️ Security Hardening (After Fix)

### Step 1: Remove Malware Persistence

```bash
# Check cron jobs
crontab -l
sudo crontab -l -u root

# Check systemd services
systemctl list-units --type=service | grep -E "p1eNsfx|suspicious"

# Check startup scripts
ls -la /etc/rc.local
ls -la /etc/init.d/ | grep -E "p1eNsfx|suspicious"

# Check .bashrc, .profile
cat ~/.bashrc | grep -E "curl|wget|p1eNsfx"
cat ~/.profile | grep -E "curl|wget|p1eNsfx"
```

### Step 2: Change Passwords

```bash
# Change user password
passwd

# Change root password (if accessible)
sudo passwd root

# Change SSH keys
# Regenerate SSH keys if compromised
```

### Step 3: Update System

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Check for security updates
sudo apt list --upgradable | grep security
```

### Step 4: Install Security Tools

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Install rkhunter (rootkit hunter)
sudo apt install rkhunter -y
sudo rkhunter --update
sudo rkhunter --check

# Install chkrootkit
sudo apt install chkrootkit -y
sudo chkrootkit
```

---

## 📋 Complete Fix Procedure

### Step 1: Kill Malware (IMMEDIATE)

```bash
# Kill suspicious processes
sudo kill -9 $(ps aux | grep -E "p1eNsfx|curl.*tor2web" | grep -v grep | awk '{print $2}')

# Verify
ps aux | grep -E "p1eNsfx|curl.*tor2web" | grep -v grep
```

### Step 2: Run Investigation

```bash
chmod +x investigate-massive-downtime.sh
./investigate-massive-downtime.sh
```

### Step 3: Fix Network Issues

```bash
# Test connectivity
ping -c 3 8.8.8.8
curl http://localhost:1234/health

# If localhost works but external doesn't, check firewall
sudo ufw status
```

### Step 4: Restart Services

```bash
pm2 restart all
sudo systemctl restart nginx
sudo systemctl restart postgresql@16-main
```

### Step 5: Verify

```bash
# Check all services
pm2 status
sudo systemctl status nginx
curl http://localhost:1234/health
curl http://localhost:5678/health
```

### Step 6: Security Hardening

```bash
# Remove malware persistence
# Change passwords
# Update system
# Install security tools
```

---

## 🔍 Investigation Commands

### Check for Malware

```bash
# All processes
ps aux --sort=-%cpu | head -20

# Suspicious processes
ps aux | grep -vE "systemd|dockerd|node|nginx|postgres" | grep -E "[a-zA-Z0-9]{8,}"

# Network connections
netstat -anp | grep ESTABLISHED | head -20

# Cron jobs
crontab -l
sudo crontab -l -u root
```

### Check System Health

```bash
# Resources
uptime
free -h
df -h

# Services
pm2 status
sudo systemctl status nginx
sudo systemctl status postgresql@16-main

# Network
ping -c 3 8.8.8.8
nslookup google.com
```

---

## 🆘 Emergency Recovery

### If Services Still Down:

```bash
# 1. Kill all suspicious processes
sudo pkill -f "p1eNsfx"
sudo pkill -f "tor2web"

# 2. Restart everything
pm2 restart all
sudo systemctl restart nginx
sudo systemctl restart postgresql@16-main
sudo systemctl restart docker

# 3. Check logs
pm2 logs --lines 50
sudo journalctl -xe | tail -50

# 4. Test connectivity
curl http://localhost:1234/health
curl http://localhost:5678/health
```

---

## 💡 Prevention

### 1. Regular Security Audits

```bash
# Weekly security check
ps aux | grep -E "curl.*tor|wget.*tor|p1eNsfx"
netstat -anp | grep -E "tor2web|onion"
```

### 2. Monitor Suspicious Activity

```bash
# Add to cron
0 * * * * ps aux | grep -E "p1eNsfx|tor2web" && echo "Suspicious process detected" | mail -s "Security Alert" admin@example.com
```

### 3. Keep System Updated

```bash
# Weekly updates
sudo apt update && sudo apt upgrade -y
```

### 4. Use Firewall

```bash
# Enable UFW
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

---

## 📊 Monitoring After Fix

```bash
# Monitor processes
watch -n 5 'ps aux --sort=-%cpu | head -10'

# Monitor network
watch -n 5 'netstat -an | grep ESTABLISHED | wc -l'

# Monitor services
watch -n 10 'pm2 status && curl -s http://localhost:1234/health'
```

---

**⚠️ CRITICAL: Kill malware processes FIRST before doing anything else!**

**Update terakhir**: 2026-01-30
