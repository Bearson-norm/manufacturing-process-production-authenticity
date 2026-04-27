---
name: nodejs-webapp-qa-audit
description: Runs structured QA on Node.js web apps with PostgreSQL—security (SQLi, XSS, CSRF, JWT, RBAC, headers, rate limits, npm audit), performance (latency, EXPLAIN ANALYZE, N+1, k6/Artillery, pg pool, heap, cache, static assets), DB integrity, REST/OpenAPI behavior, frontend (browser, responsive, a11y, session timeout), and ops (env, SIGTERM, health, logs, TLS). Outputs findings with Kritis/Tinggi/Sedang severity, evidence, and repro. Use when the user requests QA, security audit, pre-release testing, regression checklist, or verification of Node/Postgres/API/UI behavior.
---

# Node.js web app QA audit

## Role

Act as **tester / QA**: inspect code and runtime, document findings with **severity** (Kritis / Tinggi / Sedang), **evidence** (path, request, query, redacted snippet), and **reproduction**. Do not assert issues without code reference or a failed/ambiguous test.

## Stack & tools

- **Stack**: Node.js (Express/Fastify/Nest, etc.), PostgreSQL, REST and/or SSR.
- **Tools** (run when environment allows; else document manual steps): `curl`, browser DevTools Network/Application, `npm audit`, `psql` + `EXPLAIN ANALYZE`, k6 or Artillery, `node --inspect` + Chrome Memory, axe DevTools (or `@axe-core/cli`).

## Workflow

1. **Clarify**: staging URL, accounts per role, OpenAPI/spec path, whether prod testing is allowed, DB access for `EXPLAIN` if needed.
2. **Map surface**: routes, forms, uploads, auth/admin paths, health, env-based config, pool settings.
3. **Run checklist** below; each item → pass / fail / skip + notes.
4. **Report** using the template at the end.

**Severity**: Kritis = blocker security/data; Tinggi = important; Sedang = quality/hardening.

---

## 1. Security testing

