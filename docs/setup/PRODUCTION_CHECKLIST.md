# Production Deployment Checklist

## ✅ Yang Sudah Siap

1. **Database Configuration**
   - ✅ SQLite dengan WAL mode untuk concurrent access
   - ✅ Database indexes untuk performa
   - ✅ Auto-migration untuk schema updates

2. **API Endpoints**
   - ✅ Semua endpoint sudah terimplementasi
   - ✅ Error handling dasar sudah ada
   - ✅ Health check endpoint (`/health`)

3. **Scheduler**
   - ✅ Cron jobs untuk MO data sync
   - ✅ Auto cleanup old data
   - ✅ External API integration

4. **Server Configuration**
   - ✅ Environment variables support
   - ✅ Port configuration
   - ✅ Server timeout settings
   - ✅ Graceful shutdown handling

## ⚠️ Yang Perlu Diperbaiki Sebelum Production

### 🔒 Security (PENTING!)

1. **Authentication**
   - ❌ Password hardcoded: `production/production123`
   - ✅ **Action Required**: Ganti dengan environment variable atau hash password
   - ✅ **Action Required**: Implementasi JWT atau session management

2. **CORS Configuration**
   - ❌ CORS terlalu permissive (`app.use(cors())`)
   - ✅ **Action Required**: Restrict CORS ke domain production saja
   ```javascript
   app.use(cors({
     origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://yourdomain.com',
     credentials: true
   }));
   ```

3. **Rate Limiting**
   - ❌ Tidak ada rate limiting
   - ✅ **Action Required**: Install dan konfigurasi `express-rate-limit`
   ```bash
   npm install express-rate-limit
   ```

4. **Input Validation**
   - ⚠️ Validasi dasar sudah ada, tapi perlu lebih ketat
   - ✅ **Action Required**: Install `express-validator` untuk validasi yang lebih robust

5. **SQL Injection Protection**
   - ✅ Sudah menggunakan parameterized queries (aman)
   - ✅ SQLite3 sudah handle ini dengan baik

### 📝 Environment Variables

1. **File .env.example**
   - ❌ Tidak ada file `.env.example`
   - ✅ **Action Required**: Buat file `.env.example` dengan semua env vars yang diperlukan

2. **Required Environment Variables**
   ```
   NODE_ENV=production
   PORT=3000
   ODOO_SESSION_ID=your_session_id
   ODOO_API_URL=https://foomx.odoo.com
   EXTERNAL_API_URL=https://foom-dash.vercel.app/API
   EXTERNAL_API_URL_ACTIVE=https://foom-dash.vercel.app/API
   EXTERNAL_API_URL_COMPLETED=https://foom-dash.vercel.app/API
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

### 🗄️ Database

1. **Backup Strategy**
   - ❌ Tidak ada backup otomatis
   - ✅ **Action Required**: Setup cron job untuk backup database
   - ✅ **Action Required**: Setup backup ke cloud storage (S3, etc.)

2. **Database Monitoring**
   - ⚠️ Tidak ada monitoring untuk database size
   - ✅ **Action Required**: Monitor database size dan cleanup

### 📊 Logging & Monitoring

1. **Logging**
   - ⚠️ Hanya menggunakan `console.log`
   - ✅ **Action Required**: Install logging library (`winston` atau `pino`)
   - ✅ **Action Required**: Setup log rotation

2. **Error Tracking**
   - ❌ Tidak ada error tracking service
   - ✅ **Action Required**: Integrate dengan Sentry atau similar service

3. **Monitoring**
   - ✅ Health check endpoint sudah ada
   - ✅ **Action Required**: Setup monitoring tools (PM2 monitoring, New Relic, etc.)

### 🚀 Deployment

1. **Process Management**
   - ❌ Tidak ada PM2 configuration
   - ✅ **Action Required**: Setup PM2 ecosystem file
   - ✅ **Action Required**: Setup systemd service atau PM2 startup script

2. **Reverse Proxy**
   - ❌ Tidak ada Nginx configuration
   - ✅ **Action Required**: Setup Nginx sebagai reverse proxy
   - ✅ **Action Required**: Setup SSL certificate (Let's Encrypt)

3. **Build Process**
   - ✅ Client build sudah ada (`npm run build`)
   - ✅ **Action Required**: Setup automated build dan deployment

### 📦 Dependencies

1. **Security Audit**
   - ❌ Belum ada security audit
   - ✅ **Action Required**: Run `npm audit` dan fix vulnerabilities
   - ✅ **Action Required**: Setup automated security scanning

2. **Dependency Updates**
   - ⚠️ Perlu update dependencies secara berkala
   - ✅ **Action Required**: Setup Dependabot atau similar

## 📋 Pre-Deployment Checklist

### Before Deploying to VPS:

- [ ] Ganti password default di production
- [ ] Setup environment variables di VPS
- [ ] Konfigurasi CORS untuk domain production
- [ ] Install dan setup PM2
- [ ] Setup Nginx reverse proxy
- [ ] Setup SSL certificate
- [ ] Konfigurasi firewall (UFW)
- [ ] Setup database backup
- [ ] Setup log rotation
- [ ] Test semua endpoint di production
- [ ] Setup monitoring dan alerting
- [ ] Dokumentasi deployment process
- [ ] Setup rollback strategy

## 🛠️ Recommended Tools

1. **Process Management**: PM2
2. **Reverse Proxy**: Nginx
3. **SSL**: Let's Encrypt (Certbot)
4. **Monitoring**: PM2 Plus atau New Relic
5. **Logging**: Winston atau Pino
6. **Error Tracking**: Sentry
7. **Backup**: Automated script + cloud storage

## 📝 Deployment Steps

1. **Prepare VPS**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install Nginx
   sudo apt install -y nginx
   ```

2. **Deploy Application**
   ```bash
   # Clone repository
   git clone <your-repo> /var/www/manufacturing
   cd /var/www/manufacturing
   
   # Install dependencies
   npm install
   cd client && npm install && npm run build
   cd ../server && npm install
   
   # Setup environment variables
   cp .env.example .env
   nano .env  # Edit dengan production values
   ```

3. **Setup PM2**
   ```bash
   # Start with PM2
   cd /var/www/manufacturing/server
   pm2 start index.js --name manufacturing-api
   pm2 save
   pm2 startup  # Setup auto-start on boot
   ```

4. **Setup Nginx**
   - Create Nginx config file
   - Setup SSL with Let's Encrypt
   - Restart Nginx

5. **Setup Backup**
   - Create backup script
   - Setup cron job untuk backup harian

## ⚠️ Critical Issues to Fix First

1. **SECURITY**: Ganti password hardcoded
2. **SECURITY**: Restrict CORS
3. **SECURITY**: Add rate limiting
4. **DEPLOYMENT**: Setup PM2
5. **DEPLOYMENT**: Setup Nginx + SSL
6. **DATA**: Setup database backup

## 📞 Support

Jika ada pertanyaan atau butuh bantuan untuk setup production, silakan hubungi tim development.

