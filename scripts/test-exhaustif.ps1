# Tests Exhaustifs - Phases 1, 2 & 3
# Rapidite, Precision, Selection LLM, Citations UX

$results = @()

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "TESTS EXHAUSTIFS - AI PERFORMANCE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ============================================
# PARTIE 1: RAPIDITE & PRECISION
# ============================================
Write-Host "[PARTIE 1] RAPIDITE & PRECISION" -ForegroundColor Yellow
Write-Host "Tests a froid (4x) puis a chaud (4x)`n" -ForegroundColor Gray

# Tests a FROID (premiere execution, modeles pas charges)
Write-Host "--- TESTS A FROID ---" -ForegroundColor Magenta
$coldTests = @()

for($i=1; $i -le 4; $i++) {
    Write-Host "Test Froid $i/4..." -ForegroundColor Gray
    $start = Get-Date
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
            -Method POST -ContentType "application/json" `
            -Body "{`"query`":`"Qu'est-ce que la circulaire 2017?`",`"top_k`":5}" `
            -TimeoutSec 90
        $duration = (Get-Date) - $start
        
        $coldTests += @{
            test = "Froid_$i"
            time = [math]::Round($duration.TotalSeconds, 2)
            model = $r.stats.model_used
            confidence = [math]::Round($r.confidence, 3)
            sources = $r.sources.Count
            answer_length = $r.answer.Length
        }
        
        Write-Host "  Temps: $([math]::Round($duration.TotalSeconds,2))s | Confiance: $([math]::Round($r.confidence,3)) | Sources: $($r.sources.Count)" -ForegroundColor Green
    } catch {
        Write-Host "  ERREUR: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 2
}

# Tests a CHAUD (modeles deja charges)
Write-Host "`n--- TESTS A CHAUD ---" -ForegroundColor Magenta
$hotTests = @()

for($i=1; $i -le 4; $i++) {
    Write-Host "Test Chaud $i/4..." -ForegroundColor Gray
    $start = Get-Date
    try {
        $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
            -Method POST -ContentType "application/json" `
            -Body "{`"query`":`"Resumez la circulaire 2017`",`"top_k`":5}" `
            -TimeoutSec 60
        $duration = (Get-Date) - $start
        
        $hotTests += @{
            test = "Chaud_$i"
            time = [math]::Round($duration.TotalSeconds, 2)
            model = $r.stats.model_used
            confidence = [math]::Round($r.confidence, 3)
            sources = $r.sources.Count
            answer_length = $r.answer.Length
        }
        
        Write-Host "  Temps: $([math]::Round($duration.TotalSeconds,2))s | Confiance: $([math]::Round($r.confidence,3)) | Sources: $($r.sources.Count)" -ForegroundColor Green
    } catch {
        Write-Host "  ERREUR: $_" -ForegroundColor Red
    }
    Start-Sleep -Seconds 1
}

# Analyse Partie 1
$avgColdTime = ($coldTests | Measure-Object -Property time -Average).Average
$avgHotTime = ($hotTests | Measure-Object -Property time -Average).Average
$avgConfidence = (($coldTests + $hotTests) | Measure-Object -Property confidence -Average).Average

Write-Host "`n--- RESULTATS PARTIE 1 ---" -ForegroundColor Cyan
Write-Host "Temps moyen a FROID: $([math]::Round($avgColdTime,2))s" -ForegroundColor $(if($avgColdTime -lt 60){'Green'}elseif($avgColdTime -lt 120){'Yellow'}else{'Red'})
Write-Host "Temps moyen a CHAUD: $([math]::Round($avgHotTime,2))s" -ForegroundColor $(if($avgHotTime -lt 30){'Green'}elseif($avgHotTime -lt 60){'Yellow'}else{'Red'})
Write-Host "Confiance moyenne: $([math]::Round($avgConfidence,3))" -ForegroundColor $(if($avgConfidence -gt 0.6){'Green'}elseif($avgConfidence -gt 0.4){'Yellow'}else{'Red'})
Write-Host "Amelioration a chaud: $([math]::Round((1 - $avgHotTime/$avgColdTime)*100,1))%" -ForegroundColor Green

$results += @{
    partie = 1
    avgColdTime = $avgColdTime
    avgHotTime = $avgHotTime
    avgConfidence = $avgConfidence
    status = if($avgHotTime -lt 30 -and $avgConfidence -gt 0.5){"OK"}else{"ATTENTION"}
}

