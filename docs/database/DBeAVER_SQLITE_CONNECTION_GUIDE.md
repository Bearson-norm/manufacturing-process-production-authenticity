# Panduan Koneksi DBeaver ke SQLite Database di VPS

Panduan ini menjelaskan cara menghubungkan DBeaver ke database SQLite yang berada di VPS server menggunakan SSH tunneling.

## Informasi VPS
- **Hostname**: ProductionDashboard
- **Username**: foom
- **Path Database**: `~/deployments/manufacturing-app/server/database.sqlite`
- **File Database**: `database.sqlite`

## Metode 1: SSH Tunneling (Direkomendasikan)

Metode ini memungkinkan DBeaver mengakses database SQLite di VPS melalui koneksi SSH yang aman.

### Langkah-langkah:

#### 1. Persiapan di DBeaver

1. **Buka DBeaver** dan buat koneksi baru:
   - Klik kanan pada **Database Navigator** → **New** → **Database Connection**
   - Atau gunakan shortcut: `Ctrl+Shift+N`

2. **Pilih Database Type**:
   - Pilih **SQLite** dari daftar database
   - Klik **Next**

#### 2. Konfigurasi SSH Tunnel

1. **Di jendela Connection Settings**, klik tab **SSH** di bagian atas

2. **Enable SSH Tunnel**:
   - Centang checkbox **Use SSH Tunnel**

3. **Isi Informasi SSH**:
   - **Host**: IP address atau hostname VPS Anda (misalnya: `ProductionDashboard` atau IP address)
   - **Port**: `22` (default SSH port)
   - **User Name**: `foom`
   - **Authentication Method**: Pilih salah satu:
     - **Password**: Masukkan password SSH
     - **Public Key**: Gunakan private key file (.pem atau .ppk)

4. **Jika menggunakan Public Key**:
   - Klik **Browse** untuk memilih file private key
   - Atau paste path ke file private key Anda
   - Jika menggunakan PuTTY key (.ppk), DBeaver akan mengonversinya otomatis

5. **Test SSH Connection**:
   - Klik **Test Tunnel Configuration** untuk memastikan koneksi SSH berhasil
   - Pastikan muncul pesan sukses

#### 3. Konfigurasi Database Path

1. **Kembali ke tab Main** (atau **General**)

2. **Database Path**:
   - Klik **Browse** untuk memilih database
   - **PENTING**: Karena menggunakan SSH tunnel, Anda perlu memasukkan path di VPS:
     ```
     /home/foom/deployments/manufacturing-app/server/database.sqlite
     ```
   - Atau gunakan path relatif dari home directory:
     ```
     ~/deployments/manufacturing-app/server/database.sqlite
     ```

3. **Alternatif - Manual Path Entry**:
   - Jika Browse tidak bekerja, ketikkan path secara manual:
     ```
     /home/foom/deployments/manufacturing-app/server/database.sqlite
     ```

#### 4. Test dan Simpan Koneksi

1. **Test Connection**:
   - Klik **Test Connection** di bagian bawah
   - DBeaver akan:
     - Membuat SSH tunnel
     - Mengakses database melalui tunnel
     - Memverifikasi koneksi

2. **Jika Berhasil**:
   - Klik **Finish** untuk menyimpan koneksi
   - Beri nama koneksi (misalnya: "Manufacturing App - Production")

3. **Jika Gagal**:
   - Periksa:
     - Kredensial SSH (username/password atau key)
     - Path database di VPS
     - Permission file database (harus readable)
     - Firewall VPS (port 22 harus terbuka)

## Metode 2: Copy Database File ke Local (Alternatif)

Jika SSH tunneling tidak bekerja, Anda bisa menyalin database file ke komputer lokal.

### Langkah-langkah:

#### 1. Copy Database dari VPS ke Local

**Menggunakan SCP (dari terminal lokal)**:
```bash
scp foom@ProductionDashboard:~/deployments/manufacturing-app/server/database.sqlite ./database.sqlite
```

**Menggunakan SFTP Client** (FileZilla, WinSCP, dll):
- Connect ke VPS menggunakan kredensial SSH
- Navigate ke: `/home/foom/deployments/manufacturing-app/server/`
- Download file `database.sqlite` ke komputer lokal

#### 2. Koneksi di DBeaver

1. **Buat koneksi SQLite baru** (tanpa SSH tunnel)
2. **Database Path**: Pilih file `database.sqlite` yang sudah di-download
3. **Test Connection** dan **Finish**

**Catatan**: 
- Database yang di-copy adalah snapshot pada saat di-download
- Perubahan di VPS tidak akan terlihat di database lokal
- Untuk update, perlu download ulang database file

## Metode 3: Mount Remote Filesystem (Advanced)

Untuk akses real-time tanpa copy file, Anda bisa mount remote filesystem menggunakan SSHFS.

