# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Security
- JWT auth required for browser APIs; admin RBAC on PIC/vendor mutations, reports, and WMS
- Timing-safe API key comparison; login and external/receiver rate limits
- Helmet CSP (relaxed for SPA), trust proxy, generic 500 errors outside development
- Removed hardcoded DB password fallbacks from ops scripts; added credential rotation runbook

### Changed
- PM2 web + worker split (`ENABLE_SCHEDULER` / `ENABLE_HTTP`) to prevent duplicate cron jobs
- Staging port standardized to **3467**; staging health check fails the deploy job
- Versioned DB migrations via `server/migrations/` + `schema_migrations`
- Production report pagination capped (default 100, max 500)
- Stripped unreachable duplicate routes from `server/index.js`
- CI: `npm ci`, server tests, server `npm audit --audit-level=high`, client build

### Fixed
- Login loading/disabled state and 401/503 messaging; session-expired redirect UX
- Production Liquid/Device/Cartridge fetch loading and error banners
