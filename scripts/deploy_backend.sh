#!/bin/bash

# Deployment script for building and deploying only the backend service
# Usage: ./deploy_backend.sh [branch_name]
# Default branch is 'main' (standardized)

set -e  # Exit immediately if a command exits with a non-zero status

BRANCH=${1:-main}

echo "🚀 Starting backend-only deployment for branch: $BRANCH"

# Navigate to the project directory
cd "$(dirname "$0")/.."

echo "🔄 Fetching latest changes from origin..."
git fetch origin

echo "🔧 Resetting to origin/$BRANCH..."
git reset --hard origin/$BRANCH

echo "🐳 Building backend service only..."
docker compose build api

echo " ↑ Deploying backend service..."
docker compose up -d api

echo "✅ Backend deployment completed successfully!"
echo "📊 Service status:"
docker compose ps

echo ""
echo "💡 To check logs: docker compose logs api -f"
echo "💡 To rollback: git reset --hard HEAD~1 && docker compose build api && docker compose up -d api"