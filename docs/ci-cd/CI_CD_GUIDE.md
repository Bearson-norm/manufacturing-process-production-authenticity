# CI/CD Configuration Guide

Pipeline GitHub Actions: verifikasi di CI, deploy staging dari branch `staging`, deploy production dari `main`/`master`.

## Overview

Yang **ada di workflow** saat ini:

- **CI** (`.github/workflows/ci.yml`): secret scan (Gitleaks), syntax check `index.js`/`app.js`, unit tests server, `npm audit` server (high+), unit tests + build client, migrate smoke (Postgres ephemeral, push ke `main`/`master`/`staging` saja). Perubahan docs (`**/*.md`, `docs/**`, `LICENSE`) di-skip. Job agregat bernama **`ci`**.
- **Staging** (`deploy-staging.yml`): push ke `staging` → port **3467**, PM2 web + worker.
- **Production** (`deploy.yml`): push ke `main`/`master` → `PORT` dari `.env` (biasanya 1234), backup, health check, rollback jika health gagal.

Tidak ada job lint terpisah. Client `npm audit` di CI `continue-on-error` (bukan gerbang gagal). Node dipin di `.nvmrc` (18).

```
Push
  ├─ CI (test & build; skip markdown)
  ├─ branch staging → deploy staging (3467)
  └─ branch main    → deploy production (PORT dari .env) → health → rollback jika gagal
```

## File

```
.github/workflows/ci.yml
.github/workflows/deploy-staging.yml
.github/workflows/deploy.yml
.github/scripts/          # helper deploy / env di VPS
```

## GitHub Secrets

Di repository: **Settings → Secrets and variables → Actions**.

| Secret | Isi |
|--------|-----|
| `VPS_HOST` | hostname atau IP VPS |
| `VPS_USER` | user SSH |
| `VPS_SSH_KEY` | private key (termasuk BEGIN/END) |
| `VPS_PORT` | opsional, default 22 |

Jangan menempel private key atau password ke dokumentasi.

Generate key (contoh):

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_vps
ssh-copy-id -i ~/.ssh/github_actions_vps.pub USER@VPS_HOST
```

Isi `VPS_SSH_KEY` dengan isi file private key.

## Branch

**`staging`** — auto-deploy staging. Port **3467**. PM2: `manufacturing-app-staging` + worker. Direktori deploy staging (lihat workflow/scripts).

**`main` / `master`** — auto-deploy production setelah paket dibangun. Health check; rollback jika gagal. PM2: `manufacturing-app` + `manufacturing-app-worker`. `PORT` dari `server/.env`.

Disarankan: proteksi branch dengan required check **`ci`**.

## CI jobs (ci.yml)

1. `instant_gates` — Gitleaks, `node --check` server entry, grep `/health`
2. `server` — `npm ci`, `npm test`, `npm audit --omit=dev --audit-level=high`
3. `client` — `npm ci`, audit (fail-soft), unit tests, `npm run build`
4. `migrate_smoke` — migrasi ke Postgres CI (hanya push, bukan semua PR)
5. `ci` — agregat; gagal jika job wajib gagal

## Staging deploy

1. Build sekali (`deploy.tar.gz` artifact)
2. SCP ke VPS, install deps production
3. `.env` staging dengan `PORT=3467`
4. Restart PM2 web + worker
5. Health check (fail-closed)

## Production deploy

1. Build sekali + artifact
2. Backup deployment yang ada
3. Install deps, restart web **dan** worker
4. Health: beberapa percobaan; gagal → restore backup

## Monitoring

```bash
ssh USER@VPS_HOST
pm2 status
pm2 logs manufacturing-app
pm2 logs manufacturing-app-worker
```

Health (dari host, proses API):

```bash
curl http://localhost:<PORT>/health
# production default PORT=1234; staging 3467
```

GitHub → tab **Actions**.

## Rollback manual

```bash
ssh USER@VPS_HOST
cd /path/to/deployments
# list backup dari workflow, restore folder app, lalu:
cd <app>/server
pm2 restart manufacturing-app
pm2 restart manufacturing-app-worker
pm2 save
```

## Troubleshooting

CI gagal: baca log job; lokal `cd server && npm test` dan `cd client && npm run build`. Syntax: `node --check server/index.js`.

Deploy gagal: secrets SSH, disk VPS, `pm2 logs`.

Health gagal / auto-rollback: DB di `.env`, kedua proses PM2, `curl` `/health` di VPS.

## Related

- [STAGING_SETUP.md](STAGING_SETUP.md)
- [docs/deployment/DEPLOYMENT.md](../deployment/DEPLOYMENT.md)
- [docs/troubleshooting/TROUBLESHOOTING.md](../troubleshooting/TROUBLESHOOTING.md)
