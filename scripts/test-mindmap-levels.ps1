# Test Mind Map Hierarchical Levels
# PowerShell Script pour tester les modifications TASK 1 & 2

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Mind Map Levels - Test Local" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if port is in use
function Test-Port {
    param($Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
    return $connection
}

# Check Backend (Port 3000)
Write-Host "[1/5] Checking Backend (Port 3000)..." -ForegroundColor Yellow
if (Test-Port -Port 3000) {
    Write-Host "  ✓ Backend is running" -ForegroundColor Green
} else {
    Write-Host "  ✗ Backend NOT running" -ForegroundColor Red
    Write-Host "  → Starting backend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"
    Write-Host "  → Waiting 10 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Check PostgreSQL (Port 5432)
Write-Host "[2/5] Checking PostgreSQL (Port 5432)..." -ForegroundColor Yellow
if (Test-Port -Port 5432) {
    Write-Host "  ✓ PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "  ✗ PostgreSQL NOT running" -ForegroundColor Red
    Write-Host "  → Please start PostgreSQL manually" -ForegroundColor Yellow
}

# Check Embedder (Port 8000)
Write-Host "[3/5] Checking Embedder (Port 8000)..." -ForegroundColor Yellow
if (Test-Port -Port 8000) {
    Write-Host "  ✓ Embedder is running" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Embedder NOT running (optional for testing)" -ForegroundColor Yellow
}

# Check Clusterer (Port 8002)
Write-Host "[4/5] Checking Clusterer (Port 8002)..." -ForegroundColor Yellow
if (Test-Port -Port 8002) {
    Write-Host "  ✓ Clusterer is running" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Clusterer NOT running (optional for testing)" -ForegroundColor Yellow
}

# Check Frontend (Port 4200)
Write-Host "[5/5] Checking Frontend (Port 4200)..." -ForegroundColor Yellow
if (Test-Port -Port 4200) {
    Write-Host "  ✓ Frontend is running" -ForegroundColor Green
} else {
    Write-Host "  ✗ Frontend NOT running" -ForegroundColor Red
    Write-Host "  → Starting frontend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm start"
    Write-Host "  → Waiting 20 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Services Status Summary" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Port -Port 3000) { Write-Host "✓ Backend:    http://localhost:3000" -ForegroundColor Green }
else { Write-Host "✗ Backend:    NOT RUNNING" -ForegroundColor Red }

if (Test-Port -Port 5432) { Write-Host "✓ PostgreSQL: Port 5432" -ForegroundColor Green }
else { Write-Host "✗ PostgreSQL: NOT RUNNING" -ForegroundColor Red }

if (Test-Port -Port 4200) { Write-Host "✓ Frontend:   http://localhost:4200" -ForegroundColor Green }
else { Write-Host "✗ Frontend:   NOT RUNNING" -ForegroundColor Red }

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "How to Test Mind Map Levels" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open: http://localhost:4200" -ForegroundColor White
Write-Host "2. Create or open a Notebook" -ForegroundColor White
Write-Host "3. Upload some documents (PDFs, TXT)" -ForegroundColor White
Write-Host "4. Ask a question in chat" -ForegroundColor White
Write-Host "5. Open Magic Studio → Mind Map tab" -ForegroundColor White
Write-Host "6. Click 'Generate Mind Map'" -ForegroundColor White
Write-Host ""
Write-Host "Expected Result:" -ForegroundColor Yellow
Write-Host "  → Backend logs will show:" -ForegroundColor White
Write-Host "    [MindMap] Assigned hierarchical levels: L1=1, L2=X, L3=X, L4=X" -ForegroundColor Gray
Write-Host ""
Write-Host "  → API Response will include:" -ForegroundColor White
Write-Host '    { "nodes": [{ "level": 1 }, { "level": 2 }, ...] }' -ForegroundColor Gray
Write-Host ""
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:4200"

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Test Complete - Browser Opened" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