### Windows (dengan WinFsp + SSHFS-Win):

1. **Install WinFsp dan SSHFS-Win**
2. **Mount remote directory**:
   ```powershell
   net use Z: \\sshfs\foom@ProductionDashboard\home\foom\deployments\manufacturing-app\server
   ```
3. **Di DBeaver**: Gunakan path `Z:\database.sqlite`

### Linux/Mac:

1. **Install SSHFS**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install sshfs
   
   # Mac
   brew install sshfs
   ```

2. **Mount remote directory**:
   ```bash
   mkdir ~/vps_database
   sshfs foom@ProductionDashboard:~/deployments/manufacturing-app/server ~/vps_database
   ```

3. **Di DBeaver**: Gunakan path `~/vps_database/database.sqlite`

## Troubleshooting

### Error: "Database file is locked"
- **Penyebab**: Database sedang digunakan oleh aplikasi Node.js
- **Solusi**: 
  - Stop aplikasi Node.js di VPS terlebih dahulu
  - Atau gunakan database read-only mode di DBeaver

### Error: "Permission denied"
- **Penyebab**: User tidak memiliki permission untuk membaca file
- **Solusi**:
  ```bash
  # Di VPS, berikan permission read
  chmod 644 ~/deployments/manufacturing-app/server/database.sqlite
  ```

### Error: "SSH connection failed"
- **Penyebab**: 
  - Kredensial salah
  - Firewall memblokir port 22
  - SSH service tidak berjalan
- **Solusi**:
  - Verifikasi kredensial SSH
  - Test koneksi SSH manual: `ssh foom@ProductionDashboard`
  - Periksa firewall VPS

### Error: "[SQLITE_CANTOPEN] Unable to open the database file"

Error ini adalah yang paling umum dan bisa disebabkan oleh beberapa hal:

#### **Langkah 1: Verifikasi Path di VPS**

Jalankan perintah berikut di VPS untuk mendapatkan path yang benar:

```bash
# Masuk ke VPS
ssh foom@ProductionDashboard

# Cek lokasi database yang sebenarnya
cd ~/deployments/manufacturing-app/server
pwd
ls -la database.sqlite

# Atau gunakan script verifikasi
# Upload file verify-database-path.sh ke VPS, lalu:
bash verify-database-path.sh
```

#### **Langkah 2: Dapatkan Absolute Path yang Benar**

Setelah masuk ke VPS, jalankan:

```bash
realpath ~/deployments/manufacturing-app/server/database.sqlite
```

Atau:

```bash
cd ~/deployments/manufacturing-app/server
pwd
# Output akan menunjukkan path lengkap, contoh: /home/foom/deployments/manufacturing-app/server
```

#### **Langkah 3: Periksa Home Directory User**

Home directory mungkin bukan `/home/foom`. Cek dengan:

```bash
echo $HOME
# Output mungkin: /home/foom atau /var/home/foom atau path lain
```

#### **Langkah 4: Solusi Path di DBeaver**

Coba path-path berikut secara berurutan di DBeaver (di tab Main/General → Database Path):

1. **Path dengan realpath** (paling akurat):
   ```
   /home/foom/deployments/manufacturing-app/server/database.sqlite
   ```

2. **Path dengan $HOME** (jika home bukan /home/foom):
   ```
   /var/home/foom/deployments/manufacturing-app/server/database.sqlite
   ```
   (Ganti dengan output dari `echo $HOME`)

3. **Path relatif dari working directory SSH**:
   ```
   deployments/manufacturing-app/server/database.sqlite
   ```

4. **Path dengan tilde expansion** (coba tanpa leading slash):
   ```
   ~/deployments/manufacturing-app/server/database.sqlite
   ```

#### **Langkah 5: Periksa Permission**

Pastikan file dan direktori memiliki permission yang benar:

```bash
# Di VPS, jalankan:
chmod 644 ~/deployments/manufacturing-app/server/database.sqlite
chmod 755 ~/deployments/manufacturing-app/server
chmod 644 ~/deployments/manufacturing-app/server/database.sqlite-wal 2>/dev/null
chmod 644 ~/deployments/manufacturing-app/server/database.sqlite-shm 2>/dev/null
```

#### **Langkah 6: Periksa Ownership**

Pastikan file dimiliki oleh user `foom`:

```bash
# Di VPS:
ls -la ~/deployments/manufacturing-app/server/database.sqlite
# Output harus menunjukkan owner: foom

# Jika bukan, ubah ownership:
sudo chown foom:foom ~/deployments/manufacturing-app/server/database.sqlite
sudo chown foom:foom ~/deployments/manufacturing-app/server/database.sqlite-* 2>/dev/null
```

#### **Langkah 7: Test dengan Command Line di VPS**

Verifikasi database bisa dibuka:

```bash
# Di VPS, install sqlite3 jika belum ada:
# sudo apt-get install sqlite3  # Ubuntu/Debian
# sudo yum install sqlite3       # CentOS/RHEL

