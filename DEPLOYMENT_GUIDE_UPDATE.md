# 🚀 Panduan Deployment Update ke VPS

## 📝 Update ini Menambahkan:
1. **Manufacturing Report Dashboard** - Laporan hasil produksi per MO
2. **Production Statistics Chart** - Grafik statistik produksi per leader
3. **PIC Management System** - Manajemen data Person in Charge
4. **Fix Perhitungan Authenticity** - Perbaikan rumus dari `(last-first)+1` menjadi `(last-first)`
5. **Barcode Scanner Support** - Auto-advance input setelah scan
6. **Searchable Dropdowns** - Dropdown search untuk MO, SKU, dan PIC

---

## ⚠️ PENTING: Backup Dulu!

Sebelum update, **WAJIB** backup database:

```bash
ssh foom@103.31.39.189
cd ~/deployments/manufacturing-app/server
cp database.sqlite database.sqlite.backup-$(date +%Y%m%d-%H%M%S)
```

---

## 🔧 Step-by-Step Deployment

### 1️⃣ SSH ke VPS

```bash
ssh foom@103.31.39.189
```

### 2️⃣ Stop Services yang Berjalan

```bash
# Stop backend service
pm2 stop manufacturing-backend

# Check status
pm2 status
```

### 3️⃣ Navigate ke Folder Deployment

```bash
cd ~/deployments/manufacturing-app
```

### 4️⃣ Backup Database (Penting!)

```bash
cd server
cp database.sqlite database.sqlite.backup-$(date +%Y%m%d-%H%M%S)
cd ..
```

### 5️⃣ Pull Perubahan dari Git

```bash
git pull origin main
```

**Expected output:**
```
Updating beae0b9..66c1518
Fast-forward
 client/package-lock.json                        | ...
 client/package.json                             | ...
 client/src/App.js                               | ...
 client/src/components/Admin.js                  | ...
 client/src/components/Dashboard.js              | ...
 client/src/components/ProductionCartridge.js    | ...
 client/src/components/ProductionChart.css       | new file
 client/src/components/ProductionChart.js        | new file
 client/src/components/ProductionDevice.js       | ...
 client/src/components/ProductionLiquid.js       | ...
 client/src/components/ReportDashboard.css       | new file
 client/src/components/ReportDashboard.js        | new file
 server/index.js                                 | ...
 13 files changed, 3354 insertions(+), 36 deletions(-)
```

### 6️⃣ Install Dependencies Baru di Backend

```bash
cd server
npm install
```

> **Note:** Tidak ada dependency baru di backend, tapi untuk memastikan.

### 7️⃣ Install Dependencies Baru di Frontend

```bash
cd ../client
npm install
```

> **Important:** Update ini menambahkan `chart.js` dan `react-chartjs-2` untuk grafik.

### 8️⃣ Build Frontend

```bash
npm run build
```

**Expected output:**
```
Creating an optimized production build...
Compiled successfully.

File sizes after gzip:
  ...
  
The build folder is ready to be deployed.
```

### 9️⃣ Restart Backend Service

```bash
cd ..
pm2 restart manufacturing-backend
```

**Atau jika belum ada:**
```bash
cd server
pm2 start npm --name "manufacturing-backend" -- start
pm2 save
```

### 🔟 Restart Nginx (jika diperlukan)

```bash
sudo systemctl restart nginx
```

---

## ✅ Verification & Testing

### 1. Check PM2 Status
```bash
pm2 status
```

Pastikan `manufacturing-backend` berjalan dengan status `online`.

### 2. Check Backend Logs
```bash
pm2 logs manufacturing-backend --lines 50
```

Pastikan tidak ada error dan server berjalan di port yang benar.

### 3. Check Nginx Status
```bash
sudo systemctl status nginx
```

### 4. Test dari Browser

Buka browser dan akses:

#### A. Dashboard Utama
```
http://103.31.39.189
```
atau
```
http://your-domain.com
```

**Cek:**
- Card "Laporan Manufacturing" ada
- Card "Grafik Statistik Produksi" ada

