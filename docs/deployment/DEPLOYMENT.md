# Deployment Guide

Deploy ke VPS lewat GitHub Actions, atau manual. Alur otomatis: [docs/ci-cd/CI_CD_GUIDE.md](../ci-cd/CI_CD_GUIDE.md).

Database: **PostgreSQL**. Proses: **web** (HTTP) + **worker** (cron). Port production dari `server/.env` (`PORT`, default 1234). Staging: **3467**.

## Prerequisites

- VPS + SSH (user non-root dengan sudo)
- Node.js 18.x, PM2, Nginx (atau Traefik)
- PostgreSQL dan `server/.env` sudah diisi (`DB_*`, `JWT_SECRET`, password login, `CORS_ORIGIN`)
- GitHub repo + secrets `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (opsional `VPS_PORT`)

## Setup VPS (ringkas)

```bash
ssh USER@VPS_HOST
```

Install Node 18, PM2, Nginx. `pm2 startup` untuk user deploy.

Jangan commit `.env`. Salin dari `server/env.example` di host.

## GitHub Secrets

Settings → Secrets and variables → Actions: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, opsional `VPS_PORT`.

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_vps
ssh-copy-id -i ~/.ssh/github_actions_vps.pub USER@VPS_HOST
```

Paste **private** key ke secret. Jangan taruh key di markdown.

## Trigger CI/CD

- Push `staging` → deploy staging (3467), web + worker
- Push `main` / `master` → deploy production, backup, health, rollback jika `/health` gagal
- `workflow_dispatch` di tab Actions

Paket berisi `server/` + `client-build/` (hasil `client/build`). PM2 dijalankan dari `server/` dengan `ecosystem.config.js`.

## Verifikasi

```bash
curl http://localhost:<PORT>/health
# expected: { "status": "healthy", "database": "connected", ... }
```

Login: `POST /api/login` dengan username/password dari `.env` (bukan password contoh di docs).

```bash
ssh USER@VPS_HOST
pm2 status
pm2 logs manufacturing-app
pm2 logs manufacturing-app-worker
```

UI production: origin di `CORS_ORIGIN` / reverse proxy. Jangan tes dengan kredensial default `production123`.

## Troubleshooting

PM2: `pm2 restart manufacturing-app` dan `manufacturing-app-worker`, lalu `pm2 save`.

Nginx: `sudo nginx -t` dan `sudo systemctl status nginx`.

Rollback: restore folder backup dari workflow, restart **kedua** proses PM2.

## Manual deploy (jika Actions tidak jalan)

```bash
cd client && npm run build && cd ..
# salin client/build → VPS sebagai client-build di samping server/
# salin server/ (tanpa node_modules, tanpa .env overwrite)
ssh USER@VPS_HOST
cd <deploy>/server
npm install --omit=dev
pm2 restart manufacturing-app
pm2 restart manufacturing-app-worker
```

## Security

- Ganti semua password/secret di production; rotasi: [CREDENTIAL_ROTATION.md](CREDENTIAL_ROTATION.md)
- HTTPS di reverse proxy
- Firewall: jangan expose PostgreSQL ke internet
- Backup PostgreSQL secara berkala (`pg_dump`), bukan file `database.sqlite`

## Related

- [docs/setup/ENVIRONMENT_SETUP.md](../setup/ENVIRONMENT_SETUP.md)
- [docs/setup/PORT_CONFIGURATION.md](../setup/PORT_CONFIGURATION.md)
- [nginx/README.md](../../nginx/README.md)
