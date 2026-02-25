# Fix: Path DBeaver Tidak Lengkap

## Masalah
Path di DBeaver hanya menunjukkan: `/deployments/manufacturing-app/server/database.sqlite`
Padahal path yang benar: `/home/foom/deployments/manufacturing-app/server/database.sqlite`

## Solusi

### Langkah 1: Verifikasi Permission dan Status Database

Jalankan di PowerShell:

```powershell
# Cek permission
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server/database.sqlite"

# Cek apakah database sedang digunakan (locked)
ssh foom@103.31.39.189 "lsof ~/deployments/manufacturing-app/server/database.sqlite 2>/dev/null || echo 'Database not locked'"

# Fix permission jika perlu
ssh foom@103.31.39.189 "chmod 644 ~/deployments/manufacturing-app/server/database.sqlite && chmod 755 ~/deployments/manufacturing-app/server && echo 'Permission fixed'"
```

### Langkah 2: Perbaiki Path di DBeaver

1. **Di DBeaver Connection Settings**:
   - Pastikan Anda di tab **Main**
   - Lihat field **"Path:"** (bukan JDBC URL)
   - **Hapus semua isian** di field Path
   - **Ketik manual** (JANGAN gunakan Browse):
     ```
     /home/foom/deployments/manufacturing-app/server/database.sqlite
     ```
   - Pastikan path **lengkap** mulai dari `/home/foom/...`

2. **Atau gunakan JDBC URL**:
   - Klik radio button **"URL"** (bukan "Host")
   - Pastikan JDBC URL menunjukkan:
     ```
     jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite
     ```
   - Jika JDBC URL sudah benar, klik **"Test Connection"**

### Langkah 3: Pastikan SSH Tunnel Berfungsi

1. Klik tab **SSH** di DBeaver
2. Pastikan **"Use SSH Tunnel"** sudah dicentang
3. Klik **"Test Tunnel Configuration"**
4. Pastikan muncul pesan sukses
5. Jika gagal, periksa:
   - Host: `103.31.39.189` (atau `ProductionDashboard`)
   - Port: `22`
   - Username: `foom`
   - Authentication method (password atau key)

### Langkah 4: Cek Working Directory SSH

Masalah mungkin karena SSH tunnel menggunakan working directory yang berbeda.

**Solusi A: Gunakan Absolute Path Lengkap**
- Pastikan path dimulai dari root `/`
- Gunakan: `/home/foom/deployments/manufacturing-app/server/database.sqlite`

**Solusi B: Cek SSH Profile**
- Di DBeaver, lihat dropdown **"Profile 'SSH-Authenticity-Report'"**
- Edit SSH profile tersebut
- Pastikan **"Remote host"** dan **"Remote port"** sudah benar
- Cek apakah ada setting **"Initial directory"** yang mengubah working directory

### Langkah 5: Test dengan Path Alternatif

Jika masih error, coba path alternatif:

1. **Path dengan escape** (jika ada spasi atau karakter khusus):
   ```
   /home/foom/deployments/manufacturing-app/server/database.sqlite
   ```

2. **Path tanpa leading slash** (jika SSH working di home):
   ```
   deployments/manufacturing-app/server/database.sqlite
   ```
   (Tapi ini biasanya tidak bekerja untuk absolute path)

3. **Gunakan JDBC URL langsung**:
   - Pilih **"URL"** radio button
   - URL: `jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite`

## Troubleshooting Lanjutan

### Error: Database Locked
Jika database sedang digunakan oleh aplikasi Node.js:

```powershell
# Stop aplikasi di VPS
ssh foom@103.31.39.189 "pm2 stop manufacturing-app || pkill -f 'node.*index.js'"
```

Atau gunakan **read-only mode** di DBeaver:
- Tab **Driver properties**
- Tambahkan property: `readonly` = `true`

### Error: Permission Denied
```powershell
# Fix ownership dan permission
ssh foom@103.31.39.189 "sudo chown foom:foom ~/deployments/manufacturing-app/server/database.sqlite && chmod 644 ~/deployments/manufacturing-app/server/database.sqlite && chmod 755 ~/deployments/manufacturing-app/server"
```

### Verifikasi File Benar-Benar Ada
```powershell
ssh foom@103.31.39.189 "test -f ~/deployments/manufacturing-app/server/database.sqlite && echo 'File exists' || echo 'File NOT found'"
```

## Checklist

- [ ] Path di DBeaver lengkap: `/home/foom/deployments/manufacturing-app/server/database.sqlite`
- [ ] SSH Tunnel sudah di-test dan berhasil
- [ ] Permission file: `644` (readable)
- [ ] Permission directory: `755` (executable)
- [ ] Database tidak sedang locked oleh aplikasi lain
- [ ] JDBC URL menunjukkan path lengkap
- [ ] Tidak menggunakan Browse button, ketik manual

## Solusi Terakhir: Copy Database ke Lokasi Sederhana

Jika semua langkah di atas tidak bekerja:

```powershell
# Copy database ke home directory untuk testing
ssh foom@103.31.39.189 "cp ~/deployments/manufacturing-app/server/database.sqlite ~/test-db.sqlite && chmod 644 ~/test-db.sqlite"
```

Lalu di DBeaver gunakan path: `/home/foom/test-db.sqlite`

Jika ini berhasil, berarti masalahnya di path atau permission direktori `deployments/manufacturing-app/server`.

