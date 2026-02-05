# 📊 Understanding Load Average

**Load Average**: Rata-rata beban sistem dalam 1, 5, dan 15 menit terakhir

---

## 🔍 Analisis Load Average Anda

### Screenshot 1 (Awal):
- Load: **0.35, 0.33, 0.32**
- CPU: Normal
- Status: ✅ **SANGAT BAGUS**

### Screenshot 2 (Terbaru):
- Load: **1.50, 1.03, 0.69**
- CPU: **79.2%, 82.4%** (tinggi!)
- Status: ⚠️ **PERLU MONITOR**

---

## 📊 Apakah Ini Normal?

### Untuk Sistem 2 CPU Cores:

| Load Average | Status | Artinya |
|--------------|--------|---------|
| **0.0 - 1.0** | ✅ **EXCELLENT** | Sistem sangat ringan, banyak idle time |
| **1.0 - 2.0** | ⚠️ **NORMAL** | Sistem sibuk tapi masih OK (load = jumlah cores) |
| **2.0 - 4.0** | 🔴 **HIGH** | Sistem overloaded, perlu optimasi |
| **> 4.0** | 🚨 **CRITICAL** | Sistem sangat overloaded, perlu immediate action |

### Kesimpulan untuk Load 1.50:

**✅ MASIH NORMAL** untuk sistem 2 cores, tapi:
- Load 1.50 berarti sistem sedang sibuk
- CPU usage 79-82% menunjukkan high activity
- Perlu monitor apakah ini temporary spike atau persistent

---

## 🔍 Kenapa Load Average Naik?

### Kemungkinan Penyebab:

1. **Temporary Spike** (Normal)
   - Heavy operation sedang berjalan
   - Database query besar
   - File processing
   - Scheduled task

2. **High CPU Usage** (Seperti di screenshot)
   - CPU 79-82% = sistem sedang bekerja keras
   - Bisa dari manufacturing-app yang 100% CPU sebelumnya
   - Atau multiple processes bekerja bersamaan

3. **I/O Wait** (Jika ada)
   - Disk I/O tinggi
   - Network I/O tinggi
   - Database queries lambat

4. **Multiple Processes**
   - Banyak node processes running
   - Docker containers aktif
   - Background tasks

---

## 🎯 Load Average vs CPU Cores

### Rule of Thumb:

```
Load Average < CPU Cores  → ✅ OK (sistem bisa handle)
Load Average = CPU Cores  → ⚠️ Busy (sistem fully utilized)
Load Average > CPU Cores  → 🔴 Overloaded (ada queuing)
```

### Untuk Sistem Anda (2 Cores):

- **Load 0.35**: Sistem sangat ringan (hanya 17.5% utilized)
- **Load 1.50**: Sistem sibuk (75% utilized) - masih OK
- **Load 2.0**: Sistem fully utilized (100%)
- **Load > 2.0**: Sistem overloaded (ada queuing)

---

## 📈 Monitoring Load Average

### Check Current Load:

```bash
# Quick check
uptime

# Detailed
top
htop

# Continuous monitoring
watch -n 5 'uptime && free -h'
```

### Load Average Components:

```
Load Average: 1.50, 1.03, 0.69
              │     │     │
              │     │     └─ 15 menit terakhir
              │     └─────── 5 menit terakhir
              └───────────── 1 menit terakhir (paling penting)
```

**Interpretasi:**
- **1.50** (1 min): Sistem sedang sibuk SEKARANG
- **1.03** (5 min): Lebih rendah, berarti spike baru terjadi
- **0.69** (15 min): Baseline lebih rendah, spike temporary

**Kesimpulan**: Load naik baru-baru ini (spike), bukan persistent high load.

---

## ⚠️ Kapan Perlu Khawatir?

### Red Flags:

1. **Load > 2.0** (lebih dari jumlah cores)
   - Sistem overloaded
   - Processes waiting in queue
   - Response time akan lambat

2. **Load terus naik** (1.5 → 2.0 → 2.5)
   - Ada masalah yang memburuk
   - Perlu immediate action

