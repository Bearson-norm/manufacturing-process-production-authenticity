# ⚡ Quick Security Check - Copy Paste

## 🔍 Check Suspicious Processes

```bash
# Check for random process names
ps aux | awk '{print $11}' | sort | uniq -c | sort -rn | head -20

# Check specific suspicious process
ps aux | grep yVAc34l

# Get details
ps aux | grep yVAc34l | grep -v grep
```

---

## 🚨 Kill Suspicious Process

```bash
# Find PID
PID=$(ps aux | grep yVAc34l | grep -v grep | awk '{print $2}')

# Kill if found
if [ -n "$PID" ]; then
    echo "Killing process $PID"
    sudo kill -9 $PID
    echo "Verifying..."
    ps aux | grep yVAc34l | grep -v grep
else
    echo "Process not found"
fi
```

---

## 🔍 Check Network Connections (using ss)

```bash
# Install if needed
sudo apt install iproute2 -y

# Check established connections
ss -anp | grep ESTABLISHED | head -20

# Check by IP
ss -anp | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -10

# Check for suspicious domains
ss -anp | grep -E "tor2web|onion|\.tk|\.ml|\.ga"
```

---

## 🔍 Check Persistence Mechanisms

```bash
# Cron jobs
crontab -l
sudo crontab -l -u root

# Startup scripts
cat /etc/rc.local
cat ~/.bashrc | grep -E "curl|wget|yVAc34l"
cat ~/.profile | grep -E "curl|wget|yVAc34l"

# Systemd services
systemctl list-units --type=service | grep -E "yVAc34l|p1eNsfx"
```

---

## ✅ Verify Services Status

```bash
# PM2
pm2 status

# Health endpoints
curl http://localhost:1234/health
curl http://localhost:5678/health

# Services
sudo systemctl status nginx
sudo systemctl status postgresql@16-main
```

---

## 🛡️ Security Hardening

```bash
# Change password
passwd

# Update system
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install fail2ban rkhunter chkrootkit -y

# Run rootkit scan
sudo rkhunter --check
```

---

## 📊 All-in-One Security Check

```bash
# Run comprehensive check
chmod +x check-suspicious-processes.sh
./check-suspicious-processes.sh
```

---

**⚠️ Priority: Check and kill `yVAc34l` process if found!**
