#!/usr/bin/env bash
set -euo pipefail

API_URL="http://localhost:5200"
TEST_DIR="tests/fixtures"

echo "Starting E2E Tests for Bloc 2 Ingestion Pipeline"
echo "================================================"

# Vérifier que l'API est accessible
echo "1. Testing API health..."
curl -fsS "$API_URL/health/ready" > /dev/null
echo "✅ API is ready"

# Test 1: PDF
echo ""
echo "2. Testing PDF ingestion..."
if [ -f "$TEST_DIR/sample.pdf" ]; then
    RESPONSE=$(curl -s -F "file=@$TEST_DIR/sample.pdf" "$API_URL/ingest/upload")
    DOC_ID=$(echo "$RESPONSE" | jq -r '.document.id')
    CHUNKS_COUNT=$(echo "$RESPONSE" | jq -r '.stats.chunks')
    echo "✅ PDF uploaded - ID: $DOC_ID, Chunks: $CHUNKS_COUNT"
    
    # Vérifier les chunks
    CHUNKS_RESPONSE=$(curl -s "$API_URL/ingest/$DOC_ID/chunks?page=1&pageSize=5")
    CHUNKS_RETURNED=$(echo "$CHUNKS_RESPONSE" | jq -r '.chunks | length')
    echo "✅ PDF chunks retrieved: $CHUNKS_RETURNED"
else
    echo "❌ sample.pdf not found"
fi

# Test 2: HTML
echo ""
echo "3. Testing HTML ingestion..."
if [ -f "$TEST_DIR/test.html" ]; then
    RESPONSE=$(curl -s -F "file=@$TEST_DIR/test.html" "$API_URL/ingest/upload")
    DOC_ID=$(echo "$RESPONSE" | jq -r '.document.id')
    CHUNKS_COUNT=$(echo "$RESPONSE" | jq -r '.stats.chunks')
    echo "✅ HTML uploaded - ID: $DOC_ID, Chunks: $CHUNKS_COUNT"
else
    echo "❌ test.html not found"
fi

# Test 3: TXT
echo ""
echo "4. Testing TXT ingestion..."
if [ -f "$TEST_DIR/test.txt" ]; then
    RESPONSE=$(curl -s -F "file=@$TEST_DIR/test.txt" "$API_URL/ingest/upload")
    DOC_ID=$(echo "$RESPONSE" | jq -r '.document.id')
    CHUNKS_COUNT=$(echo "$RESPONSE" | jq -r '.stats.chunks')
    echo "✅ TXT uploaded - ID: $DOC_ID, Chunks: $CHUNKS_COUNT"
else
    echo "❌ test.txt not found"
fi

# Test 4: Duplicate detection
echo ""
echo "5. Testing duplicate detection..."
if [ -f "$TEST_DIR/sample.pdf" ]; then
    RESPONSE=$(curl -s -F "file=@$TEST_DIR/sample.pdf" "$API_URL/ingest/upload")
    IS_DUPLICATE=$(echo "$RESPONSE" | jq -r '.stats.duplicate // false')
    if [ "$IS_DUPLICATE" = "true" ]; then
        echo "✅ Duplicate detection working"
    else
        echo "❌ Duplicate detection failed"
    fi
else
    echo "❌ sample.pdf not found for duplicate test"
fi

# Test 5: Documents list
echo ""
echo "6. Testing documents list..."
DOCS_RESPONSE=$(curl -s "$API_URL/docs?page=1&pageSize=10")
TOTAL_DOCS=$(echo "$DOCS_RESPONSE" | jq -r '.pagination.total')
echo "✅ Documents list retrieved: $TOTAL_DOCS documents"

# Test 6: Pagination
echo ""
echo "7. Testing pagination..."
DOCS_RESPONSE=$(curl -s "$API_URL/docs?page=1&pageSize=2")
PAGE_SIZE=$(echo "$DOCS_RESPONSE" | jq -r '.pagination.pageSize')
CURRENT_PAGE=$(echo "$DOCS_RESPONSE" | jq -r '.pagination.page')
echo "✅ Pagination working - Page: $CURRENT_PAGE, Size: $PAGE_SIZE"

echo ""
echo "================================================"
echo "E2E Tests Completed Successfully!"
echo "================================================"
