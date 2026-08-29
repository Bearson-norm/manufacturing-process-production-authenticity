# Manufacturing Process Production Authenticity System

Sistem untuk mengelola proses produksi dan autentikasi pada manufacturing dengan tracking MO Number, Roll Number, dan Authenticity Data.

## Fitur

- **Production Management**: Liquid, Device, dan Cartridge
- **Authenticity Tracking**: First/Last Authenticity dan Roll Number
- **Buffer / Reject Management**
- **Session Management**: leader name dan shift number
- **Integrasi**: Odoo MO sync, external manufacturing API, WMS (admin)

## Runtime

```
UI (dev :3000, proxy /api) → proses API (PORT, default 1234, ENABLE_HTTP)
                           → PostgreSQL
                           → Odoo / external MES / WMS (server-side saja)
Worker (ENABLE_HTTP=false) → cron sync/push (tanpa HTTP publik)
```

- **Web**: PM2 `manufacturing-app` — `ENABLE_HTTP=true`, `ENABLE_SCHEDULER=false`
- **Worker**: PM2 `manufacturing-app-worker` — cron saja; tidak bind `PORT`
- Browser di development: buka `:3000`. Curl API ke proses backend (`:1234`), bukan ke React.

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

## Authentication

Ringkasan. Kontrak lengkap: [docs/api/API_DOCUMENTATION.md](docs/api/API_DOCUMENTATION.md).

| Zona | Path | Auth |
|------|------|------|
| Publik | `/health`, `POST /api/login` | Tidak ada (login di-rate-limit) |
| API key | `/api/external/*`, `/api/receiver/*` | `X-API-Key` atau `Authorization: Bearer <api_key>` |
| JWT | sisa `/api/*` | `Authorization: Bearer <jwt>` (`admin` atau `production`) |
| Admin | `/api/admin/*`, `/api/reports/*`, `/api/wms/*` | JWT + role `admin` |

Trap: jika API key belum di-set di `admin_config`, production/staging **fail-closed (503)**. Bypass tanpa key hanya di development.

Kredensial dari `server/.env` — jangan hardcode di dokumentasi.

## Database

PostgreSQL. Variabel di `server/env.example`. Bootstrap schema lewat migrasi di `server/migrations/`.

## CI/CD

- Push ke `staging` → deploy staging (port **3467**)
- Push ke `main` → deploy production (port dari `.env`, default 1234)
- Lihat [docs/ci-cd/CI_CD_GUIDE.md](docs/ci-cd/CI_CD_GUIDE.md), [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md)
- Rotasi kredensial: [docs/deployment/CREDENTIAL_ROTATION.md](docs/deployment/CREDENTIAL_ROTATION.md)

## Dokumentasi

| Topik | File |
|-------|------|
| Environment | [docs/setup/ENVIRONMENT_SETUP.md](docs/setup/ENVIRONMENT_SETUP.md) |
| Port | [docs/setup/PORT_CONFIGURATION.md](docs/setup/PORT_CONFIGURATION.md) |
| Dev startup | [docs/setup/DEV_STARTUP_GUIDE.md](docs/setup/DEV_STARTUP_GUIDE.md) |
| API | [docs/api/API_DOCUMENTATION.md](docs/api/API_DOCUMENTATION.md) |
| DBeaver / PostgreSQL | [docs/database/DBEAVER_CONNECTION_GUIDE.md](docs/database/DBEAVER_CONNECTION_GUIDE.md) |
| Security | [SECURITY_RECOMMENDATIONS.md](SECURITY_RECOMMENDATIONS.md) |

## License

ISC — see [LICENSE](LICENSE)
