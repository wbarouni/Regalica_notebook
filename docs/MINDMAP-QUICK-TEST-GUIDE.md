# Mind Map - Guide de Test Rapide

**Date:** 10 Octobre 2025  
**Objectif:** Tester le Mind Map dans l'UI sans casser l'interface originale

---

## ✅ PRÉ-REQUIS

Vérifier que tout compile:
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (nouveau terminal)
cd frontend
npm install
ng serve
```

**Statut attendu:**
- ✅ Backend compile sans erreurs
- ✅ Frontend compile sans erreurs
- ✅ Aucun warning TypeScript critique

---

## 🎯 TEST 1: Voir le Mind Map

### Étape 1: Accéder à Magic Studio
```
1. Ouvrir http://localhost:4200
2. Se connecter (si nécessaire)
3. Cliquer sur "Magic Studio" dans la navigation
   OU aller directement à: http://localhost:4200/magic-studio
```

### Étape 2: Générer un Mind Map
```
1. Sur la page Magic Studio, vous êtes sur l'onglet "Actions"
2. Cliquer sur "Open Mind Map" button
3. OU naviguer vers: http://localhost:4200/magic-studio?tab=mindmap
```

**Résultat attendu:**
- ✅ Page Mind Map s'affiche
- ✅ Canvas visible (zone blanche/grise)
- ✅ Message "Generate Mind Map" ou Mind Map vide

### Étape 3: Tester avec du contenu
```
1. Retourner au Chat
2. Poser une question avec des sources (ex: "What is machine learning?")
3. Attendre la réponse avec citations
4. Retourner à Magic Studio → Mind Map
5. Le Mind Map devrait se générer automatiquement
```

**Résultat attendu:**
- ✅ Nodes colorés apparaissent
- ✅ Connexions entre nodes visibles
- ✅ Couleurs NotebookLM (Violet/Bleu/Vert/Lavande)
- ✅ Layout force-directed (nodes espacés)

---

## 🎯 TEST 2: Tester le Modal Interactif

### Étape 1: Cliquer sur un Node
```
1. Sur le Mind Map, cliquer sur n'importe quel node (rectangle coloré)
```

**Résultat attendu:**
- ✅ Modal s'ouvre avec animation (slideIn)
- ✅ Header avec titre du node et level badge
- ✅ Bouton close (×) en haut à droite

### Étape 2: Explorer les Sections
```
Dans le modal, vérifier:
1. 📋 Résumé Détaillé → Texte AI généré
2. 📚 Sources → Liste des citations
3. 🔗 Concepts Connexes → Nodes reliés
4. ❓ Questions Suggérées → 5 questions AI
5. 💬 Chat → Textarea + bouton Send
```

**Résultat attendu:**
- ✅ Toutes sections visibles
- ✅ Loading spinner au début
- ✅ Contenu chargé après 1-2 secondes
- ✅ Boutons fonctionnels

### Étape 3: Tester la Navigation
```
1. Dans "Concepts Connexes", cliquer sur un node relié
2. Modal devrait se fermer
3. Nouveau modal s'ouvre après 300ms
4. Affiche le contexte du node cliqué
```

**Résultat attendu:**
- ✅ Transition smooth entre modals
- ✅ Nouveau contexte chargé
- ✅ Aucune erreur console

### Étape 4: Fermer le Modal
```
Options pour fermer:
1. Cliquer sur le bouton ×
2. Cliquer en dehors du modal (overlay)
3. Naviguer vers un autre node
```

**Résultat attendu:**
- ✅ Modal se ferme avec animation
- ✅ Mind Map toujours visible
- ✅ Peut rouvrir en cliquant sur un node

---

## 🎯 TEST 3: Tester la Navigation

### Test A: Query Params
```
1. Ouvrir: http://localhost:4200/magic-studio?tab=mindmap
```

**Résultat attendu:**
- ✅ S'ouvre directement sur Mind Map tab
- ✅ Pas besoin de cliquer "Open Mind Map"

### Test B: Browser Navigation
```
1. Aller sur Mind Map
2. Cliquer browser back button
3. Cliquer browser forward button
```

**Résultat attendu:**
- ✅ Back: Retourne à l'onglet précédent
- ✅ Forward: Revient au Mind Map
- ✅ Refresh: Garde l'onglet actif

---

## 🎯 TEST 4: Vérifier l'Interface Originale

### Test de Non-Régression
```
Vérifier que tout fonctionne toujours:

1. ✅ Chat → Envoyer message → Reçoit réponse
2. ✅ Sources → Sidebar affiche sources
3. ✅ Citations → Inline citations cliquables
4. ✅ Notebooks → Liste/Create/Switch fonctionnent
5. ✅ Magic Studio → Autres tabs (Actions, Podcast) fonctionnent
6. ✅ Settings → Configuration accessible
```

**Résultat attendu:**
- ✅ Aucune feature cassée
- ✅ Aucune erreur console
- ✅ Tout l'UI original intact

---

## 🐛 TROUBLESHOOTING

### Problème 1: Mind Map ne s'affiche pas
```bash
# Vérifier console browser (F12)
# Rechercher erreurs TypeScript

# Solution:
cd frontend
npm install
ng serve --poll=2000
```

### Problème 2: Modal ne s'ouvre pas
```bash
# Vérifier que context-routes.js existe:
ls backend/src/studio/context-routes.js

# Vérifier backend logs:
cd backend
npm run dev
# Chercher: [Context] Getting context for node
```

### Problème 3: Erreur "Cannot find module"
```bash
# Réinstaller dependencies:
cd frontend
rm -rf node_modules package-lock.json
npm install

cd ../backend
rm -rf node_modules package-lock.json
npm install
```

### Problème 4: Couleurs pas visibles
```bash
# Vérifier SCSS compilé:
# Ouvrir DevTools → Elements → Inspecter node
# Vérifier styles appliqués

# Si problème, rebuild:
cd frontend
ng serve --configuration=development
```

---

## 📸 CAPTURES D'ÉCRAN ATTENDUES

### 1. Mind Map Initial
```
┌─────────────────────────────────────┐
│  Magic Studio         [Back]        │
├─────────────────────────────────────┤
│                                     │
│      🟣 Central Node                │
│     /  |  |  \                      │
│    🔵 🔵 🔵 🔵  Level 2              │
│   / \  |  |  / \                    │
│  🟢 🟢 🟢 🟢 🟢 🟢  Level 3          │
│                                     │
│  [Rounded rectangles avec          │
│   couleurs NotebookLM]             │
└─────────────────────────────────────┘
```

### 2. Node Modal Ouvert
```
┌─────────────────────────────────────┐
│  [Overlay dark 50%]                 │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🟣 Concept Name        [×]    │  │
│  │ 15 chunks • 3 sources         │  │
│  ├───────────────────────────────┤  │
│  │ 📋 Résumé Détaillé           │  │
│  │ AI generated summary text... │  │
│  │ [Voir plus]                  │  │
│  │                              │  │
│  │ 📚 Sources (3)               │  │
│  │ [Citation cards]             │  │
│  │                              │  │
│  │ ❓ Questions Suggérées       │  │
│  │ [5 clickable questions]      │  │
│  │                              │  │
│  │ 💬 Poser une Question        │  │
│  │ [Textarea] [Envoyer]         │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## ✅ CHECKLIST FINALE

### Avant de déclarer succès:

**Visuel:**
- [ ] Mind Map s'affiche avec couleurs
- [ ] Nodes sont rounded rectangles
- [ ] Connexions visibles entre nodes
- [ ] Layout espacé (pas de overlap)

**Interactions:**
- [ ] Click sur node → Modal s'ouvre
- [ ] Modal a toutes les sections
- [ ] Close button fonctionne
- [ ] Click overlay ferme modal

**Navigation:**
- [ ] URL ?tab=mindmap fonctionne
- [ ] Browser back/forward fonctionnent
- [ ] Refresh garde l'état

**Non-Régression:**
- [ ] Chat fonctionne toujours
- [ ] Sources sidebar intact
- [ ] Notebooks fonctionnent
- [ ] Autres Magic Studio tabs OK

**Performance:**
- [ ] Aucune erreur console
- [ ] Pas de memory leaks
- [ ] Responsive (resize window)

---

## 🎉 RÉSULTAT FINAL

Si tous les tests passent:
```
✅ Sprint 1: Mind Map Hiérarchique - FONCTIONNEL
✅ Sprint 2: Modal Interactif - FONCTIONNEL
✅ Sprint 4: Navigation - FONCTIONNEL
✅ Interface originale - INTACTE

🎊 Mind Map prêt pour utilisation!
```

---

## 📞 SUPPORT

**Si problème persiste:**
1. Vérifier console browser (F12)
2. Vérifier backend logs
3. Redémarrer both servers
4. Clear cache & reload (Ctrl+Shift+R)

**Commandes rapides:**
```bash
# Restart tout
pkill -f node
cd backend && npm run dev &
cd frontend && ng serve &
```

**Test minimal:**
```
1. http://localhost:4200/magic-studio?tab=mindmap
2. Mind Map devrait être visible
3. Click sur node → Modal s'ouvre
```

**Si ça fonctionne:** ✅ Tout est bon!  
**Si ça ne fonctionne pas:** Vérifier troubleshooting ci-dessus.