#### B. Manufacturing Report
```
http://103.31.39.189/report-dashboard
```

**Cek:**
- Filter tanggal berfungsi
- Data MO muncul
- Perhitungan authenticity benar (last - first, tanpa +1)
- Net Result = Total Authenticity - Total Buffer - Total Reject

#### C. Production Chart
```
http://103.31.39.189/production-chart
```

**Cek:**
- Dropdown Leader muncul
- Filter Period (Day/Week/Month) berfungsi
- Filter Production Type (All/Liquid/Device/Cartridge) berfungsi
- Chart muncul dengan data

#### D. Production Input Forms
Cek di Production Liquid/Device/Cartridge:

**Cek:**
- Dropdown PIC muncul saat input authenticity
- Dropdown PIC muncul saat input buffer
- Dropdown PIC muncul saat input reject
- Barcode scanner auto-advance (scan lalu tekan Enter)

#### E. Admin Panel
```
http://103.31.39.189/admin
```

**Cek:**
- Section "PIC (Person in Charge) Management" ada
- Bisa add/edit/delete PIC
- Status Active/Inactive berfungsi

### 5. Test Database Migration

Database akan otomatis membuat tabel baru `pic_list` saat pertama kali server dijalankan.

**Verify:**
```bash
cd ~/deployments/manufacturing-app/server
sqlite3 database.sqlite
```

```sql
-- Check tabel pic_list ada
.tables

-- Check struktur tabel
.schema pic_list

-- Check data (should be empty first time)
SELECT * FROM pic_list;

-- Exit
.quit
```

---

## 📊 New Database Schema

### Tabel Baru: `pic_list`

```sql
CREATE TABLE pic_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pic_list_active ON pic_list(is_active);
CREATE INDEX idx_pic_list_name ON pic_list(name);
```

---

## 🔥 Troubleshooting

### Problem 1: Frontend tidak menampilkan chart

**Solusi:**
```bash
cd ~/deployments/manufacturing-app/client
npm install chart.js react-chartjs-2
npm run build
```

### Problem 2: Error "Cannot find module 'chart.js'"

**Solusi:**
```bash
cd ~/deployments/manufacturing-app/client
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem 3: PIC dropdown kosong

**Solusi:**
1. Masuk ke Admin Panel
2. Tambahkan data PIC secara manual
3. Atau import PIC via API/database

### Problem 4: Backend tidak start

**Check logs:**
```bash
pm2 logs manufacturing-backend --lines 100
```

**Restart:**
```bash
cd ~/deployments/manufacturing-app/server
pm2 delete manufacturing-backend
pm2 start npm --name "manufacturing-backend" -- start
pm2 save
```

### Problem 5: Perhitungan masih salah (5001 instead of 5000)

**Pastikan:**
1. Sudah pull latest code
2. Sudah restart backend
3. Clear browser cache (Ctrl+Shift+R)

---

## 🔄 Rollback Plan

Jika terjadi masalah dan ingin kembali ke versi sebelumnya:

### 1. Stop Service
```bash
pm2 stop manufacturing-backend
```

### 2. Rollback Git
```bash
cd ~/deployments/manufacturing-app
git log --oneline  # Cek commit sebelumnya
git checkout beae0b9  # Commit hash sebelum update
```

### 3. Restore Database (jika diperlukan)
```bash
cd server
# List backups
ls -lh database.sqlite.backup-*

# Restore
cp database.sqlite.backup-YYYYMMDD-HHMMSS database.sqlite
```

### 4. Reinstall Dependencies
```bash
cd ../client
npm install
npm run build

