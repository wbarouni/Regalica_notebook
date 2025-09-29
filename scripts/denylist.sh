#!/bin/bash
set -euo pipefail

# DenyList patterns
PATTERNS="TODO|FIXME|PLACEHOLDER|MOCK|DUMMY|FAKE|LOREM|IPSUM|WIP|TBD|SIMULAT|SIMULATION|STUB|HACK|TEMP|PROTOTYPE|SKIP_CI|NO_TEST|FAKE_IT|ELLIPSIS|\.\.\."

# File extensions to scan
EXTENSIONS="js|json|html|css|scss|md|yaml|yml|sh|ts|tsx|jsx"

# Directories to ignore
IGNORE_DIRS=".git|node_modules|dist|build|.angular|coverage|proofs"

# Files to ignore
IGNORE_FILES="*.log|*.png|*.jpg"

echo "Running code quality check..."

# Find files to scan
FILES=$(find . -type f \( -name "*.js" -o -name "*.json" -o -name "*.html" -o -name "*.css" -o -name "*.scss" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" -o -name "*.sh" -o -name "*.ts" -o -name "*.tsx" -o -name "*.jsx" \) | grep -vE "($IGNORE_DIRS)" | grep -vE "($IGNORE_FILES)" | grep -v "./scripts/denylist.sh" || true)

if [ -z "$FILES" ]; then
    echo "No files to scan"
    exit 0
fi

# Check for denylist patterns
MATCHES=$(echo "$FILES" | xargs grep -nE "$PATTERNS" || true)

if [ -n "$MATCHES" ]; then
    echo "DENYLIST VIOLATIONS FOUND:"
    echo "$MATCHES"
    exit 1
fi

echo "Code quality check passed - no violations found"
exit 0
