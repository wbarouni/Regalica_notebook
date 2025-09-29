#!/bin/bash
set -euo pipefail

echo "Resetting dev environment..."

# Stop and remove all containers and volumes
docker compose -f deploy/docker/docker-compose.yml down -v

# Clean up node_modules if they exist
if [ -d "backend/node_modules" ]; then
    echo "Cleaning backend dependencies..."
    rm -rf backend/node_modules
fi

if [ -d "frontend/node_modules" ]; then
    echo "Cleaning frontend dependencies..."
    rm -rf frontend/node_modules
fi

# Clean up build artifacts
if [ -d "frontend/dist" ]; then
    echo "Cleaning build artifacts..."
    rm -rf frontend/dist
fi

if [ -d "frontend/.angular" ]; then
    echo "Cleaning Angular cache..."
    rm -rf frontend/.angular
fi

# Clean up proofs directory
if [ -d "proofs" ]; then
    echo "Cleaning proof files..."
    rm -f proofs/*.log proofs/*.json proofs/*.png proofs/*.txt
fi

echo "Dev environment reset complete"
