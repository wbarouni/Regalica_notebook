#!/bin/bash
set -euo pipefail

LOGFILE="proofs/first-run.log"
mkdir -p proofs

echo "Starting first-run setup at $(date)" > "$LOGFILE"

# Pull and start all services
echo "Downloading Docker images..." | tee -a "$LOGFILE"
docker compose -f deploy/docker/docker-compose.yml pull

echo "Starting services..." | tee -a "$LOGFILE"
docker compose -f deploy/docker/docker-compose.yml up -d

# Wait for Ollama to be ready
echo "Awaiting Ollama readiness..." | tee -a "$LOGFILE"
timeout 120 bash -c 'until curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; do echo "Awaiting Ollama..."; sleep 5; done' || {
    echo "Ollama failed to start within timeout" | tee -a "$LOGFILE"
    exit 1
}

echo "Ollama ready, downloading models..." | tee -a "$LOGFILE"

# Pull required models
echo "Downloading qwen2:7b-instruct..." | tee -a "$LOGFILE"
curl -s http://localhost:11434/api/pull -d '{"name":"qwen2:7b-instruct"}' | tee -a "$LOGFILE"

echo "Downloading olmo:7b-instruct..." | tee -a "$LOGFILE"
curl -s http://localhost:11434/api/pull -d '{"name":"olmo:7b-instruct"}' | tee -a "$LOGFILE"

# Verify models are available
echo "Validating available models..." | tee -a "$LOGFILE"
curl -s http://localhost:11434/api/tags > proofs/ollama-tags.json

if grep -q "qwen2:7b-instruct" proofs/ollama-tags.json && grep -q "olmo:7b-instruct" proofs/ollama-tags.json; then
    echo "✓ All required models are available" | tee -a "$LOGFILE"
else
    echo "✗ Some models are missing" | tee -a "$LOGFILE"
    cat proofs/ollama-tags.json | tee -a "$LOGFILE"
fi

# Run healthcheck
echo "Executing healthcheck..." | tee -a "$LOGFILE"
./scripts/healthcheck.sh

echo "First-run setup completed at $(date)" >> "$LOGFILE"
echo "Setup complete! Check proofs/first-run.log for details."
