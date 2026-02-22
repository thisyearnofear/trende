#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/opt/trende-deploy"
REPO_DIR="$DEPLOY_DIR/trende-repo"
ENV_FILE="$DEPLOY_DIR/.env"
CONTAINER_NAME="trende-backend"
IMAGE_NAME="trende/backend:latest"
NETWORK_NAME="trende-network"
DB_FILE="$DEPLOY_DIR/trends.db"
MAX_WAIT_SECONDS="${MAX_WAIT_SECONDS:-90}"
HEALTH_POLL_SECONDS="${HEALTH_POLL_SECONDS:-3}"
ATTEST_HEALTH_URL="http://localhost:8000/api/health/attestation"
CONSENSUS_HEALTH_URL="http://localhost:8000/api/health/consensus"

wait_for_health() {
  local url="$1"
  local name="$2"
  local elapsed=0

  while [ "$elapsed" -lt "$MAX_WAIT_SECONDS" ]; do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      echo "✅ ${name} is healthy: ${url}"
      return 0
    fi
    sleep "$HEALTH_POLL_SECONDS"
    elapsed=$((elapsed + HEALTH_POLL_SECONDS))
  done

  echo "❌ Timed out waiting for ${name}: ${url}"
  return 1
}

cd "$REPO_DIR"

echo "📥 Pulling latest changes from main branch..."
git fetch origin
git checkout main
git pull origin main

echo "🔨 Building Docker image..."
docker build -t "$IMAGE_NAME" -f config/docker/Dockerfile .

echo "🛑 Stopping existing container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

echo "🚀 Starting new container..."
touch "$DB_FILE"
docker run -d \
  --name "$CONTAINER_NAME" \
  --env-file "$ENV_FILE" \
  --network "$NETWORK_NAME" \
  -p 8000:8000 \
  -v "$DB_FILE:/app/trends.db" \
  --restart unless-stopped \
  "$IMAGE_NAME"

echo "⏳ Waiting for service to start..."
sleep 2

echo "✅ Checking health..."
wait_for_health "$ATTEST_HEALTH_URL" "attestation route"
wait_for_health "$CONSENSUS_HEALTH_URL" "consensus route"

echo ""
echo "🎉 Deployment complete!"
echo "📊 Container status:"
docker ps | grep "$CONTAINER_NAME"

echo ""
echo "📝 View logs with: docker logs -f $CONTAINER_NAME"
