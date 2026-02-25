# Quick Fix: Error "Unable to open the database file" di DBeaver

## Solusi Cepat (5 Menit)

### Langkah 1: Dapatkan Path yang Benar dari VPS

Jalankan perintah berikut di terminal lokal Anda (PowerShell/CMD):

```bash
ssh foom@ProductionDashboard "realpath ~/deployments/manufacturing-app/server/database.sqlite"
```

**Copy output path yang muncul** (contoh: `/home/foom/deployments/manufacturing-app/server/database.sqlite`)

### Langkah 2: Perbaiki Permission (Jika Perlu)

```bash
ssh foom@ProductionDashboard "chmod 644 ~/deployments/manufacturing-app/server/database.sqlite && chmod 755 ~/deployments/manufacturing-app/server"
```

### Langkah 3: Update Path di DBeaver

1. Buka DBeaver
2. Klik kanan pada connection → **Edit Connection**
3. Pastikan tab **SSH** sudah di-test dan berhasil
4. Klik tab **Main** (atau **General**)
5. Di field **Database Path**:
   - **Hapus semua path yang ada**
   - **Paste path yang didapat dari Langkah 1** (path dari `realpath` command)
   - **JANGAN gunakan Browse button**, ketik manual
6. Klik **Test Connection**

### Langkah 4: Jika Masih Error - Cek Home Directory

Mungkin home directory bukan `/home/foom`. Cek dengan:

```bash
ssh foom@ProductionDashboard "echo \$HOME"
```

Jika output bukan `/home/foom`, gunakan path sesuai output tersebut.

Contoh:
- Jika output: `/var/home/foom`
- Maka path: `/var/home/foom/deployments/manufacturing-app/server/database.sqlite`

## Alternatif: Gunakan Script Verifikasi

1. Upload `verify-database-path.sh` ke VPS:
   ```bash
   scp verify-database-path.sh foom@ProductionDashboard:~/
   ```

2. Jalankan di VPS:
   ```bash
   ssh foom@ProductionDashboard "bash ~/verify-database-path.sh"
   ```

3. Script akan memberikan path yang benar untuk digunakan di DBeaver

## Troubleshooting Tambahan

### Error: Path dengan `~` tidak bekerja
- **Jangan gunakan `~`** di DBeaver
- Gunakan **absolute path** yang lengkap (dari `/` sampai filename)

### Error: Permission denied
- Pastikan user `foom` adalah owner file:
  ```bash
  ssh foom@ProductionDashboard "ls -la ~/deployments/manufacturing-app/server/database.sqlite"
  ```
- Jika owner bukan `foom`, ubah dengan:
  ```bash
  ssh foom@ProductionDashboard "sudo chown foom:foom ~/deployments/manufacturing-app/server/database.sqlite"
  ```

### Error: Database locked
- Database sedang digunakan oleh aplikasi Node.js
- Stop aplikasi terlebih dahulu, atau gunakan read-only mode di DBeaver

## Path yang Harus Dicoba (Berurutan)

1. Path dari `realpath` command (paling akurat)
2. `/home/foom/deployments/manufacturing-app/server/database.sqlite`
3. Path sesuai `$HOME` + `/deployments/manufacturing-app/server/database.sqlite`
4. Path tanpa leading slash: `deployments/manufacturing-app/server/database.sqlite` (jika SSH working directory di home)

## Tips Penting

✅ **DO:**
- Gunakan absolute path lengkap
- Test SSH tunnel terlebih dahulu
- Ketik path manual (jangan Browse)
- Gunakan path dari `realpath` command

❌ **DON'T:**
- Jangan gunakan `~` atau relative path
- Jangan gunakan Browse button
- Jangan skip test SSH tunnel

---

**Jika masih error setelah semua langkah di atas, jalankan script verifikasi dan share output-nya untuk troubleshooting lebih lanjut.**