# Test buka database:
sqlite3 ~/deployments/manufacturing-app/server/database.sqlite "SELECT 1;"
```

Jika command ini gagal, masalahnya ada di file database atau permission, bukan di DBeaver.

#### **Langkah 8: Konfigurasi DBeaver - Tips Tambahan**

1. **Jangan gunakan Browse button** - Ketik path secara manual
2. **Pastikan SSH Tunnel sudah connected** - Test di tab SSH dulu sebelum test connection
3. **Gunakan absolute path** - Jangan gunakan `~` atau relative path
4. **Cek Driver Properties** - Di tab "Driver Properties", pastikan tidak ada setting yang konflik

#### **Langkah 9: Alternatif - Copy Database ke Lokasi Sederhana**

Jika masih error, copy database ke home directory untuk testing:

```bash
# Di VPS:
cp ~/deployments/manufacturing-app/server/database.sqlite ~/database.sqlite
chmod 644 ~/database.sqlite
```

Lalu di DBeaver gunakan path: `/home/foom/database.sqlite` (atau sesuai `$HOME` Anda)

Jika ini berhasil, berarti masalahnya di path atau permission direktori `deployments/manufacturing-app/server`.

### Error: "Database file not found"
- **Penyebab**: Path database salah atau file tidak ada
- **Solusi**:
  - Verifikasi path lengkap di VPS: 
    ```bash
    ls -la ~/deployments/manufacturing-app/server/database.sqlite
    ```
  - Gunakan absolute path yang didapat dari `realpath` command
  - Pastikan file benar-benar ada di lokasi tersebut

### Database WAL Mode
Jika database menggunakan WAL mode (Write-Ahead Logging), pastikan file-file berikut juga accessible:
- `database.sqlite` (main file)
- `database.sqlite-wal` (WAL file)
- `database.sqlite-shm` (shared memory file)

DBeaver biasanya akan otomatis menangani file-file ini jika menggunakan SSH tunnel.

## Tips Penting

1. **Backup Database**: Selalu backup database sebelum melakukan perubahan besar
2. **Read-Only Mode**: Untuk keamanan, gunakan read-only mode jika hanya untuk melihat data
3. **Connection Timeout**: Atur timeout yang cukup untuk koneksi SSH yang lambat
4. **Multiple Connections**: SQLite mendukung multiple read connections, tapi hanya satu write connection
5. **WAL Files**: Jika aplikasi sedang berjalan, file WAL mungkin berubah. Refresh connection jika perlu

## Konfigurasi DBeaver untuk Read-Only

Untuk mencegah perubahan tidak sengaja:

1. **Di Connection Settings** → **Driver Properties**
2. Tambahkan property:
   - `readonly`: `true`
   - Atau gunakan mode read-only saat membuka database

## Quick Fix untuk Error "Unable to open the database file"

Jika Anda mendapatkan error ini, ikuti langkah-langkah berikut:

### Step-by-Step Fix:

1. **SSH ke VPS dan dapatkan path yang benar**:
   ```bash
   ssh foom@ProductionDashboard
   realpath ~/deployments/manufacturing-app/server/database.sqlite
   ```

2. **Copy output path tersebut** (contoh: `/home/foom/deployments/manufacturing-app/server/database.sqlite`)

3. **Di DBeaver**:
   - Buka connection settings
   - Pastikan SSH Tunnel sudah di-test dan berhasil
   - Di tab **Main/General** → **Database Path**
   - **Hapus path lama**, paste path yang didapat dari step 1
   - **JANGAN gunakan Browse button**, ketik manual
   - Klik **Test Connection**

4. **Jika masih error**, cek permission:
   ```bash
   # Di VPS:
   chmod 644 ~/deployments/manufacturing-app/server/database.sqlite
   chmod 755 ~/deployments/manufacturing-app/server
   ```

5. **Jika masih error**, coba path alternatif:
   - Cek home directory: `echo $HOME` di VPS
   - Gunakan path lengkap sesuai output tersebut

### Script Verifikasi Otomatis

Upload file `verify-database-path.sh` ke VPS dan jalankan:

```bash
# Upload ke VPS (dari komputer lokal):
scp verify-database-path.sh foom@ProductionDashboard:~/

# Di VPS:
bash ~/verify-database-path.sh
```

Script ini akan memberikan:
- Path absolut yang benar
- Status permission
- Rekomendasi path untuk digunakan di DBeaver

## Referensi

- [DBeaver SQLite Documentation](https://dbeaver.com/docs/wiki/SQLite/)
- [DBeaver SSH Tunnel Guide](https://dbeaver.com/docs/wiki/SSH-Tunnel/)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)

---

**Catatan**: Untuk akses real-time yang aman, **Metode 1 (SSH Tunneling)** adalah yang paling direkomendasikan.

