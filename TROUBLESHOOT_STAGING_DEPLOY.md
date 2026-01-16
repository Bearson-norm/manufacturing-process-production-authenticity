# 🔍 Troubleshooting Staging Deployment

Panduan untuk troubleshoot masalah staging deployment, khususnya jika PM2 process tidak muncul setelah deployment.

## 🐛 Problem: PM2 Process Tidak Muncul Setelah Deploy

Jika deployment sudah selesai tapi `pm2 status` tidak menunjukkan `manufacturing-app-staging`:

### Step 1: Check GitHub Actions Logs

1. Buka repository di GitHub
2. Klik tab **Actions**
3. Pilih workflow run yang terakhir
4. Expand job **deploy-staging**
5. Cari section **"Execute staging deployment script on VPS"**
6. Check apakah ada error message

**Cari error messages seperti:**
- `❌ ERROR: Server directory not found`
- `❌ ERROR: index.js not found`
- `❌ ERROR: PM2 process 'manufacturing-app-staging' NOT found!`

### Step 2: Manual Check di VPS

SSH ke VPS dan check manual:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Check directory exists
ls -la /home/foom/deployments/manufacturing-app-staging/
ls -la /home/foom/deployments/manufacturing-app-staging/server/

# Check if index.js exists
ls -la /home/foom/deployments/manufacturing-app-staging/server/index.js

# Check .env file
cat /home/foom/deployments/manufacturing-app-staging/server/.env

# Check PM2 status
pm2 status

# Check PM2 logs (jika process ada tapi error)
pm2 logs manufacturing-app-staging --lines 50
```

### Step 3: Manual Start untuk Testing

Coba start manual untuk melihat error:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Go to staging server directory
cd /home/foom/deployments/manufacturing-app-staging/server

# Check if all dependencies installed
ls -la node_modules/ | head -20

# Try to start manually (to see errors)
NODE_ENV=staging PORT=5678 node index.js

# If error, check what's missing
# If OK, stop it (Ctrl+C) and try with PM2
```

### Step 4: Manual PM2 Start

Jika manual start berhasil, coba start dengan PM2:

```bash
# SSH ke VPS
ssh foom@103.31.39.189

cd /home/foom/deployments/manufacturing-app-staging/server

# Delete existing process if any
pm2 delete manufacturing-app-staging || true

# Start with PM2
pm2 start index.js --name manufacturing-app-staging --instances 1 --cwd /home/foom/deployments/manufacturing-app-staging/server

# Check status
pm2 status

# Check logs
pm2 logs manufacturing-app-staging --lines 50

# Save PM2 config
pm2 save
```

### Step 5: Common Issues & Solutions

#### Issue 1: Directory Tidak Ada

**Symptom:**
```
❌ ERROR: Server directory not found in /home/foom/deployments/manufacturing-app-staging
```

**Solution:**
```bash
ssh foom@103.31.39.189
cd /home/foom/deployments
ls -la
# Check if deploy.tar.gz exists and extract manually if needed
tar -xzf deploy.tar.gz
ls -la deploy/
```

#### Issue 2: index.js Tidak Ada

**Symptom:**
```
❌ ERROR: index.js not found in /home/foom/deployments/manufacturing-app-staging/server
```

**Solution:**
```bash
ssh foom@103.31.39.189
cd /home/foom/deployments/manufacturing-app-staging/server
ls -la
# Check what files are there
# If index.js missing, check backup or re-deploy
```

#### Issue 3: Dependencies Tidak Terinstall

**Symptom:** PM2 process crash immediately, error di logs tentang missing module

**Solution:**
```bash
ssh foom@103.31.39.189
cd /home/foom/deployments/manufacturing-app-staging/server

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --production

# Try start again
pm2 restart manufacturing-app-staging
```

#### Issue 4: Port Already in Use

**Symptom:** PM2 start gagal karena port 5678 sudah digunakan

**Solution:**
```bash
ssh foom@103.31.39.189

# Check what's using port 5678
sudo netstat -tlnp | grep 5678

# If something else using it, stop it or change staging port
# Or kill the process
sudo kill -9 <PID>

# Then restart PM2
pm2 restart manufacturing-app-staging
```

#### Issue 5: Database Connection Error

**Symptom:** PM2 process running tapi health check gagal, logs show database error

**Solution:**
```bash
ssh foom@103.31.39.189
cd /home/foom/deployments/manufacturing-app-staging/server

# Check .env file
cat .env

# Verify database exists
sudo -u postgres psql -c "\l" | grep staging

# If database doesn't exist, create it
sudo -u postgres psql -c "CREATE DATABASE manufacturing_db_staging;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE manufacturing_db_staging TO manufacturing_user;"

# Restart PM2
pm2 restart manufacturing-app-staging
```

#### Issue 6: Permission Issues

**Symptom:** PM2 can't read files or write logs

