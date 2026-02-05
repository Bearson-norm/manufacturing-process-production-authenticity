# Troubleshooting Odoo API Postman Collection

## 🔍 Masalah: API tidak bisa dijalankan di Postman, padahal dengan `npm run` bisa

### Kemungkinan Penyebab & Solusi

#### 1. ❌ Session ID Expired atau Tidak Valid

**Gejala:**
- Error: `Access Denied`
- Error: `401 Unauthorized`
- Response: `{"error": {"message": "Access Denied"}}`

**Penyebab:**
- Session ID Odoo sudah expired (biasanya setelah beberapa jam)
- Session ID tidak valid atau salah

**Solusi:**
1. Login ke Odoo di browser
2. Buka Developer Tools (F12)
3. Tab **Application** (Chrome) atau **Storage** (Firefox)
4. Klik **Cookies** > pilih domain Odoo Anda
5. Cari cookie `session_id`
6. Copy **Value** dari cookie tersebut
7. Update variable `odoo_session_id` di Postman collection

**Cara Update Variable:**
- Klik kanan collection → **Edit**
- Tab **Variables**
- Edit `odoo_session_id` dengan value baru
- Klik **Save**

---

#### 2. ❌ Cookie Header Format Salah

**Gejala:**
- Request berhasil tapi tidak ada data
- Error authentication

**Penyebab:**
- Format cookie header tidak sesuai dengan yang digunakan server

**Solusi:**
Collection sudah diperbaiki dengan format:
```
session_id={{odoo_session_id}}; session_id={{odoo_session_id}}
```

**Verifikasi:**
1. Buka request di Postman
2. Tab **Headers**
3. Pastikan Cookie header menggunakan format di atas

---

#### 3. ❌ Variable Tidak Ter-Set

**Gejala:**
- Error: Variable not found
- URL menjadi `{{odoo_base_url}}/web/...` (tidak ter-resolve)

**Penyebab:**
- Variable collection tidak di-set
- Variable environment tidak di-set

**Solusi:**

**A. Set Collection Variables:**
1. Klik kanan collection → **Edit**
2. Tab **Variables**
3. Set semua variable:
   - `odoo_base_url`: `https://foomx.odoo.com`
   - `odoo_session_id`: Session ID dari cookie Odoo
   - `start_date`: `2026-01-01 00:00:00`
   - `end_date`: `2026-01-31 23:59:59`

**B. Atau Set Environment Variables:**
1. Klik icon **Environments** di sidebar kiri
2. Create new environment atau pilih existing
3. Add variables dengan nama yang sama
4. Pilih environment di dropdown (kanan atas)

**C. Debug Variable:**
- Jalankan request **"0. Test Connection"**
- Lihat di **Console** (View → Show Postman Console)
- Akan muncul log variable yang ter-set

---

#### 4. ❌ URL Odoo Salah

**Gejala:**
- Error: `getaddrinfo EAI_AGAIN`
- Error: `Connection refused`
- Error: `404 Not Found`

**Penyebab:**
- URL Odoo tidak benar
- URL tidak accessible dari network Anda

**Solusi:**
1. Pastikan `odoo_base_url` benar:
   - Format: `https://foomx.odoo.com` (tanpa trailing slash)
   - Jangan pakai `http://` jika Odoo menggunakan HTTPS
   - Jangan tambahkan path seperti `/web` di base URL

2. Test koneksi:
   - Buka browser
   - Akses URL Odoo
   - Pastikan bisa diakses

3. Test di Postman:
   - Jalankan request **"0. Test Connection"**
   - Lihat response

---

#### 5. ❌ Format Tanggal Salah

**Gejala:**
- Response kosong padahal ada data
- Error parsing date

**Penyebab:**
- Format tanggal tidak sesuai yang diharapkan Odoo

**Solusi:**
Format yang benar: `YYYY-MM-DD HH:MM:SS`

**Contoh:**
- ✅ `2026-01-01 00:00:00`
- ✅ `2026-12-31 23:59:59`
- ❌ `01/01/2026` (salah)
- ❌ `2026-01-01` (tanpa waktu, mungkin OK tapi kurang spesifik)

**Cara Set:**
1. Edit collection variables
2. Set `start_date` dan `end_date` dengan format di atas

---

#### 6. ❌ Network/Firewall Issue

**Gejala:**
- Timeout
- Connection refused
- SSL/TLS error

**Penyebab:**
- Firewall memblokir request
- Proxy issue
- SSL certificate issue

**Solusi:**
1. **Disable SSL Verification (untuk testing saja):**
   - Settings → General
   - Disable "SSL certificate verification"
   - ⚠️ **Hanya untuk testing, jangan di production**

2. **Proxy Settings:**
   - Settings → Proxy
   - Configure sesuai network Anda

