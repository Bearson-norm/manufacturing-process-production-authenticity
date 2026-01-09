-- Script untuk menambahkan user IT FOOM ke database manufacturing_db
-- Jalankan dengan: sudo -u postgres psql -f add-user-it-foom.sql

-- Buat user baru (atau update jika sudah ada)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'it_foom') THEN
        ALTER USER it_foom WITH PASSWORD 'FOOMIT';
        RAISE NOTICE 'User it_foom already exists, password updated';
    ELSE
        CREATE USER it_foom WITH PASSWORD 'FOOMIT';
        RAISE NOTICE 'User it_foom created';
    END IF;
END
$$;

-- Berikan hak akses ke database
GRANT ALL PRIVILEGES ON DATABASE manufacturing_db TO it_foom;

-- Connect ke database dan berikan hak akses
\c manufacturing_db

-- Hak akses schema
GRANT ALL ON SCHEMA public TO it_foom;

-- Hak akses tabel yang sudah ada
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO it_foom;

-- Hak akses sequences yang sudah ada
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO it_foom;

-- Hak akses default untuk objek yang akan dibuat di masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO it_foom;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO it_foom;

-- Verifikasi
SELECT 
    'User created successfully' as status,
    'it_foom' as username,
    'manufacturing_db' as database;
