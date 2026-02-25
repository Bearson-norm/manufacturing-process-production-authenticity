# Investigasi 165 Processes - Sejak Staging Di-Up Semalam

**Tanggal**: 2026-01-17  
**Issue**: 165 processes sejak manufacturing-app-staging di-up semalam  
**System Status**: Load 0.14, Memory 30%, Disk 61.4% (SEMUA BAGUS!)

---

## 🤔 Pertanyaan Penting

**165 processes itu BANYAK atau NORMAL?**

Jawabannya: **TERGANTUNG!**

Untuk VPS dengan Docker + PM2 + Database + Web Server:
- ✅ **100-200 processes = NORMAL**
- ⚠️ **200-300 processes = Perlu investigasi**
- ❌ **300+ processes = ADA MASALAH**

**Resource Anda BAGUS (load 0.14, mem 30%)**, jadi kemungkinan 165 masih OK, **TAPI** kita perlu cek apa yang berubah sejak staging di-up.

---

## 🔍 Kemungkinan Penyebab

### 1. **Cluster Mode 'max' = Banyak Instances** ✅ NORMAL

Dari ecosystem.config.js:
```javascript
// Production - Cluster Mode
instances: 'max'  // Uses ALL CPU cores
```

Jika server punya **16 CPU cores** (seperti screenshot PM2):
- manufacturing-app production: **16 instances**
- manufacturing-app-staging: **1 instance**
- mo-receiver: **1 instance**
- mo-reporting: **1 instance**
- PM2 daemon: **1 instance**
- **Total Node.js**: ~**20 processes**

Ini NORMAL! ✅

---

### 2. **Manufacturing-app-staging Di-restart Berkali-kali** ❌ MASALAH

**Gejala**:
- Staging crash dan auto-restart berulang kali
- Setiap restart create new process
- Old processes tidak terminated dengan baik
- Jadi **orphaned processes** atau **zombie processes**

**Cara Cek**:
```bash
# Cek restart count
pm2 status

# Cek logs untuk crash pattern
pm2 logs manufacturing-app-staging --lines 100 | grep -i "restart\|error\|crash"

# Cek orphaned processes
ps -eo pid,ppid,cmd | grep "node.*staging" | awk '$2==1'
```

**Solusi**:
```bash
# Stop staging
pm2 stop manufacturing-app-staging

# Kill orphaned processes
ps -eo pid,ppid,cmd | grep "node.*staging" | awk '$2==1 {print $1}' | xargs kill

# Start kembali
pm2 start manufacturing-app-staging

# Save state
pm2 save
```

---

### 3. **Docker Containers & Child Processes** ✅ MUNGKIN NORMAL

Docker containers juga create processes:
- PostgreSQL: ~10-15 processes
- MQTT Listener: 1-5 processes
- Dashboard: 1-5 processes
- WHAC Web UI: 1-5 processes (jika running)

Total: ~20-30 processes dari Docker

---

### 4. **System Processes** ✅ NORMAL

VPS biasanya punya:
- systemd & children: ~30-50 processes
- Docker daemon: ~5-10 processes
- SSH, cron, logging: ~10-20 processes
- Network, kernel threads: ~20-40 processes

Total: ~65-120 processes sistem

---

## 📊 Expected Process Breakdown

```
KATEGORI                          EXPECTED COUNT
===============================================
System (systemd, kernel, etc.)    60-80
Docker containers & children      20-30
Node.js (PM2 managed)            20-25
Nginx, PostgreSQL                 5-10
Other services                    10-20
-----------------------------------------------
TOTAL EXPECTED                    115-165 ✅
```

**Kesimpulan**: 165 processes sebenarnya **MASIH WAJAR** untuk setup Anda!

---

## 🎯 Yang Perlu Dicek

### Apakah Ada Masalah Sebenarnya?

**Cek ini:**

#### 1. **Node.js Process Count**
```bash
ps aux | grep node | grep -v grep | wc -l
```

**Expected**: ~20-25 processes
- Jika **> 30**: Ada masalah (orphaned/leak)
- Jika **< 30**: Normal ✅

---

#### 2. **Zombie Processes**
```bash
ps aux | grep '<defunct>' | wc -l
```

**Expected**: 0 zombies
- Jika **> 0**: Ada masalah, parent tidak cleanup children

---

#### 3. **Orphaned Node Processes**
```bash
ps -eo pid,ppid,cmd | grep "node.*index.js" | awk '$2==1'
```

**Expected**: None (atau sangat sedikit)
- PPID=1 berarti parent sudah mati, adopted by init
- Ini **orphaned processes** yang harus di-kill

---

#### 4. **PM2 Restart Count**
```bash
pm2 status
```

Cek kolom "restart":
- **0-5 restarts**: Normal ✅
- **5-20 restarts**: Ada masalah intermittent ⚠️
- **20+ restarts**: Application crash terus ❌

---

## 🔧 Diagnosis Script

Saya sudah buatkan script lengkap:

```bash
chmod +x investigate-processes.sh
./investigate-processes.sh
```

Script akan check:
1. ✅ Total processes breakdown
2. ✅ PM2 processes detail
3. ✅ Node.js processes count
4. ✅ Manufacturing-app processes
5. ✅ Manufacturing-app-staging processes
6. ✅ Zombie processes
7. ✅ Process tree
8. ✅ Child processes
9. ✅ Port listeners
10. ✅ PM2 daemon info
11. ✅ Orphaned processes
12. ✅ Process timeline
13. ✅ Recently created processes
14. ✅ **Analysis summary & recommendations**

---

## 🚨 Kemungkinan Skenario

### Skenario 1: NORMAL (Paling Mungkin - 70%)

