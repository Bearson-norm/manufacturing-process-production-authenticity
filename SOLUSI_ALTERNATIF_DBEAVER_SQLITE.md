# Solusi Alternatif: Akses SQLite Database di VPS

## Masalah
SQLite adalah **embedded database** (file-based), bukan database server. SSH tunnel di DBeaver dirancang untuk **port forwarding** ke database server (MySQL, PostgreSQL, dll), bukan untuk file access.

Untuk akses SQLite di VPS, ada beberapa metode alternatif yang lebih efektif.

## Solusi 1: Copy Database ke Local (PALING MUDAH)

Metode ini paling sederhana dan paling sering digunakan.

### Langkah-langkah:

1. **Download database dari VPS ke komputer lokal**:
   ```powershell
   # Di PowerShell lokal
   scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite C:\Users\info\Downloads\database.sqlite
   ```

2. **Buat koneksi SQLite baru di DBeaver** (TANPA SSH Tunnel):
   - Klik kanan Database Navigator → New → Database Connection
   - Pilih **SQLite**
   - **JANGAN aktifkan SSH Tunnel**
   - Path: `C:\Users\info\Downloads\database.sqlite`
   - Test Connection → OK

### Keuntungan:
- ✅ Paling mudah dan pasti berhasil
- ✅ Tidak perlu konfigurasi kompleks
- ✅ Full read-write access

### Keterbatasan:
- ❌ Database adalah snapshot (tidak real-time)
- ❌ Perlu download ulang untuk data terbaru
- ❌ Perubahan tidak otomatis sync ke VPS

### Update Data:
Untuk mendapatkan data terbaru, download ulang:
```powershell
scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite C:\Users\info\Downloads\database.sqlite
```

## Solusi 2: Mount Remote Filesystem dengan SSHFS (Real-Time Access)

Metode ini membuat direktori VPS seperti drive lokal di Windows.

### Langkah-langkah untuk Windows:

1. **Install WinFsp**:
   - Download dari: https://github.com/winfsp/winfsp/releases
   - Install dengan default settings

2. **Install SSHFS-Win**:
   - Download dari: https://github.com/winfsp/sshfs-win/releases
   - Install dengan default settings

3. **Mount VPS directory sebagai network drive**:
   ```powershell
   # Di PowerShell (run as Administrator)
   net use Z: \\sshfs\foom@103.31.39.189\home\foom\deployments\manufacturing-app\server
   ```
   
   Masukkan password VPS saat diminta.

4. **Buka DBeaver dan koneksi ke database** (TANPA SSH Tunnel):
   - Path: `Z:\database.sqlite`
   - Test Connection → OK

### Keuntungan:
- ✅ Real-time access
- ✅ Perubahan langsung ke VPS
- ✅ Seperti file lokal

### Keterbatasan:
- ❌ Perlu install software tambahan
- ❌ Koneksi tergantung network
- ❌ Bisa lambat jika koneksi internet lambat

## Solusi 3: Gunakan DBeaver dengan Remote Files Plugin

DBeaver Enterprise Edition memiliki fitur remote file access yang lebih baik.

### Untuk Community Edition (Gratis):

1. **Edit Connection**
2. **Tab SSH** → Enable SSH Tunnel
3. **PENTING**: Gunakan **"Remote host localhost"** jika database bisa diakses dari localhost di VPS
4. Atau gunakan **Local File Forward** feature jika tersedia

**CATATAN**: Fitur ini terbatas di Community Edition.

## Solusi 4: Setup SSH Tunnel Manual dengan Port Forwarding + socat

Gunakan `socat` di VPS untuk membuat SQLite accessible via TCP:

### Setup di VPS:

1. **Install socat**:
   ```bash
   ssh foom@103.31.39.189
   sudo apt-get install socat
   ```

2. **Buat TCP server untuk SQLite** (experimental, tidak direkomendasikan untuk production):
   ```bash
   # JANGAN lakukan ini di production, hanya untuk testing
   socat TCP-LISTEN:5555,reuseaddr,fork SYSTEM:'sqlite3 ~/deployments/manufacturing-app/server/database.sqlite'
   ```

**PERINGATAN**: Metode ini tidak aman dan tidak praktis. **TIDAK DIREKOMENDASIKAN**.

## Solusi 5: Akses via Web Interface (DB Browser)

Setup web interface untuk SQLite di VPS:

### Install sqliteweb:

```bash
ssh foom@103.31.39.189
pip3 install sqliteweb
```

### Jalankan:

```bash
sqliteweb ~/deployments/manufacturing-app/server/database.sqlite --host 0.0.0.0 --port 8080
```

### Akses:
- Buka browser: `http://103.31.39.189:8080`

**PERINGATAN**: Jangan expose ke internet tanpa authentication!

## Solusi 6: Gunakan CLI Tools (Untuk Query Cepat)

Jika hanya butuh query cepat tanpa GUI:

```powershell
# Query langsung via SSH
ssh foom@103.31.39.189 "sqlite3 ~/deployments/manufacturing-app/server/database.sqlite 'SELECT * FROM production_liquid LIMIT 10;'"

# Atau buka interactive mode
ssh foom@103.31.39.189 "sqlite3 ~/deployments/manufacturing-app/server/database.sqlite"
```

## Rekomendasi Berdasarkan Use Case

### Untuk Analisis Data (Read-Only):
**Gunakan Solusi 1 (Copy to Local)**
- Download database ke lokal
- Analisis dengan DBeaver lokal
- Download ulang jika perlu data terbaru

### Untuk Development/Testing:
**Gunakan Solusi 1 atau 2**
- Copy untuk testing lokal (Solusi 1)
- Atau mount untuk real-time (Solusi 2)

### Untuk Monitoring Real-Time:
**Gunakan Solusi 2 (SSHFS Mount)**
- Mount remote filesystem
- Akses seperti file lokal

### Untuk Quick Query:
**Gunakan Solusi 6 (CLI)**
- SSH + sqlite3 command
- Cepat dan praktis

## Script Otomatis untuk Download Database

Buat file `sync-database.ps1`:

```powershell
# sync-database.ps1
$VPS_HOST = "foom@103.31.39.189"
$REMOTE_PATH = "~/deployments/manufacturing-app/server/database.sqlite"
$LOCAL_PATH = "C:\Users\info\Downloads\database.sqlite"
$BACKUP_PATH = "C:\Users\info\Downloads\database-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').sqlite"

Write-Host "Downloading database from VPS..."

# Backup existing local database if exists
if (Test-Path $LOCAL_PATH) {
    Write-Host "Backing up existing database..."
    Copy-Item $LOCAL_PATH $BACKUP_PATH
}

# Download database
scp "${VPS_HOST}:${REMOTE_PATH}" $LOCAL_PATH

Write-Host "Database downloaded to: $LOCAL_PATH"
Write-Host "You can now open it in DBeaver"
```

### Cara pakai:
```powershell
powershell -ExecutionPolicy Bypass -File sync-database.ps1
```

## Kesimpulan

**Untuk sebagian besar kasus, Solusi 1 (Copy Database ke Local) adalah yang paling praktis dan mudah.**

Langkah singkat:
1. Download: `scp foom@103.31.39.189:~/deployments/manufacturing-app/server/database.sqlite C:\Users\info\Downloads\database.sqlite`
2. Buka DBeaver, buat koneksi SQLite lokal ke file tersebut
3. Selesai!

Jika perlu data terbaru, download ulang.

