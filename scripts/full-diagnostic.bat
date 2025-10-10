@echo off
echo ========================================
echo REGALICA NOTEBOOK - FULL DIAGNOSTIC
echo ========================================
echo.

echo [1] Checking Docker containers...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [2] Testing Backend API...
curl -s -o backend-health.txt -w "Backend Health Status: %%{http_code}\n" http://localhost:3000/health/ready
type backend-health.txt
echo.

echo [3] Testing Frontend...
curl -s -o frontend-status.txt -w "Frontend Status: %%{http_code}\n" http://localhost:4200
type frontend-status.txt
echo.

echo [4] Testing Embedder Service (8000)...
curl -s -o embedder-health.txt -w "Embedder Status: %%{http_code}\n" http://localhost:8000/health
type embedder-health.txt
echo.

echo [5] Testing Reranker Service (8001)...
curl -s -o reranker-health.txt -w "Reranker Status: %%{http_code}\n" http://localhost:8001/health
type reranker-health.txt
echo.

echo [6] Testing Clusterer Service (8002)...
curl -s -o clusterer-health.txt -w "Clusterer Status: %%{http_code}\n" http://localhost:8002/health
type clusterer-health.txt
echo.

echo [7] Testing Ollama Service (11434)...
curl -s -o ollama-status.txt -w "Ollama Status: %%{http_code}\n" http://localhost:11434/api/tags
type ollama-status.txt
echo.

echo [8] Testing Database Connection...
curl -s -o db-test.txt -w "Database Test Status: %%{http_code}\n" http://localhost:3000/api/ingest/documents
type db-test.txt
echo.

echo [9] Testing Backend Config...
curl -s -o config-test.txt -w "Config Test Status: %%{http_code}\n" http://localhost:3000/api/config
type config-test.txt
echo.

echo [10] Checking Service Logs...
echo --- Embedder Logs (last 10 lines) ---
docker logs docker-embedder-1 --tail 10 2>nul || echo "Embedder logs not available"
echo.

echo --- Reranker Logs (last 10 lines) ---
docker logs docker-reranker-1 --tail 10 2>nul || echo "Reranker logs not available"
echo.

echo --- Backend Logs (last 10 lines) ---
docker logs confident_solomon --tail 10 2>nul || echo "Backend logs not available"
echo.

echo ========================================
echo DIAGNOSTIC COMPLETE
echo ========================================
echo.
echo Summary:
echo - Check HTTP status codes above (200 = OK)
echo - Check service logs for any error messages
echo - Verify all required services are running
echo.
echo If services show errors, try:
echo 1. docker-compose -f deploy/docker/docker-compose.yml restart
echo 2. Check environment variables in .env file
echo 3. Verify Docker has enough resources
echo.
pause

del backend-health.txt 2>nul
del frontend-status.txt 2>nul
del embedder-health.txt 2>nul
del reranker-health.txt 2>nul
del clusterer-health.txt 2>nul
del ollama-status.txt 2>nul
del db-test.txt 2>nul
del config-test.txt 2>nul
