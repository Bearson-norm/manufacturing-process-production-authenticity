# Query Debugging untuk MO yang Diselesaikan

## 1. Cek Apakah Ada Data dengan Status 'completed'

```sql
-- Cek di production_liquid
SELECT COUNT(*) as total_completed_liquid 
FROM production_liquid 
WHERE status = 'completed';

-- Cek di production_device
SELECT COUNT(*) as total_completed_device 
FROM production_device 
WHERE status = 'completed';

-- Cek di production_cartridge
SELECT COUNT(*) as total_completed_cartridge 
FROM production_cartridge 
WHERE status = 'completed';
```

## 2. Cek Format Status yang Ada di Database

```sql
-- Cek semua nilai status yang unik di production_liquid
SELECT DISTINCT status, COUNT(*) as count 
FROM production_liquid 
GROUP BY status;

-- Cek semua nilai status yang unik di production_device
SELECT DISTINCT status, COUNT(*) as count 
FROM production_device 
GROUP BY status;

-- Cek semua nilai status yang unik di production_cartridge
SELECT DISTINCT status, COUNT(*) as count 
FROM production_cartridge 
GROUP BY status;
```

## 3. Cek Data dengan completed_at yang Tidak NULL

```sql
-- Cek di production_liquid
SELECT COUNT(*) as total_with_completed_at 
FROM production_liquid 
WHERE completed_at IS NOT NULL;

-- Lihat beberapa contoh data dengan completed_at
SELECT mo_number, status, completed_at, created_at 
FROM production_liquid 
WHERE completed_at IS NOT NULL 
LIMIT 10;
```

## 4. Cek Format Tanggal completed_at

```sql
-- Lihat format tanggal yang ada
SELECT 
    mo_number, 
    status, 
    completed_at,
    DATE(completed_at) as date_only,
    strftime('%Y-%m-%d', completed_at) as formatted_date
FROM production_liquid 
WHERE completed_at IS NOT NULL 
LIMIT 10;
```

## 5. Cek MO yang Diselesaikan (Tanpa Filter Tanggal)

```sql
-- Semua MO completed di production_liquid
SELECT mo_number, status, completed_at, created_at 
FROM production_liquid 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL
ORDER BY completed_at DESC 
LIMIT 20;
```

## 6. Cek MO yang Diselesaikan Hari Ini

```sql
-- Gunakan tanggal hari ini (ganti dengan tanggal yang sesuai)
SELECT mo_number, status, completed_at, created_at 
FROM production_liquid 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL
  AND DATE(completed_at) = DATE('now')
ORDER BY completed_at DESC;
```

## 7. Cek MO yang Diselesaikan dalam Range Tanggal

```sql
-- Cek MO yang diselesaikan dalam 7 hari terakhir
SELECT 
    mo_number, 
    status, 
    completed_at,
    DATE(completed_at) as completion_date
FROM production_liquid 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL
  AND DATE(completed_at) >= DATE('now', '-7 days')
ORDER BY completed_at DESC;
```

## 8. Query Lengkap dengan Semua Tabel (Versi Debug)

```sql
-- Query dengan semua tabel dan lihat hasilnya
SELECT 
    'liquid' as production_type,
    mo_number, 
    status, 
    completed_at,
    DATE(completed_at) as completion_date
FROM production_liquid 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL

UNION ALL

SELECT 
    'device' as production_type,
    mo_number, 
    status, 
    completed_at,
    DATE(completed_at) as completion_date
FROM production_device 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL

UNION ALL

SELECT 
    'cartridge' as production_type,
    mo_number, 
    status, 
    completed_at,
    DATE(completed_at) as completion_date
FROM production_cartridge 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL

ORDER BY completed_at DESC
LIMIT 50;
```

## 9. Cek Apakah Ada Data dengan Status Lain (Case Sensitive)

```sql
-- Cek dengan case insensitive
SELECT mo_number, status, completed_at 
FROM production_liquid 
WHERE LOWER(status) = 'completed' 
  AND completed_at IS NOT NULL
LIMIT 10;
```

## 10. Query untuk Mendapatkan MO yang Diselesaikan pada Tanggal Tertentu (Versi Alternatif)

```sql
-- Menggunakan strftime untuk format tanggal
SELECT 
    mo_number, 
    status, 
    completed_at,
    strftime('%Y-%m-%d', completed_at) as completion_date
FROM production_liquid 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL
  AND strftime('%Y-%m-%d', completed_at) = '2024-01-15'
ORDER BY completed_at ASC, mo_number ASC;
```

## Tips:

1. **Jalankan query #1 dan #2** untuk melihat apakah ada data dengan status 'completed'
2. **Jalankan query #3** untuk melihat apakah ada data dengan completed_at yang terisi
3. **Jalankan query #5** untuk melihat semua MO yang completed tanpa filter tanggal
4. Jika tidak ada hasil, kemungkinan:
   - Belum ada MO yang di-mark sebagai 'completed'
   - Kolom completed_at masih NULL
   - Format status berbeda (misalnya 'Completed' dengan huruf besar)

