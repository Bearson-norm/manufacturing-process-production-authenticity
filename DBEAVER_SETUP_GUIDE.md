# Panduan Setup DBeaver untuk Akses Database SQLite dari VPS

## 📋 Overview

DBeaver adalah database management tool yang sangat powerful dan mendukung SQLite dengan fitur lengkap. Panduan ini menjelaskan cara mengakses database SQLite yang ada di VPS menggunakan DBeaver.

## 🎯 Metode 1: Download Database ke Local (Paling Mudah & Recommended)

### Step 1: Download Database dari VPS

**Windows PowerShell:**
```powershell
scp user@your-vps-ip:/var/www/manufacturing-api/server/database.sqlite ./database.sqlite
```

**Windows Command Prompt:**
```cmd
# Install WinSCP atau gunakan PowerShell
# Atau gunakan SFTP client seperti FileZilla
```

**Menggunakan WinSCP:**
1. Download WinSCP: https://winscp.net/
2. Connect ke VPS dengan credentials SSH Anda
3. Navigate ke `/var/www/manufacturing-api/server/`
4. Download file `database.sqlite` ke local computer

### Step 2: Install DBeaver

1. Download DBeaver Community Edition (gratis):
   - Website: https://dbeaver.io/download/
   - Pilih versi sesuai OS Anda (Windows/Mac/Linux)

2. Install DBeaver:
   - Run installer
   - Ikuti wizard installation
   - DBeaver akan otomatis install SQLite driver

### Step 3: Create Connection di DBeaver

1. **Buka DBeaver**

2. **Create New Connection:**
   - Klik icon **"New Database Connection"** (icon plug di toolbar)
   - Atau: Database → New Database Connection
   - Atau tekan: `Ctrl+Shift+N`

3. **Pilih Database Type:**
   - Cari dan pilih **SQLite**
   - Klik **Next**

4. **Configure Connection:**
   - **Path:** Klik **Browse** dan pilih file `database.sqlite` yang sudah didownload
   - **Driver Properties:** Biarkan default (tidak perlu diubah)
   - Klik **Test Connection** untuk memastikan koneksi berhasil
   - Jika muncul popup "Download driver", klik **Download**

5. **Finish:**
   - Klik **Finish**
   - Connection akan muncul di Database Navigator (panel kiri)

### Step 4: Explore Database

1. **Lihat Struktur Database:**
   - Expand connection di Database Navigator
   - Expand **Tables**
   - Anda akan melihat semua tabel: `production_liquid`, `production_device`, `production_cartridge`, dll

2. **View Data:**
   - Klik kanan pada tabel (contoh: `production_liquid`)
   - Pilih **View Data**
   - Data akan ditampilkan dalam format grid

3. **Edit Data:**
   - Setelah membuka View Data
   - Klik pada cell untuk edit
   - Klik icon **Save** (disk icon) atau tekan `Ctrl+S` untuk commit changes

4. **Run SQL Query:**
   - Klik kanan pada connection → **SQL Editor** → **New SQL Script**
   - Tulis query SQL
   - Tekan `Ctrl+Enter` atau klik **Execute** untuk run query

---

## 🌐 Metode 2: Menggunakan SSH Tunnel (Akses Langsung dari VPS)

Metode ini memungkinkan Anda mengakses database langsung dari VPS tanpa perlu download. Data selalu up-to-date.

### Step 1: Install DBeaver

Sama seperti Metode 1, install DBeaver terlebih dahulu.

### Step 2: Create Connection dengan SSH Tunnel

1. **Create New Connection:**
   - Klik **New Database Connection**
   - Pilih **SQLite**
   - Klik **Next**

2. **Enable SSH Tunnel:**
   - Centang checkbox **"Use SSH Tunnel"**
   - Klik tombol **"SSH Configuration"** → **"New"**

