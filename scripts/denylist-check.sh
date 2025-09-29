#!/bin/bash

# Denylist CI Gate - Validation stricte selon spécifications
# Patterns interdits: mock|placeholder|simulate|lorem|\.\.\.|localhost|127\.0\.0\.1|onrender\.com

set -e

echo "🔍 Denylist CI Gate - Validation des patterns interdits"
echo "=================================================="

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteur d'erreurs
ERROR_COUNT=0

# Patterns interdits selon spécifications strictes
DENYLIST_PATTERNS=(
    "mock"
    "placeholder" 
    "simulate"
    "lorem"
    "\.\.\."
    "localhost"
    "127\.0\.0\.1"
    "onrender\.com"
)

# Fichiers à exclure de la vérification
EXCLUDE_PATTERNS=(
    "node_modules/"
    ".git/"
    "dist/"
    "coverage/"
    "test-results/"
    "playwright-report/"
    ".nyc_output/"
    "*.log"
    "*.lock"
    "*.min.js"
    "*.map"
    "denylist-check.sh"  # Exclure ce script lui-même
    "README.md"          # Exclure la documentation
    "DEPLOYMENT.md"
    "CI-WORKFLOW.md"
    "*.spec.ts"          # Exclure les tests E2E qui peuvent contenir des exemples
    "playwright.config.ts"
)

# Construire la commande find avec exclusions
FIND_CMD="find . -type f \( -name '*.ts' -o -name '*.js' -o -name '*.json' -o -name '*.md' -o -name '*.yml' -o -name '*.yaml' \)"

for exclude in "${EXCLUDE_PATTERNS[@]}"; do
    FIND_CMD="$FIND_CMD ! -path '*/$exclude*' ! -name '$exclude'"
done

echo "📁 Fichiers analysés:"
eval $FIND_CMD | head -10
echo "   ... (et autres)"
echo ""

# Vérification de chaque pattern interdit
for pattern in "${DENYLIST_PATTERNS[@]}"; do
    echo "🔎 Vérification du pattern: $pattern"
    
    # Recherche avec grep, en excluant les fichiers spécifiés
    MATCHES=$(eval $FIND_CMD -exec grep -l -i "$pattern" {} \; 2>/dev/null || true)
    
    if [ -n "$MATCHES" ]; then
        echo -e "${RED}❌ ERREUR: Pattern '$pattern' trouvé dans:${NC}"
        
        # Afficher les détails des matches
        while IFS= read -r file; do
            if [ -n "$file" ]; then
                echo -e "   ${RED}📄 $file${NC}"
                
                # Afficher les lignes contenant le pattern
                grep -n -i --color=always "$pattern" "$file" | head -3 | while IFS= read -r line; do
                    echo -e "      ${YELLOW}$line${NC}"
                done
                
                ERROR_COUNT=$((ERROR_COUNT + 1))
            fi
        done <<< "$MATCHES"
        echo ""
    else
        echo -e "${GREEN}✅ Pattern '$pattern' - OK${NC}"
    fi
done

echo "=================================================="

# Vérifications supplémentaires spécifiques
echo "🔍 Vérifications supplémentaires:"

# Vérifier les URLs hardcodées suspectes
echo "🌐 Vérification des URLs hardcodées..."
HARDCODED_URLS=$(eval $FIND_CMD -exec grep -l "http://\|https://" {} \; 2>/dev/null | xargs grep -n "http://\|https://" 2>/dev/null | grep -v "example.com\|github.com\|vercel.app\|api\." || true)

if [ -n "$HARDCODED_URLS" ]; then
    echo -e "${YELLOW}⚠️  URLs potentiellement hardcodées trouvées:${NC}"
    echo "$HARDCODED_URLS" | head -5
    echo ""
fi

# Vérifier les TODO/FIXME non résolus
echo "📝 Vérification des TODO/FIXME..."
TODOS=$(eval $FIND_CMD -exec grep -l "TODO\|FIXME\|XXX" {} \; 2>/dev/null || true)

if [ -n "$TODOS" ]; then
    echo -e "${YELLOW}⚠️  TODO/FIXME trouvés (à résoudre avant production):${NC}"
    echo "$TODOS" | head -3
    echo ""
fi

# Vérifier les console.log en production
echo "🖥️  Vérification des console.log..."
CONSOLE_LOGS=$(eval $FIND_CMD -name "*.ts" -o -name "*.js" -exec grep -l "console\.log\|console\.debug" {} \; 2>/dev/null || true)

if [ -n "$CONSOLE_LOGS" ]; then
    echo -e "${YELLOW}⚠️  console.log trouvés (à nettoyer pour production):${NC}"
    echo "$CONSOLE_LOGS" | head -3
    echo ""
fi

# Résultat final
echo "=================================================="
if [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${GREEN}🎉 SUCCÈS: Aucun pattern interdit trouvé!${NC}"
    echo -e "${GREEN}✅ Denylist CI Gate: PASSED${NC}"
    exit 0
else
    echo -e "${RED}💥 ÉCHEC: $ERROR_COUNT violation(s) de denylist trouvée(s)${NC}"
    echo -e "${RED}❌ Denylist CI Gate: FAILED${NC}"
    echo ""
    echo "🔧 Actions requises:"
    echo "   1. Supprimer ou remplacer les patterns interdits"
    echo "   2. Utiliser la configuration runtime au lieu du hardcoding"
    echo "   3. Implémenter des solutions réelles au lieu de mocks/placeholders"
    echo "   4. Relancer ce script après corrections"
    exit 1
fi
