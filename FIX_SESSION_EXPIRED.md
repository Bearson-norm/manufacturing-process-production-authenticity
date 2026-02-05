# 🔴 Fix: Odoo Session Expired

## Error yang Anda Dapatkan

```json
{
    "jsonrpc": "2.0",
    "id": null,
    "error": {
        "code": 100,
        "message": "Odoo Session Expired",
        "data": {
            "name": "odoo.http.SessionExpiredException",
            "message": "Session expired"
        }
    }
}
```

## ✅ Solusi Cepat (2 Cara)

### Cara 1: Login Otomatis via Postman (RECOMMENDED)

**Langkah-langkah:**

1. **Set Variable untuk Login:**
   - Buka collection → Edit → Variables
   - Set variable berikut:
     - `odoo_database`: Nama database Odoo Anda (biasanya sama dengan nama company)
     - `odoo_username`: Username untuk login
     - `odoo_password`: Password untuk login

2. **Jalankan Request Login:**
   - Buka request: **"🔐 Login to Odoo (Get Session ID)"**
   - Klik **Send**
   - Session ID akan **otomatis tersimpan** di variable `odoo_session_id`

3. **Gunakan Request Lain:**
   - Setelah login berhasil, langsung bisa menggunakan request lain
   - Session ID sudah ter-update otomatis

**Keuntungan:**
- ✅ Otomatis, tidak perlu manual copy-paste
- ✅ Cepat dan mudah
- ✅ Session ID langsung ter-update

---

### Cara 2: Login Manual via Browser

**Langkah-langkah:**

1. **Login ke Odoo di Browser:**
   - Buka browser
   - Akses URL Odoo Anda (misal: `https://foomx.odoo.com`)
   - Login dengan username dan password

2. **Ambil Session ID dari Cookie:**
   - Tekan **F12** untuk buka Developer Tools
   - Tab **Application** (Chrome) atau **Storage** (Firefox)
   - Klik **Cookies** → pilih domain Odoo Anda
   - Cari cookie dengan nama `session_id`
   - Copy **Value** dari cookie tersebut

3. **Update Variable di Postman:**
   - Buka collection → Edit → Variables
   - Edit variable `odoo_session_id`
   - Paste session ID yang sudah di-copy
   - Klik **Save**

4. **Test:**
   - Jalankan request **"0. Test Connection"**
   - Pastikan berhasil

---

## 📋 Detail Error Session Expired

### Penyebab:
- Session ID Odoo memiliki **expiration time** (biasanya beberapa jam)
- Setelah expired, semua request akan ditolak dengan error "Session expired"
- Session ID yang lama tidak bisa digunakan lagi

### Kapan Terjadi:
- Setelah beberapa jam tidak menggunakan API
- Setelah restart Odoo server
- Setelah logout dari Odoo
- Setelah session timeout

### Solusi:
- **Login ulang** untuk mendapatkan session ID baru
- Update variable `odoo_session_id` dengan session ID baru

---

## 🔧 Cara Menggunakan Request Login

### Step 1: Set Variable Login

Edit collection variables:

| Variable | Contoh Value | Deskripsi |
|----------|--------------|-----------|
| `odoo_database` | `foomx` | Nama database Odoo |
| `odoo_username` | `admin` | Username untuk login |
| `odoo_password` | `your_password` | Password untuk login |

**Cara Set:**
1. Klik kanan collection → **Edit**
2. Tab **Variables**
3. Edit value untuk `odoo_database`, `odoo_username`, dan `odoo_password`
4. Klik **Save**

### Step 2: Jalankan Request Login

1. Buka request: **"🔐 Login to Odoo (Get Session ID)"**
2. Klik **Send**
3. Lihat response:
   - ✅ **Success**: Session ID otomatis tersimpan
   - ❌ **Error**: Cek username/password/database

### Step 3: Verify Session ID

1. Buka **Console** (View → Show Postman Console)
2. Lihat log:
   ```
   ✅ Session ID extracted and saved: bc6b1450c0cd3b05...
   ```
3. Atau cek variable:
   - Collection → Edit → Variables
   - Lihat value `odoo_session_id` sudah ter-update

### Step 4: Test Connection

1. Jalankan request **"0. Test Connection"**
2. Jika berhasil → ✅ Session ID valid
3. Jika masih error → Ulangi Step 1-3

---

## 🚨 Troubleshooting Login

### Error: "Invalid credentials"

**Penyebab:**
- Username atau password salah
- Database name salah

**Solusi:**
1. Pastikan `odoo_username` dan `odoo_password` benar
2. Pastikan `odoo_database` sesuai dengan database Odoo Anda
3. Test login di browser dulu untuk memastikan credentials benar

---

### Error: "Database not found"

**Penyebab:**
- Nama database tidak sesuai

**Solusi:**
1. Cek nama database di Odoo
2. Biasanya sama dengan nama company
3. Atau tanya admin Odoo untuk nama database yang benar

---

### Session ID Tidak Tersimpan Otomatis

**Penyebab:**
- Set-Cookie header tidak ada di response
- Format cookie berbeda

**Solusi:**
1. Lihat response di Postman
2. Cek apakah ada `Set-Cookie` header
3. Jika tidak ada, gunakan **Cara 2** (login manual via browser)
4. Atau extract session ID manual dari response body

---

## 💡 Tips

1. **Simpan Credentials dengan Aman:**
   - Jangan commit password ke repository
   - Gunakan environment variables untuk production
   - Rotate password secara berkala

2. **Auto-Login Sebelum Request:**
   - Bisa setup pre-request script untuk auto-login jika session expired
   - Tapi lebih baik manual untuk security

3. **Monitor Session Expiry:**
   - Session biasanya expire setelah 2-4 jam
   - Jika sering expired, pertimbangkan untuk extend session timeout di Odoo

4. **Gunakan Environment Variables:**
   - Buat environment untuk development dan production
   - Set credentials per environment
   - Lebih aman dan mudah manage

---

## 📝 Contoh Workflow

### Workflow Normal:

```
1. Set variables (odoo_database, odoo_username, odoo_password)
   ↓
2. Jalankan "🔐 Login to Odoo"
   ↓
3. Session ID otomatis tersimpan
   ↓
4. Jalankan request lain (Get MO, dll)
   ↓
5. Jika dapat error "Session expired" → kembali ke step 2
```

### Workflow dengan Auto-Detection:

```
1. Jalankan request apapun
   ↓
2. Jika dapat error "Session expired"
   ↓
3. Console akan menampilkan pesan untuk login
   ↓
4. Jalankan "🔐 Login to Odoo"
   ↓
5. Ulangi request yang gagal
```

---

## 🔐 Security Notes

⚠️ **PENTING:**
- Jangan share session ID ke orang lain
- Session ID memberikan akses penuh ke Odoo
- Jangan commit session ID ke repository
- Gunakan environment variables untuk credentials
- Rotate password secara berkala

---

## 📞 Masih Error?

Jika setelah login masih error:

1. **Cek Console Log:**
   - Lihat error detail di Postman Console
   - Copy error message

2. **Test di Browser:**
   - Login ke Odoo di browser
   - Pastikan bisa login
   - Ambil session ID dari cookie

3. **Compare Request:**
   - Compare request login di Postman dengan request yang berhasil di browser
   - Pastikan format sama

4. **Check Odoo Settings:**
   - Pastikan Odoo API enabled
   - Pastikan user memiliki permission untuk API access

---

**Last Updated:** 2026  
**Collection Version:** 1.2.0
