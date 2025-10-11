# Test de rapidité des 3 modèles LLM
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "TEST DE RAPIDITE - 3 MODELES" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

$resultats = @()

# Test 1: MICRO MODEL (tinyllama)
Write-Host "[1/3] Test MICRO Model (tinyllama)..." -ForegroundColor Yellow
Write-Host "Query: 'Qui?'" -ForegroundColor Gray
$start = Get-Date
try {
    $r1 = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Qui?","top_k":2}' -TimeoutSec 90
    $time1 = (Get-Date) - $start
    
    Write-Host "  Temps: $([math]::Round($time1.TotalSeconds,1))s" -ForegroundColor Green
    Write-Host "  Modele: $($r1.stats.model_used)" -ForegroundColor Cyan
    Write-Host "  Confiance: $([math]::Round($r1.confidence,2))" -ForegroundColor Cyan
    
    $resultats += @{
        modele = "MICRO (tinyllama)"
        temps = [math]::Round($time1.TotalSeconds,1)
        model_used = $r1.stats.model_used
        confiance = [math]::Round($r1.confidence,2)
        status = "OK"
    }
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
    $resultats += @{
        modele = "MICRO (tinyllama)"
        temps = 0
        model_used = "N/A"
        confiance = 0
        status = "ERREUR"
    }
}

Start-Sleep -Seconds 3

# Test 2: FAST MODEL (qwen2.5:3b)
Write-Host "`n[2/3] Test FAST Model (qwen2.5:3b)..." -ForegroundColor Yellow
Write-Host "Query: 'Resume la circulaire'" -ForegroundColor Gray
$start = Get-Date
try {
    $r2 = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Resume la circulaire","top_k":3}' -TimeoutSec 90
    $time2 = (Get-Date) - $start
    
    Write-Host "  Temps: $([math]::Round($time2.TotalSeconds,1))s" -ForegroundColor Green
    Write-Host "  Modele: $($r2.stats.model_used)" -ForegroundColor Cyan
    Write-Host "  Confiance: $([math]::Round($r2.confidence,2))" -ForegroundColor Cyan
    
    $resultats += @{
        modele = "FAST (qwen2.5:3b)"
        temps = [math]::Round($time2.TotalSeconds,1)
        model_used = $r2.stats.model_used
        confiance = [math]::Round($r2.confidence,2)
        status = "OK"
    }
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
    $resultats += @{
        modele = "FAST (qwen2.5:3b)"
        temps = 0
        model_used = "N/A"
        confiance = 0
        status = "ERREUR"
    }
}

Start-Sleep -Seconds 3

# Test 3: DEEP MODEL (qwen2:7b)
Write-Host "`n[3/3] Test DEEP Model (qwen2:7b)..." -ForegroundColor Yellow
Write-Host "Query: 'Analyse detaillee' (depth=high)" -ForegroundColor Gray
$start = Get-Date
try {
    $r3 = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Analyse detaillee de la circulaire","depth":"high","top_k":5}' -TimeoutSec 120
    $time3 = (Get-Date) - $start
    
    Write-Host "  Temps: $([math]::Round($time3.TotalSeconds,1))s" -ForegroundColor Green
    Write-Host "  Modele: $($r3.stats.model_used)" -ForegroundColor Cyan
    Write-Host "  Confiance: $([math]::Round($r3.confidence,2))" -ForegroundColor Cyan
    
    $resultats += @{
        modele = "DEEP (qwen2:7b)"
        temps = [math]::Round($time3.TotalSeconds,1)
        model_used = $r3.stats.model_used
        confiance = [math]::Round($r3.confidence,2)
        status = "OK"
    }
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
    $resultats += @{
        modele = "DEEP (qwen2:7b)"
        temps = 0
        model_used = "N/A"
        confiance = 0
        status = "ERREUR"
    }
}

# Afficher tableau récapitulatif
Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "RESULTATS FINAUX" -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

foreach($r in $resultats) {
    $couleur = if($r.status -eq "OK"){"Green"}else{"Red"}
    Write-Host "$($r.modele):" -ForegroundColor Yellow
    Write-Host "  Status: $($r.status)" -ForegroundColor $couleur
    Write-Host "  Temps: $($r.temps)s" -ForegroundColor $couleur
    Write-Host "  Modele utilise: $($r.model_used)" -ForegroundColor Cyan
    Write-Host "  Confiance: $($r.confiance)" -ForegroundColor Cyan
    Write-Host ""
}

# Statistiques
$tempsOK = $resultats | Where-Object {$_.status -eq "OK"} | Select-Object -ExpandProperty temps
if($tempsOK.Count -gt 0) {
    $moyenneTemps = ($tempsOK | Measure-Object -Average).Average
    $minTemps = ($tempsOK | Measure-Object -Minimum).Minimum
    $maxTemps = ($tempsOK | Measure-Object -Maximum).Maximum
    
    Write-Host "STATISTIQUES:" -ForegroundColor Cyan
    Write-Host "  Temps moyen: $([math]::Round($moyenneTemps,1))s" -ForegroundColor Yellow
    Write-Host "  Plus rapide: $([math]::Round($minTemps,1))s" -ForegroundColor Green
    Write-Host "  Plus lent: $([math]::Round($maxTemps,1))s" -ForegroundColor Red
}
