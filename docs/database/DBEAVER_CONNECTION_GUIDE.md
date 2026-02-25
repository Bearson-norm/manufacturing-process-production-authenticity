# 🗄️ Panduan Koneksi DBeaver ke PostgreSQL

Panduan lengkap untuk mengkonfigurasi DBeaver agar bisa terhubung ke database `manufacturing_db` dengan user `it_foom`.

## 📋 Informasi Koneksi

```
Host: localhost (jika di VPS) atau ProductionDashboard (jika dari remote)
Port: 5433 ⚠️ PENTING: Bukan 5432!
Database: manufacturing_db
Username: it_foom
Password: FOOMIT
```

---

## 🚀 Setup DBeaver (Langkah demi Langkah)

### Step 1: Buat Koneksi Baru

1. Buka DBeaver
2. Klik **Database** → **New Database Connection** (atau icon + di toolbar)
3. Pilih **PostgreSQL**
4. Klik **Next**

### Step 2: Konfigurasi Main Settings

**Main Tab:**
- **Host:** `localhost` (jika DBeaver di VPS) atau `ProductionDashboard` / `103.31.39.189` (jika dari remote)
- **Port:** `5433` ⚠️ **SANGAT PENTING: Jangan gunakan 5432!**
- **Database:** `manufacturing_db`
- **Username:** `it_foom`
- **Password:** `FOOMIT`
- **Save password:** ✓ (centang untuk menyimpan password)

### Step 3: Driver Properties (PENTING!)

Klik tab **Driver Properties** dan tambahkan/edit properties berikut:

```
connectTimeout=30
socketTimeout=60
loginTimeout=30
tcpKeepAlive=true
```

**Cara menambahkan:**
1. Klik **Add** di bagian Driver Properties
2. Property: `connectTimeout`, Value: `30`
3. Ulangi untuk properties lainnya

### Step 4: SSH Tunnel (Jika Connect dari Remote)

Jika Anda connect dari komputer lain (bukan di VPS), gunakan SSH tunnel:

1. Klik tab **SSH**
2. Centang **Use SSH Tunnel**
3. Isi:
   ```
   Host: ProductionDashboard (atau 103.31.39.189)
   Port: 22
   User Name: foom
   Authentication Method: Password atau Public Key
   Password: (password SSH Anda)
   ```
4. **Local Port:** biarkan kosong (auto)
5. **Remote Host:** `localhost`
6. **Remote Port:** `5433`

### Step 5: Advanced Settings

Klik **Edit Driver Settings** (icon gear di pojok kanan):

**Connection Settings:**
- **Connection timeout:** `30` atau `60` detik
- **Keep-alive query:** `SELECT 1`
- **Auto-commit:** ✓ (centang)

**Network Settings:**
- **TCP keep-alive:** ✓ (centang)
- **TCP keep-alive interval:** `60` detik

### Step 6: Test Connection

1. Klik **Test Connection**
2. Jika driver belum ada, DBeaver akan download driver PostgreSQL
3. Tunggu hingga selesai
4. Jika berhasil, akan muncul "Connected"

### Step 7: Save Connection

1. Klik **Finish**
2. Connection akan tersimpan di Database Navigator

---

## 🆘 Troubleshooting DBeaver

### Error: "connection was aborted by the software in your host machine"

**Solusi 1: Cek Port**
```bash
# Pastikan port 5433 benar
# Di DBeaver, pastikan Port = 5433, bukan 5432
```

**Solusi 2: Tingkatkan Timeout**
1. Di DBeaver: Edit connection → Driver Properties
2. Set `connectTimeout=60` dan `socketTimeout=120`
3. Test lagi

**Solusi 3: Gunakan SSH Tunnel**
Jika connect dari remote, pastikan menggunakan SSH tunnel:
1. Enable SSH Tunnel di tab SSH
2. Isi SSH credentials dengan benar
3. Remote port harus `5433`

**Solusi 4: Cek PostgreSQL Listen Address**
```bash
# SSH ke VPS
ssh foom@ProductionDashboard

# Cek listen address
sudo -u postgres psql -c "SHOW listen_addresses;"

# Jika hanya 'localhost', dan Anda connect dari remote:
# ⚠️ HATI-HATI: Ini akan expose PostgreSQL ke network!
sudo -u postgres psql -c "ALTER SYSTEM SET listen_addresses = '*';"
sudo systemctl restart postgresql

# Pastikan firewall aktif!
sudo ufw status
```

