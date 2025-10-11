@echo off
cls
echo ========================================
echo   COMPLETE DOCKER RESET AND DEPLOYMENT
echo ========================================
echo.
echo WARNING: This will DELETE ALL Docker containers,
echo images, volumes, and caches for this project!
echo.
echo Press Ctrl+C to cancel, or
pause
echo.

echo [Step 1/12] Stopping ALL containers...
for /f "tokens=*" %%i in ('docker ps -aq') do docker stop %%i 2>nul
echo [OK] All containers stopped
echo.

echo [Step 2/12] Removing ALL containers...
for /f "tokens=*" %%i in ('docker ps -aq') do docker rm -f %%i 2>nul
echo [OK] All containers removed
echo.

echo [Step 3/12] Removing project-specific images...
docker rmi -f docker-frontend docker-backend docker-embedder docker-reranker docker-clusterer 2>nul
echo [OK] Project images removed
echo.

echo [Step 4/12] Removing ALL volumes...
cd deploy\docker
docker-compose down -v --remove-orphans 2>nul
docker volume prune -f 2>nul
cd ..\..
echo [OK] All volumes removed
echo.

echo [Step 5/12] Pruning Docker system...
docker system prune -af --volumes
echo [OK] Docker system pruned
echo.

echo [Step 6/12] Building services (this may take 10-15 minutes)...
cd deploy\docker
docker-compose build --no-cache --parallel
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    cd ..\..
    pause
    exit /b 1
)
cd ..\..
echo [OK] All services built successfully
echo.

echo [Step 7/12] Starting PostgreSQL...
cd deploy\docker
docker-compose up -d postgres
cd ..\..
timeout /t 10 /nobreak >nul
echo [OK] PostgreSQL started
echo.

echo [Step 8/12] Starting Redis...
cd deploy\docker
docker-compose up -d redis
cd ..\..
timeout /t 5 /nobreak >nul
echo [OK] Redis started
echo.

echo [Step 9/12] Starting Ollama...
cd deploy\docker
docker-compose up -d ollama
cd ..\..
timeout /t 10 /nobreak >nul
echo [OK] Ollama started
echo.

echo [Step 10/12] Starting ML services (Embedder, Reranker, Clusterer)...
echo This will download large models - may take 5-10 minutes...
cd deploy\docker
docker-compose up -d embedder reranker clusterer
cd ..\..
echo Waiting 90 seconds for ML models to download and initialize...
timeout /t 90 /nobreak >nul
echo [OK] ML services started
echo.

echo [Step 11/12] Starting Backend...
cd deploy\docker
docker-compose up -d backend
cd ..\..
timeout /t 15 /nobreak >nul
echo [OK] Backend started
echo.

echo [Step 12/12] Starting Frontend...
cd deploy\docker
docker-compose up -d frontend
cd ..\..
timeout /t 10 /nobreak >nul
echo [OK] Frontend started
echo.

echo ========================================
echo   CHECKING FINAL STATUS
echo ========================================
echo.
cd deploy\docker
docker-compose ps
echo.
docker-compose logs --tail=5 backend frontend
cd ..\..
echo.

echo ========================================
echo   DEPLOYMENT COMPLETE
echo ========================================
echo.
echo Access your application:
echo   Frontend: http://localhost:4300
echo   Backend API: http://localhost:5200
echo.
echo If any service is not running, check logs:
echo   cd deploy\docker
echo   docker-compose logs [service-name]
echo.
pause
