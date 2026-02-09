# Langkah Manual Setup Database Staging_Manufacturing_Order

## Opsi 1: Menggunakan Superuser PostgreSQL (postgres)

```bash
# Login sebagai superuser postgres
sudo -u postgres psql -p 5433

# Atau jika sudah ada password untuk postgres
psql -h localhost -p 5433 -U postgres -d postgres
```

Kemudian jalankan perintah berikut di psql:

```sql
-- 1. Buat database
CREATE DATABASE "Staging_Manufacturing_Order";

-- 2. Grant privileges ke user admin
GRANT ALL PRIVILEGES ON DATABASE "Staging_Manufacturing_Order" TO "admin";

-- 3. Connect ke database yang baru dibuat
\c "Staging_Manufacturing_Order"

-- 4. Grant privileges pada schema public
GRANT ALL ON SCHEMA public TO "admin";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "admin";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "admin";

-- 5. Keluar dari psql
\q
```

## Opsi 2: Menggunakan Command Line Langsung

```bash
# Set password untuk postgres (jika diperlukan)
export PGPASSWORD="password_postgres_anda"

# Buat database menggunakan superuser
psql -h localhost -p 5433 -U postgres -d postgres -c 'CREATE DATABASE "Staging_Manufacturing_Order";'

# Grant privileges ke admin
psql -h localhost -p 5433 -U postgres -d postgres -c 'GRANT ALL PRIVILEGES ON DATABASE "Staging_Manufacturing_Order" TO "admin";'

# Grant schema privileges
psql -h localhost -p 5433 -U postgres -d "Staging_Manufacturing_Order" -c 'GRANT ALL ON SCHEMA public TO "admin";'
psql -h localhost -p 5433 -U postgres -d "Staging_Manufacturing_Order" -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "admin";'
psql -h localhost -p 5433 -U postgres -d "Staging_Manufacturing_Order" -c 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "admin";'

# Verifikasi dengan user admin
export PGPASSWORD="Admin123"
psql -h localhost -p 5433 -U admin -d "Staging_Manufacturing_Order" -c 'SELECT current_database(), current_user;'
```

## Opsi 3: Memberikan Permission CREATE DATABASE ke User Admin

Jika Anda ingin user `admin` bisa membuat database sendiri:

```bash
# Login sebagai superuser
sudo -u postgres psql -p 5433

# Atau
psql -h localhost -p 5433 -U postgres -d postgres
```

Kemudian:

```sql
-- Berikan permission CREATEDB ke user admin
ALTER USER "admin" CREATEDB;

-- Keluar
\q
```

Setelah itu, script setup-staging-database.sh bisa dijalankan dengan user admin.
