# Solusi Masalah Server - VPS

**Tanggal**: 2026-01-17  
**Status**: Analisis dan Solusi

---

## 📋 Masalah yang Ditemukan

### 1. ❌ Warehouse-UI Stopped di PM2
**Masalah**: 
- `warehouse-ui` terdaftar di PM2 dengan status **stopped**
- Seharusnya warehouse-ui menggunakan Docker, bukan PM2

**Solusi**:
```bash
# Hapus warehouse-ui dari PM2
pm2 delete warehouse-ui
pm2 save
```

---

### 2. ⚠️ Manufacturing-app-staging Menggunakan Fork Mode

**Masalah**:
- manufacturing-app-staging: **fork mode** (1 instance)
- manufacturing-app production: **cluster mode** (16 instances)

**Apakah ini masalah?**
**TIDAK** - Ini adalah konfigurasi yang **BENAR**:
- ✅ **Staging**: Fork mode untuk testing dan debugging
- ✅ **Production**: Cluster mode untuk performa dan load balancing

**Penjelasan**:
```javascript
// STAGING - Fork Mode
{
  name: 'manufacturing-app-staging',
  instances: 1,           // Single instance
  exec_mode: 'fork',      // Fork mode
  env: {
    NODE_ENV: 'staging',
    PORT: 5678
  }
}

// PRODUCTION - Cluster Mode
{
  name: 'manufacturing-app',
  instances: 'max',       // Semua CPU cores
  exec_mode: 'cluster',   // Cluster mode
  env: {
    NODE_ENV: 'production',
    PORT: 1234
  }
}
```

**Kapan perlu diubah?**
Hanya jika staging perlu menangani beban tinggi untuk testing performa.

---

### 3. ❌ Warehouse-UI Tidak Termonitor di Uptime Kuma

**Masalah**:
- Warehouse-UI tidak muncul di Uptime Kuma monitoring
- Tidak ada visibility jika warehouse-ui down

**Solusi**:

#### A. Cari Port Warehouse-UI
```bash
# Cek Docker container yang running
docker ps

# Cari port warehouse-ui
docker ps | grep warehouse

# Atau cek semua container termasuk yang stopped
docker ps -a | grep warehouse
```

#### B. Test Endpoint
```bash
# Test dengan curl
curl http://localhost:4545
curl http://localhost:5000
curl http://localhost:4545/health
```

#### C. Tambahkan ke Uptime Kuma

1. Login ke Uptime Kuma: http://mpr.moof-set.web.id:5000
2. Klik **Add New Monitor**
3. Konfigurasi:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: Warehouse UI
   - **URL**: http://localhost:4545 (atau port yang sesuai)
   - **Heartbeat Interval**: 60 detik
   - **Retries**: 3
   - **Monitor Timeout**: 48 detik

---

## 🔧 Quick Fix Script

Jalankan script untuk fix otomatis:

```bash
# Di VPS, jalankan:
chmod +x fix-server-issues.sh
./fix-server-issues.sh
```

Script akan:
1. ✅ Hapus warehouse-ui dari PM2
2. ✅ Restart manufacturing-app-staging
3. ✅ Cek status Docker containers
4. ✅ Cari warehouse-ui di Docker
5. ✅ Tampilkan status PM2 final

---

## 📊 Status yang Diharapkan Setelah Fix

### PM2 Status:
```
┌─────┬───────────────────────────┬─────────┬─────────┬─────────┬──────────┐
│ id  │ name                      │ mode    │ status  │ cpu     │ memory   │
├─────┼───────────────────────────┼─────────┼─────────┼─────────┼──────────┤
│ 7   │ manufacturing-app         │ cluster │ online  │ 0%      │ 92.5mb   │
│ 8   │ manufacturing-app         │ cluster │ online  │ 0%      │ 96.6mb   │
│ 15  │ manufacturing-app-staging │ fork    │ online  │ 0%      │ 84.3mb   │
│ 2   │ mo-receiver               │ fork    │ online  │ 0%      │ 75.3mb   │
│ 1   │ mo-reporting              │ fork    │ online  │ 0%      │ 73.8mb   │
└─────┴───────────────────────────┴─────────┴─────────┴─────────┴──────────┘
```

**Catatan**: `warehouse-ui` TIDAK BOLEH ada di PM2

### Docker Status:
```
CONTAINER ID   IMAGE              STATUS         PORTS                    NAMES
xxxxxxxxxx     warehouse-ui       Up X hours     0.0.0.0:4545->4545/tcp   warehouse-ui
xxxxxxxxxx     postgres:15        Up X hours     5432/tcp                  pzem-db-1
xxxxxxxxxx     dashboard          Up X hours     0.0.0.0:5000->5000/tcp   pzem-dashboard
xxxxxxxxxx     mqtt-listener      Up X hours     -                         pzem-mqtt-listener
```

---

## 🔍 Investigasi Warehouse-UI

Jika warehouse-ui tidak ada di Docker, cari di mana seharusnya:

### 1. Cek Apakah Ada Docker Compose File
```bash
find /home/foom -name "docker-compose*.yml" -type f 2>/dev/null | xargs grep -l "warehouse"
```

### 2. Cek Direktori Warehouse
```bash
find /home/foom -type d -name "*warehouse*" 2>/dev/null
ls -la /home/foom/deployments/ | grep warehouse
```

### 3. Cek Port yang Digunakan
```bash
# Cek port yang listen
netstat -tlnp | grep -E ":(4545|5000|3000|8080)"

# Atau dengan ss
ss -tlnp | grep -E ":(4545|5000|3000|8080)"
```

---

## 📝 Checklist Setelah Fix

- [ ] Warehouse-UI dihapus dari PM2
- [ ] Manufacturing-app-staging running (fork mode OK)
- [ ] Manufacturing-app production running (cluster mode)
- [ ] Warehouse-UI ditemukan dan running di Docker
- [ ] Warehouse-UI ditambahkan ke Uptime Kuma monitoring
- [ ] Semua service termonitor dengan benar

---

## ❓ FAQ

### Q: Kenapa staging pakai fork mode?
**A**: Fork mode lebih cocok untuk staging karena:
- Lebih mudah debugging
- Log lebih jelas (tidak dicampur antar instance)
- Resource lebih ringan
- Cukup untuk beban testing

### Q: Apakah perlu ubah staging ke cluster mode?
**A**: **TIDAK perlu**, kecuali:
- Perlu test performa dengan multiple instances
- Staging digunakan untuk load testing
- Ingin simulasi production environment secara penuh

### Q: Bagaimana jika warehouse-ui tidak ada di Docker?
**A**: Perlu informasi lebih lanjut:
- Cek dokumentasi warehouse-ui
- Cari Docker compose atau Dockerfile
- Atau mungkin perlu dibuat Docker container baru

### Q: Port berapa warehouse-ui?
**A**: Port umum untuk warehouse UI:
- 4545 (port umum warehouse apps)
- 5000 (port alternatif)
- 3000 (port development)
- 8080 (port web server)

Cek dengan: `docker ps -a | grep warehouse`

---

## 📞 Next Steps

1. **Jalankan fix script**:
   ```bash
   ./fix-server-issues.sh
   ```

2. **Cari warehouse-ui Docker container**:
   ```bash
   docker ps -a | grep warehouse
   ```

3. **Jika tidak ada, cari docker-compose file**:
   ```bash
   find /home/foom -name "docker-compose*.yml" | xargs grep warehouse
   ```

4. **Tambahkan ke Uptime Kuma** setelah warehouse-ui ditemukan

---

**Status**: Menunggu eksekusi script dan feedback hasil
