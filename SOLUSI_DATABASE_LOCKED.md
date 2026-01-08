# Solusi: Database Locked oleh Node.js

## Masalah
Database sedang digunakan oleh aplikasi Node.js yang berjalan:
- PID: 482328
- PID: 482343

SQLite tidak bisa dibuka untuk **write access** jika sudah dibuka oleh proses lain.

## Solusi 1: Gunakan Read-Only Mode di DBeaver (REKOMENDASI)

Ini adalah solusi terbaik karena tidak akan mengganggu aplikasi production yang sedang berjalan.

### Langkah-langkah:

1. **Di DBeaver Connection Settings**:
   - Tab **Driver properties**
   - Klik **"Add"** atau tombol **"+"** untuk menambah property baru
   - **Property name**: `readonly`
   - **Property value**: `true`
   - Klik **OK**

2. **Pastikan Path sudah benar**:
   - Tab **Main**
   - Field **Path**: `/home/foom/deployments/manufacturing-app/server/database.sqlite`
   - JDBC URL: `jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite`

3. **Test Connection**:
   - Klik **"Test Connection"**
   - Seharusnya berhasil dengan read-only mode

### Keuntungan Read-Only Mode:
- ✅ Tidak mengganggu aplikasi production
- ✅ Aman untuk melihat data
- ✅ Tidak akan menyebabkan conflict
- ✅ Bisa melihat data real-time

### Keterbatasan Read-Only Mode:
- ❌ Tidak bisa melakukan INSERT, UPDATE, DELETE
- ❌ Tidak bisa mengubah struktur database
- ✅ Masih bisa melakukan SELECT (query data)

## Solusi 2: Stop Aplikasi Node.js (Hanya untuk Maintenance)

**PERINGATAN**: Ini akan menghentikan aplikasi production. Hanya lakukan jika:
- Anda perlu melakukan perubahan database
- Aplikasi sedang dalam maintenance window
- Anda punya akses untuk restart aplikasi

### Langkah-langkah:

1. **Stop aplikasi Node.js**:
   ```bash
   # Jika menggunakan PM2
   ssh foom@103.31.39.189 "pm2 stop manufacturing-app"
   
   # Atau jika menggunakan systemd
   ssh foom@103.31.39.189 "sudo systemctl stop manufacturing-app"
   
   # Atau kill process langsung (tidak direkomendasikan untuk production)
   ssh foom@103.31.39.189 "kill 482328 482343"
   ```

2. **Verifikasi database tidak lagi locked**:
   ```bash
   ssh foom@103.31.39.189 "lsof ~/deployments/manufacturing-app/server/database.sqlite 2>/dev/null || echo 'Database not locked'"
   ```

3. **Test Connection di DBeaver**:
   - Hapus property `readonly` jika sudah ditambahkan
   - Test connection
   - Seharusnya berhasil

4. **Setelah selesai, restart aplikasi**:
   ```bash
   # Jika menggunakan PM2
   ssh foom@103.31.39.189 "pm2 start manufacturing-app"
   
   # Atau jika menggunakan systemd
   ssh foom@103.31.39.189 "sudo systemctl start manufacturing-app"
   ```

## Solusi 3: Copy Database untuk Editing (Alternatif)

Jika Anda perlu melakukan perubahan tanpa mengganggu production:

1. **Copy database ke lokasi lain**:
   ```bash
   ssh foom@103.31.39.189 "cp ~/deployments/manufacturing-app/server/database.sqlite ~/database-backup.sqlite"
   ```

2. **Koneksi ke backup database di DBeaver**:
   - Buat connection baru
   - Path: `/home/foom/database-backup.sqlite`
   - Lakukan perubahan yang diperlukan

3. **Setelah selesai, copy kembali** (HATI-HATI!):
   ```bash
   # Backup database production dulu!
   ssh foom@103.31.39.189 "cp ~/deployments/manufacturing-app/server/database.sqlite ~/database-production-backup-$(date +%Y%m%d-%H%M%S).sqlite"
   
   # Stop aplikasi
   ssh foom@103.31.39.189 "pm2 stop manufacturing-app"
   
   # Copy database yang sudah diubah
   ssh foom@103.31.39.189 "cp ~/database-backup.sqlite ~/deployments/manufacturing-app/server/database.sqlite"
   
   # Restart aplikasi
   ssh foom@103.31.39.189 "pm2 start manufacturing-app"
   ```

## Rekomendasi

Untuk penggunaan sehari-hari, **gunakan Solusi 1 (Read-Only Mode)** karena:
- Aman untuk production
- Tidak mengganggu aplikasi
- Cukup untuk melihat dan menganalisis data
- Real-time data access

Hanya gunakan Solusi 2 atau 3 jika Anda benar-benar perlu melakukan perubahan database.

## Checklist Final

Setelah setup read-only mode:

- [ ] Property `readonly` = `true` sudah ditambahkan di Driver properties
- [ ] Path: `/home/foom/deployments/manufacturing-app/server/database.sqlite`
- [ ] SSH Tunnel sudah connected
- [ ] Test Connection berhasil
- [ ] Bisa melakukan SELECT query
- [ ] Aplikasi production tetap berjalan normal

---

**Catatan**: Dengan read-only mode, Anda masih bisa melihat semua data dan melakukan query, hanya tidak bisa melakukan perubahan. Ini adalah mode yang aman untuk production database.

