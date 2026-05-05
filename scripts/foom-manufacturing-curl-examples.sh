#!/usr/bin/env bash
#
# FOOM external manufacturing API — curl examples (same paths as server/services/external-api.service.js).
#
# Prerequisites:
#   export EXTERNAL_API_BASE_URL="https://foom-api.kyuantum.com"
#   export EXTERNAL_API_BEARER_TOKEN="your-bearer-token"
#
# Usage:
#   chmod +x scripts/foom-manufacturing-curl-examples.sh
#   ./scripts/foom-manufacturing-curl-examples.sh list
#   ./scripts/foom-manufacturing-curl-examples.sh list-started   # requires jq
#   ./scripts/foom-manufacturing-curl-examples.sh put
#   ./scripts/foom-manufacturing-curl-examples.sh patch-started
#   ./scripts/foom-manufacturing-curl-examples.sh patch-finished
#
# Optional: override resource UUID (default below)
#   MANUFACTURING_UUID=.... ./scripts/foom-manufacturing-curl-examples.sh get

set -euo pipefail

pretty_json() {
  if command -v jq >/dev/null 2>&1; then jq .; else cat; fi
}

BASE="${EXTERNAL_API_BASE_URL:?Set EXTERNAL_API_BASE_URL}"
TOKEN="${EXTERNAL_API_BEARER_TOKEN:?Set EXTERNAL_API_BEARER_TOKEN}"
ID="${MANUFACTURING_UUID:-ac9d28c3-d174-4c22-974b-cd052b299c18}"

LIST_URL="${BASE%/}/api/v1/manufacturing"
ITEM_URL="${BASE%/}/api/v1/manufacturing/${ID}"
STATUS_URL="${ITEM_URL}/status"

HDR_AUTH=(-H "Authorization: Bearer ${TOKEN}" -H "Accept: application/json" -H "Content-Type: application/json")
HDR_GET=(-H "Authorization: Bearer ${TOKEN}" -H "Accept: application/json")

cmd="${1:-}"

case "$cmd" in
  list)
    echo "# GET full manufacturing collection (same as app prefetch)"
    curl -sS "${HDR_GET[@]}" "$LIST_URL" | pretty_json
    ;;
  list-started)
    echo "# Rows where status == started (needs jq). Response may be [] or {data: []}"
    if ! command -v jq >/dev/null 2>&1; then
      echo "Install jq or run: list (then filter manually)" >&2
      exit 1
    fi
    curl -sS "${HDR_GET[@]}" "$LIST_URL" |
      jq '(.data // .) | if type == "array" then map(select(.status == "started")) else [] end'
    ;;
  get)
    echo "# GET current row (optional sanity check before PUT/PATCH)"
    curl -sS "${HDR_AUTH[@]}" "$ITEM_URL" | pretty_json
    ;;
  put)
    echo "# PUT full manufacturing body — edit manufacturing_id, sku, qty, leader, timestamps as needed"
    curl -sS -X PUT "${HDR_AUTH[@]}" "$ITEM_URL" \
      -d "$(cat <<'JSON'
{
  "manufacturing_id": "PROD/MO/34582",
  "sku": "Example SKU",
  "sku_name": "Example SKU Name",
  "target_qty": 5000,
  "done_qty": 0,
  "status": "idle",
  "manual_finished_qty": 0,
  "leader_name": "Your Leader",
  "started_at": null,
  "finished_at": null
}
JSON
)" | pretty_json
    ;;
  put-stdin)
    echo "# PUT body from stdin: jq -n {...} | ./scripts/foom-manufacturing-curl-examples.sh put-stdin"
    curl -sS -X PUT "${HDR_AUTH[@]}" "$ITEM_URL" -d @- | pretty_json
    ;;
  patch-started)
    echo "# PATCH .../status — transition to started (same as app confirm flow)"
    curl -sS -X PATCH "${HDR_AUTH[@]}" "$STATUS_URL" \
      -d '{"status":"started","started_at":null}' | pretty_json
    ;;
  patch-finished)
    echo "# PATCH .../status — transition to finished (Submit MO uses PUT full body + this PATCH)"
    curl -sS -X PATCH "${HDR_AUTH[@]}" "$STATUS_URL" \
      -d '{"status":"finished"}' | pretty_json
    ;;
  urls)
    echo "ITEM_URL=$ITEM_URL"
    echo "STATUS_URL=$STATUS_URL"
    ;;
  help|--help|-h|"")
    sed -n '2,30p' "$0"
    echo ""
    echo "Commands: list | list-started | get | put | put-stdin | patch-started | patch-finished | urls"
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    exit 1
    ;;
esac
