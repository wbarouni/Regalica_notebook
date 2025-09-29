#!/usr/bin/env bash
set -euo pipefail

echo "[test_rag] Tests E2E de la pipeline RAG"

# Configuration
BACKEND_URL="http://localhost:8080"
TEST_QUERY="Quel est le contenu principal du document ?"
TOP_K=10

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Fonction de test HTTP
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo "Testing: $description"
    
    local response
    local status_code
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BACKEND_URL$endpoint")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BACKEND_URL$endpoint")
    fi
    
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [ "$status_code" -eq "$expected_status" ]; then
        log_info "✅ $description - Status: $status_code"
        echo "$body" | jq . 2>/dev/null || echo "$body"
        return 0
    else
        log_error "❌ $description - Expected: $expected_status, Got: $status_code"
        echo "$body"
        return 1
    fi
}

# Vérifier que le backend est accessible
echo "🔍 Vérification de l'accessibilité du backend..."
if ! curl -s "$BACKEND_URL/health/ready" > /dev/null; then
    log_error "Backend non accessible à $BACKEND_URL"
    log_error "Assurez-vous que le backend est démarré avec 'make up'"
    exit 1
fi

log_info "Backend accessible ✅"

# Test 1: Endpoint de santé
echo -e "\n📋 Test 1: Health Check"
test_endpoint "GET" "/health/ready" "" 200 "Health check endpoint"

# Test 2: Test de requête RAG avec query vide (doit échouer)
echo -e "\n📋 Test 2: Requête vide (validation)"
test_endpoint "POST" "/rag/query" '{"query": ""}' 400 "Query endpoint with empty query"

# Test 3: Test de requête RAG avec query valide
echo -e "\n📋 Test 3: Requête valide"
test_endpoint "POST" "/rag/query" "{\"query\": \"$TEST_QUERY\", \"top_k\": $TOP_K}" 200 "Query endpoint with valid query"

# Test 4: Test de génération de réponse avec query vide (doit échouer)
echo -e "\n📋 Test 4: Génération de réponse avec query vide"
test_endpoint "POST" "/rag/answer" '{"query": ""}' 400 "Answer endpoint with empty query"

# Test 5: Test de génération de réponse avec query valide
echo -e "\n📋 Test 5: Génération de réponse complète"
log_info "⏳ Ce test peut prendre du temps (reranking + LLM)..."

start_time=$(date +%s)
if test_endpoint "POST" "/rag/answer" "{\"query\": \"$TEST_QUERY\", \"top_k\": $TOP_K}" 200 "Answer endpoint with valid query"; then
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    log_info "⏱️  Temps de traitement: ${duration}s"
fi

# Test 6: Test avec paramètres avancés
echo -e "\n📋 Test 6: Requête avec paramètres avancés"
test_endpoint "POST" "/rag/query" '{"query": "test", "top_k": 5, "lang": "fr"}' 200 "Query with advanced parameters"

# Test 7: Test avec top_k invalide (doit échouer)
echo -e "\n📋 Test 7: Paramètre top_k invalide"
test_endpoint "POST" "/rag/query" '{"query": "test", "top_k": 0}' 400 "Query with invalid top_k"

# Test 8: Test avec top_k trop élevé (doit échouer)
echo -e "\n📋 Test 8: Paramètre top_k trop élevé"
test_endpoint "POST" "/rag/query" '{"query": "test", "top_k": 300}' 400 "Query with too high top_k"

# Test 9: Statistiques RAG
echo -e "\n📋 Test 9: Statistiques RAG"
test_endpoint "GET" "/rag/stats" "" 200 "RAG statistics endpoint"

# Test 10: Test de performance avec requêtes multiples
echo -e "\n📋 Test 10: Test de performance (5 requêtes)"
total_time=0
success_count=0

for i in {1..5}; do
    echo "Requête $i/5..."
    start_time=$(date +%s)
    
    if curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"Question $i: Que contient ce document ?\", \"top_k\": 10}" \
        "$BACKEND_URL/rag/query" > /dev/null; then
        
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        total_time=$((total_time + duration))
        success_count=$((success_count + 1))
        log_info "  ✅ Requête $i: ${duration}s"
    else
        log_error "  ❌ Requête $i: échec"
    fi
done

if [ $success_count -gt 0 ]; then
    avg_time=$((total_time / success_count))
    log_info "📊 Performance: $success_count/5 réussies, temps moyen: ${avg_time}s"
else
    log_error "📊 Aucune requête n'a réussi"
fi

# Test 11: Test de détection de langue
echo -e "\n📋 Test 11: Détection de langue"
test_endpoint "POST" "/rag/query" '{"query": "What is the main content?"}' 200 "English query"
test_endpoint "POST" "/rag/query" '{"query": "Quel est le contenu principal ?"}' 200 "French query"

# Test 12: Test de robustesse avec caractères spéciaux
echo -e "\n📋 Test 12: Caractères spéciaux et Unicode"
test_endpoint "POST" "/rag/query" '{"query": "Test avec émojis 🚀 et caractères spéciaux: àéîôù"}' 200 "Query with special characters"

echo -e "\n🎯 Tests E2E terminés!"
echo "📝 Vérifiez les logs du backend pour plus de détails sur le traitement interne."
echo "🔍 Utilisez 'docker-compose logs backend' pour voir les logs détaillés."
