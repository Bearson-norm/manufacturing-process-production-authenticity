# Cara Download Database dari VPS

## 📍 Informasi VPS

- **User:** `foom`
- **Host:** `ProductionDashboard` (atau IP: `103.31.39.189`)
- **Path Database:** `~/deployments/manufacturing-app/server/database.sqlite`

## 🚀 Command SCP untuk Download Database

### Windows PowerShell

```powershell
# Menggunakan hostname (jika sudah dikonfigurasi)
scp foom@ProductionDashboard:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Atau menggunakan IP address langsung
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Atau menggunakan path lengkap
scp foom@103.31.39.189:/home/foom/deployments/manufacturing-app/server/database.sqlite ./database.sqlite
```

### Linux/Mac Terminal

```bash
# Menggunakan hostname
scp foom@ProductionDashboard:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite

# Atau menggunakan IP address
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite
```

## 📦 Download Semua File Database (Termasuk WAL Files)

Jika ingin download semua file terkait database untuk konsistensi:

```powershell
# Windows PowerShell
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite-wal ./database.sqlite-wal
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite-shm ./database.sqlite-shm
```

## 🔧 Menggunakan SFTP Client

### WinSCP (Windows)

1. Download dan install WinSCP: https://winscp.net/
2. Connect ke VPS:
   - **Host name:** `103.31.39.189` atau `ProductionDashboard`
   - **User name:** `foom`
   - **Password:** (masukkan password SSH Anda)
   - **Protocol:** SFTP
3. Navigate ke: `~/deployments/manufacturing-app/server/`
4. Download file `database.sqlite`

### FileZilla (Cross-platform)

1. Download FileZilla: https://filezilla-project.org/
2. File → Site Manager → New Site
3. Configure:
   - **Host:** `103.31.39.189` atau `ProductionDashboard`
   - **Protocol:** SFTP - SSH File Transfer Protocol
   - **Logon Type:** Normal
   - **User:** `foom`
   - **Password:** (masukkan password SSH)
4. Connect dan navigate ke `~/deployments/manufacturing-app/server/`
5. Download `database.sqlite`

## 📂 Setelah Download

Setelah database berhasil didownload, Anda bisa:

1. **Buka dengan DB Browser for SQLite:**
   - Download: https://sqlitebrowser.org/
   - File → Open Database → Pilih `database.sqlite`

2. **Buka dengan VS Code:**
   - Install extension "SQLite Viewer"
   - Buka file `database.sqlite` di VS Code
   - Klik kanan → "Open Database"

3. **Buka dengan Online Viewer:**
   - Upload ke https://sqliteviewer.app/
   - Atau https://inloop.github.io/sqlite-viewer/

## ⚠️ Catatan Penting

1. **Database mungkin sedang digunakan:** Jika aplikasi sedang berjalan, database mungkin dalam mode WAL. Download file `database.sqlite-wal` juga untuk konsistensi.

2. **Ukuran file:** Database bisa cukup besar tergantung jumlah data. Pastikan koneksi stabil.

3. **Keamanan:** Jangan commit database ke repository Git. Database berisi data produksi yang sensitif.

4. **Backup:** Sebelum melakukan perubahan, pastikan sudah ada backup.

## 🔍 Verifikasi Download

Setelah download, verifikasi file:

```powershell
# Windows PowerShell - Cek ukuran file
Get-Item database.sqlite | Select-Object Name, Length, LastWriteTime

# Atau buka dengan SQLite untuk test
sqlite3 database.sqlite "SELECT COUNT(*) FROM production_liquid;"
```

## 📚 Referensi

- [DATABASE_ACCESS_GUIDE.md](./DATABASE_ACCESS_GUIDE.md) - Panduan lengkap akses database
- [DATABASE_QUICK_START.md](./DATABASE_QUICK_START.md) - Quick start guide

