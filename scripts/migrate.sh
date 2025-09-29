#!/usr/bin/env bash
set -euo pipefail

# Charger la configuration
source .env

DIRECTION=${1:-up}

if [ "$DIRECTION" == "up" ]; then
  echo "Running UP migrations..."
  psql $DB_URL -f deploy/sql/0002_ingest_pgvector_up.sql
  echo "UP migrations complete."
elif [ "$DIRECTION" == "down" ]; then
  echo "Running DOWN migrations..."
  psql $DB_URL -f deploy/sql/0002_ingest_pgvector_down.sql
  echo "DOWN migrations complete."
else
  echo "Invalid direction. Use 'up' or 'down'."
  exit 1
fi
