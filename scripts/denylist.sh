#!/usr/bin/env bash
set -euo pipefail
echo "[denylist] scanning…"
EXCLUDES='--glob=!node_modules --glob=!**/dist --glob=!**/build --glob=!.git --glob=!scripts'
PATTERN='TODO|FIXME|PLACEHOLDER|MOCK|MOCKUP|LOREM|IPSUM|DUMMY|FAKE|SIMULAT|TBD|WIP|\.{3}'
if rg -n --hidden $EXCLUDES -e "$PATTERN" . ; then
  echo "❌ Patterns interdits trouvés."
  exit 1
else
  echo "✅ Denylist OK"
fi
