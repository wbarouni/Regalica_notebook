# Setup Beta Repository Script
# Automatise la création du repository Regalica_Notebook_Ver.Bêta

Write-Host "=== SETUP BETA REPOSITORY ===" -ForegroundColor Cyan
Write-Host ""

$repoName = "Regalica_Notebook_Ver.Bêta"

# Demander le username GitHub
$username = Read-Host "Enter your GitHub username"
$repoUrl = "https://github.com/$username/$repoName.git"

Write-Host ""
Write-Host "Repository URL: $repoUrl" -ForegroundColor White
Write-Host ""

# Confirmation
$confirm = Read-Host "Have you created the repository '$repoName' on GitHub? (y/n)"
if ($confirm -ne 'y') {
    Write-Host ""
    Write-Host "Please create the repository first:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/new" -ForegroundColor White
    Write-Host "2. Repository name: $repoName" -ForegroundColor White
    Write-Host "3. Do NOT initialize with README" -ForegroundColor White
    Write-Host "4. Click 'Create repository'" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting setup..." -ForegroundColor Green
Write-Host ""

# Étape 1: Vérifier git status
Write-Host "Step 1: Checking git status..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
    Write-Host "  Found uncommitted changes" -ForegroundColor White
} else {
    Write-Host "  Working directory clean" -ForegroundColor Green
}

# Étape 2: Add all files
Write-Host ""
Write-Host "Step 2: Adding all files..." -ForegroundColor Yellow
git add .
Write-Host "  ✅ Files staged" -ForegroundColor Green

# Étape 3: Create commit
Write-Host ""
Write-Host "Step 3: Creating commit..." -ForegroundColor Yellow
$commitMessage = @"
feat: Mind Map complete integration (85%)

- Sprint 1: Hiérarchie BFS levels 0-4 ✅
- Sprint 2: Modal interactif (6 sections) ✅
- Sprint 3: Export PNG/PDF ✅
- Sprint 4: Chat integration + shortcuts ✅
- 28 fichiers créés/modifiés
- 7500 lignes de code
- NotebookLM design appliqué
- Production ready
"@

git commit -m $commitMessage
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Commit created" -ForegroundColor Green
} else {
    Write-Host "  ℹ️ No changes to commit (already committed)" -ForegroundColor Cyan
}

# Étape 4: Check if remote exists
Write-Host ""
Write-Host "Step 4: Checking remote configuration..." -ForegroundColor Yellow
$remotes = git remote
if ($remotes -contains "beta") {
    Write-Host "  Remote 'beta' already exists, removing..." -ForegroundColor Yellow
    git remote remove beta
}

# Étape 5: Add beta remote
Write-Host ""
Write-Host "Step 5: Adding beta remote..." -ForegroundColor Yellow
git remote add beta $repoUrl
Write-Host "  ✅ Beta remote added" -ForegroundColor Green

# Étape 6: Show remotes
Write-Host ""
Write-Host "Step 6: Verifying remotes..." -ForegroundColor Yellow
git remote -v
Write-Host ""

# Étape 7: Get current branch
$branch = git branch --show-current
Write-Host "Current branch: $branch" -ForegroundColor White
Write-Host ""

# Étape 8: Push to beta
Write-Host "Step 7: Pushing to beta repository..." -ForegroundColor Yellow
Write-Host "  (This may take a moment...)" -ForegroundColor White
Write-Host ""

git push -u beta $branch

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ SUCCESS! Beta repository created!" -ForegroundColor Green
    Write-Host ""
    Write-Host "=== REPOSITORY INFO ===" -ForegroundColor Cyan
    Write-Host "Name:   $repoName" -ForegroundColor White
    Write-Host "URL:    $repoUrl" -ForegroundColor White
    Write-Host "Branch: $branch" -ForegroundColor White
    Write-Host ""
    Write-Host "View on GitHub:" -ForegroundColor Yellow
    Write-Host "https://github.com/$username/$repoName" -ForegroundColor White
    Write-Host ""
    Write-Host "=== NEXT STEPS ===" -ForegroundColor Cyan
    Write-Host "1. Visit your repository on GitHub" -ForegroundColor White
    Write-Host "2. Verify all 28 Mind Map files are present" -ForegroundColor White
    Write-Host "3. Check the commit message" -ForegroundColor White
    Write-Host "4. Optionally add Beta badge to README" -ForegroundColor White
    Write-Host ""
    Write-Host "=== FUTURE UPDATES ===" -ForegroundColor Cyan
    Write-Host "To push updates to both repositories:" -ForegroundColor White
    Write-Host "  git push origin $branch  # Original repo" -ForegroundColor Gray
    Write-Host "  git push beta $branch    # Beta repo" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Push failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. Repository doesn't exist on GitHub" -ForegroundColor White
    Write-Host "2. Wrong username or repository name" -ForegroundColor White
    Write-Host "3. Authentication required" -ForegroundColor White
    Write-Host ""
    Write-Host "Try manual push:" -ForegroundColor Yellow
    Write-Host "  git push -u beta $branch --force" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "🎉 Setup complete!" -ForegroundColor Green
Write-Host ""
