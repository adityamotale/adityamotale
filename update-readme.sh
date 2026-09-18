#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Updating README.md from data/github-stats.json..."
node "$ROOT_DIR/scripts/generate-readme.ts"
echo "==> README.md successfully updated!"
