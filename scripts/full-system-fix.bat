@echo off
echo ========================================
echo REGALICA NOTEBOOK - COMPLETE SYSTEM FIX
echo ========================================
echo.

echo [1/15] Stopping all services...
docker-compose -f deploy/docker/docker-compose.yml down
echo.

echo [2/15] Cleaning Docker system...
docker system prune -f
docker volume prune -f
echo.

echo [3/15] Building and starting all services...
docker-compose -f deploy/docker/docker-compose.yml up -d --build
echo.

echo [4/15] Waiting for services to start (60 seconds)...
timeout /t 60 /nobreak
echo.

echo [5/15] Checking Docker containers status...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [6/15] Testing Backend API...
curl -s -o backend-health.txt -w "Backend Health Status: %%{http_code}\n" http://localhost:3000/health/ready
type backend-health.txt
echo.

echo [7/15] Testing Frontend...
curl -s -o frontend-status.txt -w "Frontend Status: %%{http_code}\n" http://localhost:4200
type frontend-status.txt
echo.

echo [8/15] Testing Embedder Service...
curl -s -o embedder-health.txt -w "Embedder Status: %%{http_code}\n" http://localhost:8000/health
type embedder-health.txt
echo.

echo [9/15] Testing Reranker Service...
curl -s -o reranker-health.txt -w "Reranker Status: %%{http_code}\n" http://localhost:8001/health
type reranker-health.txt
echo.

echo [10/15] Testing Clusterer Service...
curl -s -o clusterer-health.txt -w "Clusterer Status: %%{http_code}\n" http://localhost:8002/health
type clusterer-health.txt
echo.

echo [11/15] Testing Ollama Service...
curl -s -o ollama-status.txt -w "Ollama Status: %%{http_code}\n" http://localhost:11434/api/tags
type ollama-status.txt
echo.

echo [12/15] Testing Database Connection...
curl -s -o db-test.txt -w "Database Test Status: %%{http_code}\n" http://localhost:3000/api/ingest/documents
type db-test.txt
echo.

echo [13/15] Checking Service Logs for Errors...
echo --- Backend Logs ---
docker logs confident_solomon --tail 20 2>nul || echo "Backend container not found"
echo.

echo --- Embedder Logs ---
docker logs docker-embedder-1 --tail 20 2>nul || echo "Embedder container not found"
echo.

echo --- Reranker Logs ---
docker logs docker-reranker-1 --tail 20 2>nul || echo "Reranker container not found"
echo.

echo [14/15] Testing Magic Studio Endpoints...
curl -s -o studio-test.txt -w "Studio Status: %%{http_code}\n" http://localhost:3000/api/studio/health
type studio-test.txt
echo.

echo [15/15] Final System Status...
curl -s http://localhost:3000/health/ready
echo.
echo.

echo ========================================
echo SYSTEM FIX COMPLETE
echo ========================================
echo.
echo Summary of fixes applied:
echo 1. Updated Docker configuration with lighter models
echo 2. Fixed health check configurations
echo 3. Added memory limits for Python services
echo 4. Restarted all services with fresh builds
echo.
echo Next Steps:
echo 1. Access frontend at http://localhost:4200
echo 2. Test document upload and RAG queries
echo 3. Verify Magic Studio functionality
echo.
echo If any service shows errors, check the logs above.
pause

del backend-health.txt 2>nul
del frontend-status.txt 2>nul
del embedder-health.txt 2>nul
del reranker-health.txt 2>nul
del clusterer-health.txt 2>nul
del ollama-status.txt 2>nul
del db-test.txt 2>nul
del studio-test.txt 2>nul
