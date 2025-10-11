# Test des temps réels avec tinyllama (optimisations CPU)
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST TEMPS REELS - TINYLLAMA OPTIMISE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Attendre que les services soient prêts
Start-Sleep -Seconds 10

$resultats = @()

# Test 1: Query MICRO (ultra-courte)
Write-Host "[Test 1/3] Query MICRO: 'Qui?'" -ForegroundColor Yellow
$start = Get-Date
try {
    $r1 = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Qui?","top_k":4}' -TimeoutSec 90
    $time1 = (Get-Date) - $start
    
    Write-Host "  ✅ SUCCES" -ForegroundColor Green
    Write-Host "  Temps: $([math]::Round($time1.TotalSeconds,1))s" -ForegroundColor Cyan
    Write-Host "  Modele: $($r1.stats.model_used)" -ForegroundColor Gray
    Write-Host "  Confiance: $([math]::Round($r1.confidence,2))" -ForegroundColor Gray
    Write-Host "  Retrieved: $($r1.stats.retrieved_count) chunks" -ForegroundColor Gray
    
    $resultats += [PSCustomObject]@{
        Test = "MICRO (Qui?)"
        Temps = [math]::Round($time1.TotalSeconds,1)
        Modele = $r1.stats.model_used
        Confiance = [math]::Round($r1.confidence,2)
        Status = "OK"
    }
} catch {
    Write-Host "  ❌ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    $resultats += [PSCustomObject]@{
        Test = "MICRO (Qui?)"
        Temps = 0
        Modele = "N/A"
        Confiance = 0
        Status = "ERREUR"
    }
}

Start-Sleep -Seconds 3

# Test 2: Query FAST (standard)
Write-Host "`n[Test 2/3] Query FAST: 'Resume circulaire'" -ForegroundColor Yellow
$start = Get-Date
try {
    $r2 = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Resume circulaire","top_k":4}' -TimeoutSec 90
    $time2 = (Get-Date) - $start
    
    Write-Host "  ✅ SUCCES" -ForegroundColor Green
    Write-Host "  Temps: $([math]::Round($time2.TotalSeconds,1))s" -ForegroundColor Cyan
    Write-Host "  Modele: $($r2.stats.model_used)" -ForegroundColor Gray
    Write-Host "  Confiance: $([math]::Round($r2.confidence,2))" -ForegroundColor Gray
    Write-Host "  Retrieved: $($r2.stats.retrieved_count) chunks" -ForegroundColor Gray
    
    $resultats += [PSCustomObject]@{
        Test = "FAST (Resume)"
        Temps = [math]::Round($time2.TotalSeconds,1)
        Modele = $r2.stats.model_used
        Confiance = [math]::Round($r2.confidence,2)
        Status = "OK"
    }
} catch {
    Write-Host "  ❌ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    $resultats += [PSCustomObject]@{
        Test = "FAST (Resume)"
        Temps = 0
        Modele = "N/A"
        Confiance = 0
        Status = "ERREUR"
    }
}

Start-Sleep -Seconds 3

# Test 3: Query DEEP (depth=high)
Write-Host "`n[Test 3/3] Query DEEP: 'Analyse detaillee' (depth=high)" -ForegroundColor Yellow
$start = Get-Date
try {
    $r3 = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Analyse detaillee circulaire","depth":"high","top_k":4}' -TimeoutSec 90
    $time3 = (Get-Date) - $start
    
    Write-Host "  ✅ SUCCES" -ForegroundColor Green
    Write-Host "  Temps: $([math]::Round($time3.TotalSeconds,1))s" -ForegroundColor Cyan
    Write-Host "  Modele: $($r3.stats.model_used)" -ForegroundColor Gray
    Write-Host "  Confiance: $([math]::Round($r3.confidence,2))" -ForegroundColor Gray
    Write-Host "  Retrieved: $($r3.stats.retrieved_count) chunks" -ForegroundColor Gray
    
    $resultats += [PSCustomObject]@{
        Test = "DEEP (Analyse)"
        Temps = [math]::Round($time3.TotalSeconds,1)
        Modele = $r3.stats.model_used
        Confiance = [math]::Round($r3.confidence,2)
        Status = "OK"
    }
} catch {
    Write-Host "  ❌ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    $resultats += [PSCustomObject]@{
        Test = "DEEP (Analyse)"
        Temps = 0
        Modele = "N/A"
        Confiance = 0
        Status = "ERREUR"
    }
}

# Afficher résultats
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RESULTATS FINAUX" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$resultats | Format-Table -AutoSize

# Statistiques
$testsOK = ($resultats | Where-Object {$_.Status -eq "OK"}).Count
$tempsTotal = ($resultats | Where-Object {$_.Status -eq "OK"} | Measure-Object -Property Temps -Sum).Sum
$tempsMoyen = if($testsOK -gt 0) {$tempsTotal / $testsOK} else {0}
$confianceMoy = if($testsOK -gt 0) {($resultats | Where-Object {$_.Status -eq "OK"} | Measure-Object -Property Confiance -Average).Average} else {0}

Write-Host "STATISTIQUES:" -ForegroundColor Cyan
Write-Host "  Tests reussis: $testsOK/3" -ForegroundColor $(if($testsOK -eq 3){"Green"}else{"Yellow"})
Write-Host "  Temps moyen: $([math]::Round($tempsMoyen,1))s" -ForegroundColor Cyan
Write-Host "  Confiance moyenne: $([math]::Round($confianceMoy,2))" -ForegroundColor Cyan
Write-Host "  Modele utilise: tinyllama:latest (optimise CPU)" -ForegroundColor Gray

if($testsOK -eq 3) {
    Write-Host "`n✅ TOUS LES TESTS FONCTIONNENT!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Certains tests ont échoué" -ForegroundColor Yellow
}
