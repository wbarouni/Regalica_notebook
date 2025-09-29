#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Validation de la configuration Render"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Compteurs de tests
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Fonction de test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

log_section "1. Validation de la Structure render.yaml"

# Vérifier que le fichier render.yaml existe
run_test "render.yaml exists" "test -f render.yaml"

# Vérifier la structure des services
run_test "Backend service defined" "grep -q 'name: regalica-backend' render.yaml"
run_test "Embedder service defined" "grep -q 'name: regalica-embedder' render.yaml"
run_test "Frontend service defined" "grep -q 'name: regalica-frontend' render.yaml"
run_test "Database defined" "grep -q 'name: regalica-db' render.yaml"

log_section "2. Validation Backend Service"

# Vérifier les configurations backend
run_test "Backend healthCheckPath correct" "grep -q 'healthCheckPath: /health/ready' render.yaml"
run_test "Backend uses SERVER_PORT" "grep -q 'key: SERVER_PORT' render.yaml"
run_test "Backend has EMBED_API_URL" "grep -q 'key: EMBED_API_URL' render.yaml"
run_test "Backend has EMBED_MODEL_NAME" "grep -q 'key: EMBED_MODEL_NAME' render.yaml"
run_test "Backend has RAG variables" "grep -q 'key: RAG_TOP_K' render.yaml"
run_test "Backend plan is starter" "grep -A5 'name: regalica-backend' render.yaml | grep -q 'plan: starter'"

log_section "3. Validation Embedder Service"

# Vérifier les configurations embedder
run_test "Embedder runtime is python" "grep -A10 'name: regalica-embedder' render.yaml | grep -q 'runtime: python'"
run_test "Embedder has correct rootDir" "grep -A10 'name: regalica-embedder' render.yaml | grep -q 'rootDir: ./embedder'"
run_test "Embedder has uvicorn startCommand" "grep -A10 'name: regalica-embedder' render.yaml | grep -q 'uvicorn app:app'"
run_test "Embedder healthCheckPath correct" "grep -A15 'name: regalica-embedder' render.yaml | grep -q 'healthCheckPath: /health'"

log_section "4. Validation Frontend Service"

# Vérifier les configurations frontend
run_test "Frontend type is static" "grep -B2 -A3 'name: regalica-frontend' render.yaml | grep -q 'type: static'"
run_test "Frontend has correct staticPublishPath" "grep -A10 'name: regalica-frontend' render.yaml | grep -q 'staticPublishPath: ./dist/regalica-frontend/browser'"
run_test "Frontend has security headers" "grep -A20 'name: regalica-frontend' render.yaml | grep -q 'X-Frame-Options'"
run_test "Frontend has SPA routing" "grep -A25 'name: regalica-frontend' render.yaml | grep -q 'destination: /index.html'"

log_section "5. Validation Variables d'Environnement"

# Vérifier les variables dans .env.example
run_test "EMBED_API_URL in .env.example" "grep -q 'EMBED_API_URL=' .env.example"
run_test "EMBED_MODEL_NAME in .env.example" "grep -q 'EMBED_MODEL_NAME=' .env.example"
run_test "RAG_TOP_K in .env.example" "grep -q 'RAG_TOP_K=' .env.example"
run_test "RERANKER_API_URL in .env.example" "grep -q 'RERANKER_API_URL=' .env.example"
run_test "LLM_API_URL in .env.example" "grep -q 'LLM_API_URL=' .env.example"

log_section "6. Validation Configuration Backend"

# Vérifier que le backend utilise les bonnes variables
run_test "Backend config has embedApiUrl" "grep -q 'embedApiUrl' backend/src/config/index.js"
run_test "Backend config has embedModelName" "grep -q 'embedModelName' backend/src/config/index.js"
run_test "Backend config has RAG variables" "grep -q 'ragTopK' backend/src/config/index.js"

log_section "7. Validation Fichiers Microservices"

# Vérifier que les fichiers des microservices existent
run_test "Embedder Dockerfile exists" "test -f embedder/Dockerfile"
run_test "Embedder app.py exists" "test -f embedder/app.py"
run_test "Embedder requirements.txt exists" "test -f embedder/requirements.txt"

log_section "8. Validation Documentation"

# Vérifier que la documentation est à jour
run_test "README mentions Render deployment" "grep -q 'Déploiement sur Render' README.md"
run_test "README mentions EMBED_API_URL" "grep -q 'EMBED_API_URL' README.md"
run_test "README mentions microservice embedder" "grep -q 'Microservice Embedder' README.md"

log_section "9. Validation Nettoyage Branches"

# Vérifier que bloc2 n'existe plus
run_test "bloc2 branch deleted locally" "! git branch | grep -q bloc2"
run_test "bloc2 branch deleted remotely" "! git branch -r | grep -q origin/bloc2"

log_section "10. Validation Syntaxe YAML"

# Vérifier la syntaxe YAML (si yq est disponible)
if command -v yq > /dev/null 2>&1; then
    run_test "render.yaml syntax valid" "yq eval . render.yaml > /dev/null"
else
    log_warn "yq not available, skipping YAML syntax validation"
fi

# Vérifier avec Python (fallback)
if command -v python3 > /dev/null 2>&1; then
    run_test "render.yaml parseable" "python3 -c 'import yaml; yaml.safe_load(open(\"render.yaml\"))'"
else
    log_warn "Python not available, skipping YAML parsing validation"
fi

log_section "Résumé de la Validation"

echo -e "\n📊 ${BLUE}Résultats des Tests:${NC}"
echo -e "   Total: $TOTAL_TESTS"
echo -e "   ${GREEN}Réussis: $PASSED_TESTS${NC}"
echo -e "   ${RED}Échoués: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}Tous les tests sont passés! La configuration Render est valide.${NC}"
    echo -e "\n📋 ${BLUE}Prochaines étapes:${NC}"
    echo -e "   1. Connecter le repository à Render"
    echo -e "   2. Les services se déploieront automatiquement"
    echo -e "   3. Vérifier les logs de déploiement"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}$FAILED_TESTS test(s) ont échoué. Vérifiez les erreurs ci-dessus.${NC}"
    exit 1
fi
