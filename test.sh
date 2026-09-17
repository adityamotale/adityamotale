#!/usr/bin/env bash
set -euo pipefail

echo "==> Running scripts test suite..."
(cd "$(dirname "$0")/scripts" && npm test)

echo "==> Running website test suite..."
(cd "$(dirname "$0")/website" && npm test)

