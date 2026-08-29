# Konfigurasi Port

Port diambil dari config saat ini (`PORT` di `server/.env` / `server/config.js`, React CRA, `server/ecosystem.config.js`).

## Development

| Proses | Port | URL | Peran |
|--------|------|-----|--------|
| API (web) | `PORT`, default **1234** | `http://localhost:1234` | REST + `/health` |
| React | **3000** | `http://localhost:3000` | UI; proxy `/api` → `http://localhost:1234` |

Buka browser ke **:3000**. Curl/Postman ke proses API (**1234**), kecuali Anda sengaja memakai proxy CRA.

Proxy: `client/package.json` → `"proxy": "http://localhost:1234"`.

Production (satu proses web): Express menyajikan `client-build` di `PORT` yang sama. Worker **tidak** membuka HTTP (`ENABLE_HTTP=false`).

## Staging / production (PM2)

| Proses | Port | Catatan |
|--------|------|---------|
| Production web `manufacturing-app` | `PORT` dari `.env` (biasanya 1234) | `ENABLE_HTTP=true`, scheduler off |
| Production worker | tidak bind | `ENABLE_HTTP=false`, scheduler on |
| Staging web `manufacturing-app-staging` | **3467** (ecosystem) | `NODE_ENV=staging` |
| Staging worker | tidak bind | scheduler on |

Nginx/Traefik (jika dipakai) mem-proxy 80/443 ke port web di atas. Jangan memakai port staging lama **5678**.

PostgreSQL: `DB_PORT` (default **5432** di `env.example`). Host VPS bisa memakai port lain — baca `.env` di server, jangan mengasumsikan 5433.

## Mengubah port

Backend: set `PORT` di `server/.env`, sesuaikan proxy CRA jika bukan 1234.

Frontend dev: `PORT` untuk `react-scripts` (jangan bentrok dengan API).

## Troubleshooting

**UI kosong / API 404 di :1234 saat `npm run dev`:** itu proses API, bukan SPA. Buka `:3000`.

**Cannot GET / di :1234 (dev):** normal jika `client-build` belum ada. Gunakan React di 3000.

**Port already in use:** hentikan proses lama atau ganti `PORT`.
