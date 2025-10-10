@echo off
echo ========================================
echo REGALICA NOTEBOOK - COMPLETE AUDIT
echo ========================================
echo.

echo [1/10] Checking Docker containers status...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [2/10] Testing Backend Health Endpoint...
curl -s http://localhost:3000/health/ready
echo.
echo.

echo [3/10] Testing Backend Root Endpoint...
curl -s http://localhost:3000/
echo.
echo.

echo [4/10] Testing Backend Config Endpoint...
curl -s http://localhost:3000/api/config
echo.
echo.

echo [5/10] Testing Frontend Access...
curl -s -o nul -w "Frontend HTTP Status: %%{http_code}\n" http://localhost:4200
echo.

echo [6/10] Testing Embedder Service...
curl -s http://localhost:8000/health
echo.
echo.

echo [7/10] Testing Reranker Service...
curl -s http://localhost:8001/health
echo.
echo.

echo [8/10] Testing Clusterer Service...
curl -s http://localhost:8002/health
echo.
echo.

echo [9/10] Testing Ollama Service...
curl -s http://localhost:11434/api/tags
echo.
echo.

echo [10/10] Testing Database Connection (via Backend)...
curl -s http://localhost:3000/api/ingest/documents
echo.
echo.

echo ========================================
echo AUDIT COMPLETE
echo ========================================
echo.
echo Next Steps:
echo 1. If any service shows errors, check logs: docker-compose -f deploy/docker/docker-compose.yml logs [service]
echo 2. Test Magic Studio features via browser at http://localhost:4200
echo 3. Upload a document and submit a query to test full pipeline
echo.
pause
