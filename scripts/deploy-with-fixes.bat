@echo off
REM ========================================
REM Regalica Notebook - Complete Deployment with All Fixes Applied
REM This script deploys the system with all critical fixes in place
REM ========================================

echo ========================================
echo Regalica Notebook - Deployment Script
echo All Critical Fixes Applied
echo ========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running! Please start Docker Desktop first.
    pause
    exit /b 1
)

echo [1/10] Docker is running ✓
echo.

REM Navigate to project root
cd /d %~dp0..

REM Stop any existing containers
echo [2/10] Stopping existing containers...
cd deploy\docker
docker-compose down -v
echo.

REM Install backend dependencies
echo [3/10] Installing backend dependencies...
cd ..\..\backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
echo Backend dependencies installed ✓
echo.

REM Build Docker images
echo [4/10] Building Docker images...
cd ..\deploy\docker
docker-compose build --no-cache
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build Docker images
    pause
    exit /b 1
)
echo Docker images built ✓
echo.

REM Start services
echo [5/10] Starting all services...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services
    pause
    exit /b 1
)
echo Services started ✓
echo.

echo [6/10] Waiting for services to initialize (60 seconds)...
timeout /t 60 /nobreak >nul
echo.

echo [7/10] Checking service health...
echo.

REM Check PostgreSQL
echo Checking PostgreSQL + pgvector...
docker-compose exec -T postgres pg_isready -U postgres >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ PostgreSQL is ready
) else (
    echo   ✗ PostgreSQL is NOT ready
)

REM Check pgvector extension
docker-compose exec -T postgres psql -U postgres -d notebook -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ pgvector extension installed
) else (
    echo   ✗ pgvector extension NOT installed
)

REM Check Redis
echo Checking Redis...
docker-compose exec -T redis redis-cli ping >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Redis is ready
) else (
    echo   ✗ Redis is NOT ready
)

REM Check Embedder
echo Checking Embedder...
curl -f http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Embedder is ready
) else (
    echo   ✗ Embedder is NOT ready
)

REM Check Reranker
echo Checking Reranker...
curl -f http://localhost:8001/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Reranker is ready
) else (
    echo   ✗ Reranker is NOT ready
)

REM Check Clusterer
echo Checking Clusterer...
curl -f http://localhost:8002/health >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Clusterer is ready
) else (
    echo   ✗ Clusterer is NOT ready
)

REM Check Backend
echo Checking Backend...
curl -f http://localhost:5200/health/ready >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Backend is ready
) else (
    echo   ✗ Backend is NOT ready
)

REM Check Frontend
echo Checking Frontend...
curl -f http://localhost:4300 >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Frontend is ready
) else (
    echo   ✗ Frontend is NOT ready
)

REM Check Ollama Load Balancer
echo Checking Ollama Load Balancer...
curl -f http://localhost:11434/api/version >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Ollama Load Balancer is ready
) else (
    echo   ✗ Ollama Load Balancer is NOT ready
)

echo.
echo [8/10] Verifying critical fixes...
echo.

echo Checking database schema (vector type)...
docker-compose exec -T postgres psql -U postgres -d notebook -c "\d nbk.embeddings" | findstr "vector(1024)" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Database schema uses proper vector type
) else (
    echo   ✗ Database schema still uses TEXT type - FIX FAILED
)

echo Checking HNSW index...
docker-compose exec -T postgres psql -U postgres -d notebook -c "\di nbk.embeddings_vec_hnsw_idx" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ HNSW index exists
) else (
    echo   ✗ HNSW index NOT found - FIX FAILED
)

echo Checking Nginx routing configuration...
docker-compose exec -T ollama-lb cat /etc/nginx/nginx.conf | findstr "tinyllama" >nul 2>&1
if %errorlevel% equ 0 (
    echo   ✓ Nginx routing uses correct model names
) else (
    echo   ✗ Nginx routing configuration NOT updated - FIX FAILED
)

echo.
echo [9/10] Deployment Summary
echo ========================================
echo.
echo Services Status:
docker-compose ps
echo.

echo [10/10] Access Points:
echo   Frontend:  http://localhost:4300
echo   Backend:   http://localhost:5200
echo   Embedder:  http://localhost:8000
echo   Reranker:  http://localhost:8001
echo   Clusterer: http://localhost:8002
echo   Ollama LB: http://localhost:11434
echo.

echo ========================================
echo Deployment Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Open http://localhost:4300 in your browser
echo 2. Upload a document via the interface
echo 3. Test RAG queries
echo 4. Check logs: docker-compose logs -f backend
echo.

pause
