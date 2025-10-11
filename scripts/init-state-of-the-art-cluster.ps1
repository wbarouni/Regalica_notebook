Write-Host "🚀 Initializing STATE-OF-THE-ART Ollama Cluster" -ForegroundColor Cyan
Write-Host "   Latest 2025 models: SmolLM2, Gemma3, Qwen3" -ForegroundColor Gray
Write-Host ""

# Model configuration
$models = @{
    "ollama-micro"  = "smollm2:360m-instruct-q4_K_M"
    "ollama-fast-1" = "gemma3:4b-instruct-q4_0"
    "ollama-fast-2" = "gemma3:4b-instruct-q4_0"
    "ollama-deep"   = "qwen3:14b-instruct-q4_0"
}

Write-Host "📋 Model Plan:" -ForegroundColor Yellow
Write-Host "   • MICRO  (ollama-micro):  SmolLM2 360M   -> 5-8s   -> 250MB" -ForegroundColor White
Write-Host "   • FAST-1 (ollama-fast-1): Gemma3 4B      -> 12-18s -> 2.5GB" -ForegroundColor White
Write-Host "   • FAST-2 (ollama-fast-2): Gemma3 4B      -> 12-18s -> 2.5GB" -ForegroundColor White
Write-Host "   • DEEP   (ollama-deep):   Qwen3 14B      -> 35-45s -> 8.5GB" -ForegroundColor White
Write-Host "   Total download: ~14GB" -ForegroundColor Gray
Write-Host ""

# Check if containers are running
Write-Host "1. Checking cluster status..." -ForegroundColor Yellow
$runningContainers = docker ps --format "{{.Names}}" | Select-String -Pattern "ollama-"
if ($runningContainers.Count -eq 0) {
    Write-Host "   WARNING: No Ollama containers running." -ForegroundColor Red
    Write-Host "   Please run: docker-compose up -d ollama-micro ollama-fast-1 ollama-fast-2 ollama-deep ollama-lb" -ForegroundColor White
    exit 1
}
Write-Host "   OK: Cluster containers running" -ForegroundColor Green

# Pull models in parallel
Write-Host "`n2. Pulling models in parallel..." -ForegroundColor Yellow
$jobs = @()
foreach ($container in $models.Keys) {
    $model = $models[$container]
    Write-Host "   Starting pull: $model on $container" -ForegroundColor Gray
    
    $jobs += Start-Job -ScriptBlock {
        param($cont, $mod)
        docker exec $cont ollama pull $mod 2>&1
    } -ArgumentList $container, $model
}

Write-Host "`n   Downloading models (may take 10-15 minutes)..." -ForegroundColor Gray
Write-Host "   Monitor progress: docker logs -f ollama-micro" -ForegroundColor Cyan

# Wait for completion
$jobs | Wait-Job | Out-Null
$jobs | Remove-Job

Write-Host "`n3. Verifying installation..." -ForegroundColor Yellow
$allSuccess = $true
foreach ($container in $models.Keys) {
    $model = $models[$container]
    $checkOutput = docker exec $container ollama list 2>&1 | Select-String -Pattern $model.Split(':')[0]
    if ($checkOutput) {
        Write-Host "   OK: $container - $model installed" -ForegroundColor Green
    } else {
        Write-Host "   FAILED: $container - $model" -ForegroundColor Red
        $allSuccess = $false
    }
}

if ($allSuccess) {
    Write-Host "`n✅ STATE-OF-THE-ART cluster ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Deployed Models:" -ForegroundColor Cyan
    Write-Host "   • MICRO (5%):  SmolLM2 360M  -> 5-8s   (ultra-fast)" -ForegroundColor White
    Write-Host "   • FAST  (80%): Gemma3 4B     -> 12-18s (2x instances)" -ForegroundColor White
    Write-Host "   • DEEP  (15%): Qwen3 14B     -> 35-45s (best quality)" -ForegroundColor White
    Write-Host ""
    Write-Host "Expected Performance:" -ForegroundColor Cyan
    Write-Host "   • Average: ~15s (vs 76s before)" -ForegroundColor Green
    Write-Host "   • Quality: STATE-OF-THE-ART 2025" -ForegroundColor Green
    Write-Host "   • CPU: 8/8 cores utilized" -ForegroundColor Green
    Write-Host "   • RAM: 16GB/16GB used" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Run: .\test-cluster.ps1" -ForegroundColor White
    Write-Host "   2. Restart backend: docker-compose restart backend" -ForegroundColor White
} else {
    Write-Host "`n❌ Some models failed to install" -ForegroundColor Red
    Write-Host "   Check logs: docker logs ollama-micro" -ForegroundColor White
    exit 1
}
