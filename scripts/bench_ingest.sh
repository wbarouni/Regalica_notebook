#!/usr/bin/env bash
set -euo pipefail

FILE_PATH=${1:?"Usage: $0 <path_to_file>"}

if [ ! -f "$FILE_PATH" ]; then
  echo "File not found: $FILE_PATH"
  exit 1
fi

API_URL="http://localhost:8080/ingest/upload"

echo "Starting benchmark for: $FILE_PATH"

START_TIME=$(date +%s%3N)

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -F "file=@$FILE_PATH" "$API_URL")

END_TIME=$(date +%s%3N)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
JSON_BODY=$(echo "$RESPONSE" | sed '$d')

TOTAL_TIME=$((END_TIME - START_TIME))

echo "----------------------------------------"
echo "Benchmark Results"
echo "----------------------------------------"
echo "HTTP Status: $HTTP_STATUS"
echo "Total Time: ${TOTAL_TIME}ms"
echo ""
echo "API Response:"
echo "$JSON_BODY" | jq
echo "----------------------------------------"

if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "Benchmark FAILED"
  exit 1
else
  echo "Benchmark PASSED"
fi
