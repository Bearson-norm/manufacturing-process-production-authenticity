# 🔐 API Key Authentication Setup Guide

Panduan lengkap untuk setup dan menggunakan API Key Authentication pada Manufacturing Process Production Authenticity System.

## 📋 Daftar Isi

1. [Overview](#overview)
2. [Generate API Key](#generate-api-key)
3. [Menggunakan API Key](#menggunakan-api-key)
4. [Security Best Practices](#security-best-practices)
5. [Troubleshooting](#troubleshooting)

---

## 📖 Overview

API Key Authentication adalah fitur keamanan untuk melindungi external API endpoints dari akses yang tidak sah. Fitur ini:

- ✅ **Optional**: Jika API key belum dikonfigurasi, endpoint masih bisa diakses (backward compatibility)
- ✅ **Secure**: API key di-generate menggunakan cryptographic random (64 karakter hex)
- ✅ **Flexible**: Dapat di-generate dan di-regenerate kapan saja melalui Admin panel
- ✅ **Masked Display**: API key yang ditampilkan di Admin panel adalah versi masked untuk keamanan

### Endpoint yang Dilindungi

Semua endpoint external API dapat dilindungi dengan API key:
- `GET /api/external/authenticity`
- `POST /api/external/authenticity`
- `GET /api/external/manufacturing-data`
- `GET /api/external/manufacturing-data/status`

---

## 🔑 Generate API Key

### Via Admin Panel (Recommended)

1. **Login ke Admin Panel**
   - Buka aplikasi di browser
   - Login dengan credentials: `production` / `production123`

2. **Buka Halaman Admin**
   - Klik menu "Admin" di sidebar
   - Scroll ke bagian "API Key Authentication"

3. **Generate API Key**
   - Klik tombol "Generate API Key"
   - Konfirmasi dialog yang muncul
   - **PENTING**: API key akan ditampilkan hanya sekali saat di-generate
   - Copy API key ke clipboard menggunakan tombol "Copy to Clipboard"
   - Simpan API key di tempat yang aman

4. **Verifikasi**
   - Setelah generate, status akan berubah menjadi "✅ API Key sudah dikonfigurasi"
   - Masked API key akan ditampilkan (hanya 8 karakter terakhir yang terlihat)

### Via API Endpoint

```bash
curl -X POST http://localhost:1234/api/admin/generate-api-key
```

Response:
```json
{
  "success": true,
  "message": "API key generated successfully",
  "apiKey": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2",
  "warning": "Please save this API key securely. It will not be shown again."
}
```

---

## 🔌 Menggunakan API Key

### Option 1: Menggunakan Header `X-API-Key` (Recommended)

```bash
curl -H "X-API-Key: your_api_key_here" \
  "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
```

### Option 2: Menggunakan Header `Authorization` (Bearer Token)

```bash
curl -H "Authorization: Bearer your_api_key_here" \
  "http://localhost:1234/api/external/manufacturing-data?mo_number=PROD/MO/28246&completed_at=all"
```

### Contoh dengan JavaScript/Axios

```javascript
const axios = require('axios');

async function getManufacturingData(moNumber, apiKey) {
  try {
    const response = await axios.get('http://localhost:1234/api/external/manufacturing-data', {
      params: {
        mo_number: moNumber,
        completed_at: 'all'
      },
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    console.log('Data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage
getManufacturingData('PROD/MO/28246', 'your_api_key_here');
```

### Contoh dengan Python/Requests

```python
import requests

api_key = "your_api_key_here"
url = "http://localhost:1234/api/external/manufacturing-data"
params = {
    "mo_number": "PROD/MO/28246",
    "completed_at": "all"
}
headers = {
    "X-API-Key": api_key
}

response = requests.get(url, params=params, headers=headers)
print(response.json())
```

---

## 🔒 Security Best Practices

### 1. Simpan API Key dengan Aman

- ✅ **Jangan commit API key ke Git**
- ✅ **Gunakan environment variables** untuk menyimpan API key di production
- ✅ **Jangan share API key** melalui email atau chat yang tidak aman
- ✅ **Rotate API key secara berkala** (generate API key baru setiap 3-6 bulan)

### 2. Regenerate API Key jika Terkompromi

Jika API key terkompromi atau hilang:

1. Login ke Admin panel
2. Klik tombol "Regenerate API Key"
3. Simpan API key baru
4. Update semua aplikasi/client yang menggunakan API key lama

### 3. Monitor API Usage

- Monitor log server untuk melihat penggunaan API key
- Check untuk aktivitas mencurigakan
- Set up alert jika ada banyak request yang gagal

### 4. Production Recommendations

Untuk production environment:

- ✅ **Selalu konfigurasi API key** (jangan biarkan endpoint tanpa autentikasi)
- ✅ **Gunakan HTTPS** untuk semua komunikasi API
- ✅ **Implement rate limiting** untuk mencegah abuse
- ✅ **Log semua API access** untuk audit trail

---

## 🐛 Troubleshooting

### Problem: API key tidak bekerja

**Solution:**
1. Pastikan API key sudah dikonfigurasi di Admin panel
2. Pastikan API key yang digunakan benar (copy-paste untuk menghindari typo)
3. Pastikan header `X-API-Key` atau `Authorization` dikirim dengan benar
4. Check log server untuk melihat error detail

### Problem: Error 401 "API key is required"

**Solution:**
- Pastikan header `X-API-Key` atau `Authorization: Bearer <key>` dikirim dengan request
- Pastikan API key sudah dikonfigurasi di Admin panel

### Problem: Error 403 "Invalid API key"

**Solution:**
- Pastikan API key yang digunakan benar
- Pastikan tidak ada spasi atau karakter tambahan saat copy-paste
- Generate API key baru jika perlu

### Problem: API key hilang

**Solution:**
1. Login ke Admin panel
2. Klik tombol "Regenerate API Key"
3. Simpan API key baru
4. Update semua aplikasi/client yang menggunakan API key

### Problem: Endpoint masih bisa diakses tanpa API key

**Solution:**
- Ini adalah behavior normal jika API key belum dikonfigurasi (backward compatibility)
- Untuk mengaktifkan authentication, generate API key di Admin panel
- Setelah API key dikonfigurasi, semua request harus menyertakan API key yang valid

---

## 📚 Related Documentation

- `API_DOCUMENTATION.md` - Dokumentasi lengkap semua API endpoints
- `VPS_UPDATE_GUIDE.md` - Panduan update sistem ke VPS
- `SECURITY_RECOMMENDATIONS.md` - Rekomendasi security improvements

---

## ✅ Checklist Setup

- [ ] Generate API key di Admin panel
- [ ] Simpan API key di tempat yang aman
- [ ] Test API endpoint dengan API key
- [ ] Test API endpoint tanpa API key (harus error jika sudah dikonfigurasi)
- [ ] Update semua aplikasi/client yang menggunakan API
- [ ] Dokumentasikan API key untuk team
- [ ] Setup monitoring untuk API usage

---

**🔐 Security First!** Selalu jaga kerahasiaan API key Anda.