3. **Network:**
   - Pastikan bisa akses Odoo dari browser
   - Test dengan curl atau browser

---

## 🧪 Langkah Debugging Step-by-Step

### Step 1: Test Connection
1. Jalankan request **"0. Test Connection (No Filter)"**
2. Lihat response:
   - ✅ Jika berhasil → lanjut ke Step 2
   - ❌ Jika gagal → cek Session ID dan URL

### Step 2: Check Variables
1. Buka **Console** (View → Show Postman Console)
2. Jalankan request apapun
3. Lihat log di Console:
   ```
   === Pre-request Debug ===
   Odoo Base URL: https://foomx.odoo.com
   Odoo Session ID: bc6b1450c0cd3b05...
   Start Date: 2026-01-01 00:00:00
   End Date: 2026-01-31 23:59:59
   ```
4. Pastikan semua variable ter-set dengan benar

### Step 3: Check Request Details
1. Klik request
2. Tab **Headers** → pastikan Cookie header benar
3. Tab **Body** → pastikan JSON valid
4. Tab **Params** → pastikan tidak ada params yang salah

### Step 4: Check Response
1. Lihat **Status Code**:
   - `200` = OK
   - `401` = Unauthorized (Session ID salah)
   - `404` = Not Found (URL salah)
   - `500` = Server Error (Odoo error)

2. Lihat **Response Body**:
   - Jika ada `error` → baca pesan error
   - Jika ada `result` → cek apakah array kosong atau tidak

---

## 📋 Checklist Sebelum Request

- [ ] Variable `odoo_base_url` sudah di-set
- [ ] Variable `odoo_session_id` sudah di-set dan valid
- [ ] Variable `start_date` dan `end_date` sudah di-set dengan format benar
- [ ] Cookie header menggunakan format: `session_id={{odoo_session_id}}; session_id={{odoo_session_id}}`
- [ ] URL endpoint benar: `{{odoo_base_url}}/web/dataset/call_kw/mrp.production/search_read`
- [ ] Request method: **POST**
- [ ] Content-Type: `application/json`
- [ ] JSON body valid (bisa di-validate di Postman)

---

## 🔧 Perbandingan dengan Server Code

### Server Code (yang bekerja):
```javascript
const COOKIE_HEADER = `session_id=${config.sessionId}; session_id=${config.sessionId}`;
const ODOO_URL = `${config.odooBaseUrl}/web/dataset/call_kw/mrp.production/search_read`;

const requestData = {
  "jsonrpc": "2.0",
  "method": "call",
  "params": {
    "model": "mrp.production",
    "method": "search_read",
    "args": [[["create_date", ">=", startDateStr]]],
    "kwargs": {
      "fields": ["id", "name", "product_id", "product_qty", "note", "create_date"],
      "limit": 1000,
      "order": "create_date desc"
    }
  }
};
```

### Postman Collection (sudah disesuaikan):
- ✅ Cookie header: `session_id={{odoo_session_id}}; session_id={{odoo_session_id}}`
- ✅ URL: `{{odoo_base_url}}/web/dataset/call_kw/mrp.production/search_read`
- ✅ Method: POST
- ✅ Body: JSON dengan format yang sama

---

## 💡 Tips

1. **Selalu jalankan "0. Test Connection" dulu** sebelum request lain
2. **Gunakan Console** untuk melihat log dan debug
3. **Check Test Results** di tab Test untuk melihat error detail
4. **Session ID expire** → login ulang dan ambil session_id baru
5. **Jika masih error**, compare request di Postman dengan request yang berhasil di server (gunakan Network tab di browser)

---

## 🆘 Masih Tidak Bisa?

Jika setelah mengikuti semua langkah di atas masih tidak bisa:

1. **Copy request dari server yang berhasil:**
   - Buka Network tab di browser
   - Jalankan request dari aplikasi (npm run)
   - Copy request details (headers, body, URL)
   - Compare dengan Postman request

2. **Check server logs:**
   - Lihat log di terminal saat `npm run`
   - Bandingkan dengan error di Postman

3. **Test dengan curl:**
   ```bash
   curl -X POST "https://foomx.odoo.com/web/dataset/call_kw/mrp.production/search_read" \
     -H "Content-Type: application/json" \
     -H "Cookie: session_id=YOUR_SESSION_ID; session_id=YOUR_SESSION_ID" \
     -d '{
       "jsonrpc": "2.0",
       "method": "call",
       "params": {
         "model": "mrp.production",
         "method": "search_read",
         "args": [[]],
         "kwargs": {
           "fields": ["id", "name"],
           "limit": 5
         }
       }
     }'
   ```

4. **Share error details:**
   - Status code
   - Response body
   - Console logs
   - Request details (tanpa session_id)

---

**Last Updated:** 2026  
**Collection Version:** 1.1.0
