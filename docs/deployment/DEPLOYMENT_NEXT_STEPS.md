# 🚀 Next Steps: Lanjutkan Deployment

Setelah PostgreSQL sudah fix, ikuti langkah-langkah berikut untuk menyelesaikan deployment.

---

## ⚡ Quick Start (Step-by-Step)

### Step 1: Setup .env File di VPS

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Pastikan .env ada
    if [ ! -f .env ]; then
        cp env.example .env
    fi
    
    # Update DB_PORT ke 5433 (PENTING!)
    sed -i 's/^DB_PORT=.*/DB_PORT=5433/' .env || echo "DB_PORT=5433" >> .env
    
    # Verify
    echo "=== Current .env DB Settings ==="
    grep "^DB_" .env
ENDSSH
```

### Step 2: Test PostgreSQL Connection

```bash
ssh foom@103.31.39.189 "PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c 'SELECT current_user, current_database();'"
```

Harus return user dan database name.

### Step 3: Stop Aplikasi (Jika Masih Running)

```bash
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && pm2 stop manufacturing-app || true"
```

### Step 4: Run Migration Database

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Pastikan .env sudah benar
    echo "DB_PORT=5433" >> .env
    
    # Run migration
    echo "Running database migration..."
    node migrate-to-postgresql.js
    
    echo ""
    echo "Verifying migration..."
    node check-data.js || echo "Check script not found, skipping..."
ENDSSH
```

### Step 5: Build Client (Frontend)

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/client
    
    # Install dependencies
    npm install
    
    # Build untuk production
    npm run build
    
    echo "✅ Client built successfully"
ENDSSH
```

### Step 6: Start Aplikasi

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Start atau restart dengan PM2
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Show status
    pm2 status
ENDSSH
```

### Step 7: Verifikasi

```bash
# Test health endpoint
ssh foom@103.31.39.189 "curl http://localhost:1234/health"

# Atau dari luar
curl http://103.31.39.189:1234/health
```

Harus return:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## 📊 Verifikasi Lengkap

### 1. Cek PM2 Status

```bash
ssh foom@103.31.39.189 "pm2 status"
```

Harus menunjukkan `manufacturing-app` dengan status `online`.

### 2. Cek Logs

```bash
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 30"
```

Pastikan tidak ada error terkait database.

### 3. Test Database Connection

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    cd ~/deployments/manufacturing-app/server
    
    # Test dengan script
    node test-postgresql-connection.js || {
        echo "Script not found, testing manually..."
        PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
    }
ENDSSH
```

### 4. Cek Data Migration

```bash
ssh foom@103.31.39.189 << 'ENDSSH'
    PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db << 'SQL'
        SELECT 'production_liquid' as table_name, COUNT(*) as count FROM production_liquid
        UNION ALL
        SELECT 'production_device', COUNT(*) FROM production_device
        UNION ALL
        SELECT 'production_cartridge', COUNT(*) FROM production_cartridge;
SQL
ENDSSH
```

### 5. Test API Endpoints

```bash
# Health check
curl http://103.31.39.189:1234/health

# Test login (jika sudah ada)
curl -X POST http://103.31.39.189:1234/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

---

## 🎯 All-in-One Deployment Script

Jika Anda sudah update code dan ingin deploy lengkap:

### Dari Komputer Lokal

```bash
# Deploy dari git repository
./deploy-from-git.sh

# Atau deploy langsung dari lokal
./deploy-to-vps.sh
```

**PENTING**: Script deployment sudah include migrasi, tapi pastikan `.env` sudah benar dengan `DB_PORT=5433`.

---

## ✅ Checklist Final

- [ ] .env file sudah dikonfigurasi (DB_PORT=5433)
- [ ] PostgreSQL connection test berhasil
- [ ] Migration database berhasil tanpa error
- [ ] Data ter-verifikasi di PostgreSQL
- [ ] Client (frontend) sudah di-build
- [ ] Aplikasi running dengan PM2
- [ ] Health endpoint return "healthy"
- [ ] API endpoints berfungsi
- [ ] Frontend accessible

---

## 🆘 Troubleshooting

### Migration Error

```bash
# Cek apakah SQLite database ada
ssh foom@103.31.39.189 "ls -la ~/deployments/manufacturing-app/server/database.sqlite"

# Run migration lagi
ssh foom@103.31.39.189 "cd ~/deployments/manufacturing-app/server && node migrate-to-postgresql.js"
```

### Application Won't Start

```bash
# Cek logs
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --lines 100"

# Cek error specific
ssh foom@103.31.39.189 "pm2 logs manufacturing-app --err --lines 50"
```

### Database Connection Error

```bash
# Test connection manual
ssh foom@103.31.39.189 "PGPASSWORD=Admin123 psql -h localhost -p 5433 -U admin -d manufacturing_db -c 'SELECT 1;'"

# Cek .env
ssh foom@103.31.39.189 "cat ~/deployments/manufacturing-app/server/.env | grep DB_"
```

---

## 🎉 Setelah Deployment Berhasil

1. **Monitor aplikasi** selama beberapa jam pertama
2. **Cek logs** secara berkala: `pm2 logs manufacturing-app`
3. **Backup PostgreSQL** secara berkala
4. **Test semua fitur** di frontend

---

**Last Updated**: 2026-01-08  
**Status**: ✅ Ready to Deploy
