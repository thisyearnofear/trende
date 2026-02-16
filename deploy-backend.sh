#!/bin/bash
set -e

DEPLOY_DIR="/opt/trende-deploy"
REPO_DIR="$DEPLOY_DIR/trende-repo"
ENV_FILE="$DEPLOY_DIR/.env"
CONTAINER_NAME="trende-backend"
IMAGE_NAME="trende/backend:latest"

cd $REPO_DIR

echo "📥 Pulling latest changes from main branch..."
git fetch origin
git checkout main
git pull origin main

echo "🔨 Building Docker image..."
docker build -t $IMAGE_NAME -f config/docker/Dockerfile .

echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

echo "🚀 Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  --env-file $ENV_FILE \
  -p 8000:8000 \
  --restart unless-stopped \
  $IMAGE_NAME

echo "⏳ Waiting for service to start..."
sleep 5

echo "✅ Checking health..."
curl -s --max-time 10 http://localhost:8000/health || echo "Health check failed (might need to configure endpoint)"

echo ""
echo "🎉 Deployment complete!"
echo "📊 Container status:"
docker ps | grep $CONTAINER_NAME

echo ""
echo "📝 View logs with: docker logs -f $CONTAINER_NAME"
