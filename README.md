# Manufacturing Process Production Authenticity System

Sistem untuk mengelola proses produksi dan autentikasi pada manufacturing dengan tracking MO Number, Roll Number, dan Authenticity Data.

## 🚀 Fitur

- **Production Management**: Kelola proses produksi untuk Liquid, Device, dan Cartridge
- **Authenticity Tracking**: Tracking authenticity label dengan First/Last Authenticity dan Roll Number
- **Buffer Management**: Kelola buffer authenticity numbers
- **Session Management**: Kelola session produksi dengan leader name dan shift number
- **Combined API**: API terpadu untuk query data dari semua tipe production

## 📋 Requirements

- Node.js >= 14.x
- npm atau yarn
- SQLite3

## 🛠️ Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd Manufacturing-Process-Production-Authenticity
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install && cd ..

# Install server dependencies
cd server && npm install && cd ..
```

Atau gunakan script:
```bash
npm run install-all
```

## 🏃 Running the Application

### Development Mode
```bash
# Run both client and server concurrently
npm run dev

# Or run separately:
npm run server  # Backend on port 5000
npm run client  # Frontend on port 3000
```

### Production Mode

#### Server
```bash
cd server
npm start
```

#### Client
```bash
cd client
npm run build
# Serve the build folder using a static server (nginx, apache, etc.)
```

## 📁 Project Structure

```
├── client/                 # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── server/                 # Express backend server
│   ├── index.js           # Main server file
│   ├── database.sqlite    # SQLite database (gitignored)
│   └── package.json
└── package.json           # Root package.json
```

## 🔌 API Endpoints

### Production Endpoints
- `GET /api/production/liquid` - Get all liquid production data
- `POST /api/production/liquid` - Create liquid production entry
- `GET /api/production/device` - Get all device production data
- `POST /api/production/device` - Create device production entry
- `GET /api/production/cartridge` - Get all cartridge production data
- `POST /api/production/cartridge` - Create cartridge production entry

### Combined Production Endpoints
- `GET /api/production/combined` - Query combined data (supports filters: moNumber, created_at, production_type)
- `POST /api/production/combined` - Insert data to combined table
- `POST /api/production/combined/sync` - Sync data from individual tables

### Buffer Endpoints
- `GET /api/buffer/liquid?moNumber=XXX` - Get buffer data for liquid
- `POST /api/buffer/liquid` - Create buffer entry for liquid
- Similar endpoints for device and cartridge

### Authentication
- `POST /api/login` — returns JWT (`token`) + `role`
- Credentials come from server env: `ADMIN_USERNAME` / `ADMIN_PASSWORD`, `PRODUCTION_USERNAME` / `PRODUCTION_PASSWORD`
- All `/api/*` routes (except `/api/login`, `/api/external/*`, `/api/receiver/*`) require `Authorization: Bearer <token>`
- `/health` is public

## 🗄️ Database

Database menggunakan PostgreSQL. Lihat `server/env.example` untuk variabel yang wajib diisi.

Tabel utama:
- `production_liquid`, `production_device`, `production_cartridge`
- `production_combined`
- `buffer_liquid`, `buffer_device`, `buffer_cartridge`

## 🔐 Credentials

Jangan hardcode password di dokumentasi. Set di `server/.env`:
- `JWT_SECRET`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `PRODUCTION_USERNAME` / `PRODUCTION_PASSWORD`

Untuk development lokal saja, jika password env kosong, fallback sementara `admin`/`admin123` dan `production`/`production123` masih aktif. **Staging/production wajib set password kuat via env.**

## 🚀 Deployment

### Manual Deployment
1. Build client: `cd client && npm run build`
2. Copy build folder dan server folder ke VPS
3. Install dependencies di server
4. Setup PM2 atau systemd untuk process management
5. Setup Nginx sebagai reverse proxy

### Automated Deployment (CI/CD)
Project ini menggunakan GitHub Actions untuk automated deployment dengan staging environment untuk testing.

**Features**:
- ✅ **CI Pipeline**: Automated testing dan linting pada semua branches
- ✅ **Staging Environment**: Auto-deploy ke staging (port 5678) untuk testing sebelum production
- ✅ **Production Deployment**: Auto-deploy ke production (port 1234) dengan safety checks dan auto-rollback
- ✅ **Health Checks**: Automatic health verification setelah deployment

**Workflow**:
```
Development → Staging Branch → Test → Main Branch → Production
```

**Documentation**:
- 📘 [CI/CD Guide](CI_CD_GUIDE.md) - Complete CI/CD documentation
- 🧪 [Staging Setup](STAGING_SETUP.md) - Staging environment setup guide
- 🚀 [Deployment Guide](DEPLOYMENT.md) - Manual deployment procedures

**Quick Start**:
- Deploy ke staging: Push ke branch `staging`
- Deploy ke production: Push ke branch `main` (setelah CI pass)

Lihat `.github/workflows/` untuk workflow files detail.

## 📝 Environment Variables

Buat file `.env` di root directory:
```env
NODE_ENV=production
PORT=5000
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

ISC

## 👥 Authors

- Your Name

## 🙏 Acknowledgments

- React
- Express.js
- SQLite3