**Solusi 5: Test dengan psql**
```bash
# Test dari komputer yang sama dengan DBeaver
PGPASSWORD=FOOMIT psql -h ProductionDashboard -p 5433 -U it_foom -d manufacturing_db -c "SELECT 1;"
```

**Solusi 6: Gunakan Connection String**
Di DBeaver, coba gunakan connection string langsung:
1. Edit connection
2. Di tab **Main**, klik **JDBC URL** (toggle)
3. Gunakan URL:
   ```
   jdbc:postgresql://localhost:5433/manufacturing_db?user=it_foom&password=FOOMIT&connectTimeout=30&socketTimeout=60&tcpKeepAlive=true
   ```

**Solusi 7: Cek DBeaver Logs**
1. Di DBeaver: **Help** → **View Log**
2. Cari error terkait connection
3. Copy error message untuk analisis

**Solusi 8: Update PostgreSQL Driver**
1. Di DBeaver: **Database** → **Driver Manager**
2. Pilih **PostgreSQL**
3. Klik **Edit**
4. Update ke versi terbaru
5. Test connection lagi

**Solusi 9: Restart DBeaver**
Tutup dan buka kembali DBeaver, lalu test connection lagi.

**Solusi 10: Cek Network Connectivity**
```bash
# Dari komputer yang menjalankan DBeaver
telnet ProductionDashboard 5433
# atau
nc -zv ProductionDashboard 5433

# Jika gagal, berarti ada masalah network/firewall
```

---

## 🔧 Konfigurasi Lanjutan

### Connection Pooling

Untuk performa lebih baik, enable connection pooling:

1. Edit connection
2. Tab **Connection Settings**
3. **Connection pool:**
   - **Min connections:** `2`
   - **Max connections:** `10`
   - **Connection timeout:** `30`

### SSL Connection (Opsional)

Jika ingin menggunakan SSL:

1. Edit connection
2. Tab **SSL**
3. Enable SSL jika diperlukan
4. Untuk localhost biasanya tidak perlu SSL

---

## ✅ Checklist Setup

Setelah setup, pastikan:

- [ ] Host: `localhost` atau `ProductionDashboard`
- [ ] Port: `5433` (bukan 5432!)
- [ ] Database: `manufacturing_db`
- [ ] Username: `it_foom`
- [ ] Password: `FOOMIT`
- [ ] Driver Properties: `connectTimeout=30`, `socketTimeout=60`
- [ ] SSH Tunnel enabled (jika connect dari remote)
- [ ] Test connection berhasil
- [ ] Bisa query data: `SELECT COUNT(*) FROM production_liquid;`

---

## 📝 Contoh Query Test

Setelah berhasil connect, test dengan query berikut:

```sql
-- Test 1: Cek user dan database
SELECT current_user, current_database();

-- Test 2: Cek jumlah data
SELECT COUNT(*) FROM production_liquid;

-- Test 3: Cek privileges
SELECT table_name, privilege_type 
FROM information_schema.table_privileges 
WHERE grantee = 'it_foom' 
LIMIT 10;
```

---

## 🔐 Keamanan

**Best Practices:**

1. **Jangan expose PostgreSQL ke internet tanpa firewall**
   - Gunakan SSH tunnel untuk remote access
   - Atau gunakan VPN

2. **Gunakan password yang kuat**
   - Password `FOOMIT` sudah cukup untuk development
   - Untuk production, pertimbangkan password yang lebih kuat

3. **Limit access**
   - Hanya berikan akses ke user yang memerlukan
   - Monitor active connections

4. **Backup credentials**
   - Simpan credentials dengan aman
   - Jangan commit password ke repository

---

## 📚 Referensi

- [DBeaver Documentation](https://dbeaver.com/docs/)
- [PostgreSQL JDBC Driver Documentation](https://jdbc.postgresql.org/documentation/)
- [PostgreSQL Connection String Parameters](https://jdbc.postgresql.org/documentation/head/connect.html)

---

**Dibuat untuk:** User `it_foom`  
**Database:** `manufacturing_db`  
**Port:** `5433`