| ID | Topic | Sev | Verify |
|----|-------|-----|--------|
| S1 | SQL injection | Kritis | Forms, query params, headers, path params feeding SQL. Parameterized queries only; grep for raw concatenation/template literals in SQL. Fuzz PostgreSQL-oriented payloads on every input surface. |
| S2 | XSS | Kritis | Every response that embeds user data: encoding, sanitization, CSP. Check SSR templates and React `dangerouslySetInnerHTML` / rich-text paths. |
| S3 | CSRF | Kritis | Mutations (POST/PUT/PATCH/DELETE): CSRF token or equivalent (SameSite + double-submit), reject invalid/missing token. |
| S4 | Authentication & JWT | Kritis | Access/refresh expiry, refresh rotation if used, logout invalidation (server denylist or very short TTL), brute-force / credential-stuffing mitigation (rate limit, lockout, backoff). |
| S5 | Authorization / RBAC | Kritis | Cross-role: normal user must not reach admin routes or objects (vertical + horizontal / IDOR). Middleware order: authenticate before authorize; default deny. |
| S6 | Sensitive data exposure | Tinggi | Passwords, tokens, PII not in JSON responses, logs, query strings, or referrer-visible URLs; logger redaction. |
| S7 | Security headers | Tinggi | `curl -I` or DevTools: HSTS, CSP, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy` as appropriate. |
| S8 | Rate limiting & DoS | Tinggi | Login and heavy APIs: per-IP/user/key limits; timeouts on long operations. |
| S9 | Dependency vulnerabilities | Tinggi | `npm audit` (and lockfile); track critical/high CVEs and safe upgrade path. |

---

## 2. Performance testing

| ID | Topic | Sev | Verify |
|----|-------|-----|--------|
| P1 | Response time baseline | Tinggi | Measure critical APIs (p50/p95); align with product target (e.g. **&lt;200ms** for agreed critical paths under nominal conditions). |
| P2 | Database query performance | Kritis | `EXPLAIN ANALYZE` on hot paths; sequential scans on large tables; missing indexes. |
| P3 | N+1 query problem | Tinggi | ORM/service loops that issue per-row queries; prefer join/batch/DataLoader. |
| P4 | Load testing | Tinggi | k6 or Artillery concurrent users; monitor app CPU/memory, DB latency and errors. |
| P5 | Connection pool (`pg` / pool) | Tinggi | `max`, idle timeout, acquire timeout; behavior when pool exhausted (clear errors vs hang). |
| P6 | Memory leak | Sedang | Long run; heap trend via `--inspect` + Chrome DevTools Memory or periodic `process.memoryUsage()`. |
| P7 | Caching strategy | Sedang | Hit/miss, TTL; user-specific data not served from shared wrong keys (cache poisoning). |
| P8 | Static asset & CDN | Sedang | gzip/brotli, `Cache-Control`, fingerprinted build assets. |

---

## 3. Database & data integrity

| ID | Topic | Sev | Verify |
|----|-------|-----|--------|
| D1 | Constraint validation | Kritis | NOT NULL, UNIQUE, FK, CHECK enforced in DB (not only app). |
| D2 | Transaction isolation | Kritis | Concurrent transactions / race conditions; document isolation level; lost update / phantom where relevant. |
| D3 | Migration safety | Tinggi | Migrations idempotent where possible; rollback path without unintended data loss. |
| D4 | Data validation layer | Tinggi | Backend validation (schema layer) matches DB constraints; errors mapped consistently. |
| D5 | Cascade delete behavior | Tinggi | ON DELETE CASCADE/RESTRICT/SET NULL matches product rules; no orphan surprises. |
| D6 | Index coverage | Sedang | Frequent WHERE/JOIN/ORDER BY columns indexed; avoid useless duplicates. |
| D7 | Backup & recovery | Sedang | Backups run; restore drill documented or verified if access exists. |

---

## 4. API testing

| ID | Topic | Sev | Verify |
|----|-------|-----|--------|
| A1 | REST contract / OpenAPI | Tinggi | Spec vs reality: paths, methods, status codes, bodies, required headers. |
| A2 | Input boundary testing | Tinggi | Empty, null, negative, very long strings, special/unicode characters. |
| A3 | HTTP status code accuracy | Tinggi | 400/401/403/404/409/500 on correct conditions—not masking failures as 200. |
| A4 | Pagination & sorting | Sedang | limit/offset or cursor; stable sort; sane max page size. |
| A5 | Error response format | Tinggi | Consistent JSON/shape; **no stack traces in production**. |
| A6 | File upload handling | Sedang | Max size, MIME/type validation, secure storage path and permissions. |
| A7 | Versioning compatibility | Sedang | If versioned APIs: backward compatibility or explicit deprecation. |

---

## 5. Frontend & UI testing

| ID | Topic | Sev | Verify |
|----|-------|-----|--------|
| F1 | Cross-browser compatibility | Sedang | Core flows on ≥2 of Chrome, Firefox, Safari, Edge (recent). |
| F2 | Responsive design | Sedang | ~360px mobile, ~768px tablet, 1280px+ desktop. |
| F3 | Form validation UX | Sedang | Clear inline errors; not only generic `alert`. |
| F4 | Accessibility (a11y) | Sedang | axe: ARIA, keyboard navigation, focus order, contrast. |
| F5 | Loading state & skeleton | Sedang | Visible loading for async data; error empty states. |
| F6 | Session timeout handling | Tinggi | Expired session → login redirect and clear message; no broken silent UI. |

---

## 6. Infrastructure & ops

| ID | Topic | Sev | Verify |
|----|-------|-----|--------|
| I1 | Environment config | Kritis | Production env separate from dev/staging; **no secrets hardcoded** in repo or images. |
| I2 | Graceful shutdown | Tinggi | SIGTERM/SIGINT: stop accept, drain in-flight, close DB pool and other handles. |
| I3 | Health check endpoint | Tinggi | `/health` or `/ready`: DB (and deps) connectivity; no sensitive payload. |
| I4 | Log quality | Sedang | Structured (e.g. JSON), correlation/request ID, no secrets/PII in log lines. |
| I5 | Error monitoring | Sedang | Sentry/Datadog/etc. from env; confirm events in staging. |
| I6 | SSL/TLS configuration | Kritis | Valid certificate, TLS 1.2+, HTTP→HTTPS redirect, HSTS at reverse proxy if used. |

---

## Quick commands (examples)

```bash
# Headers (replace URL)
curl -sI https://staging.example.com/api/health

# Audit deps
npm audit --omit=dev
```

```sql
-- In psql: slow query (replace table/conditions)
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

Document k6/Artillery scripts in the report attachment or repo path—do not embed large scripts in the chat unless the user asks.

## Evidence discipline

- Static: `file:line` from repo.
- Dynamic: method, path, status, redacted body snippet.
- **N/A**: state reason (e.g. no uploads).

## Report template

```markdown
# QA audit — [product] — [date]

## Environment
- Branch/commit:
- URL:
- Roles tested:

## Executive summary
- [2–5 bullets: risk, blockers]

## Findings

### Kritis
| ID | Title | Evidence | Recommendation |
|----|-------|----------|----------------|

### Tinggi
...

### Sedang
...

## Checklist matrix
| ID | Status (pass/fail/skip) | Notes |

## Out of scope / not tested
```

For org-specific thresholds or tool versions, add [reference.md](reference.md) in this folder and link it here once.