# ============================================
# PARTIE 2: SELECTION LLM ADEQUATE
# ============================================
Write-Host "`n`n[PARTIE 2] SELECTION LLM ADEQUATE" -ForegroundColor Yellow
Write-Host "4 tests pour verifier selection modele`n" -ForegroundColor Gray

$llmTests = @()

# Test 1: MICRO (ultra-court)
Write-Host "Test LLM 1/4: MICRO (ultra-court)..." -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Qui?","top_k":2}' -TimeoutSec 30
    $isMicro = $r.stats.model_used -match 'tinyllama'
    Write-Host "  Modele: $($r.stats.model_used) | $(if($isMicro){'OK MICRO'}else{'ERREUR: attendu tinyllama'})" `
        -ForegroundColor $(if($isMicro){'Green'}else{'Red'})
    $llmTests += @{test="MICRO"; expected="tinyllama"; got=$r.stats.model_used; ok=$isMicro}
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Start-Sleep -Seconds 2

# Test 2: FAST (standard)
Write-Host "Test LLM 2/4: FAST (standard)..." -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Quelle est la circulaire?","top_k":5}' -TimeoutSec 45
    $isFast = $r.stats.model_used -match '3b'
    Write-Host "  Modele: $($r.stats.model_used) | $(if($isFast){'OK FAST'}else{'ATTENTION'})" `
        -ForegroundColor $(if($isFast){'Green'}else{'Yellow'})
    $llmTests += @{test="FAST"; expected="qwen2.5:3b"; got=$r.stats.model_used; ok=$isFast}
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Start-Sleep -Seconds 2

# Test 3: DEEP (complexe avec mot-cle)
Write-Host "Test LLM 3/4: DEEP (mot-cle 'pourquoi')..." -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Pourquoi cette circulaire existe?","top_k":8}' -TimeoutSec 60
    $isDeep = $r.stats.model_used -match '7b'
    Write-Host "  Modele: $($r.stats.model_used) | $(if($isDeep){'OK DEEP'}else{'ATTENTION'})" `
        -ForegroundColor $(if($isDeep){'Green'}else{'Yellow'})
    $llmTests += @{test="DEEP_keyword"; expected="qwen2:7b"; got=$r.stats.model_used; ok=$isDeep}
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Start-Sleep -Seconds 2

# Test 4: DEEP (flag explicite)
Write-Host "Test LLM 4/4: DEEP (flag depth=high)..." -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Question simple","depth":"high","top_k":5}' -TimeoutSec 60
    $isDeep = $r.stats.model_used -match '7b'
    Write-Host "  Modele: $($r.stats.model_used) | $(if($isDeep){'OK DEEP'}else{'ERREUR'})" `
        -ForegroundColor $(if($isDeep){'Green'}else{'Red'})
    $llmTests += @{test="DEEP_flag"; expected="qwen2:7b"; got=$r.stats.model_used; ok=$isDeep}
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}

# Analyse Partie 2
$llmSuccess = ($llmTests | Where-Object {$_.ok -eq $true}).Count
Write-Host "`n--- RESULTATS PARTIE 2 ---" -ForegroundColor Cyan
Write-Host "Tests reussis: $llmSuccess/4 ($([math]::Round($llmSuccess/4*100,0))%)" `
    -ForegroundColor $(if($llmSuccess -ge 3){'Green'}elseif($llmSuccess -ge 2){'Yellow'}else{'Red'})

$results += @{
    partie = 2
    success = $llmSuccess
    total = 4
    status = if($llmSuccess -ge 3){"OK"}else{"PROBLEME"}
}

# ============================================
# PARTIE 3: CITATIONS UX
# ============================================
Write-Host "`n`n[PARTIE 3] CITATIONS UX" -ForegroundColor Yellow
Write-Host "4 tests pour verifier citations inline et API`n" -ForegroundColor Gray

$citationTests = @()

