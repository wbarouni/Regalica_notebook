#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Validation complète du Bloc 3 - Pipeline RAG Avancée"

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

# Variables de configuration
BACKEND_URL="http://localhost:8080"
FRONTEND_URL="http://localhost:4200"
EMBEDDER_URL="http://localhost:8001"
RERANKER_URL="http://localhost:8002"

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

# Fonction de test avec sortie
run_test_with_output() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo "Testing: $test_name"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

log_section "1. Vérification des Services de Base"

# Vérifier que les services sont accessibles
run_test "Backend Health Check" "curl -sf $BACKEND_URL/health/ready"
run_test "Frontend Accessibility" "curl -sf $FRONTEND_URL"

log_section "2. Vérification des Microservices"

# Vérifier les microservices (si accessibles)
if curl -sf http://localhost:8001/health > /dev/null 2>&1; then
    run_test "Embedder Service Health" "curl -sf http://localhost:8001/health"
else
    log_warn "Embedder service not accessible (Docker internal network)"
fi

if curl -sf http://localhost:8002/health > /dev/null 2>&1; then
    run_test "Reranker Service Health" "curl -sf http://localhost:8002/health"
else
    log_warn "Reranker service not accessible (Docker internal network)"
fi

log_section "3. Validation de la Structure des Fichiers"

# Vérifier la présence des fichiers clés du Bloc 3
files_to_check=(
    "reranker/Dockerfile"
    "reranker/app.py"
    "reranker/requirements.txt"
    "backend/src/rag/query.js"
    "backend/src/rag/rerank.js"
    "backend/src/rag/synthesize.js"
    "backend/src/rag/routes.js"
    "frontend/src/app/chat/chat.component.ts"
    "frontend/src/app/chat/chat.component.html"
    "frontend/src/app/services/rag.service.ts"
    "deploy/sql/0003_rag_logs_up.sql"
    "scripts/test_rag.sh"
    "frontend/tests/e2e/chat.spec.ts"
    "proofs/bloc3-report.md"
)

for file in "${files_to_check[@]}"; do
    run_test "File exists: $file" "test -f $file"
done

log_section "4. Validation des Endpoints RAG"

# Tester les endpoints RAG
run_test_with_output "RAG Query Endpoint" "curl -sf -X POST -H 'Content-Type: application/json' -d '{\"query\": \"test\", \"top_k\": 5}' $BACKEND_URL/rag/query | jq ."

run_test_with_output "RAG Answer Endpoint" "curl -sf -X POST -H 'Content-Type: application/json' -d '{\"query\": \"test question\", \"top_k\": 5}' $BACKEND_URL/rag/answer | jq ."

run_test "RAG Stats Endpoint" "curl -sf $BACKEND_URL/rag/stats"

log_section "5. Validation des Erreurs"

# Tester la gestion d'erreurs
run_test "Empty Query Validation" "curl -sf -X POST -H 'Content-Type: application/json' -d '{\"query\": \"\"}' $BACKEND_URL/rag/query | grep -q 'INVALID_QUERY'"

run_test "Invalid top_k Validation" "curl -sf -X POST -H 'Content-Type: application/json' -d '{\"query\": \"test\", \"top_k\": 0}' $BACKEND_URL/rag/query | grep -q 'INVALID_TOP_K'"

log_section "6. Validation de la Configuration"

# Vérifier les variables d'environnement dans la configuration
config_checks=(
    "grep -q 'ragTopK' backend/src/config/index.js"
    "grep -q 'ragCitationsMin' backend/src/config/index.js"
    "grep -q 'rerankerApiUrl' backend/src/config/index.js"
    "grep -q 'llmApiUrl' backend/src/config/index.js"
    "grep -q 'RAG_TOP_K' .env.example"
    "grep -q 'RERANKER_API_URL' .env.example"
    "grep -q 'LLM_MODEL_NAME' .env.example"
)

for check in "${config_checks[@]}"; do
    run_test "Config check: $check" "$check"
done

log_section "7. Validation Docker Compose"

# Vérifier que les services sont définis dans docker-compose
docker_checks=(
    "grep -q 'reranker:' deploy/docker/docker-compose.yml"
    "grep -q 'reranker_cache:' deploy/docker/docker-compose.yml"
    "grep -q 'RERANKER_API_URL' deploy/docker/docker-compose.yml"
    "grep -q 'LLM_API_URL' deploy/docker/docker-compose.yml"
)

for check in "${docker_checks[@]}"; do
    run_test "Docker config: $check" "$check"
done

log_section "8. Validation des Migrations SQL"

# Vérifier les migrations
run_test "Migration UP exists" "test -f deploy/sql/0003_rag_logs_up.sql"
run_test "Migration DOWN exists" "test -f deploy/sql/0003_rag_logs_down.sql"
run_test "Migration contains rag_logs table" "grep -q 'CREATE TABLE.*rag_logs' deploy/sql/0003_rag_logs_up.sql"

log_section "9. Validation des Tests"

# Vérifier que les scripts de test sont exécutables
test_scripts=(
    "scripts/test_rag.sh"
    "scripts/validate_bloc3.sh"
)

for script in "${test_scripts[@]}"; do
    run_test "Script executable: $script" "test -x $script"
done

# Vérifier les tests Playwright
run_test "Playwright chat tests exist" "test -f frontend/tests/e2e/chat.spec.ts"
run_test "Chat tests contain required scenarios" "grep -q 'should display chat interface correctly' frontend/tests/e2e/chat.spec.ts"

log_section "10. Test de Performance Rapide"

# Test de performance basique
echo "Measuring RAG query performance..."
start_time=$(date +%s%N)
if curl -sf -X POST -H 'Content-Type: application/json' -d '{"query": "performance test", "top_k": 10}' $BACKEND_URL/rag/query > /dev/null; then
    end_time=$(date +%s%N)
    duration_ms=$(( (end_time - start_time) / 1000000 ))
    log_info "RAG query latency: ${duration_ms}ms"
    
    if [ $duration_ms -lt 5000 ]; then
        echo -e "${GREEN}✅ Performance acceptable (<5s)${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${YELLOW}⚠️  Performance lente (>5s)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
fi

log_section "11. Validation du Frontend Angular"

# Vérifier la structure Angular
angular_checks=(
    "grep -q 'ChatComponent' frontend/src/app/app.component.ts"
    "grep -q 'activeTab.*chat' frontend/src/app/app.component.ts"
    "grep -q 'data-testid=\"chat-tab\"' frontend/src/app/app.component.html"
    "grep -q 'RagService' frontend/src/app/services/rag.service.ts"
    "grep -q 'citations' frontend/src/app/chat/chat.component.ts"
)

for check in "${angular_checks[@]}"; do
    run_test "Angular check: $check" "$check"
done

log_section "Résumé de la Validation"

echo -e "\n📊 ${BLUE}Résultats des Tests:${NC}"
echo -e "   Total: $TOTAL_TESTS"
echo -e "   ${GREEN}Réussis: $PASSED_TESTS${NC}"
echo -e "   ${RED}Échoués: $FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}Tous les tests sont passés! Le Bloc 3 est validé.${NC}"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}$FAILED_TESTS test(s) ont échoué. Vérifiez les erreurs ci-dessus.${NC}"
    exit 1
fi
