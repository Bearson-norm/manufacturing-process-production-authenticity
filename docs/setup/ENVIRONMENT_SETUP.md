# Environment Configuration Guide

Konfigurasi lewat `server/.env`. Template kanonik: [server/env.example](../../server/env.example). Database adalah **PostgreSQL** (`DB_*`), bukan file SQLite.

## File structure

```
server/
  ├── .env           # tidak di-commit
  ├── env.example    # template
  ├── config.js      # loader
  └── index.js
```

PM2 memuat `.env` dari direktori yang sama dengan `ecosystem.config.js` (`server/`).

## Development

```bash
cd server
cp env.example .env
# Set DB_*, JWT_SECRET, ADMIN_PASSWORD, PRODUCTION_PASSWORD
```

Dari root repo:

```bash
npm run dev
```

`PORT` default **1234** (proses API). React di **3000** mem-proxy `/api` ke backend. Jangan set `CORS_ORIGIN=*` di staging/production.

## Production / staging

Salin `server/env.example` ke `server/.env` di host deploy, lalu set:

- `NODE_ENV=production` atau `staging`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `ADMIN_PASSWORD`, `PRODUCTION_PASSWORD`
- `CORS_ORIGIN` (origin UI, comma-separated; hindari `*`)

Staging app port di ecosystem: **3467**. Production `PORT` dari `.env` (default 1234).

Setelah edit `.env`:

```bash
pm2 restart manufacturing-app --update-env
pm2 restart manufacturing-app-worker --update-env
```

(staging: `manufacturing-app-staging` + `manufacturing-app-staging-worker`)

## Variabel

| Variable | Default (example) | Meaning |
|----------|-------------------|---------|
| `NODE_ENV` | `development` | `development` / `staging` / `production` |
| `PORT` | `1234` | Port proses HTTP (web). Worker tidak bind port. |
| `DB_HOST` | `localhost` | Host PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL (VPS bisa berbeda; baca `.env` host) |
| `DB_NAME` | `manufacturing_db` | Nama database |
| `DB_USER` | `admin` | User PostgreSQL |
| `DB_PASSWORD` | (wajib diisi) | Password DB |
| `DB_POOL_MAX` | `20` | Pool size |
| `JWT_SECRET` | (wajib prod/staging) | Signing key JWT |
| `JWT_EXPIRES_IN` | `8h` | Expiry token |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | — | Login role `admin` |
| `PRODUCTION_USERNAME` / `PRODUCTION_PASSWORD` | — | Login role `production` |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowlist origin |
| `ENABLE_SCHEDULER` | di-set PM2 | `true` hanya di worker |
| `ENABLE_HTTP` | di-set PM2 | `false` di worker |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |

Jika `DB_NAME` tidak di-set, `config.js` memakai fallback internal — **selalu set `DB_NAME` di `.env`**.

### Integrasi (opsional)

Preferensi: Admin UI → tabel `admin_config`. Env hanya fallback:

- Odoo: `ODOO_SESSION_ID`, `ODOO_API_URL`
- External MES: `EXTERNAL_API_BASE_URL`, `EXTERNAL_API_BEARER_TOKEN`, `EXTERNAL_API_TARGETS` (JSON list target). Legacy: `EXTERNAL_API_URL`, `EXTERNAL_API_URL_ACTIVE`, `EXTERNAL_API_URL_COMPLETED`
- WMS: `WMS_API_BASE_URL`, `WMS_ACCESS_TOKEN`, `WMS_USERNAME`, `WMS_COMPANY_ID`, `WMS_SITE`
- Idle push window: `EXTERNAL_MFG_MIN_CREATE_DATE`, `EXTERNAL_MFG_WINDOW_DAYS_BACK`, `EXTERNAL_MFG_WINDOW_DAYS_FORWARD`

## Security

- Jangan commit `.env`.
- Jangan menempel isi `.env` ke chat, screenshot, atau markdown.
- Backup `.env` di host (di luar git) sebelum mengubah nilai.

## Troubleshooting

**Variabel tidak terbaca:** file harus `server/.env` (bukan root repo). Restart proses.

**PM2 tidak update env:** `pm2 restart <app> --update-env`.

**Prod/staging gagal boot:** `JWT_SECRET`, `ADMIN_PASSWORD`, dan `PRODUCTION_PASSWORD` wajib.