# Test 1: Citations inline dans reponse
Write-Host "Test Citation 1/4: Citations inline [1],[2]..." -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Parlez-moi de la circulaire","top_k":5}' -TimeoutSec 45
    $hasCitations = $r.answer -match '\[\d+\]'
    $citCount = ([regex]::Matches($r.answer, '\[\d+\]')).Count
    Write-Host "  Citations inline trouvees: $citCount | $(if($hasCitations){'OK'}else{'ATTENTION'})" `
        -ForegroundColor $(if($hasCitations){'Green'}else{'Yellow'})
    $citationTests += @{test="Inline"; found=$citCount; ok=$hasCitations}
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}
Start-Sleep -Seconds 2

# Test 2: Sources retournees
Write-Host "Test Citation 2/4: Sources dans reponse..." -ForegroundColor Gray
try {
    $r = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/answer" `
        -Method POST -ContentType "application/json" `
        -Body '{"query":"Resume circulaire","top_k":5}' -TimeoutSec 45
    $hasSources = $r.sources.Count -gt 0
    Write-Host "  Sources retournees: $($r.sources.Count) | $(if($hasSources){'OK'}else{'ERREUR'})" `
        -ForegroundColor $(if($hasSources){'Green'}else{'Red'})
    $citationTests += @{test="Sources"; found=$r.sources.Count; ok=$hasSources}
    
    # Test 3: API Preview Citation
    if($hasSources) {
        Write-Host "Test Citation 3/4: API preview citation..." -ForegroundColor Gray
        $testChunkId = $r.sources[0].chunk_id
        $preview = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/citation/preview/$testChunkId" `
            -Method GET -TimeoutSec 10
        $hasPreview = $preview.document -and $preview.content
        Write-Host "  API Preview: $(if($hasPreview){'OK'}else{'ERREUR'}) | Doc: $($preview.document.title)" `
            -ForegroundColor $(if($hasPreview){'Green'}else{'Red'})
        $citationTests += @{test="API_Preview"; ok=$hasPreview}
        
        # Test 4: API Locate Citation
        Write-Host "Test Citation 4/4: API locate citation..." -ForegroundColor Gray
        $locate = Invoke-RestMethod -Uri "http://localhost:5200/api/rag/citation/locate/$testChunkId" `
            -Method GET -TimeoutSec 10
        $hasLocate = $locate.location -and $locate.document_title
        Write-Host "  API Locate: $(if($hasLocate){'OK'}else{'ERREUR'}) | Page: $($locate.location.page)" `
            -ForegroundColor $(if($hasLocate){'Green'}else{'Red'})
        $citationTests += @{test="API_Locate"; ok=$hasLocate}
    }
} catch {
    Write-Host "  ERREUR: $_" -ForegroundColor Red
}

# Analyse Partie 3
$citSuccess = ($citationTests | Where-Object {$_.ok -eq $true}).Count
Write-Host "`n--- RESULTATS PARTIE 3 ---" -ForegroundColor Cyan
Write-Host "Tests reussis: $citSuccess/$($citationTests.Count) ($([math]::Round($citSuccess/$citationTests.Count*100,0))%)" `
    -ForegroundColor $(if($citSuccess -eq $citationTests.Count){'Green'}else{'Yellow'})

$results += @{
    partie = 3
    success = $citSuccess
    total = $citationTests.Count
    status = if($citSuccess -ge 3){"OK"}else{"PROBLEME"}
}

# ============================================
# RESUME FINAL
# ============================================
Write-Host "`n`n========================================" -ForegroundColor Cyan
Write-Host "RESUME FINAL DES TESTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$r1 = $results[0]
$r2 = $results[1]
$r3 = $results[2]

Write-Host "`n[1] RAPIDITE & PRECISION: $($r1.status)" -ForegroundColor $(if($r1.status -eq "OK"){'Green'}else{'Yellow'})
Write-Host "    - Temps froid: $([math]::Round($r1.avgColdTime,1))s" -ForegroundColor Gray
Write-Host "    - Temps chaud: $([math]::Round($r1.avgHotTime,1))s" -ForegroundColor Gray
Write-Host "    - Confiance: $([math]::Round($r1.avgConfidence,2))" -ForegroundColor Gray

Write-Host "`n[2] SELECTION LLM: $($r2.status)" -ForegroundColor $(if($r2.status -eq "OK"){'Green'}else{'Red'})
Write-Host "    - Reussis: $($r2.success)/$($r2.total)" -ForegroundColor Gray

Write-Host "`n[3] CITATIONS UX: $($r3.status)" -ForegroundColor $(if($r3.status -eq "OK"){'Green'}else{'Yellow'})
Write-Host "    - Reussis: $($r3.success)/$($r3.total)" -ForegroundColor Gray

$globalStatus = if($r1.status -eq "OK" -and $r2.status -eq "OK" -and $r3.status -eq "OK"){"EXCELLENT"}
                elseif($r2.status -eq "PROBLEME"){"CRITIQUE"}
                else{"BON AVEC AMELIORATIONS"}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "STATUT GLOBAL: $globalStatus" -ForegroundColor $(if($globalStatus -eq "EXCELLENT"){'Green'}elseif($globalStatus -eq "CRITIQUE"){'Red'}else{'Yellow'})
Write-Host "========================================`n" -ForegroundColor Cyan
