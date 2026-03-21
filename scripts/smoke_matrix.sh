#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
POLL_SECONDS="${POLL_SECONDS:-6}"
MAX_POLLS="${MAX_POLLS:-80}"
SMOKE_WALLET="${SMOKE_WALLET:-}"

curl_json() {
  local method="$1"
  local url="$2"
  local payload="${3:-}"
  if [[ -n "${SMOKE_WALLET}" ]]; then
    if [[ -n "${payload}" ]]; then
      curl -sS -X "${method}" "${url}" -H 'Content-Type: application/json' -H "X-Wallet-Address: ${SMOKE_WALLET}" -d "${payload}"
    else
      curl -sS -X "${method}" "${url}" -H "X-Wallet-Address: ${SMOKE_WALLET}"
    fi
  else
    if [[ -n "${payload}" ]]; then
      curl -sS -X "${method}" "${url}" -H 'Content-Type: application/json' -d "${payload}"
    else
      curl -sS -X "${method}" "${url}"
    fi
  fi
}

echo "API_BASE=${API_BASE}"
echo "POLL_SECONDS=${POLL_SECONDS} MAX_POLLS=${MAX_POLLS}"

post_run() {
  local name="$1"
  local payload="$2"
  local response
  response="$(curl_json POST "${API_BASE}/api/trends/start" "${payload}")"
  local task_id
  task_id="$(printf '%s' "${response}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("id") or d.get("task_id") or "")' 2>/dev/null || true)"
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
    status_json="$(curl_json GET "${API_BASE}/api/trends/${task_id}")"
    status="$(printf '%s' "${status_json}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("query") or {}).get("status",""))' 2>/dev/null || true)"
    echo "[$name] poll=${i} status=${status}"
    if [[ "${status}" == "completed" || "${status}" == "failed" ]]; then
      break
    fi
    sleep "${POLL_SECONDS}"
  done

  local final_json summary_overview attestation_status
  final_json="$(curl_json GET "${API_BASE}/api/trends/${task_id}")"
  summary_overview="$(printf '%s' "${final_json}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(((d.get("summary") or {}).get("overview") or "")[:140])' 2>/dev/null || true)"
  attestation_status="$(printf '%s' "${final_json}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(((d.get("summary") or {}).get("attestationData") or {}).get("status",""))' 2>/dev/null || true)"
  echo "[$name] overview='${summary_overview}'"
  echo "[$name] attestation_status=${attestation_status}"

  local export_code
  if [[ -n "${SMOKE_WALLET}" ]]; then
    export_code="$(curl -sS -o /tmp/trende-${task_id}.pdf -w '%{http_code}' -H "X-Wallet-Address: ${SMOKE_WALLET}" "${API_BASE}/api/trends/${task_id}/export?format=pdf")"
  else
    export_code="$(curl -sS -o /tmp/trende-${task_id}.pdf -w '%{http_code}' "${API_BASE}/api/trends/${task_id}/export?format=pdf")"
  fi
  local size
  size="$(wc -c < "/tmp/trende-${task_id}.pdf" | tr -d ' ')"
  echo "[$name] export_status=${export_code} export_size=${size}B"
}

post_run "fast" '{"idea":"Fast smoke check: summarize current AI infra momentum.","platforms":["newsapi","hackernews"],"models":["venice","openrouter_llama_70b"],"relevanceThreshold":0.45}'
post_run "standard" '{"idea":"Standard smoke check: compare privacy AI vs agent infra narratives this week.","platforms":["newsapi","web","hackernews","stackexchange"],"models":["venice","openrouter_llama_70b","openrouter_hermes"],"relevanceThreshold":0.6}'
post_run "deep" '{"idea":"Deep smoke check: identify convergent signals across Base, BNB, and onchain AI ecosystems.","platforms":["newsapi","web","hackernews","stackexchange","coingecko","tinyfish"],"models":["venice","aisa","openrouter_llama_70b","openrouter_hermes","openrouter_stepfun"],"relevanceThreshold":0.8}'

echo "Smoke matrix complete."
