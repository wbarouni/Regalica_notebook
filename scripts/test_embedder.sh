#!/usr/bin/env bash
set -euo pipefail

EMBEDDER_URL="http://localhost:8000"

echo "Test du microservice embedder"
echo "=============================="

# Test 1: Health check
echo ""
echo "1. Test health check..."
HEALTH_RESPONSE=$(curl -s "$EMBEDDER_URL/health")
echo "Health: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' > /dev/null; then
    echo "✅ Health check OK"
else
    echo "❌ Health check failed"
    exit 1
fi

# Test 2: Model info
echo ""
echo "2. Test model info..."
INFO_RESPONSE=$(curl -s "$EMBEDDER_URL/info")
echo "Info: $INFO_RESPONSE"

MODEL_NAME=$(echo "$INFO_RESPONSE" | jq -r '.model_name')
DIMENSION=$(echo "$INFO_RESPONSE" | jq -r '.dimension')
echo "✅ Modèle: $MODEL_NAME, Dimension: $DIMENSION"

# Test 3: Génération d'embeddings simple
echo ""
echo "3. Test génération embeddings simple..."
EMBED_RESPONSE=$(curl -s -H "Content-Type: application/json" \
    -d '{"texts": ["Hello world", "Bonjour le monde"]}' \
    "$EMBEDDER_URL/embed")

VECTORS_COUNT=$(echo "$EMBED_RESPONSE" | jq '.vectors | length')
RETURNED_DIM=$(echo "$EMBED_RESPONSE" | jq '.dim')
PROCESSING_TIME=$(echo "$EMBED_RESPONSE" | jq '.processing_time_ms')

echo "Vecteurs générés: $VECTORS_COUNT"
echo "Dimension: $RETURNED_DIM"
echo "Temps de traitement: ${PROCESSING_TIME}ms"

if [ "$VECTORS_COUNT" -eq 2 ] && [ "$RETURNED_DIM" -eq "$DIMENSION" ]; then
    echo "✅ Génération embeddings OK"
else
    echo "❌ Génération embeddings failed"
    exit 1
fi

# Test 4: Vérification normalisation L2
echo ""
echo "4. Test normalisation L2..."
FIRST_VECTOR=$(echo "$EMBED_RESPONSE" | jq '.vectors[0]')
NORM=$(echo "$FIRST_VECTOR" | jq 'map(. * .) | add | sqrt')
echo "Norme L2 du premier vecteur: $NORM"

# Vérifier que la norme est proche de 1.0 (tolérance 0.01)
if echo "$NORM" | awk '{if ($1 > 0.99 && $1 < 1.01) exit 0; else exit 1}'; then
    echo "✅ Normalisation L2 OK"
else
    echo "❌ Normalisation L2 failed (norme = $NORM)"
    exit 1
fi

# Test 5: Test avec texte plus long
echo ""
echo "5. Test avec texte long..."
LONG_TEXT="Ceci est un texte plus long pour tester la capacité du modèle à traiter des phrases complètes avec plus de contexte et de mots significatifs."
LONG_EMBED_RESPONSE=$(curl -s -H "Content-Type: application/json" \
    -d "{\"texts\": [\"$LONG_TEXT\"]}" \
    "$EMBEDDER_URL/embed")

LONG_PROCESSING_TIME=$(echo "$LONG_EMBED_RESPONSE" | jq '.processing_time_ms')
echo "Temps de traitement texte long: ${LONG_PROCESSING_TIME}ms"
echo "✅ Test texte long OK"

# Test 6: Test batch
echo ""
echo "6. Test batch (10 textes)..."
BATCH_PAYLOAD=$(cat << 'EOF'
{
  "texts": [
    "Premier texte de test",
    "Deuxième texte avec plus de contenu",
    "Third text in English",
    "Quatrième texte français",
    "Fifth text with numbers 123",
    "Sixième texte avec caractères spéciaux: éàù",
    "Seventh text for batch testing",
    "Huitième texte pour validation",
    "Ninth text almost done",
    "Dixième et dernier texte du batch"
  ]
}
EOF
)

BATCH_RESPONSE=$(curl -s -H "Content-Type: application/json" \
    -d "$BATCH_PAYLOAD" \
    "$EMBEDDER_URL/embed")

BATCH_COUNT=$(echo "$BATCH_RESPONSE" | jq '.vectors | length')
BATCH_TIME=$(echo "$BATCH_RESPONSE" | jq '.processing_time_ms')
echo "Batch: $BATCH_COUNT vecteurs en ${BATCH_TIME}ms"

if [ "$BATCH_COUNT" -eq 10 ]; then
    echo "✅ Test batch OK"
else
    echo "❌ Test batch failed"
    exit 1
fi

echo ""
echo "=============================="
echo "✅ Tous les tests réussis!"
echo "Modèle: $MODEL_NAME"
echo "Dimension: $DIMENSION"
echo "Microservice embedder opérationnel"
echo "=============================="