**Bukti**:
- Load 0.14 (sangat rendah)
- Memory 30% (bagus)
- Swap 0% (tidak dipakai)

**Kesimpulan**:
- 165 processes adalah kombinasi normal dari:
  - 16 instances manufacturing-app (cluster max)
  - System processes
  - Docker containers
  - Services lainnya
- **TIDAK ADA MASALAH**, hanya terlihat banyak karena cluster mode 'max'

**Action**: Tidak perlu action, tapi bisa monitoring dengan script

---

### Skenario 2: STAGING RESTART LOOP (20% kemungkinan)

**Bukti yang perlu dicari**:
- manufacturing-app-staging restart count > 10
- Orphaned node processes dengan PPID=1
- Error logs di staging

**Kesimpulan**:
- Staging crash berulang kali sejak semalam
- Create orphaned processes
- Perlu fix root cause (cek logs)

**Action**: 
```bash
pm2 logs manufacturing-app-staging --lines 200 --err
pm2 restart manufacturing-app-staging
```

---

### Skenario 3: MEMORY/PROCESS LEAK (10% kemungkinan)

**Bukti yang perlu dicari**:
- Node processes bertambah terus over time
- Memory usage naik perlahan
- Child processes tidak terminated

**Kesimpulan**:
- Ada bug di code yang leak processes
- Perlu code review

**Action**: Monitor dan fix code

---

## 🔥 Quick Fix Options

### Option 1: Restart PM2 (Safest)
```bash
# Restart semua apps
pm2 restart all

# Atau restart satu per satu
pm2 restart manufacturing-app-staging
pm2 restart manufacturing-app
```

---

### Option 2: Kill Orphaned Processes (If Found)
```bash
# Cari orphaned node processes
ps -eo pid,ppid,cmd | grep "node.*index.js" | awk '$2==1'

# Kill them (HATI-HATI!)
ps -eo pid,ppid,cmd | grep "node.*index.js" | awk '$2==1 {print $1}' | xargs kill

# Atau force kill jika tidak mau mati
ps -eo pid,ppid,cmd | grep "node.*index.js" | awk '$2==1 {print $1}' | xargs kill -9
```

---

### Option 3: Reduce Cluster Instances (Long-term)

Edit `server/ecosystem.config.js`:

```javascript
// Dari:
instances: 'max',  // 16 instances

// Ke:
instances: 4,  // atau 8, lebih manageable
```

Lalu:
```bash
pm2 restart manufacturing-app
pm2 save
```

**Benefits**:
- Fewer processes
- Easier to monitor
- Less resource contention
- Masih cukup untuk handle load

---

## 📈 Monitoring Ongoing

### Setup Continuous Monitoring

```bash
# Terminal 1: PM2 monitoring
watch -n 5 'pm2 status'

# Terminal 2: Process count
watch -n 10 'echo "Total: $(ps aux | wc -l) | Node: $(ps aux | grep node | grep -v grep | wc -l)"'

# Terminal 3: System resources
htop
```

### Alert Thresholds

Set alert jika:
- Node.js processes > 30
- Zombie processes > 0
- PM2 restart count > 20
- Memory > 80%
- Load average > CPU cores

---

## 💡 Analisis Pribadi Saya

Berdasarkan data Anda:
- ✅ Load 0.14 = SANGAT BAGUS
- ✅ Memory 30% = SANGAT BAGUS
- ✅ Swap 0% = BAGUS
- ⚠️ 165 processes = Terlihat banyak tapi mungkin normal

**Prediksi saya (80% confidence)**:
- 165 processes adalah **NORMAL** untuk setup Anda
- Cluster mode 'max' (16 instances) adalah penyebab utama
- Tidak ada masalah serius (karena resource usage bagus)

**Yang perlu diverifikasi**:
1. Node.js process count (should be ~20-25)
2. Staging restart count (should be < 10)
3. No zombie or orphaned processes

---

## 📞 Next Steps

1. **Jalankan investigasi script**:
   ```bash
   ./investigate-processes.sh > investigation-$(date +%Y%m%d-%H%M%S).log
   ```

2. **Cek PM2 status**:
   ```bash
   pm2 status
   ```

3. **Cek staging logs**:
   ```bash
   pm2 logs manufacturing-app-staging --lines 100
   ```

4. **Share hasil** investigasi untuk analisis lebih lanjut

---

## ❓ FAQ

### Q: 165 processes itu banyak?
**A**: Untuk VPS dengan setup Anda (Docker + PM2 cluster + services), **115-165 adalah NORMAL**. Yang penting resource usage (load, memory) masih OK.

### Q: Kenapa sejak staging di-up jadi 165?
**A**: Kemungkinan:
1. Staging nambah ~5-10 processes (normal)
2. Staging restart berkali-kali jadi orphaned processes (perlu dicek)
3. Coincidence, mungkin sebelumnya juga ~150-160

### Q: Apa yang harus di-fix?
**A**: **Tunggu hasil investigate-processes.sh dulu**. Jika:
- Node processes > 30 → Ada leak/orphaned, perlu cleanup
- Node processes < 30 → Everything is fine, monitor saja

### Q: Apakah perlu kurangi instances dari 'max'?
**A**: **Tidak wajib**, tapi recommended untuk:
- Easier monitoring
- Fewer processes
- Still handle load dengan 4-8 instances

### Q: Apakah ini penyebab downtime sebelumnya?
**A**: **Kemungkinan kecil**. Resource usage masih bagus (30% memory). Downtime sebelumnya kemungkinan dari cause lain (database, network, dll).

---

**Jalankan `investigate-processes.sh` dan share hasilnya untuk analisis lebih detail!** 🚀
