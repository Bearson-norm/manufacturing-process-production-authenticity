# Manufacturing Process Production Authenticity System

Sistem untuk mengelola proses produksi dan autentikasi pada manufacturing dengan tracking MO Number, Roll Number, dan Authenticity Data.

## Fitur

- **Production Management**: Liquid, Device, dan Cartridge
- **Authenticity Tracking**: First/Last Authenticity dan Roll Number
- **Buffer / Reject Management**
- **Session Management**: leader name dan shift number
- **Integrasi**: Odoo MO sync, external manufacturing API, WMS (admin)

## Requirements

- Node.js >= 18.x
- npm
- PostgreSQL

## Installation

```bash
git clone <repository-url>
cd Manufacturing-Process-Production-Authenticity
npm run install-all
cp server/env.example server/.env
# Edit server/.env — set DB_*, JWT_SECRET, ADMIN_PASSWORD, PRODUCTION_PASSWORD, CORS_ORIGIN
```

## Running

### Development

```bash
npm run dev
# Backend default port 1234, React dev server 3000 (proxy ke backend)
```

### Production (manual)

```bash
cd client && npm run build && cd ..
# Deploy client/build sebagai client-build di samping server/
cd server && npm install --omit=dev
pm2 start ecosystem.config.js --only manufacturing-app
pm2 start ecosystem.config.js --only manufacturing-app-worker
```

PM2 **web** (`ENABLE_SCHEDULER=false`) melayani HTTP; **worker** (`ENABLE_SCHEDULER=true`, `ENABLE_HTTP=false`) menjalankan cron saja.

## Authentication

- `POST /api/login` — JWT + role (`admin` | `production`)
- Semua `/api/*` kecuali `/api/login`, `/api/external/*`, `/api/receiver/*` membutuhkan `Authorization: Bearer <token>`
- `/health` publik (probe DB)
- Kredensial dari `server/.env` — jangan hardcode di dokumentasi

## Database

PostgreSQL. Variabel di `server/env.example`. Bootstrap schema lewat migrasi di `server/migrations/`.

## CI/CD

- Push ke `staging` → deploy staging (port **3467**)
- Push ke `main` → deploy production (port dari `.env`, biasanya 1234)
- Lihat [docs/ci-cd/CI_CD_GUIDE.md](docs/ci-cd/CI_CD_GUIDE.md), [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)
- Rotasi kredensial: [docs/deployment/CREDENTIAL_ROTATION.md](docs/deployment/CREDENTIAL_ROTATION.md)

## License

ISC — see [LICENSE](LICENSE)