cd ../server
npm install
```

### 5. Restart Service
```bash
pm2 restart manufacturing-backend
```

---

## 📌 Post-Deployment Tasks

### 1. Populate PIC Data

Masuk ke Admin Panel dan tambahkan semua PIC:

```
Puput Wijanarko
Adhari Wijaya
Qurotul Aini
Fita Estikasari
Dela Wahyu Handayani
Thania Novelia Suseno
Astikaria Nababan
Yati Sumiati
Faliq Humam Zulian
Pria Nanda Pratama
Rendy Join Prayoga Hutapea
Rizqi Mahendra
Muhammad Irfan Perdinan
Ahmad Buseri
Ilyas Safiq
Ganjar Ferdianto
Martunis Hidayatulloh
Selly Juniar Andriyani
Irma Anggraeni
Evi Dwi Setiani
Siti Sopiah
Dede Mustika Alawiah
Diah Ayu Novianti
Anisa Putri Ramadani
Ahmad Ari Ripa'i
Andre Romadoni
Dwi Nova Safitri
Sahroni
Niken Susanti
Ubedilah
Aulia Rachma Putri
Zimam Mulhakam
Yuliyanti Putri Pratiwi
Meitya Rifai Yusnah
Nurhadi
Bagas Prasetya
Hendra Azwar Eka Saputra
Rini Rokhimah
Iin Silpiana Dewi
Muhammad Abdul Halim
Ahmad Muhaimin
Sharani Noor padilah
Iin Rofizah
Frisca Nurjannah
Windi Nur Azizah
Muhammad Ilham
Jonathan Claudio P
Teguh Santoso
Adi Ardiansyah
Widi Dwi Gita
Nurul Amelia
Dini Milati
Sofhie Angellita
Annisa Rahmawati
Dessy Indriyani
Suhendra Jaya Kusuma
Ardani
Rohiah
Novita Astriani
Nurul Khofiduriah
Galing Resdianto
Nurbaiti
Andri Mulyadi
Tiaruli Nababan
Indadari Windrayanti
Muhammad Apandi
Vini Claras Anatasyia
Siti Mahidah
Rusnia Ningsih
Randy Virmansyah
Silvia Fransiska
Armah Wati
Euis Santi
Hermawan
Linda Haryati
Aditya Rachman
Calvin Lama Tokan
Norris Samuel Silaban
Dora Nopinda
Vita Lativa
Nur Azizah
Devi Yanti
Ita Purnamasari
Rizky Septian
Laila Arifatul Hilmi
Erfild Ardi Mahardika
Hanun Dhiya Imtiaz
Mayang Puspitaningrum
Hikmatul Iman
Muhammad Tedi Al Bukhori
Mahardika
Sevira Yunita Andini
Gista Nadia
Parjiyanti
Rifki Maulana Rafif
Sri hoviya
Amanda Tifara
Laras Wati
Dwi Setia Putri
Putri Bela Savira
Siti Hasanah
Farhan Rizky Wahyudi
Adam Rizki
Tomi Wijaya
Syahrizal
Sherly Triananda Lisa
Henry Daniarto
Sindy Yusnia
Inka Purnama Sari
Larasati
Muhamad Hojaji Muslim
Sopiyana
Yuyun
```

### 2. Train Users

Latih user tentang fitur baru:
- Cara menggunakan Manufacturing Report
- Cara membaca Production Chart
- Cara memilih PIC saat input
- Cara scan barcode

### 3. Monitor Performance

```bash
# Check CPU/Memory usage
pm2 monit

# Check logs
pm2 logs manufacturing-backend

# Check database size
cd ~/deployments/manufacturing-app/server
ls -lh database.sqlite
```

---

## 📞 Support

Jika ada masalah, hubungi:
- Developer: [Your Contact]
- Dokumentasi: `VPS_UPDATE_GUIDE.md`

---

## ✨ Summary

**What's New:**
✅ Manufacturing Report Dashboard  
✅ Production Statistics Chart  
✅ PIC Management System  
✅ Fixed Authenticity Calculation  
✅ Barcode Scanner Support  
✅ Searchable Dropdowns  

**Database Changes:**
✅ New table: `pic_list`  
✅ Auto-migration on first run  

**Dependencies Added:**
✅ chart.js  
✅ react-chartjs-2  

---

**Deployment Date:** {{ Insert date here }}  
**Version:** {{ Insert version here }}  
**Status:** ✅ Ready to Deploy

