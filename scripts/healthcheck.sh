#!/bin/bash
set -euo pipefail

LOGFILE="proofs/healthcheck.log"
mkdir -p proofs

echo "Starting healthcheck at $(date)" > "$LOGFILE"

# Function to check service with timeout
check_service() {
    local name="$1"
    local url="$2"
    local timeout="${3:-10}"
    
    echo "Verifying $name..." | tee -a "$LOGFILE"
    
    if timeout "$timeout" bash -c "until curl -sf '$url' > /dev/null 2>&1; do sleep 1; done"; then
        echo "✓ $name is healthy" | tee -a "$LOGFILE"
        return 0
    else
        echo "✗ $name is not responding" | tee -a "$LOGFILE"
        return 1
    fi
}

# Check all services
FAILED=0

check_service "Frontend" "http://localhost:4200/" 15 || FAILED=1
check_service "Backend" "http://localhost:8080/health/ready" 10 || FAILED=1

# Check PostgreSQL
echo "Verifying PostgreSQL..." | tee -a "$LOGFILE"
if timeout 10 bash -c "until pg_isready -h localhost -p 5432 -U regalica -d regalica > /dev/null 2>&1; do sleep 1; done"; then
    echo "✓ PostgreSQL is healthy" | tee -a "$LOGFILE"
else
    echo "✗ PostgreSQL is not responding" | tee -a "$LOGFILE"
    FAILED=1
fi

# Check Redis
echo "Verifying Redis..." | tee -a "$LOGFILE"
if timeout 10 bash -c "until redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; do sleep 1; done"; then
    echo "✓ Redis is healthy" | tee -a "$LOGFILE"
else
    echo "✗ Redis is not responding" | tee -a "$LOGFILE"
    FAILED=1
fi

check_service "Ollama" "http://localhost:11434/api/tags" 15 || FAILED=1

echo "Healthcheck completed at $(date)" >> "$LOGFILE"

if [ $FAILED -eq 0 ]; then
    echo "All services are healthy" | tee -a "$LOGFILE"
    exit 0
else
    echo "Some services are not healthy" | tee -a "$LOGFILE"
    exit 1
fi
