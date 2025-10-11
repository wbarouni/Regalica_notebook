@echo off
echo ========================================
echo Regalica Notebook - Status Check
echo ========================================
echo.

echo [1/3] Checking Docker Containers...
cd deploy\docker
docker-compose ps
echo.

echo [2/3] Testing Frontend (http://localhost:4300)...
curl -I http://localhost:4300 2>&1
echo.

echo [3/3] Testing Backend (http://localhost:5200/health/ready)...
curl -I http://localhost:5200/health/ready 2>&1
echo.

echo ========================================
echo Check complete!
echo ========================================
pause