3. **Configure SSH Settings:**
   
   **Tab "Main":**
   ```
   Host: your-vps-ip (contoh: 192.168.1.100 atau yourdomain.com)
   Port: 22
   User name: your-ssh-username
   ```
   
   **Tab "Authentication":**
   
   **Option A: Password Authentication**
   - Pilih **"Password"**
   - Masukkan password SSH Anda
   - Centang **"Save password"** jika ingin menyimpan
   
   **Option B: Public Key Authentication (Recommended)**
   - Pilih **"Public Key"**
   - **Private Key:** Browse ke file private key Anda
     - Windows: File `.ppk` (PuTTY) atau `.pem` (OpenSSH)
     - Jika pakai PuTTY, convert `.ppk` ke OpenSSH format dulu
   - **Passphrase:** Masukkan passphrase jika private key di-encrypt
   - Centang **"Save password"** jika ingin menyimpan

4. **Test SSH Connection:**
   - Klik **Test Connection**
   - Jika berhasil, akan muncul "SSH tunnel test successful"
   - Klik **OK**

5. **Configure Database Path:**
   - Kembali ke tab **Main** (SQLite connection)
   - **Path:** Masukkan path absolute di VPS:
     ```
     /var/www/manufacturing-api/server/database.sqlite
     ```
   - ⚠️ **Important:** Gunakan path absolute, bukan relative path

6. **Test Database Connection:**
   - Klik **Test Connection**
   - Jika berhasil, akan muncul "Connected"
   - Klik **Finish**

### Step 3: Menggunakan Connection

1. **Buka Connection:**
   - Connection akan muncul di Database Navigator
   - Expand untuk melihat tables

2. **Catatan Penting:**
   - ⚠️ **Read-only Warning:** Saat menggunakan SSH tunnel, DBeaver mungkin membuka database dalam mode read-only untuk mencegah corruption
   - ⚠️ **Performance:** Akses melalui SSH tunnel lebih lambat dibanding local file
   - ✅ **Real-time:** Data selalu up-to-date karena langsung dari VPS
   - ✅ **No Download:** Tidak perlu download database setiap kali

---

## 🛠️ Fitur DBeaver yang Berguna

### 1. SQL Editor

**Cara menggunakan:**
- Klik kanan pada connection → **SQL Editor** → **New SQL Script**
- Atau tekan `Ctrl+Shift+Enter`
- Tulis query SQL dengan syntax highlighting
- Tekan `Ctrl+Enter` untuk execute query
- Hasil akan muncul di panel bawah

**Contoh Query:**
```sql
-- Get all completed MO
SELECT DISTINCT mo_number, sku_name, completed_at
FROM production_liquid
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 20;

-- Get statistics per day
SELECT 
  DATE(completed_at) as date,
  COUNT(DISTINCT mo_number) as total_mo,
  COUNT(*) as total_records
FROM production_liquid
WHERE status = 'completed' AND completed_at IS NOT NULL
GROUP BY DATE(completed_at)
ORDER BY date DESC;
```

### 2. Data Export

**Export ke CSV/Excel:**
1. Buka tabel → View Data
2. Klik kanan pada data grid
3. Pilih **Export Data**
4. Pilih format: CSV, Excel, JSON, SQL, dll
5. Configure export settings
6. Klik **Start**

**Export Query Results:**
1. Jalankan query di SQL Editor
2. Klik kanan pada results
3. Pilih **Export Data**
4. Pilih format dan configure
5. Klik **Start**

### 3. Data Import

1. Klik kanan pada tabel
2. Pilih **Import Data**
3. Pilih source file (CSV, Excel, JSON, dll)
4. Configure mapping columns
5. Klik **Start**

### 4. ER Diagram

**Generate ER Diagram:**
1. Klik kanan pada connection
2. Pilih **View Diagram**
3. DBeaver akan generate ER diagram otomatis
4. Anda bisa drag & drop untuk arrange diagram

### 5. Database Compare

**Compare Database Structure:**
1. Klik kanan pada connection
2. Pilih **Tools** → **Compare/Migrate**
3. Pilih source dan target database
4. DBeaver akan show differences

### 6. Query History

