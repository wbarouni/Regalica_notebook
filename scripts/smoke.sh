#!/bin/bash
set -euo pipefail

# Smoke test - Test rapide de santé du système
echo "Running smoke test..."

# Test du backend
echo "Testing backend health endpoint..."
if curl -sf http://localhost:8080/health/ready > /dev/null 2>&1; then
    echo "✅ Backend is responding"
else
    echo "❌ Backend is not responding"
    exit 1
fi

# Test du frontend
echo "Testing frontend..."
if curl -sf http://localhost:4200/ > /dev/null 2>&1; then
    echo "✅ Frontend is responding"
else
    echo "❌ Frontend is not responding"
    exit 1
fi

echo "✅ Smoke test passed - all critical services are responding"
exit 0
