@echo off
echo ========================================
echo REGALICA NOTEBOOK - FULL STACK DIAGNOSTIC
echo ========================================
echo.

echo [1/10] Checking Docker Services...
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.

echo [2/10] Testing PostgreSQL Connection...
curl -s http://localhost:5433 >nul 2>&1
if %errorlevel%==0 (
    echo [OK] PostgreSQL is accessible on port 5433
) else (
    echo [WARN] PostgreSQL connection check inconclusive
)
echo.

echo [3/10] Testing Redis Connection...
curl -s http://localhost:6379 >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Redis is accessible on port 6379
) else (
    echo [WARN] Redis connection check inconclusive
)
echo.

echo [4/10] Testing Ollama LLM...
curl -s http://localhost:11435/api/tags
echo.

echo [5/10] Testing Embedder Service...
curl -s http://localhost:8000/health
echo.

echo [6/10] Testing Reranker Service...
curl -s http://localhost:8001/health
echo.

echo [7/10] Testing Backend API...
curl -s http://localhost:5200/
echo.

echo [8/10] Testing Backend RAG Endpoints...
curl -s http://localhost:5200/api/ingest/health
echo.

echo [9/10] Testing Backend Studio Endpoints...
curl -s http://localhost:5200/api/studio/health
echo.

echo [10/10] Testing Frontend...
curl -s http://localhost:4300/ | findstr "Regalica"
echo.

echo.
echo ========================================
echo DIAGNOSTIC COMPLETE
echo ========================================
echo.
echo Services Summary:
echo - PostgreSQL: port 5433
echo - Redis: port 6379
echo - Ollama LLM: port 11435
echo - Embedder: port 8000
echo - Reranker: port 8001
echo - Backend API: port 5200
echo - Frontend: port 4300
echo.
echo To view logs:
echo   docker logs docker-backend-1
echo   docker logs docker-frontend-1
echo   docker logs docker-postgres-1
echo.
pause