**View Query History:**
- Window → **Query Manager**
- Atau tekan `Ctrl+Shift+H`
- Lihat semua query yang pernah dijalankan
- Bisa re-run query dari history

### 7. Database Backup

**Backup Database:**
1. Klik kanan pada connection
2. Pilih **Tools** → **Backup Database**
3. Pilih destination file
4. Klik **Start**

---

## 🔧 Troubleshooting

### Issue: "Database is locked"

**Penyebab:** Database sedang digunakan oleh aplikasi lain (Node.js server)

**Solusi:**
```bash
# SSH ke VPS
ssh user@your-vps-ip

# Stop PM2 processes
pm2 stop all

# Atau stop specific app
pm2 stop manufacturing-api

# Setelah selesai, restart
pm2 start all
```

### Issue: "Cannot open database file"

**Penyebab:** Path salah atau permission issue

**Solusi:**
1. **Cek path:**
   - Pastikan path absolute: `/var/www/manufacturing-api/server/database.sqlite`
   - Jangan pakai relative path

2. **Cek permission:**
   ```bash
   # SSH ke VPS
   ls -la /var/www/manufacturing-api/server/database.sqlite
   
   # Jika permission salah, fix:
   sudo chmod 664 /var/www/manufacturing-api/server/database.sqlite
   sudo chown $USER:$USER /var/www/manufacturing-api/server/database.sqlite
   ```

### Issue: SSH Tunnel Connection Failed

**Penyebab:** SSH credentials salah atau firewall blocking

**Solusi:**
1. **Test SSH connection dulu:**
   ```bash
   ssh user@your-vps-ip
   ```
   Jika bisa connect, berarti credentials benar

2. **Cek firewall:**
   ```bash
   # Di VPS
   sudo ufw status
   sudo ufw allow 22/tcp
   ```

3. **Cek SSH service:**
   ```bash
   # Di VPS
   sudo systemctl status ssh
   ```

### Issue: "Read-only database" saat pakai SSH Tunnel

**Penyebab:** SQLite WAL mode atau database sedang digunakan

**Solusi:**
1. **Stop aplikasi dulu:**
   ```bash
   pm2 stop all
   ```

2. **Atau download database ke local** untuk edit (Metode 1)

### Issue: Slow Performance dengan SSH Tunnel

**Penyebab:** Network latency atau database besar

**Solusi:**
1. **Download database ke local** untuk query yang lebih cepat
2. **Atau gunakan API endpoints** untuk akses data

---

## 💡 Tips & Best Practices

1. **Untuk Development/Testing:**
   - Download database ke local (Metode 1)
   - Lebih cepat dan bisa edit data dengan mudah

2. **Untuk Production Monitoring:**
   - Gunakan SSH Tunnel (Metode 2)
   - Data selalu up-to-date
   - Jangan edit data langsung di production!

3. **Backup Sebelum Edit:**
   - Selalu backup database sebelum melakukan perubahan besar
   - Gunakan DBeaver backup feature atau manual copy

4. **Gunakan SQL Editor:**
   - Write complex queries dengan syntax highlighting
   - Save queries untuk reuse
   - Use query history untuk track changes

5. **Export Data Regularly:**
   - Export data penting ke CSV/Excel untuk backup
   - Atau setup automated backup script di VPS

---

## 📚 Referensi

- [DBeaver Documentation](https://dbeaver.com/docs/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [DATABASE_ACCESS_GUIDE.md](./DATABASE_ACCESS_GUIDE.md) - Panduan lengkap akses database
- [VPS_DEPLOYMENT_GUIDE.md](./VPS_DEPLOYMENT_GUIDE.md) - Panduan deployment VPS

---

## ✅ Quick Checklist

- [ ] Download DBeaver Community Edition
- [ ] Download database dari VPS ke local (Metode 1) atau setup SSH Tunnel (Metode 2)
- [ ] Create connection di DBeaver
- [ ] Test connection berhasil
- [ ] Explore tables dan data
- [ ] Try SQL Editor untuk custom queries
- [ ] Export data untuk backup

---

**Selamat menggunakan DBeaver! 🎉**

