# 📁 Ringkasan File Deployment

Dokumen ini menjelaskan semua file yang dibuat untuk deployment dan migrasi ke VPS.

---

## 🚀 Script Deployment

### 1. `deploy-to-vps.sh`
**Lokasi**: Root directory  
**Fungsi**: Script deployment otomatis lengkap  
**Cara Pakai**:
```bash
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

**Yang Dilakukan**:
- Backup database SQLite
- Stop aplikasi
- Upload kode baru
- Install PostgreSQL (jika belum ada)
- Install dependencies
- Run migrasi database
- Build client
- Start aplikasi

---

## 🔄 Script Migrasi

### 2. `server/migrate-sqlite-to-postgresql-vps.js`
**Lokasi**: `server/`  
**Fungsi**: Script migrasi khusus untuk VPS  
**Cara Pakai**:
```bash
cd ~/deployments/manufacturing-app/server
node migrate-sqlite-to-postgresql-vps.js
```

**Fitur**:
- Membaca data dari SQLite
- Membuat tabel di PostgreSQL
- Migrasi semua data
- Verifikasi hasil migrasi
- Error handling yang baik

**Perbedaan dengan `migrate-to-postgresql.js`**:
- Menggunakan konfigurasi dari `.env`
- Lebih banyak logging
- Verifikasi otomatis
- Optimized untuk production

---

## 💾 Script Backup

### 3. `server/backup-database-vps.sh`
**Lokasi**: `server/`  
**Fungsi**: Backup database sebelum migrasi  
**Cara Pakai**:
```bash
cd ~/deployments/manufacturing-app/server
bash backup-database-vps.sh
```

**Yang Dibackup**:
- `database.sqlite`
- `database.sqlite-wal` (jika ada)
- `database.sqlite-shm` (jika ada)
- PostgreSQL dump (jika ada)

**Lokasi Backup**: `~/backups/manufacturing-app/`

---

## 🔙 Script Rollback

### 4. `server/rollback-to-sqlite.sh`
**Lokasi**: `server/`  
**Fungsi**: Rollback ke SQLite jika migrasi gagal  
**Cara Pakai**:
```bash
cd ~/deployments/manufacturing-app/server
bash rollback-to-sqlite.sh
```

**Yang Dilakukan**:
- Stop aplikasi
- Restore database dari backup terbaru
- Restore WAL files
- Instruksi untuk revert code

**⚠️ PENTING**: Setelah rollback, perlu revert code ke versi SQLite.

---

## 📚 Dokumentasi

### 5. `VPS_DEPLOYMENT_GUIDE.md`
**Lokasi**: Root directory  
**Fungsi**: Panduan lengkap deployment dan migrasi  
**Isi**:
- Persiapan
- Backup database
- Deployment step-by-step
- Setup PostgreSQL
- Migrasi database
- Verifikasi
- Rollback
- Troubleshooting

**Untuk**: Developer yang ingin memahami proses lengkap

---

### 6. `QUICK_START_DEPLOYMENT.md`
**Lokasi**: Root directory  
**Fungsi**: Panduan cepat deployment  
**Isi**:
- Deployment otomatis (1 command)
- Manual step-by-step
- Rollback cepat
- Checklist

**Untuk**: Developer yang ingin deploy cepat

---

### 7. `DEPLOYMENT_FILES_SUMMARY.md`
**Lokasi**: Root directory (file ini)  
**Fungsi**: Ringkasan semua file deployment  
**Isi**: Penjelasan semua file yang dibuat

---

## 📋 File yang Sudah Ada (Dari Project)

### `server/migrate-to-postgresql.js`
**Fungsi**: Script migrasi original (untuk development)  
**Perbedaan**: Hardcoded config, untuk local development

### `server/migrate-production-data.js`
**Fungsi**: Migrasi data production saja  
**Gunakan**: Jika hanya perlu migrasi data tanpa schema

### `server/database.js`
**Fungsi**: PostgreSQL wrapper (sudah digunakan)  
**Status**: ✅ Sudah diupdate untuk PostgreSQL

### `server/config.js`
**Fungsi**: Konfigurasi database  
**Status**: ✅ Sudah dikonfigurasi untuk PostgreSQL

### `server/env.example`
**Fungsi**: Template environment variables  
**Status**: ✅ Sudah include PostgreSQL config

---

## 🎯 Workflow Deployment

### Deployment Pertama Kali

1. **Backup** → `backup-database-vps.sh`
2. **Deploy** → `deploy-to-vps.sh`
3. **Verifikasi** → Cek logs dan health endpoint

### Update Kode (Tanpa Migrasi)

1. **Backup** (opsional)
2. **Deploy** → `deploy-to-vps.sh` (akan skip migrasi jika sudah ada)
3. **Restart** → `pm2 restart manufacturing-app`

### Rollback

1. **Stop** → `pm2 stop manufacturing-app`
2. **Rollback** → `rollback-to-sqlite.sh`
3. **Revert Code** → Git checkout versi SQLite
4. **Restart** → `pm2 start manufacturing-app`

---

## 🔧 Troubleshooting Files

Jika ada masalah, cek:

1. **Logs**: `pm2 logs manufacturing-app`
2. **Database**: `node check-data.js`
3. **Health**: `curl http://103.31.39.189:1234/health`
4. **PostgreSQL**: `sudo systemctl status postgresql`

---

## 📝 Checklist Sebelum Deployment

- [ ] Backup database dibuat
- [ ] Kode sudah di-commit
- [ ] PostgreSQL ready di VPS
- [ ] .env dikonfigurasi
- [ ] Dependencies terinstall
- [ ] Script deployment di-test (opsional)

---

## 🎉 Setelah Deployment

- [ ] Aplikasi running (`pm2 status`)
- [ ] Health check OK
- [ ] Data terlihat di frontend
- [ ] API endpoints berfungsi
- [ ] Logs tidak ada error

---

**Last Updated**: 2026-01-08  
**Version**: 1.0.0
