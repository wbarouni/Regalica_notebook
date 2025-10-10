@echo off
cls
echo ========================================
echo   REGALICA NOTEBOOK - COMPLETE DEPLOYMENT
echo ========================================
echo.

echo [Step 1/10] Checking Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)
echo [OK] Docker is available
echo.

echo [Step 2/10] Stopping existing containers...
cd deploy\docker
docker-compose down -v --remove-orphans 2>nul
cd ..\..
echo [OK] Containers stopped
echo.

echo [Step 3/10] Removing old images...
docker rmi docker-frontend docker-backend docker-embedder docker-reranker docker-clusterer 2>nul
echo [OK] Old images removed
echo.

echo [Step 4/10] Building services (this may take 5-10 minutes)...
cd deploy\docker
docker-compose build --no-cache --parallel
if %errorlevel% neq 0 (
    echo [ERROR] Build failed
    pause
    exit /b 1
)
cd ..\..
echo [OK] All services built
echo.

echo [Step 5/10] Starting core services...
cd deploy\docker
docker-compose up -d postgres redis ollama
cd ..\..
echo [OK] Core services started
echo.

echo [Step 6/10] Waiting for core services (20 seconds)...
timeout /t 20 /nobreak >nul
echo [OK] Core services should be ready
echo.

echo [Step 7/10] Starting ML services...
cd deploy\docker
docker-compose up -d embedder reranker clusterer
cd ..\..
echo [OK] ML services started
echo.

echo [Step 8/10] Waiting for ML services (60 seconds - downloading models)...
timeout /t 60 /nobreak >nul
echo [OK] ML services should be ready
echo.

echo [Step 9/10] Starting application services...
cd deploy\docker
docker-compose up -d backend frontend
cd ..\..
echo [OK] Application services started
echo.

echo [Step 10/10] Waiting for application to be ready (20 seconds)...
timeout /t 20 /nobreak >nul
echo.

echo ========================================
echo   CHECKING SERVICE STATUS
echo ========================================
echo.
cd deploy\docker
docker-compose ps
cd ..\..
echo.

echo ========================================
echo   DEPLOYMENT COMPLETE
echo ========================================
echo.
echo If all services show "Up" or "healthy", access:
echo.
echo   Frontend: http://localhost:4300
echo   Backend:  http://localhost:5200
echo.
echo If services are not all running, check logs:
echo   cd deploy\docker
echo   docker-compose logs [service-name]
echo.
echo Press any key to open the application...
pause >nul
start http://localhost:4300