**Solution:**
```bash
ssh foom@103.31.39.189

# Check ownership
ls -la /home/foom/deployments/manufacturing-app-staging/server/

# Fix ownership if needed
sudo chown -R foom:foom /home/foom/deployments/manufacturing-app-staging/

# Check PM2 user
pm2 info manufacturing-app-staging
```

### Step 6: Check Deployment Files Structure

Verify file structure is correct:

```bash
ssh foom@103.31.39.189
cd /home/foom/deployments/manufacturing-app-staging

# Expected structure:
# manufacturing-app-staging/
#   ├── server/
#   │   ├── index.js
#   │   ├── package.json
#   │   ├── node_modules/
#   │   ├── .env
#   │   └── logs/
#   └── client-build/
#       └── (React build files)

tree -L 2 /home/foom/deployments/manufacturing-app-staging/ || find /home/foom/deployments/manufacturing-app-staging/ -maxdepth 2
```

### Step 7: Check PM2 Logs

```bash
ssh foom@103.31.39.189

# Check if process exists but crashed
pm2 list

# Check logs for errors
pm2 logs manufacturing-app-staging --lines 100

# Check PM2 error logs
cat ~/.pm2/logs/manufacturing-app-staging-error.log

# Check PM2 out logs
cat ~/.pm2/logs/manufacturing-app-staging-out.log
```

### Step 8: Re-run Deployment

Jika semua manual checks berhasil, tapi PM2 process tidak ada, mungkin ada issue dengan workflow. Coba:

1. **Re-run workflow dari GitHub Actions:**
   - Buka Actions tab
   - Pilih workflow run yang gagal
   - Klik "Re-run all jobs"

2. **Or trigger manual workflow:**
   - Buka Actions tab
   - Pilih "Deploy to Staging" workflow
   - Klik "Run workflow"
   - Pilih branch `staging`
   - Run workflow

### Step 9: Verify PM2 is Working

```bash
ssh foom@103.31.39.189

# Check PM2 is installed and working
pm2 --version

# Check PM2 processes
pm2 list

# Check if staging process is there
pm2 describe manufacturing-app-staging

# Check PM2 startup script
pm2 startup
```

### Step 10: Check System Resources

```bash
ssh foom@103.31.39.189

# Check disk space
df -h

# Check memory
free -h

# Check CPU
top -bn1 | head -20

# If low resources, might affect PM2 startup
```

## 🔧 Quick Fix Script

Jika Anda ingin quick fix, jalankan script ini di VPS:

```bash
#!/bin/bash
# Quick fix for staging PM2 process

STAGING_DIR="/home/foom/deployments/manufacturing-app-staging"
STAGING_PORT=5678

echo "🔍 Checking staging deployment..."

# Check directory
if [ ! -d "$STAGING_DIR/server" ]; then
    echo "❌ ERROR: Server directory not found!"
    exit 1
fi

cd "$STAGING_DIR/server"

# Check index.js
if [ ! -f "index.js" ]; then
    echo "❌ ERROR: index.js not found!"
    exit 1
fi

# Check .env
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
NODE_ENV=staging
PORT=$STAGING_PORT
DB_HOST=localhost
DB_PORT=5433
DB_NAME=manufacturing_db_staging
DB_USER=manufacturing_user
EOF
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --production
fi

# Delete existing PM2 process
pm2 delete manufacturing-app-staging 2>/dev/null || true

# Start with PM2
echo "🚀 Starting with PM2..."
pm2 start index.js --name manufacturing-app-staging --instances 1 --cwd "$STAGING_DIR/server"

# Wait and check
sleep 3
pm2 status

# Verify
if pm2 list | grep -q "manufacturing-app-staging"; then
    echo "✅ PM2 process started successfully!"
    pm2 save
else
    echo "❌ PM2 process failed to start. Check logs:"
    pm2 logs manufacturing-app-staging --lines 20
fi
```

Save sebagai `fix-staging-pm2.sh` dan jalankan:

```bash
chmod +x fix-staging-pm2.sh
./fix-staging-pm2.sh
```

## 📊 Verification Checklist

Setelah fix, verify:

- [ ] `pm2 status` shows `manufacturing-app-staging`
- [ ] `pm2 logs manufacturing-app-staging` shows no errors
- [ ] `curl http://localhost:5678/health` returns healthy status
- [ ] Port 5678 is listening: `sudo netstat -tlnp | grep 5678`
- [ ] Directory structure is correct
- [ ] .env file exists and has correct values
- [ ] Database connection works

## 🆘 Still Having Issues?

Jika masih ada masalah:

1. **Check GitHub Actions logs** untuk detailed error
2. **Run manual checks** seperti di atas
3. **Check PM2 logs** untuk specific errors
4. **Verify file structure** di VPS
5. **Check system resources** (disk, memory)

Jika masih stuck, share:
- GitHub Actions log output
- Output dari `pm2 logs manufacturing-app-staging`
- Output dari `ls -la /home/foom/deployments/manufacturing-app-staging/server/`

---

**Note**: Workflow deployment sudah di-update dengan better error handling dan verification steps. Push perubahan ke staging branch untuk trigger deployment baru.
