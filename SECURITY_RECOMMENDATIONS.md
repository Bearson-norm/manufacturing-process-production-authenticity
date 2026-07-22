# Security status (current codebase)

This document reflects the **implemented** security controls. Historical “not implemented” checklists below are obsolete.

## Implemented

| Control | Status | Notes |
|---------|--------|--------|
| JWT on `/api/*` (except login/external/receiver) | Done | `server/app.js`, `auth.middleware.js` |
| Admin RBAC | Done | `/api/admin`, `/api/reports`, `/api/wms`, PIC/vendor writes |
| External API key | Done | Fail-closed in production/staging if key unset |
| Login rate limit | Done | 20 / 15 min |
| External/receiver rate limit | Done | 300 / 15 min |
| Helmet + CSP (relaxed SPA) | Done | Tighten further when removing inline styles |
| CORS allowlist | Done | Set `CORS_ORIGIN` in staging/production |
| Timing-safe API key compare | Done | `crypto.timingSafeEqual` |
| Auth secrets required on staging/production | Done | Boot fails without `JWT_SECRET` / passwords |
| Scheduler singleton | Done | PM2 worker only (`ENABLE_SCHEDULER=true`) |

## Remaining / follow-up

1. Prefer HttpOnly cookie session over `localStorage` JWT (XSS surface).
2. Encrypt `admin_config` secrets at rest (KMS/vault).
3. Rotate any credentials that ever appeared in docs/scripts (`YOUR_DB_PASSWORD` placeholders) — see [docs/deployment/CREDENTIAL_ROTATION.md](docs/deployment/CREDENTIAL_ROTATION.md).
4. Add broader API integration tests and keep `npm audit` clean on the client toolchain.
5. Enable stricter CSP (nonces) when the SPA no longer needs `'unsafe-inline'`.

## Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
