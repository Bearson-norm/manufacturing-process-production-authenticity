# Solusi Final: Error DBeaver dengan SSH Tunnel

## Status Saat Ini
✅ File database ada di VPS  
✅ SSH Tunnel berhasil connected  
✅ JDBC URL sudah benar: `jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite`  
❌ Field "Path" masih relatif: `deployments/manufacturing-app/server/database.sqlite`

## Solusi 1: Perbaiki Field Path (PENTING!)

Meskipun Anda sudah memilih "URL" mode, DBeaver masih menggunakan field "Path" untuk beberapa operasi.

### Langkah-langkah:

1. **Di DBeaver Connection Settings**:
   - Tab **Main**
   - Lihat field **"Path:"** (di bawah JDBC URL)
   - **Hapus isian yang ada**: `deployments/manufacturing-app/server/database.sqlite`
   - **Ketik manual** path lengkap:
     ```
     /home/foom/deployments/manufacturing-app/server/database.sqlite
     ```
   - Pastikan path **dimulai dari `/home/foom/...`** (bukan hanya `deployments/...`)

2. **Atau kosongkan field Path**:
   - Hapus semua isian di field "Path"
   - Biarkan kosong
   - Pastikan JDBC URL sudah benar
   - Test connection

3. **Test Connection**:
   - Klik **"Test Connection"**
   - Jika masih error, lanjut ke Solusi 2

## Solusi 2: Fix Permission dan Cek Database Lock

Jalankan perintah berikut di PowerShell:

```powershell
# Fix permission
ssh foom@103.31.39.189 "chmod 644 ~/deployments/manufacturing-app/server/database.sqlite; chmod 755 ~/deployments/manufacturing-app/server; chmod 644 ~/deployments/manufacturing-app/server/database.sqlite-wal 2>$null; chmod 644 ~/deployments/manufacturing-app/server/database.sqlite-shm 2>$null"

# Cek permission
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server/database.sqlite*"

# Cek apakah database locked
ssh foom@103.31.39.189 "lsof ~/deployments/manufacturing-app/server/database.sqlite 2>/dev/null || echo 'Database not locked'"
```

## Solusi 3: Gunakan Read-Only Mode

Jika database sedang digunakan oleh aplikasi Node.js:

1. **Di DBeaver**:
   - Tab **Driver properties**
   - Klik **"Add"** atau **"+"**
   - Property name: `readonly`
   - Property value: `true`
   - Klik **OK**

2. **Test Connection** lagi

## Solusi 4: Stop Aplikasi Node.js (Jika Perlu)

Jika Anda perlu write access dan aplikasi sedang berjalan:

```powershell
# Stop aplikasi (pilih salah satu sesuai setup Anda)
ssh foom@103.31.39.189 "pm2 stop manufacturing-app"
# atau
ssh foom@103.31.39.189 "pkill -f 'node.*index.js'"
# atau
ssh foom@103.31.39.189 "systemctl stop manufacturing-app"
```

Setelah stop, test connection di DBeaver.

## Solusi 5: Edit SSH Profile Working Directory

Masalah mungkin karena SSH tunnel working directory.

1. **Di DBeaver**:
   - Klik dropdown **"Profile 'SSH-Authenticity-Report'"**
   - Pilih **"Edit"** atau buka SSH profile settings
   - Cari setting **"Initial directory"** atau **"Working directory"**
   - Set ke: `/home/foom`
   - Atau kosongkan (biarkan default)

2. **Test Tunnel Configuration** lagi
3. **Test Connection** lagi

## Solusi 6: Recreate Connection (Last Resort)

Jika semua solusi di atas tidak bekerja:

1. **Buat connection baru**:
   - Klik kanan Database Navigator → **New** → **Database Connection**
   - Pilih **SQLite**

2. **Setup SSH Tunnel**:
   - Tab **SSH**
   - Enable **"Use SSH Tunnel"**
   - Host: `103.31.39.189`
   - Port: `22`
   - Username: `foom`
   - Authentication: Password atau Key
   - **Test Tunnel Configuration** → harus sukses

3. **Setup Database**:
   - Tab **Main**
   - Pilih **"URL"** radio button
   - JDBC URL: `jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite`
   - **Path**: `/home/foom/deployments/manufacturing-app/server/database.sqlite`
   - **JANGAN gunakan Browse**, ketik manual

4. **Test Connection**

## Checklist Final

Sebelum test connection, pastikan:

- [ ] SSH Tunnel sudah di-test dan **Connected** (ada dialog Success)
- [ ] JDBC URL: `jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite`
- [ ] Field **Path**: `/home/foom/deployments/manufacturing-app/server/database.sqlite` (bukan relatif)
- [ ] Permission file: `644` (readable)
- [ ] Permission directory: `755` (executable)
- [ ] Database tidak locked (atau gunakan read-only mode)
- [ ] Tidak menggunakan Browse button

## Debugging Command

Jika masih error, jalankan ini untuk mendapatkan info lengkap:

```powershell
ssh foom@103.31.39.189 @"
echo '=== Database Info ==='
ls -la ~/deployments/manufacturing-app/server/database.sqlite*
echo ''
echo '=== Permission ==='
stat -c '%a %U:%G %n' ~/deployments/manufacturing-app/server/database.sqlite
echo ''
echo '=== Directory Permission ==='
stat -c '%a %U:%G %n' ~/deployments/manufacturing-app/server
echo ''
echo '=== Database Lock Check ==='
lsof ~/deployments/manufacturing-app/server/database.sqlite 2>/dev/null || echo 'Not locked'
echo ''
echo '=== Absolute Path ==='
realpath ~/deployments/manufacturing-app/server/database.sqlite
"@
```

---

**PENTING**: Field "Path" harus diisi dengan absolute path lengkap `/home/foom/...`, bukan path relatif `deployments/...`

