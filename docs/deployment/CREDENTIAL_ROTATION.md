# Credential Rotation Runbook

Short checklist for rotating secrets on the VPS without downtime surprises. Run during a maintenance window when possible.

## Prerequisites

- SSH access to the VPS
- `sudo` for PostgreSQL user password changes
- Backup of `server/.env` before edits: `cp server/.env server/.env.backup-$(date +%Y%m%d)`

## 1. PostgreSQL admin password

Generate a new strong password and export it for shell scripts:

```bash
export DB_PASSWORD='replace_with_strong_password'
```

Rotate in PostgreSQL (pick the user your app uses, typically `admin`):

```bash
sudo -u postgres psql -c "ALTER USER admin WITH PASSWORD '$DB_PASSWORD';"
```

Verify:

```bash
PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5433 -U admin -d manufacturing_db -c "SELECT 1;"
```

Update `server/.env`:

```bash
# In server/.env
DB_PASSWORD=replace_with_strong_password
```

## 2. JWT secret

Generate a new secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Set in `server/.env`:

```bash
JWT_SECRET=<new_hex_secret>
```

**Note:** All existing JWT sessions will be invalidated. Users must log in again.

## 3. Application login passwords

Update in `server/.env`:

```bash
ADMIN_PASSWORD=replace_with_strong_admin_password
PRODUCTION_PASSWORD=replace_with_strong_production_password
```

These control the admin and production UI/API logins (separate from `DB_PASSWORD`).

## 4. Odoo session

Odoo integration reads `odoo_session_id` and `odoo_base_url` from the `admin_config` table (Admin UI or direct SQL).

1. Log in to Odoo in the browser and obtain a fresh session ID.
2. Update via Admin UI **or**:

```sql
UPDATE admin_config SET config_value = '<new_session_id>', updated_at = NOW()
WHERE config_key = 'odoo_session_id';
```

## 5. API keys in admin_config

Rotate integration secrets stored in `admin_config` as needed:

| config_key | Purpose |
|------------|---------|
| `api_key` | General API key |
| `external_api_bearer_token` | External API bearer token |
| `external_api_url`, `external_api_url_active`, `external_api_url_completed` | External API URLs |
| `wms_access_token`, `wms_api_base_url`, `wms_username`, etc. | WMS integration |

Update through the Admin UI when available, or via SQL `UPDATE admin_config ...` for each key.

> **Follow-up:** `admin_config` values are stored in plain text today. Plan encrypt-at-rest (e.g. application-level encryption or pgcrypto) as a separate hardening task.

## 6. Apply .env and restart PM2

From the deployment directory (e.g. `~/deployments/manufacturing-app/server`):

```bash
# Confirm .env has all updated values
grep -E '^(DB_PASSWORD|JWT_SECRET|ADMIN_PASSWORD|PRODUCTION_PASSWORD)=' .env

# Restart web + worker (production example)
pm2 restart manufacturing-app manufacturing-app-worker

# Staging example
pm2 restart manufacturing-app-staging manufacturing-app-staging-worker
```

## 7. Verify health

```bash
curl -sS http://localhost:1234/health
# Or staging port, e.g. curl -sS http://localhost:5678/health
```

Expected: HTTP 200 with a healthy status payload.

Also check:

```bash
pm2 status
pm2 logs manufacturing-app --lines 30 --nostream
```

- Log in to the admin UI with the new `ADMIN_PASSWORD`.
- Trigger a read-only Odoo or external API call if those integrations are in use.

## Rollback

If something fails after rotation:

1. Restore `.env` from backup: `cp server/.env.backup-YYYYMMDD server/.env`
2. Revert PostgreSQL password if it was changed: `ALTER USER admin WITH PASSWORD '<previous_password>';`
3. `pm2 restart manufacturing-app manufacturing-app-worker`
4. Re-test `/health`
