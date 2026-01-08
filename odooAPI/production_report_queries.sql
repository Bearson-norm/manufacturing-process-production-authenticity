-- ===================================================
-- QUERY PRODUCTION REPORT
-- Mendapatkan data: PIC Input, SKU, MO ID, Roll, First Authenticity ID, Last Authenticity ID
-- ===================================================

-- 1. Query untuk Production Liquid
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    created_at as 'Created At'
FROM production_liquid
WHERE status = 'active'  -- atau 'completed' untuk data yang sudah selesai
ORDER BY created_at DESC;

-- 2. Query untuk Production Device
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    created_at as 'Created At'
FROM production_device
WHERE status = 'active'
ORDER BY created_at DESC;

-- 3. Query untuk Production Cartridge
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    created_at as 'Created At'
FROM production_cartridge
WHERE status = 'active'
ORDER BY created_at DESC;

-- 4. Query untuk SEMUA Production Types (UNION)
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'liquid' as 'Production Type',
    created_at as 'Created At'
FROM production_liquid
WHERE status = 'active'

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'device' as 'Production Type',
    created_at as 'Created At'
FROM production_device
WHERE status = 'active'

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'cartridge' as 'Production Type',
    created_at as 'Created At'
FROM production_cartridge
WHERE status = 'active'

ORDER BY 'Created At' DESC;

-- ===================================================
-- QUERY DENGAN FILTER
-- ===================================================

-- 5. Filter berdasarkan MO Number
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'liquid' as 'Production Type',
    created_at as 'Created At'
FROM production_liquid
WHERE mo_number = 'MO001'  -- Ganti dengan MO Number yang diinginkan

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'device' as 'Production Type',
    created_at as 'Created At'
FROM production_device
WHERE mo_number = 'MO001'

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'cartridge' as 'Production Type',
    created_at as 'Created At'
FROM production_cartridge
WHERE mo_number = 'MO001'

ORDER BY 'Created At' DESC;

-- 6. Filter berdasarkan PIC Name
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'liquid' as 'Production Type',
    created_at as 'Created At'
FROM production_liquid
WHERE pic LIKE '%Puput%'  -- Ganti dengan nama PIC yang diinginkan

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'device' as 'Production Type',
    created_at as 'Created At'
FROM production_device
WHERE pic LIKE '%Puput%'

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'cartridge' as 'Production Type',
    created_at as 'Created At'
FROM production_cartridge
WHERE pic LIKE '%Puput%'

ORDER BY 'Created At' DESC;

-- 7. Filter berdasarkan Tanggal (Range)
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'liquid' as 'Production Type',
    created_at as 'Created At'
FROM production_liquid
WHERE date(created_at) BETWEEN '2025-01-01' AND '2025-01-31'

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'device' as 'Production Type',
    created_at as 'Created At'
FROM production_device
WHERE date(created_at) BETWEEN '2025-01-01' AND '2025-01-31'

UNION ALL

SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    'cartridge' as 'Production Type',
    created_at as 'Created At'
FROM production_cartridge
WHERE date(created_at) BETWEEN '2025-01-01' AND '2025-01-31'

ORDER BY 'Created At' DESC;

-- ===================================================
-- QUERY AGGREGATE (GROUP BY MO Number)
-- ===================================================

-- 8. Aggregate: Jumlah Roll per MO Number (Liquid)
SELECT 
    mo_number as 'MO ID',
    sku_name as 'SKU',
    COUNT(*) as 'Total Rolls',
    MIN(json_extract(authenticity_data, '$[0].firstAuthenticity')) as 'Min First ID',
    MAX(json_extract(authenticity_data, '$[0].lastAuthenticity')) as 'Max Last ID',
    GROUP_CONCAT(DISTINCT pic) as 'PIC List'
FROM production_liquid
WHERE status = 'active'
GROUP BY mo_number, sku_name
ORDER BY mo_number;

-- 9. Aggregate: Summary per PIC
SELECT 
    pic as 'PIC Input',
    COUNT(DISTINCT mo_number) as 'Total MO',
    COUNT(*) as 'Total Rolls',
    'liquid' as 'Production Type'
FROM production_liquid
WHERE status = 'active'
GROUP BY pic

UNION ALL

SELECT 
    pic as 'PIC Input',
    COUNT(DISTINCT mo_number) as 'Total MO',
    COUNT(*) as 'Total Rolls',
    'device' as 'Production Type'
FROM production_device
WHERE status = 'active'
GROUP BY pic

UNION ALL

SELECT 
    pic as 'PIC Input',
    COUNT(DISTINCT mo_number) as 'Total MO',
    COUNT(*) as 'Total Rolls',
    'cartridge' as 'Production Type'
FROM production_cartridge
WHERE status = 'active'
GROUP BY pic

ORDER BY 'PIC Input';

-- ===================================================
-- QUERY DENGAN DETAIL TAMBAHAN
-- ===================================================

-- 10. Detail Lengkap dengan Session Info
SELECT 
    pic as 'PIC Input',
    sku_name as 'SKU',
    mo_number as 'MO ID',
    json_extract(authenticity_data, '$[0].rollNumber') as 'Roll',
    json_extract(authenticity_data, '$[0].firstAuthenticity') as 'First Authenticity ID',
    json_extract(authenticity_data, '$[0].lastAuthenticity') as 'Last Authenticity ID',
    leader_name as 'Leader',
    shift_number as 'Shift',
    status as 'Status',
    created_at as 'Created At',
    completed_at as 'Completed At'
FROM production_liquid
ORDER BY created_at DESC;


