#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:8000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
TOPIC="${1:-Verifiable AI news synthesis and meme momentum in crypto}"
PLATFORMS="${PLATFORMS:-[\"twitter\",\"newsapi\",\"web\"]}"
POLL_SECS="${POLL_SECS:-3}"
MAX_POLLS="${MAX_POLLS:-80}"

echo "== Trende Finals Flow =="
echo "API:      ${API_URL}"
echo "Frontend: ${FRONTEND_URL}"
echo "Topic:    ${TOPIC}"

START_PAYLOAD=$(cat <<JSON
{"idea": "${TOPIC}", "platforms": ${PLATFORMS}}
JSON
)

START_RESPONSE=$(curl -sS -X POST "${API_URL}/api/trends/start" \
  -H "Content-Type: application/json" \
  -d "${START_PAYLOAD}")

TASK_ID=$(printf '%s' "${START_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id') or d.get('task_id') or '')")
if [[ -z "${TASK_ID}" ]]; then
  echo "Failed to start analysis. Response: ${START_RESPONSE}"
  exit 1
fi

echo "Started task: ${TASK_ID}"

for ((i=1; i<=MAX_POLLS; i++)); do
  STATUS_RESPONSE=$(curl -sS "${API_URL}/api/trends/status/${TASK_ID}")
  STATUS=$(printf '%s' "${STATUS_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))")
  echo "[${i}/${MAX_POLLS}] status=${STATUS}"

  if [[ "${STATUS}" == "completed" ]]; then
    break
  fi

  if [[ "${STATUS}" == "failed" ]]; then
    echo "Task failed. Inspect API status payload for logs."
    exit 2
  fi

  sleep "${POLL_SECS}"
done

RESULT_RESPONSE=$(curl -sS "${API_URL}/api/trends/${TASK_ID}")
SUMMARY=$(printf '%s' "${RESULT_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); s=((d.get('summary') or {}).get('overview') or ''); print(s[:240].replace('\\n',' '))")

echo
echo "== Completed =="
echo "Task ID: ${TASK_ID}"
echo "Summary: ${SUMMARY}"
echo "Forge (Meme): ${FRONTEND_URL}/meme/${TASK_ID}?view=meme"
echo "Forge (News): ${FRONTEND_URL}/meme/${TASK_ID}?view=news"
