#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
POLL_SECONDS="${POLL_SECONDS:-6}"
MAX_POLLS="${MAX_POLLS:-80}"

echo "API_BASE=${API_BASE}"
echo "POLL_SECONDS=${POLL_SECONDS} MAX_POLLS=${MAX_POLLS}"

post_run() {
  local name="$1"
  local payload="$2"
  local response
  response="$(curl -sS -X POST "${API_BASE}/api/trends/start" -H 'Content-Type: application/json' -d "${payload}")"
  local task_id
  task_id="$(printf '%s' "${response}" | python3 - <<'PY'
import json,sys
try:
    data=json.loads(sys.stdin.read())
    print(data.get("id") or data.get("task_id") or "")
except Exception:
    print("")
PY
)"
  if [[ -z "${task_id}" ]]; then
    echo "[$name] failed to start: ${response}"
    return 1
  fi
  echo "[$name] task_id=${task_id}"
  poll_run "${name}" "${task_id}"
}

poll_run() {
  local name="$1"
  local task_id="$2"
  local i
  for (( i=1; i<=MAX_POLLS; i++ )); do
    local status_json status
    status_json="$(curl -sS "${API_BASE}/api/trends/${task_id}")"
    status="$(printf '%s' "${status_json}" | python3 - <<'PY'
import json,sys
try:
    d=json.loads(sys.stdin.read())
    print((d.get("query") or {}).get("status",""))
except Exception:
    print("")
PY
)"
    echo "[$name] poll=${i} status=${status}"
    if [[ "${status}" == "completed" || "${status}" == "failed" ]]; then
      break
    fi
    sleep "${POLL_SECONDS}"
  done

  local final_json summary_overview attestation_status
  final_json="$(curl -sS "${API_BASE}/api/trends/${task_id}")"
  summary_overview="$(printf '%s' "${final_json}" | python3 - <<'PY'
import json,sys
try:
    d=json.loads(sys.stdin.read())
    print(((d.get("summary") or {}).get("overview") or "")[:140])
except Exception:
    print("")
PY
)"
  attestation_status="$(printf '%s' "${final_json}" | python3 - <<'PY'
import json,sys
try:
    d=json.loads(sys.stdin.read())
    print(((d.get("summary") or {}).get("attestationData") or {}).get("status",""))
except Exception:
    print("")
PY
)"
  echo "[$name] overview='${summary_overview}'"
  echo "[$name] attestation_status=${attestation_status}"

  local export_code
  export_code="$(curl -sS -o /tmp/trende-${task_id}.pdf -w '%{http_code}' "${API_BASE}/api/trends/${task_id}/export?format=pdf")"
  local size
  size="$(wc -c < "/tmp/trende-${task_id}.pdf" | tr -d ' ')"
  echo "[$name] export_status=${export_code} export_size=${size}B"
}

post_run "fast" '{"idea":"Fast smoke check: summarize current AI infra momentum.","platforms":["newsapi","hackernews"],"models":["venice","openrouter_llama_70b"],"relevanceThreshold":0.45}'
post_run "standard" '{"idea":"Standard smoke check: compare privacy AI vs agent infra narratives this week.","platforms":["newsapi","web","hackernews","stackexchange"],"models":["venice","openrouter_llama_70b","openrouter_hermes"],"relevanceThreshold":0.6}'
post_run "deep" '{"idea":"Deep smoke check: identify convergent signals across Eigen, Base, and BNB ecosystems.","platforms":["newsapi","web","hackernews","stackexchange","coingecko","tinyfish"],"models":["venice","aisa","openrouter_llama_70b","openrouter_hermes","openrouter_stepfun"],"relevanceThreshold":0.8}'

echo "Smoke matrix complete."
