# 🚀 Deployment Guide: SQLite → PostgreSQL di VPS

Sistem ini sudah dimigrasi dari SQLite ke PostgreSQL. Panduan ini membantu Anda mengupdate VPS yang masih menggunakan SQLite.

---

## ⚡ Quick Start (Recommended)

### Cara Paling Cepat

```bash
# 1. Backup database
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && bash backup-database-vps.sh"

# 2. Deploy (dari komputer lokal)
chmod +x deploy-to-vps.sh
./deploy-to-vps.sh
```

**Selesai!** Script akan otomatis melakukan semua langkah.

---

## 📋 File yang Tersedia

### Script Deployment
- **`deploy-to-vps.sh`** - Deployment otomatis lengkap
- **`server/migrate-sqlite-to-postgresql-vps.js`** - Script migrasi untuk VPS
- **`server/backup-database-vps.sh`** - Backup database
- **`server/rollback-to-sqlite.sh`** - Rollback jika gagal

### Dokumentasi
- **`VPS_DEPLOYMENT_GUIDE.md`** - Panduan lengkap (detail)
- **`QUICK_START_DEPLOYMENT.md`** - Panduan cepat
- **`DEPLOYMENT_FILES_SUMMARY.md`** - Ringkasan semua file

---

## 🎯 Langkah-Langkah Deployment

### 1. Persiapan

```bash
# Test SSH connection
ssh foom@103.31.39.189

# Cek struktur direktori
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server"
```

### 2. Backup Database

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && bash backup-database-vps.sh"
```

### 3. Deploy

**Metode Otomatis (Recommended)**:
```bash
./deploy-to-vps.sh
```

**Metode Manual**:
Lihat `QUICK_START_DEPLOYMENT.md` untuk step-by-step manual.

### 4. Verifikasi

```bash
# Cek status aplikasi
ssh foom@103.31.39.189 "pm2 status"

# Cek health endpoint
curl http://103.31.39.189:1234/health

# Cek data
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node check-data.js"
```

---

## 🔧 Yang Akan Terjadi

### Selama Deployment:

1. ✅ **Backup** - Database SQLite di-backup ke `~/backups/manufacturing-app/`
2. ✅ **Stop App** - Aplikasi dihentikan sementara
3. ✅ **Upload Code** - Kode baru di-upload ke VPS
4. ✅ **Install PostgreSQL** - PostgreSQL diinstall (jika belum ada)
5. ✅ **Install Dependencies** - npm install untuk semua package
6. ✅ **Migrasi Database** - Data SQLite dimigrasi ke PostgreSQL
7. ✅ **Build Client** - Frontend di-build
8. ✅ **Start App** - Aplikasi di-start dengan PM2

### Setelah Deployment:

- ✅ Database menggunakan PostgreSQL
- ✅ Semua data ter-migrasi
- ✅ Aplikasi berjalan normal
- ✅ SQLite database tetap ada (untuk backup)

---

## 🔙 Rollback (Jika Gagal)

Jika ada masalah dan perlu rollback:

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    pm2 stop manufacturing-app
    bash rollback-to-sqlite.sh
ENDSSH
```

**PENTING**: Setelah rollback, perlu revert code ke versi SQLite dengan Git.

---

## 📊 Checklist

Sebelum deployment:
- [ ] Backup database dibuat
- [ ] Kode sudah di-commit
- [ ] Akses SSH ke VPS OK

Setelah deployment:
- [ ] Aplikasi running (`pm2 status`)
- [ ] Health check OK (`/health` endpoint)
- [ ] Data terlihat di frontend
- [ ] Tidak ada error di logs

---

## 🆘 Troubleshooting

### Error: "Cannot connect to PostgreSQL"
```bash
# Cek status PostgreSQL
ssh foom@103.31.39.189 "sudo systemctl status postgresql"

# Start jika tidak berjalan
ssh foom@103.31.39.189 "sudo systemctl start postgresql"
```

### Error: "Application won't start"
```bash
# Cek logs
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 100"
```

### Error: "No data after migration"
```bash
# Re-run migrasi
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node migrate-sqlite-to-postgresql-vps.js"
```

**Untuk troubleshooting lengkap, lihat**: `VPS_DEPLOYMENT_GUIDE.md`

---

## 📚 Dokumentasi Lengkap

- **`VPS_DEPLOYMENT_GUIDE.md`** - Panduan lengkap dengan detail
- **`QUICK_START_DEPLOYMENT.md`** - Quick reference
- **`DEPLOYMENT_FILES_SUMMARY.md`** - Penjelasan semua file

---

## ✅ Status

- ✅ Script deployment siap
- ✅ Script migrasi siap
- ✅ Script backup siap
- ✅ Script rollback siap
- ✅ Dokumentasi lengkap

**Siap untuk deployment!** 🎉

---

**Last Updated**: 2026-01-08  
**Version**: 1.0.0
