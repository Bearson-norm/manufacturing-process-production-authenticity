# Environment Configuration Guide

Sistem ini menggunakan environment variables untuk konfigurasi yang berbeda antara development (lokal) dan production (VPS).

## 📁 File Structure

```
server/
  ├── .env              # Environment variables (tidak di-commit ke git)
  ├── env.example       # Template untuk .env
  ├── config.js         # Centralized config loader
  └── index.js          # Load .env di awal
```

## 🚀 Setup untuk Development (Lokal)

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Buat file .env
```bash
# Copy template
cp env.example .env

# Edit sesuai kebutuhan lokal
# Default sudah cocok untuk development
```

### 3. Edit .env (opsional)
```env
NODE_ENV=development
PORT=1234
DATABASE_PATH=./database.sqlite
CORS_ORIGIN=*
LOG_LEVEL=info
```

### 4. Jalankan aplikasi
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🖥️ Setup untuk Production (VPS)

### 1. Setup otomatis via deployment
CI/CD akan otomatis membuat `.env` dari `env.example` jika belum ada.

### 2. Setup manual
```bash
# SSH ke VPS
ssh foom@103.31.39.189

# Masuk ke directory deployment
cd /home/foom/deployments/manufacturing-app/server

# Copy template
cp env.example .env

# Edit untuk production
nano .env
```

### 3. Konfigurasi Production (.env)
```env
NODE_ENV=production
PORT=1234
DATABASE_PATH=/home/foom/deployments/manufacturing-app/server/database.sqlite
CORS_ORIGIN=https://mpr.moof-set.web.id
LOG_LEVEL=info
APP_NAME=Manufacturing Process Production Authenticity
APP_VERSION=1.0.0
```

### 4. Restart aplikasi
```bash
pm2 restart manufacturing-app
```

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode: `development` atau `production` |
| `PORT` | `1234` | Port untuk server |
| `DATABASE_PATH` | `./database.sqlite` | Path ke database file |
| `CORS_ORIGIN` | `*` | CORS allowed origins (comma-separated) |
| `LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `APP_NAME` | `Manufacturing...` | Application name |
| `APP_VERSION` | `1.0.0` | Application version |

## 🔄 Update Environment

### Di Lokal
1. Edit `server/.env`
2. Restart aplikasi:
   ```bash
   # Stop aplikasi (Ctrl+C jika running)
   # Start lagi
   npm run dev
   ```

### Di VPS
1. Edit `.env`:
   ```bash
   ssh foom@103.31.39.189
   cd /home/foom/deployments/manufacturing-app/server
   nano .env
   ```

2. Restart PM2:
   ```bash
   pm2 restart manufacturing-app
   ```

3. Check status:
   ```bash
   pm2 status
   pm2 logs manufacturing-app
   ```

## 🔐 Security Notes

1. **JANGAN commit `.env` ke git!**
   - File `.env` sudah ada di `.gitignore`
   - Hanya commit `env.example` sebagai template

2. **JANGAN share `.env` file!**
   - Berisi konfigurasi sensitif
   - Setiap environment punya `.env` sendiri

3. **Backup `.env` di VPS:**
   ```bash
   # Backup sebelum update
   cp .env .env.backup.$(date +%Y%m%d)
   ```

## 🛠️ Troubleshooting

### Environment variables tidak terbaca
1. Pastikan file `.env` ada di `server/` directory
2. Pastikan `dotenv` sudah terinstall: `npm install`
3. Restart aplikasi

### PM2 tidak load .env
1. PM2 load `.env` dari `ecosystem.config.js`
2. Pastikan `.env` ada di directory yang sama dengan `ecosystem.config.js`
3. Restart PM2: `pm2 restart manufacturing-app --update-env`

### Check current environment
```bash
# Di server/index.js, tambahkan:
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);
console.log('Database:', process.env.DATABASE_PATH);
```

## 📚 Scripts

### Setup environment di VPS
```bash
cd /var/www/manufacturing-process-production-authenticity
chmod +x .github/scripts/setup-env.sh
sudo ./.github/scripts/setup-env.sh
```

### Check environment
```bash
# Di VPS
cd /home/foom/deployments/manufacturing-app/server
cat .env

# Check PM2 environment
pm2 show manufacturing-app | grep env
```

## 🔄 Update Program dengan Environment

### Workflow Update:

1. **Update kode di lokal:**
   ```bash
   git add .
   git commit -m "Update: add new features"
   git push origin main
   ```

2. **CI/CD otomatis deploy:**
   - GitHub Actions akan:
     - Build aplikasi
     - Deploy ke VPS
     - Setup `.env` jika belum ada
     - Restart PM2

3. **Manual update environment (jika perlu):**
   ```bash
   # Di VPS
   cd /home/foom/deployments/manufacturing-app/server
   nano .env  # Edit jika perlu
   pm2 restart manufacturing-app
   ```

### Sync Environment Lokal ke VPS:

Jika ingin sync environment dari lokal ke VPS:

```bash
# Di lokal, export environment
cd server
cat .env

# Di VPS, edit .env dan paste values
ssh foom@103.31.39.189
cd /home/foom/deployments/manufacturing-app/server
nano .env  # Paste values dari lokal
pm2 restart manufacturing-app
```

## ✅ Checklist

- [ ] `.env` file dibuat di `server/` (lokal)
- [ ] `.env` file dibuat di VPS deployment directory
- [ ] Environment variables sesuai dengan environment (dev/prod)
- [ ] `dotenv` package terinstall
- [ ] Aplikasi restart setelah update `.env`
- [ ] PM2 load environment dengan benar