3. **Load tinggi + CPU tinggi + Memory tinggi**
   - Sistem under heavy stress
   - Perlu optimasi atau scale up

4. **Load tinggi + High I/O Wait**
   - Disk atau network bottleneck
   - Perlu check I/O operations

---

## 🔧 Action Plan

### Jika Load 1.50 (Current Situation):

**✅ NO ACTION NEEDED** jika:
- Load turun kembali setelah beberapa menit
- CPU usage turun kembali
- Tidak ada user complaints
- Health endpoints masih OK

**⚠️ MONITOR** jika:
- Load tetap tinggi (>1.5) untuk >10 menit
- CPU usage tetap tinggi
- Response time lambat

**🔴 TAKE ACTION** jika:
- Load > 2.0
- Load terus naik
- System unresponsive
- Health endpoints down

---

## 🚀 Quick Checks

### Check 1: Is Load Decreasing?

```bash
# Monitor load untuk 5 menit
watch -n 10 'uptime'
```

**Expected**: Load turun dari 1.50 ke <1.0

### Check 2: What's Causing High Load?

```bash
# Top processes by CPU
ps aux --sort=-%cpu | head -10

# Top processes by load
top -bn1 | head -20
```

### Check 3: Is It Temporary?

```bash
# Check load history
uptime
# Wait 5 minutes
uptime
# Wait 5 more minutes
uptime
```

**If load decreases**: Temporary spike, no action needed
**If load stays high**: Persistent issue, need investigation

---

## 📊 Load Average Monitoring Script

```bash
#!/bin/bash
# Monitor load average and alert if high

CPU_CORES=$(nproc)
LOAD_1MIN=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')

if (( $(echo "$LOAD_1MIN > $CPU_CORES" | bc -l 2>/dev/null || echo "0") )); then
    echo "⚠️ ALERT: Load average ($LOAD_1MIN) > CPU cores ($CPU_CORES)"
    echo "Top processes:"
    ps aux --sort=-%cpu | head -5
else
    echo "✓ Load average OK: $LOAD_1MIN (CPU cores: $CPU_CORES)"
fi
```

---

## 💡 Best Practices

### 1. Monitor Load Regularly

```bash
# Add to cron (check every 5 minutes)
*/5 * * * * uptime >> /var/log/load-average.log
```

### 2. Set Alert Thresholds

- **Warning**: Load > 1.5 (75% of capacity)
- **Critical**: Load > 2.0 (100% of capacity)

### 3. Understand Your Baseline

- Monitor load selama 1 minggu
- Identify normal load patterns
- Set alerts based on your baseline

### 4. Optimize if Persistent High Load

- Optimize database queries
- Reduce unnecessary processes
- Add more CPU cores (if needed)
- Optimize application code

---

## 🎯 Summary untuk Situasi Anda

### Current Status:

✅ **Load 1.50 masih NORMAL** untuk 2 cores
⚠️ **CPU 79-82% menunjukkan high activity**
📈 **Load naik dari 0.35 → 1.50** (spike baru terjadi)

### Recommendation:

1. **Monitor** load untuk 10-15 menit
   - Jika turun kembali → No action needed
   - Jika tetap tinggi → Investigate

2. **Check** apa yang menyebabkan spike
   - Manufacturing-app yang 100% CPU sebelumnya?
   - Heavy database query?
   - Scheduled task?

3. **Optimize** jika load persistent >1.5
   - Fix high CPU processes
   - Optimize database queries
   - Reduce unnecessary operations

---

## 📝 Quick Reference

```bash
# Check load
uptime

# Check CPU cores
nproc

# Check if load is high
LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
CORES=$(nproc)
if (( $(echo "$LOAD > $CORES" | bc -l) )); then
    echo "⚠️ High load: $LOAD > $CORES cores"
else
    echo "✓ Load OK: $LOAD <= $CORES cores"
fi
```

---

**Kesimpulan**: Load 1.50 masih normal, tapi perlu monitor. Jika turun kembali, tidak ada masalah. Jika tetap tinggi, perlu investigasi lebih lanjut.

**Update terakhir**: 2026-01-30
