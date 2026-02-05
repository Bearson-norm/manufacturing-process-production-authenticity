# ⚡ Quick Load Average Check - Copy Paste

## 🔍 Quick Check

```bash
# Check load average
uptime

# Check CPU cores
nproc

# Compare
echo "Load: $(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}') | Cores: $(nproc)"
```

---

## 📊 Is Load Normal?

```bash
# Quick check script
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CORES=$(nproc)
if (( $(echo "$LOAD > $CORES" | bc -l) )); then
    echo "⚠️ HIGH: Load $LOAD > Cores $CORES"
else
    echo "✓ OK: Load $LOAD <= Cores $CORES"
fi
```

---

## 📈 Monitor Load (5 minutes)

```bash
# Watch load average
watch -n 10 'uptime && echo "" && ps aux --sort=-%cpu | head -5'
```

---

## 🎯 Load Average Interpretation

### For 2 CPU Cores:

- **0.0 - 1.0**: ✅ Excellent (sistem ringan)
- **1.0 - 2.0**: ⚠️ Normal (sistem sibuk, masih OK)
- **2.0 - 4.0**: 🔴 High (overloaded)
- **> 4.0**: 🚨 Critical (sangat overloaded)

### Your Situation:

- **Load 0.35**: ✅ Excellent
- **Load 1.50**: ⚠️ Normal (75% utilized, masih OK)

---

## 🔧 If Load is High

```bash
# 1. Check what's causing it
ps aux --sort=-%cpu | head -10

# 2. Check PM2
pm2 status

# 3. Check system resources
free -h
df -h

# 4. Monitor for trends
watch -n 5 'uptime && free -h'
```

---

## ✅ Quick Answer

**Load 1.50 pada sistem 2 cores = MASIH NORMAL**

- Load 1.50 berarti 75% utilized
- Masih ada 25% headroom
- Perlu monitor apakah turun atau tetap tinggi

**Action**: Monitor 10-15 menit. Jika turun → OK. Jika tetap tinggi → Investigate.

---

**Gunakan `monitor-load-average.sh` untuk monitoring otomatis!**
