# Test Phase 1: Vérification scores avec alpha=0.6, beta=0.4

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TEST PHASE 1: NOUVEAU CALCUL SCORES" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$query = "Resume la circulaire"
$apiUrl = "http://localhost:5200/api/rag/answer"

Write-Host "[1/3] Envoi requête: '$query'..." -ForegroundColor Yellow

try {
    $body = @{
        query = $query
        top_k = 6
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType "application/json" -TimeoutSec 120
    
    Write-Host "✓ Réponse reçue!" -ForegroundColor Green
    Write-Host "`n[2/3] Analyse réponse..." -ForegroundColor Yellow
    
    if ($response.answer -eq "NO_ANSWER") {
        Write-Host "✗ ÉCHEC: Toujours NO_ANSWER" -ForegroundColor Red
        Write-Host "   → Phase 1 insuffisante, passer à Phase 2" -ForegroundColor Yellow
    } else {
        Write-Host "✓ SUCCÈS: Réponse générée!" -ForegroundColor Green
        Write-Host "   Longueur: $($response.answer.Length) caractères" -ForegroundColor White
        Write-Host "   Citations: $($response.sources.Count)" -ForegroundColor White
        Write-Host "   Confiance: $([math]::Round($response.confidence, 3))" -ForegroundColor White
    }
    
    Write-Host "`n[3/3] Vérification logs backend..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    
    $logs = docker-compose -f deploy/docker/docker-compose.yml logs backend --tail=30 2>&1 | Out-String
    
    # Extraire les scores finaux
    if ($logs -match "Scores finaux: min=(\d+\.\d+), max=(\d+\.\d+), avg=(\d+\.\d+), std=(\d+\.\d+)") {
        $min = [double]$matches[1]
        $max = [double]$matches[2]
        $avg = [double]$matches[3]
        $std = [double]$matches[4]
        
        Write-Host "`n📊 SCORES FINAUX (avec alpha=0.6, beta=0.4):" -ForegroundColor Cyan
        Write-Host "   Min:    $min" -ForegroundColor White
        Write-Host "   Max:    $max $(if ($max -gt 0.40) {'✓ BON'} else {'✗ Insuffisant'})" -ForegroundColor $(if ($max -gt 0.40) {'Green'} else {'Red'})
        Write-Host "   Avg:    $avg $(if ($avg -gt 0.35) {'✓ BON'} else {'✗ Insuffisant'})" -ForegroundColor $(if ($avg -gt 0.35) {'Green'} else {'Red'})
        Write-Host "   StdDev: $std" -ForegroundColor White
        
        # Extraire aussi les scores rerank pour comparaison
        if ($logs -match "Scores rerank: min=(\d+\.\d+), max=(\d+\.\d+), avg=(\d+\.\d+), std=(\d+\.\d+)") {
            $rerankMax = [double]$matches[2]
            Write-Host "`n📉 SCORES RERANK (bruts):" -ForegroundColor Cyan
            Write-Host "   Max: $rerankMax $(if ($rerankMax -lt 0.15) {'⚠️ Faible (modèle mal calibré)'} else {'OK'})" -ForegroundColor Yellow
        }
        
        Write-Host "`n"
        if ($max -gt 0.45 -and $avg -gt 0.35) {
            Write-Host "✅ PHASE 1 RÉUSSIE!" -ForegroundColor Green
            Write-Host "   Les scores finaux ont bien augmenté" -ForegroundColor Green
            Write-Host "   Le système devrait fonctionner maintenant" -ForegroundColor Green
        } elseif ($max -gt 0.35) {
            Write-Host "⚠️  PHASE 1 PARTIELLEMENT EFFICACE" -ForegroundColor Yellow
            Write-Host "   Amélioration visible mais peut-être insuffisante" -ForegroundColor Yellow
            Write-Host "   Recommandation: Passer à PHASE 2" -ForegroundColor Yellow
        } else {
            Write-Host "✗ PHASE 1 INSUFFISANTE" -ForegroundColor Red
            Write-Host "   Les scores restent trop bas" -ForegroundColor Red
            Write-Host "   Action: Implémenter PHASE 2 (expand-and-rerank)" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  Impossible d'extraire les scores des logs" -ForegroundColor Yellow
        Write-Host "   Vérifier manuellement les logs:" -ForegroundColor Yellow
        Write-Host "   docker-compose -f deploy/docker/docker-compose.yml logs backend --tail=50" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "✗ ERREUR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Le backend n'est peut-être pas prêt, attendez 10s et réessayez" -ForegroundColor Yellow
}

Write-Host "`n========================================`n" -ForegroundColor Cyan
