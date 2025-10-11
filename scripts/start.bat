@echo off
cls
echo ========================================
echo   REGALICA NOTEBOOK - MAGIC STUDIO
echo ========================================
echo.
echo Starting all services...
echo.

echo [1/4] Starting Docker services...
cd deploy\docker
docker-compose up -d
cd ..\..
echo.

echo [2/4] Waiting for services to be healthy (30 seconds)...
timeout /t 30 /nobreak >nul
echo.

echo [3/4] Checking service health...
docker ps --format "table {{.Names}}\t{{.Status}}"
echo.

echo [4/4] Services ready!
echo.
echo ========================================
echo   ACCESS YOUR APP
echo ========================================
echo.
echo Frontend (with Magic Studio):
echo   http://localhost:4300
echo.
echo Backend API:
echo   http://localhost:5200
echo.
echo LLM (Ollama):
echo   http://localhost:11435
echo.
echo ========================================
echo   MAGIC STUDIO FEATURES
echo ========================================
echo.
echo 1. Upload documents in Sources panel
echo 2. Ask questions in Chat
echo 3. Click "Magic Studio" button (bottom-right)
echo 4. Explore:
echo    - Mind Map (auto-generates from responses)
echo    - Podcast (TTS playback)
echo    - Actions (summaries, plans, flashcards)
echo.
echo Press any key to open the app in your browser...
pause >nul

start http://localhost:4300

echo.
echo App opened in browser!
echo.
echo To stop all services:
echo   cd deploy\docker
echo   docker-compose down
echo.
pause
