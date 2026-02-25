# Fix: Path DBeaver Masih Relatif

## Masalah dari Screenshot

Field "Path" di DBeaver masih menunjukkan:
```
/deployments/manufacturing-app/server/database.sqlite
```

Ini adalah **path relatif** yang salah. Seharusnya adalah **absolute path**:
```
/home/foom/deployments/manufacturing-app/server/database.sqlite
```

## Solusi Langkah-per-Langkah

### Langkah 1: Focus ke Field Path

1. Di DBeaver Connection Settings
2. Tab **Main** (Anda sudah berada di tab ini)
3. Lihat field **"Path:"** (di bawah JDBC URL)
4. **Klik di dalam field Path tersebut**

### Langkah 2: Hapus Path yang Ada

1. **Select all** text di field Path:
   - Tekan `Ctrl + A` untuk select semua
   - Atau triple-click untuk select semua
   - Atau manual drag dari awal sampai akhir

2. **Delete** semua text yang terselect:
   - Tekan `Delete` atau `Backspace`
   - Pastikan field **kosong**

### Langkah 3: Ketik Path yang Benar

**Ketik manual** (JANGAN copy-paste dari field lain, JANGAN gunakan Browse):

```
/home/foom/deployments/manufacturing-app/server/database.sqlite
```

**PENTING**: 
- Path harus dimulai dengan `/home/foom/`
- JANGAN dimulai hanya dengan `/deployments/`
- JANGAN gunakan `~` (tilde)

### Langkah 4: Verifikasi Path

Setelah ketik, pastikan field "Path" menunjukkan:
```
/home/foom/deployments/manufacturing-app/server/database.sqlite
```

**BUKAN**:
- ❌ `/deployments/manufacturing-app/server/database.sqlite`
- ❌ `~/deployments/manufacturing-app/server/database.sqlite`
- ❌ `deployments/manufacturing-app/server/database.sqlite`

### Langkah 5: Test Connection

1. Klik tombol **"Test Connection ..."** di bagian bawah
2. Tunggu beberapa detik
3. Seharusnya muncul dialog "Connected!" atau "Success"

## Checklist Sebelum Test Connection

- [ ] Aplikasi manufacturing-app sudah stopped (PM2 stopped)
- [ ] Database tidak locked (verified dengan lsof)
- [ ] Field "Path" berisi: `/home/foom/deployments/manufacturing-app/server/database.sqlite`
- [ ] Path dimulai dengan `/home/foom/` (BUKAN `/deployments/`)
- [ ] SSH Tunnel masih connected
- [ ] Read-only property sudah dihapus (jika ingin write access)

## Jika Masih Error

Jika setelah langkah di atas masih error, coba:

### Opsi A: Gunakan Mode URL

1. Pilih radio button **"URL"** (bukan "Host")
2. Di field JDBC URL, pastikan berisi:
   ```
   jdbc:sqlite:/home/foom/deployments/manufacturing-app/server/database.sqlite
   ```
3. **Kosongkan** field "Path" (biarkan kosong)
4. Test Connection

### Opsi B: Cek Permission Lagi

Pastikan file bisa dibaca dan ditulis:

```powershell
# Cek permission
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server/database.sqlite"

# Fix permission untuk read-write
ssh foom@103.31.39.189 "chmod 644 ~/deployments/manufacturing-app/server/database.sqlite"
```

### Opsi C: Test dengan File Database Lain

Untuk memastikan masalahnya bukan di DBeaver atau SSH:

```powershell
# Copy database ke home directory
ssh foom@103.31.39.189 "cp ~/deployments/manufacturing-app/server/database.sqlite ~/test-connection.sqlite && chmod 644 ~/test-connection.sqlite"
```

Di DBeaver, coba koneksi dengan path sederhana:
```
/home/foom/test-connection.sqlite
```

Jika ini berhasil, berarti masalahnya di path atau permission direktori `deployments/manufacturing-app/server/`.

## Screenshot untuk Verifikasi

Setelah mengubah path, field "Path" di DBeaver harus terlihat seperti ini:

```
Path: /home/foom/deployments/manufacturing-app/server/database.sqlite
```

BUKAN seperti ini:
```
Path: /deployments/manufacturing-app/server/database.sqlite
```

---

**Kunci masalahnya**: Path harus **absolute** dan dimulai dengan `/home/foom/`, bukan path relatif yang dimulai dengan `/deployments/`.

