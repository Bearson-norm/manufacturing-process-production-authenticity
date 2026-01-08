# 🔧 Fix PostgreSQL scram-sha-256 Authentication

## 🎯 Masalah

PostgreSQL menggunakan `scram-sha-256` untuk authentication (bukan `md5`). Ini adalah metode yang lebih modern dan aman.

Dari `pg_hba.conf` Anda:
```
host    all             all             127.0.0.1/32            scram-sha-256
```

## ⚡ Solusi

### Step 1: Set Password dengan Benar

```bash
# Password akan otomatis di-hash dengan scram-sha-256
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"
```

### Step 2: Reload PostgreSQL

```bash
sudo systemctl reload postgresql
```

### Step 3: Test Connection

```bash
# Test dengan TCP/IP (scram-sha-256)
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"
```

## 🔄 Alternatif: Gunakan Unix Socket (Peer Auth)

Jika TCP/IP masih bermasalah, gunakan Unix socket dengan peer authentication (tidak perlu password):

### Update .env

```bash
cd ~/deployments/manufacturing-app/server
nano .env
```

Ubah:
```
DB_HOST=/var/run/postgresql
# atau
DB_HOST=
```

Atau jika menggunakan socket path:
```
DB_HOST=/var/run/postgresql/.s.PGSQL.5432
```

### Test Unix Socket Connection

```bash
# Test via postgres user dengan role switch
sudo -u postgres psql -d manufacturing_db << 'SQL'
    SET ROLE admin;
    SELECT current_user, current_database();
SQL
```

## 📋 Script Lengkap

```bash
cd ~/deployments/manufacturing-app/server

# Copy script dari git repo
cp /var/www/manufacturing-process-production-authenticity/server/fix-postgresql-scram.sh ./

# Run fix
sudo bash fix-postgresql-scram.sh
```

## 🔍 Troubleshooting

### Error: "password authentication failed"

1. **Pastikan password sudah di-set**:
   ```bash
   sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"
   ```

2. **Reload PostgreSQL**:
   ```bash
   sudo systemctl reload postgresql
   ```

3. **Cek password encryption method**:
   ```bash
   sudo -u postgres psql -c "SHOW password_encryption;"
   ```
   Harus return: `scram-sha-256`

4. **Cek user exists**:
   ```bash
   sudo -u postgres psql -c "\du admin"
   ```

### Jika Masih Gagal: Gunakan Unix Socket

Update `server/config.js` atau `.env` untuk menggunakan Unix socket:

```javascript
// Di config.js atau .env
DB_HOST: process.env.DB_HOST || '', // Empty = Unix socket
// atau
DB_HOST: '/var/run/postgresql',
```

Lalu di connection pool, tidak perlu password untuk peer auth:
```javascript
const pool = new Pool({
  host: config.database.host || undefined, // undefined = Unix socket
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  // password tidak diperlukan untuk peer auth
});
```

## ✅ Checklist

- [ ] Password sudah di-set: `ALTER USER admin WITH PASSWORD 'Admin123';`
- [ ] PostgreSQL sudah reload: `sudo systemctl reload postgresql`
- [ ] Test connection berhasil
- [ ] .env file sudah benar
- [ ] (Optional) Update ke Unix socket jika TCP/IP masih bermasalah

## 🎯 Quick Commands

```bash
# Fix password
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD 'Admin123';"

# Reload
sudo systemctl reload postgresql

# Test TCP/IP
PGPASSWORD=Admin123 psql -h localhost -U admin -d manufacturing_db -c "SELECT 1;"

# Test Unix socket
sudo -u postgres psql -d manufacturing_db -c "SET ROLE admin; SELECT 1;"
```

---

**Last Updated**: 2026-01-08
