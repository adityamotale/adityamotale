#!/usr/bin/env bash
set -euo pipefail

echo "==> Running mdparser test suite..."
(cd "$(dirname "$0")/mdparser" && npm test)

echo "==> Running scripts test suite..."
(cd "$(dirname "$0")/scripts" && npm test)

echo "==> Running website test suite..."
(cd "$(dirname "$0")/website" && npm test)

