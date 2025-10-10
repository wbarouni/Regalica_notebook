# Test script for notebooks isolation
# Verifies that notebooks properly isolate documents

Write-Host "=== NOTEBOOKS ISOLATION TEST ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3001/api"

# Test 1: Create Notebook 1
Write-Host "1. Creating Notebook 1..." -ForegroundColor Yellow
$notebook1 = Invoke-RestMethod -Uri "$baseUrl/notebooks/create" -Method POST -ContentType "application/json" -Body '{"title":"Test Notebook 1","description":"First test notebook"}'
$nb1Id = $notebook1.id
Write-Host "   Created: $nb1Id" -ForegroundColor Green

# Test 2: Create Notebook 2
Write-Host "2. Creating Notebook 2..." -ForegroundColor Yellow
$notebook2 = Invoke-RestMethod -Uri "$baseUrl/notebooks/create" -Method POST -ContentType "application/json" -Body '{"title":"Test Notebook 2","description":"Second test notebook"}'
$nb2Id = $notebook2.id
Write-Host "   Created: $nb2Id" -ForegroundColor Green

# Test 3: Get all notebooks
Write-Host "3. Listing all notebooks..." -ForegroundColor Yellow
$allNotebooks = Invoke-RestMethod -Uri "$baseUrl/notebooks/list" -Method GET
Write-Host "   Found: $($allNotebooks.Length) notebooks" -ForegroundColor Green

# Test 4: Boot Notebook 1
Write-Host "4. Booting Notebook 1..." -ForegroundColor Yellow
$boot1 = Invoke-RestMethod -Uri "$baseUrl/notebooks/$nb1Id/boot" -Method GET
Write-Host "   Documents: $($boot1.documents.Length)" -ForegroundColor Green
Write-Host "   Messages: $($boot1.session.Length)" -ForegroundColor Green

# Test 5: Boot Notebook 2
Write-Host "5. Booting Notebook 2..." -ForegroundColor Yellow
$boot2 = Invoke-RestMethod -Uri "$baseUrl/notebooks/$nb2Id/boot" -Method GET
Write-Host "   Documents: $($boot2.documents.Length)" -ForegroundColor Green
Write-Host "   Messages: $($boot2.session.Length)" -ForegroundColor Green

Write-Host ""
Write-Host "=== TEST RESULTS ===" -ForegroundColor Cyan
Write-Host "Notebook 1 ID: $nb1Id" -ForegroundColor White
Write-Host "Notebook 2 ID: $nb2Id" -ForegroundColor White
Write-Host ""
Write-Host "Next: Upload documents via UI and rerun this script to verify isolation" -ForegroundColor Yellow
