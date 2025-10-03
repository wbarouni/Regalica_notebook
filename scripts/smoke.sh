#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] wait backend…"
for i in {1..40}; do
  curl -fsS http://localhost:5200/health/ready && break
  sleep 2
  [[ $i -eq 40 ]] && { echo "backend KO"; exit 1; }
done

echo "[smoke] upload sample.pdf"
SRC_JSON=$(curl -fsS -F file=@tests/fixtures/sample.pdf http://localhost:5200/sources)
echo "$SRC_JSON"
SRC_ID=$(echo "$SRC_JSON" | jq -r .source_id)

echo "[smoke] ask chat"
curl -fsS -H 'Content-Type: application/json' \
  -d "{\"message\":\"Quel est le titre ?\",\"source_id\":\"$SRC_ID\"}" \
  http://localhost:5200/chat/ask | tee /tmp/smoke.json

jq -e '.answer' /tmp/smoke.json >/dev/null
echo "✅ smoke OK"
