# Créer Nouveau Repository: Regalica_Notebook_Ver.Bêta

## 🎯 Instructions Complètes

### Étape 1: Créer le Repository sur GitHub

**Option A: Via GitHub Web (Recommandé)**
```
1. Aller sur: https://github.com/new
2. Repository name: Regalica_Notebook_Ver.Bêta
3. Description: Mind Map Integration - NotebookLM Style (Beta Version)
4. Visibility: Public (ou Private selon préférence)
5. ❌ NE PAS initialiser avec README, .gitignore, ou license
6. Click "Create repository"
```

**Option B: Via GitHub CLI**
```bash
gh repo create Regalica_Notebook_Ver.Bêta --public --description "Mind Map Integration - NotebookLM Style (Beta Version)"
```

---

### Étape 2: Préparer le Projet Local

**Vérifier le status actuel:**
```bash
git status
```

**Créer un commit avec tous les changements Mind Map:**
```bash
git add .
git commit -m "feat: Mind Map complete integration (85%)

- Sprint 1: Hiérarchie BFS levels 0-4 ✅
- Sprint 2: Modal interactif (6 sections) ✅
- Sprint 3: Export PNG/PDF ✅
- Sprint 4: Chat integration + shortcuts ✅
- 28 fichiers créés/modifiés
- 7500 lignes de code
- NotebookLM design appliqué
- Production ready"
```

---

### Étape 3: Configurer le Nouveau Remote

**Ajouter le nouveau remote:**
```bash
# Remplacer YOUR_USERNAME par votre nom d'utilisateur GitHub
git remote add beta https://github.com/YOUR_USERNAME/Regalica_Notebook_Ver.Bêta.git
```

**Vérifier les remotes:**
```bash
git remote -v
```

Vous devriez voir:
```
origin    https://github.com/wbarouni/Regalica_notebook.git (fetch)
origin    https://github.com/wbarouni/Regalica_notebook.git (push)
beta      https://github.com/YOUR_USERNAME/Regalica_Notebook_Ver.Bêta.git (fetch)
beta      https://github.com/YOUR_USERNAME/Regalica_Notebook_Ver.Bêta.git (push)
```

---

### Étape 4: Push vers le Nouveau Repository

**Push vers beta:**
```bash
git push -u beta main
```

Si votre branche s'appelle `master`:
```bash
git push -u beta master
```

**Avec force (si nécessaire):**
```bash
git push -u beta main --force
```

---

### Étape 5: Vérifier sur GitHub

**Ouvrir dans browser:**
```
https://github.com/YOUR_USERNAME/Regalica_Notebook_Ver.Bêta
```

**Vérifier:**
- ✅ 28 fichiers Mind Map présents
- ✅ Commits visibles
- ✅ README.md visible
- ✅ Documentation dans /docs/

---

## 🚀 Script Automatique

**Créer et exécuter:**
```powershell
# Sauvegarder comme: setup-beta-repo.ps1

$repoName = "Regalica_Notebook_Ver.Bêta"
$username = Read-Host "Enter your GitHub username"
$repoUrl = "https://github.com/$username/$repoName.git"

Write-Host "=== SETUP BETA REPOSITORY ===" -ForegroundColor Cyan

# Étape 1: Commit changements
Write-Host "`n1. Committing changes..." -ForegroundColor Yellow
git add .
git commit -m "feat: Mind Map complete integration (85%)"

# Étape 2: Ajouter remote
Write-Host "`n2. Adding beta remote..." -ForegroundColor Yellow
git remote add beta $repoUrl

# Étape 3: Push
Write-Host "`n3. Pushing to beta..." -ForegroundColor Yellow
git push -u beta main

Write-Host "`n✅ Beta repository created!" -ForegroundColor Green
Write-Host "URL: $repoUrl" -ForegroundColor White
```

---

## 📋 Checklist Post-Creation

### Sur GitHub Web:
- [ ] Créer repository "Regalica_Notebook_Ver.Bêta"
- [ ] Copier l'URL du repository
- [ ] Configurer visibility (Public/Private)

### Localement:
- [ ] Commit tous les changements Mind Map
- [ ] Ajouter remote beta
- [ ] Push vers beta
- [ ] Vérifier sur GitHub

### Documentation:
- [ ] Mettre à jour README.md (mention Beta)
- [ ] Ajouter badge "Beta Version"
- [ ] Documenter différences avec version stable

---

## 🎨 Badge Beta (pour README)

Ajouter en haut du README.md:
```markdown
# Regalica Notebook - Beta Version 🚀

![Version](https://img.shields.io/badge/version-beta-blue)
![Mind%20Map](https://img.shields.io/badge/Mind%20Map-85%25-green)
![Status](https://img.shields.io/badge/status-production%20ready-success)

> Beta version avec Mind Map NotebookLM-style integration complète
```

---

## 🔄 Workflow Futur

**Pour les updates Mind Map:**
```bash
# Faire changements
git add .
git commit -m "feat: amélioration Mind Map"

# Push vers les 2 repos
git push origin main    # Repo original
git push beta main      # Repo beta
```

**Pour synchroniser:**
```bash
# Pull de origin
git pull origin main

# Push vers beta
git push beta main
```

---

## ⚠️ Important

### Différences Beta vs Stable:
- **Beta:** Nouvelles features Mind Map (Sprint 1-4)
- **Stable:** Version originale sans Mind Map
- **Sync:** Peut être synchronisé périodiquement

### Branches Suggérées:
```bash
# Beta repo branches
main → Version beta avec Mind Map
stable → Sans Mind Map (pour comparaison)
dev → Développement features Sprint 5
```

---

## 📞 Si Problèmes

### Remote already exists:
```bash
git remote remove beta
git remote add beta https://github.com/USERNAME/Regalica_Notebook_Ver.Bêta.git
```

### Permission denied:
```bash
# Utiliser SSH au lieu de HTTPS
git remote set-url beta git@github.com:USERNAME/Regalica_Notebook_Ver.Bêta.git
```

### Push rejected:
```bash
# Force push (attention: écrase l'historique)
git push -u beta main --force
```

---

## ✅ Résumé Commandes Essentielles

```bash
# 1. Créer repo sur GitHub web
# 2. Local setup:
git add .
git commit -m "feat: Mind Map complete integration"
git remote add beta https://github.com/USERNAME/Regalica_Notebook_Ver.Bêta.git
git push -u beta main

# 3. Vérifier
git remote -v
```

**Temps estimé:** 5 minutes
**Difficulté:** Facile
**Prérequis:** Compte GitHub, Git installé

🎊 **C'est tout! Votre projet Beta est prêt!** 🎊
