# Production deployment checklist

## Ready in codebase

- [x] PostgreSQL + versioned migrations (`server/migrations/`)
- [x] JWT auth + role checks (admin vs production)
- [x] API key auth for `/api/external` and `/api/receiver` (fail-closed in staging/prod)
- [x] Helmet CSP (relaxed), CORS allowlist via `CORS_ORIGIN`
- [x] Login + external rate limits
- [x] `/health` with DB probe
- [x] Graceful shutdown (HTTP + cron stop + DB pool)
- [x] PM2 web + worker (`server/ecosystem.config.js`)
- [x] Staging port **3467** + nginx staging conf
- [x] `server/env.example`
- [x] CI: server tests, syntax, client build, server audit (high+)

## Before each production release (ops)

- [ ] `server/.env` on VPS has strong `JWT_SECRET`, `ADMIN_PASSWORD`, `PRODUCTION_PASSWORD`, `DB_PASSWORD`, explicit `CORS_ORIGIN`
- [ ] Rotate credentials if they were ever shared — [CREDENTIAL_ROTATION.md](../deployment/CREDENTIAL_ROTATION.md)
- [ ] `pg_dump` backup before deploy
- [ ] Confirm PM2 shows `manufacturing-app` **and** `manufacturing-app-worker`
- [ ] `curl http://localhost:$PORT/health` returns `"healthy"`
- [ ] Smoke: login admin + production, one production submit, admin PIC/vendor blocked for production role

## Follow-ups (not blockers if accepted)

- [ ] HttpOnly session cookies instead of `localStorage` JWT
- [ ] Encrypt `admin_config` secrets at rest
- [ ] Stricter CSP (nonces)
- [ ] Broader integration/E2E tests; client dependency upgrades beyond CRA toolchain
