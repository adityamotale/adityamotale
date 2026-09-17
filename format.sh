#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-write}"

if [[ "$MODE" == "--check" || "$MODE" == "-c" || "$MODE" == "check" ]]; then
  echo "==> Checking code formatting (mdparser)..."
  (cd "$ROOT_DIR/mdparser" && npm run format:check)

  echo "==> Checking code formatting (website)..."
  (cd "$ROOT_DIR/website" && npm run format:check)

  echo "==> Checking code formatting (scripts)..."
  (cd "$ROOT_DIR/scripts" && npm run format:check)

  echo "==> All formatting checks passed!"
else
  echo "==> Formatting code (mdparser)..."
  (cd "$ROOT_DIR/mdparser" && npm run format)

  echo "==> Formatting code (website)..."
  (cd "$ROOT_DIR/website" && npm run format)

  echo "==> Formatting code (scripts)..."
  (cd "$ROOT_DIR/scripts" && npm run format)

  echo "==> Code formatting complete!"
fi
