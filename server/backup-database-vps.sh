#!/bin/bash
# Backup PostgreSQL (primary) for Manufacturing app on VPS
# Optional: also copies legacy SQLite file if still present

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/manufacturing-app}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
APP_DIR="${APP_DIR:-$HOME/deployments/manufacturing-app/server}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-admin}"
DB_NAME="${DB_NAME:-manufacturing_db}"

if [ -z "${DB_PASSWORD:-}" ]; then
  echo "❌ DB_PASSWORD is required"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
export PGPASSWORD="$DB_PASSWORD"

echo "=========================================="
echo "PostgreSQL backup"
echo "=========================================="

if ! command -v pg_dump &> /dev/null; then
  echo "❌ pg_dump not found"
  exit 1
fi

OUT="$BACKUP_DIR/postgresql-${DB_NAME}.$TIMESTAMP.dump"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc -f "$OUT"
echo "✅ PostgreSQL backup: $OUT"
ls -lh "$OUT"

# Legacy SQLite (optional)
if [ -f "$APP_DIR/database.sqlite" ]; then
  cp "$APP_DIR/database.sqlite" "$BACKUP_DIR/database.sqlite.$TIMESTAMP"
  echo "✅ Also copied legacy SQLite snapshot"
fi

unset PGPASSWORD
echo "Done."
